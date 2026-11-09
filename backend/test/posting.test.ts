import { describe, it, expect, vi } from "vitest";
import { postTransaction, reverseTransaction } from "../src/accounting/posting";
import { buildJournalLines, validateBalanced } from "../src/accounting/engine";
import type { TransactionRow } from "../src/repositories/transactions";
import type { AccountRow } from "../src/repositories/accounts";

interface TrackedStatement {
  sql: string;
  params: unknown[];
}

function makeDb() {
  const batches: TrackedStatement[][] = [];
  const tables = {
    journal_entries: [] as Record<string, unknown>[],
    journal_lines: [] as Record<string, unknown>[],
    transactions: new Map<number, Record<string, unknown>>(),
  };
  let nextId = 100;
  let journalRowId = 1;

  const db = {
    batch: vi.fn(async (stmts: TrackedStatement[]) => {
      batches.push(stmts);
      for (const s of stmts) {
        const sql = s.sql;
        if (sql.startsWith("INSERT INTO journal_entries")) {
          // params: journal_number, entry_date, description, txid, txid, debit, credit, user
          tables.journal_entries.push({
            id: journalRowId,
            journal_number: s.params[0],
            total_debit: s.params[5],
            total_credit: s.params[6],
          });
          nextId = journalRowId;
          journalRowId++;
        } else if (sql.startsWith("INSERT INTO journal_lines")) {
          tables.journal_lines.push({
            journal_number: s.params[0],
            account_id: s.params[1],
            description: s.params[2],
            debit: s.params[3],
            credit: s.params[4],
            line_number: s.params[5],
          });
        } else if (sql.startsWith("UPDATE transactions")) {
          // status = 'diposting' or 'dibatalkan'
          if (sql.includes("status = 'diposting'")) tables.transactions.set(s.params[1] as number, { status: "diposting", posted_by: s.params[0] });
          if (sql.includes("status = 'dibatalkan'")) tables.transactions.set(s.params[1] as number, { status: "dibatalkan", reversed_by: s.params[0] });
        } else {
          throw new Error(`Unexpected batch statement: ${sql.slice(0, 60)}`);
        }
      }
    }),
    prepare: vi.fn((sql: string) => {
      const stmt = {
        sql,
        params: [] as unknown[],
        bind: vi.fn((...args: unknown[]) => {
          const bound = {
            sql,
            params: args,
            first: vi.fn(async () => {
              if (sql.includes("SELECT id FROM journal_entries WHERE journal_number")) {
                const found = tables.journal_entries.find(
                  (e) => e.journal_number === args[0]
                );
                return found ? { id: found.id } : null;
              }
              return null;
            }),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ meta: { last_row_id: nextId++ } })),
          };
          return bound;
        }),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: { last_row_id: nextId++ } })),
      };
      return stmt;
    }),
  };

  return { db, batches, tables };
}

// postTransaction reads `first` for the existing-journal check via prepare().bind().first()
// We simulate: no existing journal initially.

function tx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 7, transaction_number: "TX-2026-0007", transaction_type: "penerimaan",
    wakif_id: 1, category_id: 1, payment_method: "tunai", rekening: null,
    amount: 1_000_000, description: "wakaf uang", transaction_date: "2026-03-01",
    status: "disetujui", attachment_url: null, rejection_reason: null, is_reversed: 0,
    created_by: 2, submitted_at: null, submitted_by: null, approved_at: null, approved_by: null,
    rejected_at: null, rejected_by: null, posted_at: null, posted_by: null,
    reversed_at: null, reversed_by: null, created_at: "", updated_at: "",
    ...overrides,
  };
}

const accounts: AccountRow[] = [
  { id: 1, code: "111", name: "Kas", account_type: "aset", parent_id: null, is_active: 1, description: null, created_at: "", updated_at: "" },
  { id: 2, code: "112", name: "Bank", account_type: "aset", parent_id: null, is_active: 1, description: null, created_at: "", updated_at: "" },
  { id: 3, code: "120", name: "Aset Wakaf Nonkas", account_type: "aset", parent_id: null, is_active: 1, description: null, created_at: "", updated_at: "" },
  { id: 4, code: "411-6", name: "Aset Wakaf (Neto)", account_type: "aset_neto", parent_id: null, is_active: 1, description: null, created_at: "", updated_at: "" },
  { id: 12, code: "4-1000", name: "Pendapatan Wakaf Uang", account_type: "pendapatan", parent_id: null, is_active: 1, description: null, created_at: "", updated_at: "" },
];

const categoryAccount = accounts.find((a) => a.id === 12)!;

describe("postTransaction", () => {
  it("inserts journal + lines + status update in a single atomic batch", async () => {
    const { db, batches, tables } = makeDb();
    const result = await postTransaction(db as never, tx(), accounts, categoryAccount, "JV-2026-0001", 4);
    expect(result.idempotent).toBe(false);
    expect(batches).toHaveLength(1);
    const batch = batches[0]!;
    // 1 journal + 2 lines + 1 update = 4 statements, all in ONE batch (atomic)
    expect(batch).toHaveLength(4);
    expect(batch[0]!.sql).toContain("INSERT INTO journal_entries");
    expect(batch[1]!.sql).toContain("INSERT INTO journal_lines");
    expect(batch[2]!.sql).toContain("INSERT INTO journal_lines");
    expect(batch[3]!.sql).toContain("UPDATE transactions");
    expect(batch[3]!.sql).toContain("status = 'diposting'");

    // journal totals balanced
    const entry = tables.journal_entries[0]!;
    expect(entry.total_debit).toBe(1_000_000);
    expect(entry.total_credit).toBe(1_000_000);
    // lines balanced
    const lines = tables.journal_lines;
    expect(lines.reduce((s, l) => s + (l.debit as number), 0)).toBe(
      lines.reduce((s, l) => s + (l.credit as number), 0)
    );
    // transaction updated
    expect(tables.transactions.get(7)).toMatchObject({ status: "diposting", posted_by: 4 });
  });

  it("is idempotent: returns existing journal when already posted", async () => {
    const { db, batches } = makeDb();
    // simulate existing journal
    (db.prepare as unknown as { mockImplementation: (fn: unknown) => unknown }).mockImplementation((sql: string) => {
      if (sql.includes("SELECT id, journal_number FROM journal_entries WHERE transaction_id")) {
        return {
          sql,
          bind: () => ({
            first: async () => ({ id: 42, journal_number: "JV-2026-0042" }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { last_row_id: 42 } }),
          }),
        };
      }
      return {
        sql,
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      };
    });
    const result = await postTransaction(db as never, tx({ status: "diposting" }), accounts, categoryAccount, "JV-2026-9999", 4);
    expect(result.idempotent).toBe(true);
    expect(result.journal_id).toBe(42);
    expect(result.journal_number).toBe("JV-2026-0042");
    // no second batch ran
    expect(batches).toHaveLength(0);
  });

  it("throws when category account is missing", async () => {
    const { db } = makeDb();
    await expect(
      postTransaction(db as never, tx(), accounts, null, "JV-2026-0002", 4)
    ).rejects.toThrow(/no category/);
  });
});

describe("reverseTransaction", () => {
  it("creates reversing journal with swapped lines and cancels transaction", async () => {
    const { db, batches, tables } = makeDb();
    // provide original journal lines for reversal
    (db.prepare as unknown as { mockImplementation: (fn: unknown) => unknown }).mockImplementation((sql: string) => {
      if (sql.includes("SELECT id FROM journal_entries WHERE journal_number")) {
        return {
          sql,
          bind: (...args: unknown[]) => ({
            sql,
            params: args,
            first: async () => ({ id: 99 }),
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { last_row_id: 99 } }),
          }),
        };
      }
      if (sql.includes("FROM journal_lines jl JOIN accounts a")) {
        return {
          sql,
          bind: (...args: unknown[]) => ({
            sql,
            params: args,
            first: async () => null,
            all: async () => ({
              results: [
                { account_id: 1, account_code: "111", account_name: "Kas", description: "d", debit: 1_000_000, credit: 0 },
                { account_id: 12, account_code: "4-1000", account_name: "Pendapatan Wakaf Uang", description: "d", debit: 0, credit: 1_000_000 },
              ],
            }),
            run: async () => ({ meta: { last_row_id: 1 } }),
          }),
        };
      }
      return {
        sql,
        bind: (...args: unknown[]) => ({
          sql,
          params: args,
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      };
    });
    const result = await reverseTransaction(db as never, tx({ status: "diposting" }), accounts, categoryAccount, "JV-2026-0005", 4);
    expect(result.journal_number).toBe("JV-2026-0005");
    expect(batches).toHaveLength(1);
    const batch = batches[0]!;
    // 1 journal + 2 reversed lines + 1 status update
    expect(batch).toHaveLength(4);
    // lines swapped in place: Kas line (was Dr) becomes Cr; Pendapatan (was Cr) becomes Dr
    const reversedLines = tables.journal_lines;
    expect(reversedLines[0]).toMatchObject({ account_id: 1, debit: 0, credit: 1_000_000 });
    expect(reversedLines[1]).toMatchObject({ account_id: 12, debit: 1_000_000, credit: 0 });
    // transaction set dibatalkan + is_reversed
    const updateSql = batch[3]!.sql;
    expect(updateSql).toContain("status = 'dibatalkan'");
    expect(updateSql).toContain("is_reversed = 1");
    expect(tables.transactions.get(7)).toMatchObject({ status: "dibatalkan", reversed_by: 4 });
  });

  it("refuses to reverse a non-posted transaction", async () => {
    const { db } = makeDb();
    await expect(
      reverseTransaction(db as never, tx({ status: "disetujui" }), accounts, categoryAccount, "JV-1", 4)
    ).rejects.toThrow(/Only posted/);
  });
});

describe("post/reverse symmetry with engine", () => {
  it("reversal of a posted journal nets to zero", () => {
    const t = tx();
    const lines = buildJournalLines(t, categoryAccount, accounts);
    validateBalanced(lines);
    // simulate the reversal path used in reverseTransaction
    const reversed = lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
    validateBalanced(reversed);
    const netDebit = lines.reduce((s, l) => s + l.debit, 0) - reversed.reduce((s, l) => s + l.debit, 0);
    const netCredit = lines.reduce((s, l) => s + l.credit, 0) - reversed.reduce((s, l) => s + l.credit, 0);
    expect(netDebit).toBe(0);
    expect(netCredit).toBe(0);
  });
});

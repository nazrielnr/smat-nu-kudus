import { describe, it, expect } from "vitest";
import {
  validateBalanced,
  buildJournalLines,
  journalTotals,
  reverseLines,
  isDebitPositive,
  computeRunningBalance,
  type JournalLineSpec,
} from "../src/accounting/engine";
import type { AccountRow } from "../src/repositories/accounts";
import type { TransactionRow } from "../src/repositories/transactions";

function acc(id: number, code: string, name: string, type: AccountRow["account_type"]): AccountRow {
  return {
    id, code, name, account_type: type, parent_id: null, is_active: 1,
    description: null, created_at: "", updated_at: "",
  };
}

const accounts: AccountRow[] = [
  acc(1, "111", "Kas", "aset"),
  acc(2, "112", "Bank", "aset"),
  acc(3, "120", "Aset Wakaf Nonkas", "aset"),
  acc(4, "411-6", "Aset Wakaf (Neto)", "aset_neto"),
  acc(12, "4-1000", "Pendapatan Wakaf Uang", "pendapatan"),
  acc(14, "5-1000", "Beban Penyaluran Manfaat", "beban"),
];

function tx(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    id: 1, transaction_number: "TX-2026-0001", transaction_type: "penerimaan",
    wakif_id: null, category_id: 1, payment_method: "tunai", rekening: null,
    amount: 1_000_000, description: null, transaction_date: "2026-01-15",
    status: "draft", attachment_url: null, rejection_reason: null, is_reversed: 0,
    created_by: 2, submitted_at: null, submitted_by: null, approved_at: null,
    approved_by: null, rejected_at: null, rejected_by: null, posted_at: null,
    posted_by: null, reversed_at: null, reversed_by: null,
    created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("validateBalanced", () => {
  it("accepts a balanced journal", () => {
    const lines: JournalLineSpec[] = [
      { account_id: 1, debit: 500, credit: 0 },
      { account_id: 12, debit: 0, credit: 500 },
    ];
    expect(() => validateBalanced(lines)).not.toThrow();
  });

  it("rejects unbalanced debit != credit", () => {
    const lines: JournalLineSpec[] = [
      { account_id: 1, debit: 500, credit: 0 },
      { account_id: 12, debit: 0, credit: 400 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/not balanced/);
  });

  it("rejects single-line journals", () => {
    expect(() => validateBalanced([{ account_id: 1, debit: 100, credit: 0 }])).toThrow(/at least 2 lines/);
  });

  it("rejects lines with both debit and credit", () => {
    const lines: JournalLineSpec[] = [
      { account_id: 1, debit: 100, credit: 100 },
      { account_id: 12, debit: 100, credit: 0 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/both/);
  });

  it("rejects zero totals", () => {
    const lines: JournalLineSpec[] = [
      { account_id: 1, debit: 0, credit: 0 },
      { account_id: 12, debit: 0, credit: 0 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/zero/);
  });
});

describe("buildJournalLines", () => {
  it("cash penerimaan: Dr Kas, Cr Pendapatan", () => {
    const lines = buildJournalLines(
      tx({ amount: 1_000_000, payment_method: "tunai" }),
      accounts.find((a) => a.id === 12)!,
      accounts
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ account_id: 1, debit: 1_000_000, credit: 0 });
    expect(lines[1]).toMatchObject({ account_id: 12, debit: 0, credit: 1_000_000 });
    validateBalanced(lines);
  });

  it("transfer penerimaan: Dr Bank (not Kas)", () => {
    const lines = buildJournalLines(
      tx({ payment_method: "transfer", rekening: "BSI 123", amount: 2_000_000 }),
      accounts.find((a) => a.id === 12)!,
      accounts
    );
    expect(lines[0]).toMatchObject({ account_id: 2, debit: 2_000_000 });
    expect(lines[1]).toMatchObject({ account_id: 12, credit: 2_000_000 });
    validateBalanced(lines);
  });

  it("noncash asset penerimaan: Dr Aset Nonkas, Cr Aset Neto Wakaf", () => {
    const lines = buildJournalLines(
      tx({ payment_method: "aset_nonkas", amount: 5_000_000 }),
      accounts.find((a) => a.id === 12)!,
      accounts
    );
    expect(lines[0]).toMatchObject({ account_id: 3, debit: 5_000_000 });
    expect(lines[1]).toMatchObject({ account_id: 4, credit: 5_000_000 });
    validateBalanced(lines);
  });

  it("pengeluaran: Dr Beban (category), Cr Kas", () => {
    const lines = buildJournalLines(
      tx({ transaction_type: "pengeluaran", amount: 750_000 }),
      accounts.find((a) => a.id === 14)!,
      accounts
    );
    expect(lines[0]).toMatchObject({ account_id: 14, debit: 750_000 });
    expect(lines[1]).toMatchObject({ account_id: 1, credit: 750_000 });
    validateBalanced(lines);
  });
});

describe("journalTotals and reversal", () => {
  it("totals sum debit and credit", () => {
    const lines = buildJournalLines(tx({}), accounts.find((a) => a.id === 12)!, accounts);
    const totals = journalTotals(lines);
    expect(totals.total_debit).toBe(1_000_000);
    expect(totals.total_credit).toBe(1_000_000);
  });

  it("reversal swaps debit and credit and stays balanced", () => {
    const lines = buildJournalLines(tx({ amount: 3_000_000 }), accounts.find((a) => a.id === 12)!, accounts);
    const reversed = reverseLines(lines);
    expect(reversed[0]).toMatchObject({ debit: 0, credit: 3_000_000 });
    expect(reversed[1]).toMatchObject({ debit: 3_000_000, credit: 0 });
    validateBalanced(reversed);
    const totals = journalTotals(reversed);
    expect(totals.total_debit).toBe(totals.total_credit);
  });

  it("double reversal returns to original", () => {
    const lines = buildJournalLines(tx({}), accounts.find((a) => a.id === 12)!, accounts);
    const back = reverseLines(reverseLines(lines));
    expect(back.map((l) => [l.debit, l.credit])).toEqual(lines.map((l) => [l.debit, l.credit]));
  });
});

describe("ledger running balance", () => {
  it("accumulates debit-positive for asset accounts", () => {
    const rows = [
      { account_id: 1, account_code: "111", account_name: "Kas", account_type: "aset" as const,
        entry_date: "2026-01-01", journal_number: "JV-1", journal_id: 1, description: null, debit: 100, credit: 0 },
      { account_id: 1, account_code: "111", account_name: "Kas", account_type: "aset" as const,
        entry_date: "2026-01-02", journal_number: "JV-2", journal_id: 2, description: null, debit: 0, credit: 30 },
      { account_id: 1, account_code: "111", account_name: "Kas", account_type: "aset" as const,
        entry_date: "2026-01-03", journal_number: "JV-3", journal_id: 3, description: null, debit: 10, credit: 0 },
    ];
    const out = computeRunningBalance(0, rows);
    expect(out.map((r) => r.running_balance)).toEqual([100, 70, 80]);
  });
});

describe("account sign convention", () => {
  it("aset and beban are debit-positive", () => {
    expect(isDebitPositive("aset")).toBe(true);
    expect(isDebitPositive("beban")).toBe(true);
  });
  it("liabilitas, aset_neto, pendapatan are credit-positive", () => {
    expect(isDebitPositive("liabilitas")).toBe(false);
    expect(isDebitPositive("aset_neto")).toBe(false);
    expect(isDebitPositive("pendapatan")).toBe(false);
  });
});

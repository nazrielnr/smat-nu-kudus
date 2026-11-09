import type { D1Database } from "@cloudflare/workers-types";
import type { TransactionRow } from "../repositories/transactions";
import type { AccountRow } from "../repositories/accounts";
import {
  buildJournalLines, journalTotals, reverseLines, validateBalanced,
  type JournalSpec, type JournalLineSpec,
} from "./engine";

export interface PostResult {
  journal_id: number;
  journal_number: string;
  idempotent: boolean;
}

/**
 * Atomically post a transaction:
 * 1. Check current status (diposting → return existing journal, idempotent)
 * 2. Build journal lines via accounting engine
 * 3. Validate balance
 * 4. D1 batch: insert journal_entries + journal_lines + update transaction
 */
export async function postTransaction(
  db: D1Database,
  tx: TransactionRow,
  accounts: AccountRow[],
  categoryAccount: AccountRow | null,
  journalNumber: string,
  userId: number
): Promise<PostResult> {
  // Idempotency: already posted → return existing journal
  const existing = await db
    .prepare(
      "SELECT id, journal_number FROM journal_entries WHERE transaction_id = ? AND source_type = 'transaction_post' ORDER BY id LIMIT 1"
    )
    .bind(tx.id)
    .first<{ id: number; journal_number: string }>();
  if (tx.status === "diposting" || tx.status === "dibatalkan" || existing) {
    if (existing) return { journal_id: existing.id, journal_number: existing.journal_number, idempotent: true };
  }

  if (!categoryAccount) {
    throw new Error("Transaction has no category with a default account");
  }

  const lines: JournalLineSpec[] = buildJournalLines(tx, categoryAccount, accounts);
  validateBalanced(lines);
  const totals = journalTotals(lines);

  const insertJournal = db
    .prepare(
      `INSERT INTO journal_entries
       (journal_number, entry_date, description, source_type, source_transaction_id, transaction_id,
        total_debit, total_credit, status, posted_at, created_by)
       VALUES (?, ?, ?, 'transaction_post', ?, ?, ?, ?, 'posted', datetime('now'), ?)`
    )
    .bind(
      journalNumber, tx.transaction_date,
      `Auto journal for transaction ${tx.transaction_number}`,
      tx.id, tx.id, totals.total_debit, totals.total_credit, userId
    );

  const lineStatements = lines.map((l, i) =>
    db
      .prepare(
        `INSERT INTO journal_lines (journal_id, account_id, description, debit, credit, line_number)
         VALUES ((SELECT id FROM journal_entries WHERE journal_number = ?), ?, ?, ?, ?, ?)`
      )
      .bind(journalNumber, l.account_id, l.description ?? null, l.debit, l.credit, i + 1)
  );

  const updateTx = db
    .prepare(
      `UPDATE transactions SET status = 'diposting', posted_at = datetime('now'), posted_by = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(userId, tx.id);

  await db.batch([insertJournal, ...lineStatements, updateTx]);

  const created = await db
    .prepare("SELECT id FROM journal_entries WHERE journal_number = ?")
    .bind(journalNumber)
    .first<{ id: number }>();
  return { journal_id: created!.id, journal_number: journalNumber, idempotent: false };
}

/**
 * Reverse a posted transaction: create a reversing journal (swap debit/credit)
 * and set transaction status to dibatalkan.
 */
export async function reverseTransaction(
  db: D1Database,
  tx: TransactionRow,
  accounts: AccountRow[],
  categoryAccount: AccountRow | null,
  journalNumber: string,
  userId: number
): Promise<{ journal_id: number; journal_number: string }> {
  if (tx.status !== "diposting") {
    throw new Error("Only posted transactions can be reversed");
  }

  const originalLines = await db
    .prepare(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_id = (SELECT id FROM journal_entries WHERE transaction_id = ? AND source_type = 'transaction_post' ORDER BY id LIMIT 1)
       ORDER BY jl.line_number`
    )
    .bind(tx.id)
    .all<JournalLineSpec & { journal_id: number; id: number; created_at: string }>();

  const rawLines: JournalLineSpec[] = (originalLines.results ?? []).map((l) => ({
    account_id: l.account_id,
    account_code: l.account_code,
    account_name: l.account_name,
    description: l.description,
    debit: l.debit,
    credit: l.credit,
  }));

  const lines = reverseLines(rawLines);
  validateBalanced(lines);
  const totals = journalTotals(lines);

  const insertJournal = db
    .prepare(
      `INSERT INTO journal_entries
       (journal_number, entry_date, description, source_type, source_transaction_id, transaction_id,
        total_debit, total_credit, status, posted_at, created_by)
       VALUES (?, ?, ?, 'transaction_reversal', ?, ?, ?, ?, 'posted', datetime('now'), ?)`
    )
    .bind(
      journalNumber, new Date().toISOString().slice(0, 10),
      `Reversal journal for transaction ${tx.transaction_number}`,
      tx.id, tx.id, totals.total_debit, totals.total_credit, userId
    );

  const lineStatements = lines.map((l, i) =>
    db
      .prepare(
        `INSERT INTO journal_lines (journal_id, account_id, description, debit, credit, line_number)
         VALUES ((SELECT id FROM journal_entries WHERE journal_number = ?), ?, ?, ?, ?, ?)`
      )
      .bind(journalNumber, l.account_id, l.description ?? null, l.debit, l.credit, i + 1)
  );

  const updateTx = db
    .prepare(
      `UPDATE transactions SET status = 'dibatalkan', is_reversed = 1, reversed_at = datetime('now'), reversed_by = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(userId, tx.id);

  await db.batch([insertJournal, ...lineStatements, updateTx]);

  const created = await db
    .prepare("SELECT id FROM journal_entries WHERE journal_number = ?")
    .bind(journalNumber)
    .first<{ id: number }>();
  return { journal_id: created!.id, journal_number: journalNumber };
}

export function buildSpecForTest(
  journalNumber: string,
  tx: TransactionRow,
  accounts: AccountRow[],
  categoryAccount: AccountRow
): JournalSpec {
  const lines = buildJournalLines(tx, categoryAccount, accounts);
  validateBalanced(lines);
  return {
    journal_number: journalNumber,
    entry_date: tx.transaction_date,
    description: `Auto journal for transaction ${tx.transaction_number}`,
    source_type: "transaction_post",
    source_transaction_id: tx.id,
    transaction_id: tx.id,
    lines,
  };
}

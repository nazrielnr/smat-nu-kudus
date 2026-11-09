import type { D1Database } from "@cloudflare/workers-types";

export interface JournalEntryRow {
  id: number;
  journal_number: string;
  entry_date: string;
  description: string | null;
  source_type: "manual" | "transaction_post" | "transaction_reversal";
  source_transaction_id: number | null;
  transaction_id: number | null;
  total_debit: number;
  total_credit: number;
  status: "draft" | "posted";
  posted_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JournalLineRow {
  id: number;
  journal_id: number;
  account_id: number;
  description: string | null;
  debit: number;
  credit: number;
  line_number: number;
}

export interface JournalFilter {
  date_from?: string;
  date_to?: string;
  status?: string;
  q?: string;
  limit: number;
  offset: number;
}

export function journalsRepo(db: D1Database) {
  async function findById(id: number): Promise<JournalEntryRow | null> {
    return db
      .prepare("SELECT * FROM journal_entries WHERE id = ?")
      .bind(id)
      .first<JournalEntryRow>();
  }

  async function findByTransactionAndType(transactionId: number, sourceType: string): Promise<JournalEntryRow | null> {
    return db
      .prepare(
        "SELECT * FROM journal_entries WHERE transaction_id = ? AND source_type = ? ORDER BY id DESC LIMIT 1"
      )
      .bind(transactionId, sourceType)
      .first<JournalEntryRow>();
  }

  async function lines(journalId: number): Promise<JournalLineRow[]> {
    const r = await db
      .prepare(
        `SELECT jl.*, a.code AS account_code, a.name AS account_name
         FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
         WHERE jl.journal_id = ? ORDER BY jl.line_number, jl.id`
      )
      .bind(journalId)
      .all<JournalLineRow>();
    return r.results ?? [];
  }

  async function list(f: JournalFilter): Promise<{ items: JournalEntryRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.date_from) { where.push("entry_date >= ?"); params.push(f.date_from); }
    if (f.date_to) { where.push("entry_date <= ?"); params.push(f.date_to); }
    if (f.status) { where.push("status = ?"); params.push(f.status); }
    if (f.q) { where.push("(journal_number LIKE ? OR description LIKE ?)"); params.push(`%${f.q}%`, `%${f.q}%`); }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM journal_entries WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const r = await db
      .prepare(`SELECT * FROM journal_entries WHERE ${whereSql} ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...params, f.limit, f.offset)
      .all<JournalEntryRow>();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  async function countByYear(year: number): Promise<number> {
    const r = await db
      .prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE journal_number LIKE ?")
      .bind(`JV-${year}-%`)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }

  async function setStatus(id: number, status: "draft" | "posted"): Promise<void> {
    await db
      .prepare(
        `UPDATE journal_entries SET status = ?, posted_at = CASE WHEN ? = 'posted' THEN datetime('now') ELSE posted_at END, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(status, status, id)
      .run();
  }

  return { findById, findByTransactionAndType, lines, list, countByYear, setStatus };
}

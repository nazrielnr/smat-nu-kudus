import type { D1Database } from "@cloudflare/workers-types";

export type TransactionStatus =
  | "draft"
  | "menunggu_persetujuan"
  | "disetujui"
  | "ditolak"
  | "diposting"
  | "dibatalkan";

export type TransactionType = "penerimaan" | "pengeluaran";

export interface TransactionRow {
  id: number;
  transaction_number: string;
  transaction_type: TransactionType;
  wakif_id: number | null;
  category_id: number | null;
  payment_method: string | null;
  rekening: string | null;
  amount: number;
  description: string | null;
  transaction_date: string;
  status: TransactionStatus;
  attachment_url: string | null;
  rejection_reason: string | null;
  is_reversed: number;
  created_by: number;
  submitted_at: string | null;
  submitted_by: number | null;
  approved_at: string | null;
  approved_by: number | null;
  rejected_at: string | null;
  rejected_by: number | null;
  posted_at: string | null;
  posted_by: number | null;
  reversed_at: string | null;
  reversed_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionFilter {
  type?: string;
  status?: string;
  category_id?: number;
  wakif_id?: number;
  date_from?: string;
  date_to?: string;
  q?: string;
  limit: number;
  offset: number;
}

const SELECT_TX = `
  SELECT t.*, w.name AS wakif_name, c.name AS category_name,
         cu.name AS created_by_name, au.name AS approved_by_name
  FROM transactions t
  LEFT JOIN wakif w ON w.id = t.wakif_id
  LEFT JOIN transaction_categories c ON c.id = t.category_id
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users au ON au.id = t.approved_by
`;

export function transactionsRepo(db: D1Database) {
  async function findById(id: number): Promise<TransactionRow | null> {
    return db
      .prepare(`${SELECT_TX} WHERE t.id = ?`)
      .bind(id)
      .first<TransactionRow>();
  }

  async function list(f: TransactionFilter): Promise<{ items: TransactionRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.type) { where.push("t.transaction_type = ?"); params.push(f.type); }
    if (f.status) { where.push("t.status = ?"); params.push(f.status); }
    if (f.category_id !== undefined) { where.push("t.category_id = ?"); params.push(f.category_id); }
    if (f.wakif_id !== undefined) { where.push("t.wakif_id = ?"); params.push(f.wakif_id); }
    if (f.date_from) { where.push("t.transaction_date >= ?"); params.push(f.date_from); }
    if (f.date_to) { where.push("t.transaction_date <= ?"); params.push(f.date_to); }
    if (f.q) {
      where.push("(t.description LIKE ? OR t.transaction_number LIKE ? OR w.name LIKE ?)");
      params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
    }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM transactions t LEFT JOIN wakif w ON w.id = t.wakif_id WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const r = await db
      .prepare(`${SELECT_TX} WHERE ${whereSql} ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?`)
      .bind(...params, f.limit, f.offset)
      .all<TransactionRow>();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  async function create(
    tx: Omit<TransactionRow, "id" | "created_at" | "updated_at" | "status" | "is_reversed" | "submitted_at" | "submitted_by" | "approved_at" | "approved_by" | "rejected_at" | "rejected_by" | "posted_at" | "posted_by" | "reversed_at" | "reversed_by">,
    status: TransactionStatus = "draft"
  ): Promise<number> {
    const r = await db
      .prepare(
        `INSERT INTO transactions
         (transaction_number, transaction_type, wakif_id, category_id, payment_method, rekening,
          amount, description, transaction_date, status, attachment_url, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tx.transaction_number, tx.transaction_type, tx.wakif_id, tx.category_id,
        tx.payment_method, tx.rekening, tx.amount, tx.description, tx.transaction_date,
        status, tx.attachment_url, tx.created_by
      )
      .run();
    return r.meta.last_row_id;
  }

  async function update(id: number, fields: Partial<TransactionRow>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(value);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  async function countByYear(prefix: string, year: number): Promise<number> {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM transactions WHERE transaction_number LIKE ?`
      )
      .bind(`${prefix}-${year}-%`)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }

  async function postedTotals(dateFrom?: string, dateTo?: string) {
    const where = ["t.status = 'diposting'"];
    const params: unknown[] = [];
    if (dateFrom) { where.push("t.transaction_date >= ?"); params.push(dateFrom); }
    if (dateTo) { where.push("t.transaction_date <= ?"); params.push(dateTo); }
    const r = await db
      .prepare(
        `SELECT t.transaction_type AS type, COUNT(*) AS n, SUM(t.amount) AS total
         FROM transactions t WHERE ${where.join(" AND ")} GROUP BY t.transaction_type`
      )
      .bind(...params)
      .all<{ type: string; n: number; total: number }>();
    return r.results ?? [];
  }

  return { findById, list, create, update, countByYear, postedTotals };
}

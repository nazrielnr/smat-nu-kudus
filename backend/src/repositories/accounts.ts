import type { D1Database } from "@cloudflare/workers-types";

export type AccountType = "aset" | "liabilitas" | "aset_neto" | "pendapatan" | "beban";

export interface AccountRow {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: number | null;
  is_active: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function accountsRepo(db: D1Database) {
  async function findById(id: number): Promise<AccountRow | null> {
    return db.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).first<AccountRow>();
  }

  async function findByCode(code: string): Promise<AccountRow | null> {
    return db.prepare("SELECT * FROM accounts WHERE code = ?").bind(code).first<AccountRow>();
  }

  async function findByCodes(codes: string[]): Promise<AccountRow[]> {
    const placeholders = codes.map(() => "?").join(",");
    const r = await db
      .prepare(`SELECT * FROM accounts WHERE code IN (${placeholders})`)
      .bind(...codes)
      .all<AccountRow>();
    return r.results ?? [];
  }

  async function list(f: { q?: string; account_type?: string; is_active?: number }): Promise<AccountRow[]> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.q) { where.push("(code LIKE ? OR name LIKE ?)"); params.push(`%${f.q}%`, `%${f.q}%`); }
    if (f.account_type) { where.push("account_type = ?"); params.push(f.account_type); }
    if (f.is_active !== undefined) { where.push("is_active = ?"); params.push(f.is_active); }
    const r = await db
      .prepare(`SELECT * FROM accounts WHERE ${where.join(" AND ")} ORDER BY code`)
      .bind(...params)
      .all<AccountRow>();
    return r.results ?? [];
  }

  async function create(a: { code: string; name: string; account_type: AccountType; description?: string | null; parent_id?: number | null }): Promise<AccountRow> {
    const r = await db
      .prepare(
        `INSERT INTO accounts (code, name, account_type, parent_id, description)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(a.code, a.name, a.account_type, a.parent_id ?? null, a.description ?? null)
      .run();
    return (await findById(r.meta.last_row_id))!;
  }

  async function update(id: number, fields: Partial<AccountRow>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.name !== undefined) { sets.push("name = ?"); params.push(fields.name); }
    if (fields.description !== undefined) { sets.push("description = ?"); params.push(fields.description); }
    if (fields.is_active !== undefined) { sets.push("is_active = ?"); params.push(fields.is_active); }
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  async function countByCodePrefix(prefix: string): Promise<number> {
    const r = await db
      .prepare("SELECT COUNT(*) AS n FROM accounts WHERE code LIKE ?")
      .bind(`${prefix}%`)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }

  return { findById, findByCode, findByCodes, list, create, update, countByCodePrefix };
}

import type { D1Database } from "@cloudflare/workers-types";

export interface CategoryRow {
  id: number;
  name: string;
  transaction_type: "penerimaan" | "pengeluaran";
  default_account_id: number;
  description: string | null;
  is_active: number;
}

export function categoriesRepo(db: D1Database) {
  async function findById(id: number): Promise<CategoryRow | null> {
    return db
      .prepare("SELECT * FROM transaction_categories WHERE id = ?")
      .bind(id)
      .first<CategoryRow>();
  }

  async function list(f: { q?: string; transaction_type?: string; is_active?: number }): Promise<CategoryRow[]> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.q) { where.push("name LIKE ?"); params.push(`%${f.q}%`); }
    if (f.transaction_type) { where.push("transaction_type = ?"); params.push(f.transaction_type); }
    if (f.is_active !== undefined) { where.push("is_active = ?"); params.push(f.is_active); }
    const r = await db
      .prepare(
        `SELECT * FROM transaction_categories WHERE ${where.join(" AND ")} ORDER BY transaction_type, name`
      )
      .bind(...params)
      .all<CategoryRow>();
    return r.results ?? [];
  }

  async function create(c: Omit<CategoryRow, "id">): Promise<CategoryRow> {
    const r = await db
      .prepare(
        `INSERT INTO transaction_categories (name, transaction_type, default_account_id, description, is_active)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(c.name, c.transaction_type, c.default_account_id, c.description ?? null, c.is_active ?? 1)
      .run();
    return (await findById(r.meta.last_row_id))!;
  }

  async function update(id: number, fields: Partial<CategoryRow>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(value);
    }
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE transaction_categories SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  return { findById, list, create, update };
}

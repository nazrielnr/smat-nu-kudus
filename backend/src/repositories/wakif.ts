import type { D1Database } from "@cloudflare/workers-types";

export interface WakifRow {
  id: number;
  name: string;
  type: "individu" | "organisasi" | "lembaga";
  nik: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NewWakif {
  name: string;
  type: "individu" | "organisasi" | "lembaga";
  nik?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_active?: number;
}

export interface WakifFilter {
  q?: string;
  is_active?: number;
  limit: number;
  offset: number;
}

export function wakifRepo(db: D1Database) {
  async function findById(id: number): Promise<WakifRow | null> {
    return db.prepare("SELECT * FROM wakif WHERE id = ?").bind(id).first<WakifRow>();
  }

  async function list(f: WakifFilter): Promise<{ items: WakifRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.q) {
      where.push("(name LIKE ? OR nik LIKE ? OR phone LIKE ?)");
      params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
    }
    if (f.is_active !== undefined) {
      where.push("is_active = ?");
      params.push(f.is_active);
    }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM wakif WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const r = await db
      .prepare(`SELECT * FROM wakif WHERE ${whereSql} ORDER BY name LIMIT ? OFFSET ?`)
      .bind(...params, f.limit, f.offset)
      .all<WakifRow>();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  async function create(w: NewWakif): Promise<WakifRow> {
    const r = await db
      .prepare(
        `INSERT INTO wakif (name, type, nik, phone, email, address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(w.name, w.type, w.nik ?? null, w.phone ?? null, w.email ?? null, w.address ?? null, w.is_active ?? 1)
      .run();
    return (await findById(r.meta.last_row_id))!;
  }

  async function update(id: number, w: Partial<NewWakif>): Promise<WakifRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (w.name !== undefined) { sets.push("name = ?"); params.push(w.name); }
    if (w.type !== undefined) { sets.push("type = ?"); params.push(w.type); }
    if (w.nik !== undefined) { sets.push("nik = ?"); params.push(w.nik); }
    if (w.phone !== undefined) { sets.push("phone = ?"); params.push(w.phone); }
    if (w.email !== undefined) { sets.push("email = ?"); params.push(w.email); }
    if (w.address !== undefined) { sets.push("address = ?"); params.push(w.address); }
    if (w.is_active !== undefined) { sets.push("is_active = ?"); params.push(w.is_active); }
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE wakif SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
    return (await findById(id))!;
  }

  async function transactionsOf(id: number, limit: number, offset: number) {
    const totalRow = await db
      .prepare("SELECT COUNT(*) AS n FROM transactions WHERE wakif_id = ?")
      .bind(id)
      .first<{ n: number }>();
    const r = await db
      .prepare(
        `SELECT * FROM transactions WHERE wakif_id = ? ORDER BY transaction_date DESC, id DESC LIMIT ? OFFSET ?`
      )
      .bind(id, limit, offset)
      .all();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  return { findById, list, create, update, transactionsOf };
}

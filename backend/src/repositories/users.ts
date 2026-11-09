import type { D1Database } from "@cloudflare/workers-types";
import type { Role } from "../types";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NewUser {
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active?: number;
}

export interface UserFilter {
  q?: string;
  role?: string;
  is_active?: number;
  limit: number;
  offset: number;
}

export function usersRepo(db: D1Database) {
  async function findByEmail(email: string): Promise<UserRow | null> {
    return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  }

  async function findById(id: number): Promise<UserRow | null> {
    return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  }

  async function list(f: UserFilter): Promise<{ items: UserRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.q) {
      where.push("(name LIKE ? OR email LIKE ?)");
      params.push(`%${f.q}%`, `%${f.q}%`);
    }
    if (f.role) {
      where.push("role = ?");
      params.push(f.role);
    }
    if (f.is_active !== undefined) {
      where.push("is_active = ?");
      params.push(f.is_active);
    }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const page = await db
      .prepare(
        `SELECT * FROM users WHERE ${whereSql} ORDER BY id LIMIT ? OFFSET ?`
      )
      .bind(...params, f.limit, f.offset)
      .all<UserRow>();
    const items = page.results ?? [];
    return { items, total: totalRow?.n ?? 0 };
  }

  async function create(u: NewUser): Promise<UserRow> {
    const r = await db
      .prepare(
        "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(u.name, u.email, u.password_hash, u.role, u.is_active ?? 1)
      .run();
    return (await findById(r.meta.last_row_id))!;
  }

  async function update(id: number, fields: Partial<NewUser>): Promise<UserRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.name !== undefined) { sets.push("name = ?"); params.push(fields.name); }
    if (fields.email !== undefined) { sets.push("email = ?"); params.push(fields.email); }
    if (fields.password_hash !== undefined) { sets.push("password_hash = ?"); params.push(fields.password_hash); }
    if (fields.role !== undefined) { sets.push("role = ?"); params.push(fields.role); }
    if (fields.is_active !== undefined) { sets.push("is_active = ?"); params.push(fields.is_active); }
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
    return (await findById(id))!;
  }

  async function count(): Promise<number> {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    return r?.n ?? 0;
  }

  return { findByEmail, findById, list, create, update, count };
}
import type { D1Database } from "@cloudflare/workers-types";

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export function auditRepo(db: D1Database) {
  async function write(
    user: { id: number; name: string } | null,
    action: string,
    entityType: string,
    entityId: string | number | null,
    details: Record<string, unknown> | null,
    ip: string | null
  ): Promise<void> {
    await db
      .prepare(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user?.id ?? null,
        user?.name ?? null,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        details === null ? null : JSON.stringify(details),
        ip
      )
      .run();
  }

  async function list(f: {
    action?: string;
    entity_type?: string;
    user_id?: number;
    date_from?: string;
    date_to?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: AuditLogRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.action) { where.push("action = ?"); params.push(f.action); }
    if (f.entity_type) { where.push("entity_type = ?"); params.push(f.entity_type); }
    if (f.user_id !== undefined) { where.push("user_id = ?"); params.push(f.user_id); }
    if (f.date_from) { where.push("date(created_at) >= ?"); params.push(f.date_from); }
    if (f.date_to) { where.push("date(created_at) <= ?"); params.push(f.date_to); }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const r = await db
      .prepare(`SELECT * FROM audit_logs WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...params, f.limit, f.offset)
      .all<AuditLogRow>();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  async function recordLoginAttempt(email: string, success: boolean, ip: string | null): Promise<void> {
    await db
      .prepare("INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)")
      .bind(email, ip, success ? 1 : 0)
      .run();
  }

  async function insertSession(s: {
    token_id: string;
    user_id: number;
    expires_at: string;
    user_agent: string | null;
    ip_address: string | null;
  }): Promise<void> {
    await db
      .prepare(
        `INSERT INTO sessions (token_id, user_id, expires_at, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(s.token_id, s.user_id, s.expires_at, s.user_agent, s.ip_address)
      .run();
  }

  async function revokeSession(tokenId: string): Promise<void> {
    await db
      .prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_id = ?")
      .bind(tokenId)
      .run();
  }

  return { write, list, recordLoginAttempt, insertSession, revokeSession };
}

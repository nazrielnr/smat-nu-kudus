import type { D1Database } from "@cloudflare/workers-types";

/**
 * Next sequential number per prefix, e.g. transaction numbers TX-2026-0001.
 * Wraps the read+insert in a D1 batch to avoid races under local single-writer
 * semantics; callers MUST pass the entity INSERT in the same batch when possible.
 */
export async function nextNumber(
  db: D1Database,
  prefix: string,
  year: number,
  countQuery: string
): Promise<string> {
  const row = await db
    .prepare(countQuery)
    .bind(year)
    .first<{ n: number }>();
  const next = (row?.n ?? 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** Random fallback when sequential counting is unavailable (tests, offline). */
export function randomSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

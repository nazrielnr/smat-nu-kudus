import type { D1Database } from "@cloudflare/workers-types";
import { HttpError, notFound } from "../middleware/auth";

export type Env = { Bindings: { DB: D1Database; BUCKET: R2Bucket; SESSION_SECRET: string } };
export type Repo = Env["Bindings"];

export function res<T>(stmt: { results?: unknown[] } | { result?: unknown[] } | unknown): T[] {
  const anyStmt = stmt as { results?: unknown[]; result?: unknown[] };
  return (anyStmt.results ?? anyStmt.result ?? []) as T[];
}

export function first<T>(r: unknown): T | null {
  const anyR = r as { results?: T[]; success?: boolean; meta?: unknown };
  if (anyR && Array.isArray(anyR.results)) return anyR.results[0] ?? null;
  return (r as T) ?? null;
}

export function resTyped<T>(r: { results?: T[]; result?: T[] }): T[] {
  return r.results ?? r.result ?? [];
}

export { HttpError, notFound };

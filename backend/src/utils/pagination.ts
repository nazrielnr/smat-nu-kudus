import { z } from "zod";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PageQuery {
  page: number;
  limit: number;
  offset: number;
}

export function parsePageQuery(input: URL | string, defaultLimit = 20, maxLimit = 100): PageQuery {
  const url = typeof input === "string" ? new URL(input) : input;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPage<T>(items: T[], total: number, q: PageQuery): Page<T> {
  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
    total_pages: Math.max(1, Math.ceil(total / q.limit)),
  };
}

export const idParam = z.coerce.number().int().positive();
export const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
export const money = z
  .number({ error: "amount must be an integer" })
  .int("amount must be an integer")
  .positive("amount must be > 0");
export const moneyFromInput = z.union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(/[^\d-]/g, "")) : v))
  .refine((v) => Number.isInteger(v) && v > 0, "amount must be a positive integer");

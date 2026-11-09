import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireRoles, badRequest, notFound } from "../middleware/auth";
import { wakifSchema, wakifUpdateSchema } from "../validators";
import { wakifRepo } from "../repositories/wakif";
import { auditRepo } from "../repositories/audit";
import { parsePageQuery, buildPage } from "../utils/pagination";

export const wakifRoutes = new Hono<AppEnv>();

wakifRoutes.use("*", requireRoles("admin", "bendahara", "pemeriksa", "pimpinan", "pengelola_aset"));

wakifRoutes.get("/", async (c) => {
  const q = parsePageQuery(c.req.url);
  const { items, total } = await wakifRepo(c.env.DB).list({
    q: c.req.query("q"),
    is_active: c.req.query("is_active") === undefined ? undefined : c.req.query("is_active") === "true" ? 1 : 0,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json({ success: true, data: buildPage(items, total, q) });
});

wakifRoutes.post("/", requireRoles("admin", "bendahara"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = wakifSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const created = await wakifRepo(c.env.DB).create({
    name: data.name,
    type: data.type,
    nik: data.nik ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    address: data.address ?? null,
  });
  await auditRepo(c.env.DB).write(c.get("currentUser"), "wakif_create", "wakif", created.id, { name: created.name }, null);
  return c.json({ success: true, data: created }, 201);
});

wakifRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const w = await wakifRepo(c.env.DB).findById(id);
  if (!w) throw notFound("Wakif tidak ditemukan");
  return c.json({ success: true, data: w });
});

wakifRoutes.put("/:id", requireRoles("admin", "bendahara"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = wakifUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const repo = wakifRepo(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Wakif tidak ditemukan");
  const updated = await repo.update(id, {
    name: parsed.data.name,
    type: parsed.data.type,
    nik: parsed.data.nik,
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
  });
  await auditRepo(c.env.DB).write(c.get("currentUser"), "wakif_update", "wakif", id, { fields: Object.keys(parsed.data) }, null);
  return c.json({ success: true, data: updated });
});

wakifRoutes.get("/:id/transactions", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const repo = wakifRepo(c.env.DB);
  const w = await repo.findById(id);
  if (!w) throw notFound("Wakif tidak ditemukan");
  const q = parsePageQuery(c.req.url);
  const { items, total } = await repo.transactionsOf(id, q.limit, q.offset);
  return c.json({ success: true, data: buildPage(items, total, q) });
});

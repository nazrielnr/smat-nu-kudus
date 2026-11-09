import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireRoles, badRequest, notFound } from "../middleware/auth";
import { accountSchema, accountUpdateSchema, categorySchema, categoryUpdateSchema } from "../validators";
import { accountsRepo } from "../repositories/accounts";
import { journalsRepo } from "../repositories/journals";
import { categoriesRepo } from "../repositories/categories";
import { auditRepo } from "../repositories/audit";
import { getLedger, getTrialBalance } from "../accounting/queries";
import { validateBalanced } from "../accounting/engine";
import { parsePageQuery, buildPage } from "../utils/pagination";

export const accountingRoutes = new Hono<AppEnv>();

// --- accounts (COA) ---

accountingRoutes.get("/accounts", async (c) => {
  const sp = c.req.query();
  const items = await accountsRepo(c.env.DB).list({
    q: sp.q,
    account_type: sp.account_type,
    is_active: sp.is_active === undefined ? undefined : sp.is_active === "true" ? 1 : 0,
  });
  return c.json({ success: true, data: { items, total: items.length, page: 1, limit: items.length, total_pages: 1 } });
});

accountingRoutes.post("/accounts", requireRoles("admin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const db = c.env.DB;
  const repo = accountsRepo(db);
  if (await repo.findByCode(data.code)) throw badRequest("Kode akun sudah digunakan");
  if (data.parent_id) {
    const parent = await repo.findById(data.parent_id);
    if (!parent) throw badRequest("Akun induk tidak ditemukan");
  }
  const created = await repo.create({
    code: data.code,
    name: data.name,
    account_type: data.account_type,
    description: data.description ?? null,
    parent_id: data.parent_id ?? null,
  });
  await auditRepo(db).write(c.get("currentUser"), "account_create", "account", created.id, { code: created.code }, null);
  return c.json({ success: true, data: created }, 201);
});

accountingRoutes.put("/accounts/:id", requireRoles("admin"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const db = c.env.DB;
  const repo = accountsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Akun tidak ditemukan");
  await repo.update(id, {
    name: parsed.data.name,
    description: parsed.data.description,
    is_active: parsed.data.is_active === undefined ? undefined : parsed.data.is_active ? 1 : 0,
  });
  const updated = await repo.findById(id);
  await auditRepo(db).write(c.get("currentUser"), "account_update", "account", id, { fields: Object.keys(parsed.data) }, null);
  return c.json({ success: true, data: updated });
});

// --- transaction categories ---

accountingRoutes.get("/transaction-categories", async (c) => {
  const sp = c.req.query();
  const items = await categoriesRepo(c.env.DB).list({
    q: sp.q,
    transaction_type: sp.transaction_type,
    is_active: sp.is_active === undefined ? undefined : sp.is_active === "true" ? 1 : 0,
  });
  return c.json({ success: true, data: items });
});

accountingRoutes.get("/transaction-categories/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const cat = await categoriesRepo(c.env.DB).findById(id);
  if (!cat) throw notFound("Kategori tidak ditemukan");
  return c.json({ success: true, data: cat });
});

accountingRoutes.post("/transaction-categories", requireRoles("admin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const db = c.env.DB;
  const account = await accountsRepo(db).findById(data.default_account_id);
  if (!account) throw badRequest("Akun default tidak ditemukan");
  const created = await categoriesRepo(db).create({
    name: data.name,
    transaction_type: data.transaction_type,
    default_account_id: data.default_account_id,
    description: data.description ?? null,
    is_active: 1,
  });
  await auditRepo(db).write(c.get("currentUser"), "category_create", "category", created.id, { name: created.name }, null);
  return c.json({ success: true, data: created }, 201);
});

accountingRoutes.put("/transaction-categories/:id", requireRoles("admin"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const db = c.env.DB;
  const repo = categoriesRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Kategori tidak ditemukan");
  if (parsed.data.default_account_id) {
    const account = await accountsRepo(db).findById(parsed.data.default_account_id);
    if (!account) throw badRequest("Akun default tidak ditemukan");
  }
  await repo.update(id, {
    name: parsed.data.name,
    transaction_type: parsed.data.transaction_type,
    default_account_id: parsed.data.default_account_id,
    description: parsed.data.description,
    is_active: parsed.data.is_active === undefined ? undefined : parsed.data.is_active ? 1 : 0,
  });
  const updated = await repo.findById(id);
  await auditRepo(db).write(c.get("currentUser"), "category_update", "category", id, { fields: Object.keys(parsed.data) }, null);
  return c.json({ success: true, data: updated });
});

// --- journals ---

accountingRoutes.get("/journals", async (c) => {
  const q = parsePageQuery(c.req.url);
  const sp = c.req.query();
  const { items, total } = await journalsRepo(c.env.DB).list({
    date_from: sp.date_from,
    date_to: sp.date_to,
    status: sp.status,
    q: sp.q,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json({ success: true, data: buildPage(items, total, q) });
});

accountingRoutes.get("/journals/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const db = c.env.DB;
  const repo = journalsRepo(db);
  const entry = await repo.findById(id);
  if (!entry) throw notFound("Jurnal tidak ditemukan");
  const lines = await repo.lines(id);
  return c.json({ success: true, data: { ...entry, lines } });
});

accountingRoutes.post("/journals/:id/post", requireRoles("admin", "bendahara", "pemeriksa"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const db = c.env.DB;
  const repo = journalsRepo(db);
  const entry = await repo.findById(id);
  if (!entry) throw notFound("Jurnal tidak ditemukan");
  if (entry.status === "posted") {
    return c.json({ success: true, data: { journal_id: id, status: "posted", idempotent: true } });
  }
  const lines = await repo.lines(id);
  validateBalanced(lines.map((l) => ({ ...l, account_id: l.account_id })));
  await repo.setStatus(id, "posted");
  await auditRepo(db).write(c.get("currentUser"), "journal_post", "journal", id, null, null);
  const updated = await repo.findById(id);
  return c.json({ success: true, data: { journal_id: id, status: updated!.status, idempotent: false } });
});

// --- ledger & trial balance ---

accountingRoutes.get("/ledger", async (c) => {
  const accountId = Number(c.req.query("account_id"));
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw badRequest("Parameter account_id wajib diisi");
  }
  const { account, opening, rows, closing } = await getLedger(
    c.env.DB,
    accountId,
    c.req.query("date_from") ?? null,
    c.req.query("date_to") ?? null
  );
  return c.json({
    success: true,
    data: {
      account: { id: account.id, code: account.code, name: account.name, account_type: account.account_type },
      saldo_awal: opening,
      rows,
      saldo_akhir: closing,
      total: rows.length,
    },
  });
});

accountingRoutes.get("/trial-balance", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("date harus YYYY-MM-DD");
  const result = await getTrialBalance(c.env.DB, date);
  return c.json({ success: true, data: result });
});

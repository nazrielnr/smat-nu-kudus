import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../types";
import { badRequest, notFound, forbidden, conflict, HttpError } from "../middleware/auth";
import { transactionSchema, transactionUpdateSchema, rejectSchema } from "../validators";
import { transactionsRepo, type TransactionRow } from "../repositories/transactions";
import { categoriesRepo } from "../repositories/categories";
import { accountsRepo } from "../repositories/accounts";
import { wakifRepo } from "../repositories/wakif";
import { auditRepo } from "../repositories/audit";
import { postTransaction, reverseTransaction } from "../accounting/posting";
import { currentYear } from "../utils/numbers";
import { parsePageQuery, buildPage } from "../utils/pagination";

export const transactionRoutes = new Hono<AppEnv>();

async function assertCategory(db: D1Database, categoryId: number, type: string) {
  const cat = await categoriesRepo(db).findById(categoryId);
  if (!cat) throw badRequest("Kategori transaksi tidak ditemukan");
  if (cat.transaction_type !== type) {
    throw badRequest(
      `Kategori '${cat.name}' hanya untuk transaksi ${cat.transaction_type}, bukan ${type}`
    );
  }
  return cat;
}

async function nextTransactionNumber(db: D1Database): Promise<string> {
  const year = currentYear();
  const count = await transactionsRepo(db).countByYear("TX", year);
  return `TX-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function nextJournalNumber(db: D1Database): Promise<string> {
  const year = currentYear();
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE journal_number LIKE ?")
    .bind(`JV-${year}-%`)
    .first<{ n: number }>();
  return `JV-${year}-${String((count?.n ?? 0) + 1).padStart(4, "0")}`;
}

function ipOf(c: Context<AppEnv>): string | null {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;
}

// --- permissions ---
// bendahara: create/update/submit own; pemeriksa & admin: approve/reject/post/reverse; view: all roles
const CAN_WRITE = new Set(["admin", "bendahara"]);
const CAN_APPROVE = new Set(["admin", "pemeriksa"]);

transactionRoutes.get("/", async (c) => {
  const q = parsePageQuery(c.req.url);
  const sp = c.req.query();
  const { items, total } = await transactionsRepo(c.env.DB).list({
    type: sp.type,
    status: sp.status,
    category_id: sp.category_id ? Number(sp.category_id) : undefined,
    wakif_id: sp.wakif_id ? Number(sp.wakif_id) : undefined,
    date_from: sp.date_from,
    date_to: sp.date_to,
    q: sp.q,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json({ success: true, data: buildPage(items, total, q) });
});

transactionRoutes.post("/", async (c) => {
  const user = c.get("currentUser");
  if (!CAN_WRITE.has(user.role)) {
    throw forbidden("Hanya admin atau bendahara yang dapat membuat transaksi");
  }
  const body = await c.req.json().catch(() => null);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const db = c.env.DB;
  await assertCategory(db, data.category_id, data.transaction_type);
  if (data.wakif_id) {
    const w = await wakifRepo(db).findById(data.wakif_id);
    if (!w) throw badRequest("Wakif tidak ditemukan");
  }
  const repo = transactionsRepo(db);
  const id = await repo.create({
    transaction_number: await nextTransactionNumber(db),
    transaction_type: data.transaction_type,
    wakif_id: data.wakif_id ?? null,
    category_id: data.category_id,
    payment_method: data.payment_method ?? null,
    rekening: data.rekening ?? null,
    amount: data.amount,
    description: data.description ?? null,
    transaction_date: data.transaction_date,
    attachment_url: data.attachment_url ?? null,
    rejection_reason: null,
    created_by: user.id,
  });
  const tx = await repo.findById(id);
  await auditRepo(db).write(user, "transaction_create", "transaction", id, {
    transaction_number: tx!.transaction_number,
    transaction_type: data.transaction_type,
    amount: data.amount,
  }, ipOf(c));
  return c.json({ success: true, data: tx }, 201);
});

transactionRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const tx = await transactionsRepo(c.env.DB).findById(id);
  if (!tx) throw notFound("Transaksi tidak ditemukan");
  return c.json({ success: true, data: tx });
});

transactionRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_WRITE.has(user.role)) {
    throw forbidden("Hanya admin atau bendahara yang dapat mengubah transaksi");
  }
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  const editable = ["draft", "ditolak"];
  if (!editable.includes(existing.status)) {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat diubah`,
      "INVALID_STATUS"
    );
  }
  if (user.role !== "admin" && existing.created_by !== user.id) {
    throw forbidden("Hanya pembuat transaksi atau admin yang dapat mengubah");
  }
  const body = await c.req.json().catch(() => null);
  const parsed = transactionUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const effectiveType = data.transaction_type ?? existing.transaction_type;
  if (data.category_id) await assertCategory(db, data.category_id, effectiveType);
  if (data.wakif_id) {
    const w = await wakifRepo(db).findById(data.wakif_id);
    if (!w) throw badRequest("Wakif tidak ditemukan");
  }
  await repo.update(id, {
    transaction_type: data.transaction_type,
    wakif_id: data.wakif_id ?? undefined,
    category_id: data.category_id,
    payment_method: data.payment_method ?? undefined,
    rekening: data.rekening ?? undefined,
    amount: data.amount,
    description: data.description ?? undefined,
    transaction_date: data.transaction_date,
    attachment_url: data.attachment_url ?? undefined,
    status: "draft",
    rejection_reason: null,
  });
  const updated = await repo.findById(id);
  await auditRepo(db).write(user, "transaction_update", "transaction", id, { fields: Object.keys(data) }, ipOf(c));
  return c.json({ success: true, data: updated });
});

transactionRoutes.post("/:id/submit", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_WRITE.has(user.role)) {
    throw forbidden("Hanya admin atau bendahara yang dapat mengajukan transaksi");
  }
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  if (existing.status !== "draft" && existing.status !== "ditolak") {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat diajukan`,
      "INVALID_STATUS"
    );
  }
  if (user.role !== "admin" && existing.created_by !== user.id) {
    throw forbidden("Hanya pembuat transaksi atau admin yang dapat mengajukan");
  }
  await repo.update(id, { status: "menunggu_persetujuan", submitted_at: null });
  await db
    .prepare(
      "UPDATE transactions SET submitted_at = datetime('now'), submitted_by = ? WHERE id = ?"
    )
    .bind(user.id, id)
    .run();
  const updated = await repo.findById(id);
  await auditRepo(db).write(user, "transaction_submit", "transaction", id, { status: "menunggu_persetujuan" }, ipOf(c));
  return c.json({ success: true, data: updated });
});

transactionRoutes.post("/:id/approve", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_APPROVE.has(user.role)) {
    throw forbidden("Hanya pemeriksa atau admin yang dapat menyetujui transaksi");
  }
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  if (existing.status !== "menunggu_persetujuan") {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat disetujui`,
      "INVALID_STATUS"
    );
  }
  if (existing.created_by === user.id) {
    throw forbidden("Tidak dapat menyetujui transaksi yang dibuat sendiri");
  }
  await db
    .prepare(
      "UPDATE transactions SET status = 'disetujui', approved_at = datetime('now'), approved_by = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(user.id, id)
    .run();
  const updated = await repo.findById(id);
  await auditRepo(db).write(user, "transaction_approve", "transaction", id, { status: "disetujui" }, ipOf(c));
  return c.json({ success: true, data: updated });
});

transactionRoutes.post("/:id/reject", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_APPROVE.has(user.role)) {
    throw forbidden("Hanya pemeriksa atau admin yang dapat menolak transaksi");
  }
  const body = await c.req.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Alasan penolakan wajib diisi");
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  if (existing.status !== "menunggu_persetujuan") {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat ditolak`,
      "INVALID_STATUS"
    );
  }
  if (existing.created_by === user.id) {
    throw forbidden("Tidak dapat menolak transaksi yang dibuat sendiri");
  }
  await db
    .prepare(
      "UPDATE transactions SET status = 'ditolak', rejected_at = datetime('now'), rejected_by = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(user.id, parsed.data.reason, id)
    .run();
  const updated = await repo.findById(id);
  await auditRepo(db).write(user, "transaction_reject", "transaction", id, { reason: parsed.data.reason }, ipOf(c));
  return c.json({ success: true, data: updated });
});

transactionRoutes.post("/:id/post", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_APPROVE.has(user.role) && user.role !== "bendahara") {
    throw forbidden("Hanya pemeriksa, bendahara, atau admin yang dapat memposting transaksi");
  }
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  if (existing.status === "diposting") {
    // idempotent repost
    const j = await db
      .prepare(
        "SELECT id, journal_number FROM journal_entries WHERE transaction_id = ? AND source_type = 'transaction_post' ORDER BY id LIMIT 1"
      )
      .bind(id)
      .first<{ id: number; journal_number: string }>();
    if (j) {
      return c.json({
        success: true,
        data: { journal_id: j.id, journal_number: j.journal_number, idempotent: true },
      });
    }
  }
  if (existing.status !== "disetujui") {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat diposting. Harus berstatus 'disetujui'`,
      "INVALID_STATUS"
    );
  }
  const cat = existing.category_id
    ? await categoriesRepo(db).findById(existing.category_id)
    : null;
  const categoryAccount = cat
    ? await accountsRepo(db).findById(cat.default_account_id)
    : null;
  const accounts = await accountsRepo(db).list({});

  const result = await postTransaction(
    db, existing, accounts, categoryAccount, await nextJournalNumber(db), user.id
  );
  await auditRepo(db).write(user, "transaction_post", "transaction", id, {
    journal_number: result.journal_number,
    idempotent: result.idempotent,
  }, ipOf(c));
  return c.json({ success: true, data: result });
});

transactionRoutes.post("/:id/reverse", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = c.get("currentUser");
  if (!CAN_APPROVE.has(user.role)) {
    throw forbidden("Hanya pemeriksa atau admin yang dapat membatalkan (reverse) transaksi");
  }
  const db = c.env.DB;
  const repo = transactionsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Transaksi tidak ditemukan");
  if (existing.status === "dibatalkan") {
    const j = await db
      .prepare(
        "SELECT id, journal_number FROM journal_entries WHERE transaction_id = ? AND source_type = 'transaction_reversal' ORDER BY id LIMIT 1"
      )
      .bind(id)
      .first<{ id: number; journal_number: string }>();
    if (j) {
      return c.json({
        success: true,
        data: { journal_id: j.id, journal_number: j.journal_number, idempotent: true },
      });
    }
  }
  if (existing.status !== "diposting") {
    throw conflict(
      `Transaksi dengan status '${existing.status}' tidak dapat dibatalkan. Harus berstatus 'diposting'`,
      "INVALID_STATUS"
    );
  }
  const accounts = await accountsRepo(db).list({});
  const cat = existing.category_id
    ? await categoriesRepo(db).findById(existing.category_id)
    : null;
  const categoryAccount = cat
    ? await accountsRepo(db).findById(cat.default_account_id)
    : null;

  const result = await reverseTransaction(
    db, existing, accounts, categoryAccount, await nextJournalNumber(db), user.id
  );
  await auditRepo(db).write(user, "transaction_reverse", "transaction", id, {
    journal_number: result.journal_number,
  }, ipOf(c));
  return c.json({ success: true, data: result });
});

import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireRoles, badRequest, notFound, forbidden } from "../middleware/auth";
import { assetSchema, assetUpdateSchema } from "../validators";
import { assetsRepo } from "../repositories/assets";
import { wakifRepo } from "../repositories/wakif";
import { auditRepo } from "../repositories/audit";
import { parsePageQuery, buildPage } from "../utils/pagination";
import { currentYear } from "../utils/numbers";

export const assetRoutes = new Hono<AppEnv>();

// All authenticated roles can view; write requires pengelola_aset or admin
assetRoutes.get("/", async (c) => {
  const q = parsePageQuery(c.req.url);
  const sp = c.req.query();
  const { items, total } = await assetsRepo(c.env.DB).list({
    q: sp.q,
    asset_type: sp.asset_type,
    status: sp.status,
    wakif_id: sp.wakif_id ? Number(sp.wakif_id) : undefined,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json({ success: true, data: buildPage(items, total, q) });
});

async function nextAssetCode(db: D1Database): Promise<string> {
  const year = currentYear();
  const count = await assetsRepo(db).countByCodePrefix("AST", year);
  return `AST-${year}-${String(count + 1).padStart(4, "0")}`;
}

assetRoutes.post("/", requireRoles("admin", "pengelola_aset"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const db = c.env.DB;
  if (data.wakif_id) {
    const w = await wakifRepo(db).findById(data.wakif_id);
    if (!w) throw badRequest("Wakif tidak ditemukan");
  }
  const user = c.get("currentUser");
  const created = await assetsRepo(db).create({
    asset_code: data.asset_code ?? (await nextAssetCode(db)),
    name: data.name,
    asset_type: data.asset_type,
    wakif_id: data.wakif_id ?? null,
    acquisition_date: data.acquisition_date,
    acquisition_value: data.acquisition_value,
    book_value: data.acquisition_value,
    acquisition_method: data.acquisition_method ?? null,
    location: data.location ?? null,
    certificate_number: data.certificate_number ?? null,
    status: data.status,
    management_status: data.management_status,
    notes: data.notes ?? null,
    created_by: user.id,
  });
  await assetsRepo(db).addLog(created.id, "created", null, { name: created.name, asset_code: created.asset_code }, user.id);
  await auditRepo(db).write(user, "asset_create", "asset", created.id, { asset_code: created.asset_code }, null);
  return c.json({ success: true, data: created }, 201);
});

assetRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const a = await assetsRepo(c.env.DB).findById(id);
  if (!a) throw notFound("Aset tidak ditemukan");
  return c.json({ success: true, data: a });
});

assetRoutes.put("/:id", requireRoles("admin", "pengelola_aset"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = assetUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const db = c.env.DB;
  const repo = assetsRepo(db);
  const existing = await repo.findById(id);
  if (!existing) throw notFound("Aset tidak ditemukan");
  if (data.wakif_id) {
    const w = await wakifRepo(db).findById(data.wakif_id);
    if (!w) throw badRequest("Wakif tidak ditemukan");
  }
  const user = c.get("currentUser");
  const changed: Record<string, unknown> = {};
  if (data.acquisition_value !== undefined && data.acquisition_value !== existing.acquisition_value) {
    changed.acquisition_value = { from: existing.acquisition_value, to: data.acquisition_value };
  }
  if (data.status !== undefined && data.status !== existing.status) {
    changed.status = { from: existing.status, to: data.status };
  }
  if (data.management_status !== undefined && data.management_status !== existing.management_status) {
    changed.management_status = { from: existing.management_status, to: data.management_status };
  }
  await repo.update(id, {
    name: data.name,
    asset_type: data.asset_type,
    wakif_id: data.wakif_id ?? undefined,
    acquisition_date: data.acquisition_date,
    acquisition_value: data.acquisition_value,
    book_value: data.acquisition_value !== undefined ? data.acquisition_value : undefined,
    acquisition_method: data.acquisition_method ?? undefined,
    location: data.location ?? undefined,
    certificate_number: data.certificate_number ?? undefined,
    status: data.status,
    management_status: data.management_status,
    notes: data.notes ?? undefined,
  });
  if (Object.keys(changed).length > 0) {
    await repo.addLog(id, "updated", existing, changed, user.id);
    await auditRepo(db).write(user, "asset_update", "asset", id, changed, null);
  }
  const updated = await repo.findById(id);
  return c.json({ success: true, data: updated });
});

assetRoutes.get("/:id/history", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const db = c.env.DB;
  const a = await assetsRepo(db).findById(id);
  if (!a) throw notFound("Aset tidak ditemukan");
  const history = await assetsRepo(db).history(id);
  return c.json({ success: true, data: { asset_id: id, history } });
});

// --- documents (R2) ---

assetRoutes.post("/:id/documents", requireRoles("admin", "pengelola_aset", "bendahara"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const db = c.env.DB;
  const repo = assetsRepo(db);
  const asset = await repo.findById(id);
  if (!asset) throw notFound("Aset tidak ditemukan");

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Field 'file' (multipart) wajib diisi");
  if (file.size > 10 * 1024 * 1024) throw badRequest("Ukuran file maksimal 10MB");
  const documentType = (form.get("document_type") as string | null) ?? "lainnya";
  const description = (form.get("description") as string | null) ?? null;

  const user = c.get("currentUser");
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const objectKey = `assets/${id}/${crypto.randomUUID()}.${ext}`;
  await c.env.BUCKET.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const doc = await repo.insertDocument({
    asset_id: id,
    document_type: documentType,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type || "application/octet-stream",
    object_key: objectKey,
    description,
    uploaded_by: user.id,
  });
  await auditRepo(db).write(user, "asset_document_upload", "asset_document", doc.id, { file_name: file.name }, null);
  return c.json({
    success: true,
    data: {
      id: doc.id,
      asset_id: doc.asset_id,
      document_type: doc.document_type,
      file_name: doc.file_name,
      file_size: doc.file_size,
      description: doc.description,
      url: `/api/v1/assets/${id}/documents/${doc.id}/file`,
    },
  }, 201);
});

assetRoutes.get("/:id/documents", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const db = c.env.DB;
  const asset = await assetsRepo(db).findById(id);
  if (!asset) throw notFound("Aset tidak ditemukan");
  const docs = await assetsRepo(db).documents(id);
  return c.json({
    success: true,
    data: docs.map((d) => ({
      id: d.id,
      asset_id: d.asset_id,
      document_type: d.document_type,
      file_name: d.file_name,
      file_size: d.file_size,
      content_type: d.content_type,
      description: d.description,
      created_at: d.created_at,
      url: `/api/v1/assets/${id}/documents/${d.id}/file`,
    })),
  });
});

assetRoutes.get("/:id/documents/:docId/file", async (c) => {
  const id = Number(c.req.param("id"));
  const docId = Number(c.req.param("docId"));
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(docId) || docId <= 0) {
    throw badRequest("Invalid id");
  }
  const doc = await assetsRepo(c.env.DB).findDocument(docId);
  if (!doc || doc.asset_id !== id) throw notFound("Dokumen tidak ditemukan");
  const obj = await c.env.BUCKET.get(doc.object_key);
  if (!obj) throw notFound("File tidak ditemukan di storage");
  return new Response(obj.body, {
    headers: {
      "Content-Type": doc.content_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.file_name}"`,
    },
  });
});

assetRoutes.delete("/:id/documents/:docId", requireRoles("admin", "pengelola_aset"), async (c) => {
  const id = Number(c.req.param("id"));
  const docId = Number(c.req.param("docId"));
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(docId) || docId <= 0) {
    throw badRequest("Invalid id");
  }
  const db = c.env.DB;
  const repo = assetsRepo(db);
  const doc = await repo.findDocument(docId);
  if (!doc || doc.asset_id !== id) throw notFound("Dokumen tidak ditemukan");
  await c.env.BUCKET.delete(doc.object_key);
  await repo.deleteDocument(docId);
  await auditRepo(db).write(c.get("currentUser"), "asset_document_delete", "asset_document", docId, { file_name: doc.file_name }, null);
  return c.json({ success: true, data: { message: "Dokumen dihapus" } });
});

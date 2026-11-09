import type { D1Database } from "@cloudflare/workers-types";

export interface AssetRow {
  id: number;
  asset_code: string;
  name: string;
  asset_type: "tanah" | "bangunan" | "uang" | "kendaraan" | "lainnya";
  wakif_id: number | null;
  acquisition_date: string;
  acquisition_value: number;
  book_value: number;
  acquisition_method: string | null;
  location: string | null;
  certificate_number: string | null;
  status: "aktif" | "tidak_aktif" | "dihapus" | "dipindahtangkan";
  management_status: "diurus_sendiri" | "dikuasakan" | "disewakan" | "dijual";
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AssetDocumentRow {
  id: number;
  asset_id: number;
  document_type: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  object_key: string;
  description: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export function assetsRepo(db: D1Database) {
  async function findById(id: number): Promise<AssetRow | null> {
    return db.prepare("SELECT * FROM assets WHERE id = ?").bind(id).first<AssetRow>();
  }

  async function list(f: {
    q?: string;
    asset_type?: string;
    status?: string;
    wakif_id?: number;
    limit: number;
    offset: number;
  }): Promise<{ items: AssetRow[]; total: number }> {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (f.q) { where.push("(name LIKE ? OR asset_code LIKE ?)"); params.push(`%${f.q}%`, `%${f.q}%`); }
    if (f.asset_type) { where.push("asset_type = ?"); params.push(f.asset_type); }
    if (f.status) { where.push("status = ?"); params.push(f.status); }
    if (f.wakif_id !== undefined) { where.push("wakif_id = ?"); params.push(f.wakif_id); }
    const whereSql = where.join(" AND ");
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS n FROM assets WHERE ${whereSql}`)
      .bind(...params)
      .first<{ n: number }>();
    const r = await db
      .prepare(`SELECT * FROM assets WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...params, f.limit, f.offset)
      .all<AssetRow>();
    return { items: r.results ?? [], total: totalRow?.n ?? 0 };
  }

  async function create(a: Omit<AssetRow, "id" | "created_at" | "updated_at">): Promise<AssetRow> {
    const r = await db
      .prepare(
        `INSERT INTO assets (asset_code, name, asset_type, wakif_id, acquisition_date, acquisition_value,
          book_value, acquisition_method, location, certificate_number, status, management_status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        a.asset_code, a.name, a.asset_type, a.wakif_id, a.acquisition_date, a.acquisition_value,
        a.book_value, a.acquisition_method, a.location, a.certificate_number, a.status,
        a.management_status, a.notes, a.created_by
      )
      .run();
    return (await findById(r.meta.last_row_id))!;
  }

  async function update(id: number, fields: Partial<AssetRow>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${key} = ?`);
      params.push(value);
    }
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await db
      .prepare(`UPDATE assets SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  async function addLog(
    assetId: number,
    changeType: string,
    oldValues: unknown,
    newValues: unknown,
    userId: number
  ): Promise<void> {
    await db
      .prepare(
        `INSERT INTO asset_transfer_logs (asset_id, change_type, old_values, new_values, changed_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        assetId,
        changeType,
        oldValues === null ? null : JSON.stringify(oldValues),
        newValues === null ? null : JSON.stringify(newValues),
        userId
      )
      .run();
  }

  async function history(assetId: number): Promise<Record<string, unknown>[]> {
    const logs = await db
      .prepare(
        `SELECT l.*, u.name AS changed_by_name FROM asset_transfer_logs l
         LEFT JOIN users u ON u.id = l.changed_by
         WHERE l.asset_id = ? ORDER BY l.id DESC`
      )
      .bind(assetId)
      .all<Record<string, unknown>>();
    return logs.results ?? [];
  }

  async function documents(assetId: number): Promise<AssetDocumentRow[]> {
    const r = await db
      .prepare("SELECT * FROM asset_documents WHERE asset_id = ? ORDER BY id DESC")
      .bind(assetId)
      .all<AssetDocumentRow>();
    return r.results ?? [];
  }

  async function findDocument(docId: number): Promise<AssetDocumentRow | null> {
    return db
      .prepare("SELECT * FROM asset_documents WHERE id = ?")
      .bind(docId)
      .first<AssetDocumentRow>();
  }

  async function insertDocument(d: Omit<AssetDocumentRow, "id" | "created_at">): Promise<AssetDocumentRow> {
    const r = await db
      .prepare(
        `INSERT INTO asset_documents (asset_id, document_type, file_name, file_size, content_type, object_key, description, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        d.asset_id, d.document_type, d.file_name, d.file_size, d.content_type, d.object_key,
        d.description, d.uploaded_by
      )
      .run();
    return (await findDocument(r.meta.last_row_id))!;
  }

  async function deleteDocument(docId: number): Promise<void> {
    await db.prepare("DELETE FROM asset_documents WHERE id = ?").bind(docId).run();
  }

  async function distributionByType(): Promise<{ asset_type: string; count: number; total_value: number }[]> {
    const r = await db
      .prepare(
        `SELECT asset_type, COUNT(*) AS count, SUM(book_value) AS total_value
         FROM assets WHERE status = 'aktif' GROUP BY asset_type`
      )
      .all<{ asset_type: string; count: number; total_value: number }>();
    return r.results ?? [];
  }

  async function countByCodePrefix(prefix: string, year: number): Promise<number> {
    const r = await db
      .prepare("SELECT COUNT(*) AS n FROM assets WHERE asset_code LIKE ?")
      .bind(`${prefix}-${year}-%`)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }

  return {
    findById, list, create, update, addLog, history, documents, findDocument,
    insertDocument, deleteDocument, distributionByType, countByCodePrefix,
  };
}

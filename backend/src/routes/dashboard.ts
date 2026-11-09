import { Hono } from "hono";
import type { AppEnv } from "../types";
import { transactionsRepo } from "../repositories/transactions";
import { assetsRepo } from "../repositories/assets";
import { journalsRepo } from "../repositories/journals";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/summary", async (c) => {
  const db = c.env.DB;

  // Penerimaan/pengeluaran = arus kas dari jurnal terposting pada akun Kas & Bank
  // (sama dengan laporan arus kas, termasuk jurnal manual).
  const cashRow = await db
    .prepare(
      `SELECT COALESCE(SUM(jl.debit), 0) AS inflow, COALESCE(SUM(jl.credit), 0) AS outflow
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.status = 'posted' AND a.code IN ('111', '112')`
    )
    .first<{ inflow: number; outflow: number }>();
  const inflow = cashRow?.inflow ?? 0;
  const outflow = cashRow?.outflow ?? 0;

  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'menunggu_persetujuan' THEN 1 ELSE 0 END), 0) AS pending
       FROM transactions`
    )
    .first<{ total: number; pending: number }>();

  const assetRow = await db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(book_value), 0) AS total FROM assets WHERE status = 'aktif'"
    )
    .first<{ n: number; total: number }>();

  const wakifRow = await db
    .prepare("SELECT COUNT(*) AS n FROM wakif WHERE is_active = 1")
    .first<{ n: number }>();

  return c.json({
    success: true,
    data: {
      total_penerimaan: inflow,
      total_pengeluaran: outflow,
      saldo_kas: inflow - outflow,
      total_aset_wakaf: assetRow?.total ?? 0,
      jumlah_wakif: wakifRow?.n ?? 0,
      jumlah_transaksi: counts?.total ?? 0,
      transaksi_menunggu_persetujuan: counts?.pending ?? 0,
      // nama lama, dipertahankan untuk kompatibilitas
      saldo_kas_dan_bank: inflow - outflow,
      surplus: inflow - outflow,
      pending_transactions: counts?.pending ?? 0,
      total_assets: assetRow?.n ?? 0,
      total_asset_value: assetRow?.total ?? 0,
      total_wakif: wakifRow?.n ?? 0,
    },
  });
});

dashboardRoutes.get("/transactions", async (c) => {
  const limit = Math.min(Math.max(1, Number(c.req.query("limit") ?? 10) || 10), 50);
  const { items } = await transactionsRepo(c.env.DB).list({ limit, offset: 0 });
  return c.json({ success: true, data: items });
});

dashboardRoutes.get("/cash-flow", async (c) => {
  const months = Math.min(Math.max(1, Number(c.req.query("months") ?? 12) || 12), 24);
  const db = c.env.DB;
  const r = await db
    .prepare(
      `SELECT strftime('%Y-%m', je.entry_date) AS month,
              SUM(CASE WHEN a.code = '111' OR a.code = '112' THEN jl.debit ELSE 0 END) AS inflow,
              SUM(CASE WHEN a.code = '111' OR a.code = '112' THEN jl.credit ELSE 0 END) AS outflow
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.status = 'posted'
         AND je.entry_date >= date((SELECT MAX(entry_date) FROM journal_entries WHERE status = 'posted'), 'start of month', ?)
       GROUP BY strftime('%Y-%m', je.entry_date)
       ORDER BY month`
    )
    .bind(`-${months - 1} months`)
    .all<{ month: string; inflow: number; outflow: number }>();
  return c.json({
    success: true,
    data: (r.results ?? []).map((x) => ({
      month: x.month,
      penerimaan: x.inflow,
      pengeluaran: x.outflow,
      inflow: x.inflow,
      outflow: x.outflow,
      net: x.inflow - x.outflow,
    })),
  });
});

dashboardRoutes.get("/assets", async (c) => {
  const distribution = await assetsRepo(c.env.DB).distributionByType();
  return c.json({ success: true, data: distribution });
});

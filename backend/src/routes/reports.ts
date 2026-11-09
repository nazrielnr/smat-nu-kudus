import { Hono } from "hono";
import type { AppEnv } from "../types";
import { getTrialBalance } from "../accounting/queries";
import type { AccountType } from "../repositories/accounts";
import { isDebitPositive } from "../accounting/engine";

export const reportRoutes = new Hono<AppEnv>();

const VALID_ROLES = ["admin", "bendahara", "pemeriksa", "pimpinan", "pengelola_aset"];

reportRoutes.use("*", async (c, next) => {
  const user = c.get("currentUser");
  if (!VALID_ROLES.includes(user.role)) {
    return c.json(
      { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
      403
    );
  }
  await next();
});

interface BalanceRow {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  opening: number;
  total_debit: number;
  total_credit: number;
  closing: number;
}

interface WaqfAssetRow {
  id: number;
  asset_code: string;
  name: string;
  asset_type: string;
  acquisition_date: string;
  acquisition_value: number;
  book_value: number;
  status: string;
  management_status: string;
  location: string | null;
  wakif_name: string | null;
}

interface ActivityRow {
  id: number;
  transaction_number: string;
  transaction_type: "penerimaan" | "pengeluaran";
  transaction_date: string;
  description: string | null;
  amount: number;
  category_name: string | null;
  wakif_name: string | null;
}


/** Pengelompokan akun aktivitas mengikuti format Excel (Laporan Aktivitas & aset kelolaan). */
const ACTIVITY_GROUPS: Array<{ key: string; label: string; code: string; kind: "pendapatan" | "beban"; match: (code: string) => boolean }> = [
  { key: "wakaf", label: "Penerimaan wakaf", code: "411", kind: "pendapatan", match: (c) => c.startsWith("411") },
  { key: "hibah", label: "Penerimaan hibah", code: "412", kind: "pendapatan", match: (c) => c.startsWith("412") },
  { key: "pendapatan", label: "Pendapatan pengelolaan", code: "421-422", kind: "pendapatan", match: (c) => c.startsWith("421") || c.startsWith("422") },
  { key: "penyesuaian", label: "Penyesuaian nilai aset", code: "441", kind: "pendapatan", match: (c) => c.startsWith("441") },
  { key: "penyaluran", label: "Penyaluran manfaat wakaf", code: "521", kind: "beban", match: (c) => c.startsWith("521") },
  { key: "operasional", label: "Biaya operasional", code: "511-516", kind: "beban", match: (c) => c.startsWith("51") },
];

interface ActivityAccount { account_id: number; code: string; name: string; account_type: string; amount: number }

function buildActivityGroups(rows: ActivityAccount[]) {
  const used = new Set<ActivityAccount>();
  const groups = ACTIVITY_GROUPS.map((g) => {
    const items = rows.filter((r) => r.account_type === g.kind && g.match(r.code));
    items.forEach((i) => used.add(i));
    const total = items.reduce((s, x) => s + x.amount, 0);
    return { key: g.key, label: g.label, code: g.code, type: g.kind, items, total, surplus: g.kind === "pendapatan" ? total : -total };
  });
  // akun di luar pola kode di atas tetap ikut dihitung
  const rest = rows.filter((r) => !used.has(r));
  for (const kind of ["pendapatan", "beban"] as const) {
    const items = rest.filter((r) => r.account_type === kind);
    if (items.length === 0) continue;
    const total = items.reduce((s, x) => s + x.amount, 0);
    groups.push({ key: `lain-${kind}`, label: kind === "pendapatan" ? "Pendapatan lainnya" : "Beban lainnya", code: "", type: kind, items, total, surplus: kind === "pendapatan" ? total : -total });
  }
  return groups.filter((g) => g.items.length > 0);
}

reportRoutes.get("/financial-position", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
  const tb = await getTrialBalance(c.env.DB, date);
  const rows = tb.rows as BalanceRow[];

  const group = (types: string[]) =>
    rows
      .filter((r) => types.includes(r.account_type) && (r.closing !== 0 || r.opening !== 0))
      .map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, amount: r.closing }));

  const assets = group(["aset"]);
  const liabilities = group(["liabilitas"]);
  const netAssets = group(["aset_neto"]);
  // surplus/deficit of the period (pendapatan - beban) rolls into aset neto for the statement
  const surplus =
    rows
      .filter((r) => r.account_type === "pendapatan")
      .reduce((s, r) => s + r.closing, 0) -
    rows
      .filter((r) => r.account_type === "beban")
      .reduce((s, r) => s + r.closing, 0);

  // Aset kelolaan = akumulasi surplus, dirinci per kelompok aktivitas (format Excel)
  const activityRows: ActivityAccount[] = rows
    .filter((r) => r.account_type === "pendapatan" || r.account_type === "beban")
    .map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, account_type: r.account_type, amount: r.closing }));
  for (const g of buildActivityGroups(activityRows)) {
    if (g.surplus !== 0) netAssets.push({ account_id: 0, code: g.code, name: g.label, amount: g.surplus });
  }
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
  const totalNetAssets = netAssets.reduce((s, a) => s + a.amount, 0);

  return c.json({
    success: true,
    data: {
      report: "posisi_keuangan",
      as_of: date,
      aset: assets,
      liabilitas: liabilities,
      aset_neto: netAssets,
      total_aset: totalAssets,
      total_liabilitas: totalLiabilities,
      total_aset_neto: totalNetAssets,
      surplus_defisit: surplus,
      balanced: totalAssets === totalLiabilities + totalNetAssets,
    },
  });
});

reportRoutes.get("/waqf-assets", async (c) => {
  const db = c.env.DB;
  const dateFrom = c.req.query("date_from");
  const dateTo = c.req.query("date_to");
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (dateFrom) { where.push("a.acquisition_date >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("a.acquisition_date <= ?"); params.push(dateTo); }
  const r = await db
    .prepare(
      `SELECT a.id, a.asset_code, a.name, a.asset_type, a.acquisition_date, a.acquisition_value,
              a.book_value, a.status, a.management_status, a.location, w.name AS wakif_name
       FROM assets a LEFT JOIN wakif w ON w.id = a.wakif_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.acquisition_date`
    )
    .bind(...params)
    .all<WaqfAssetRow>();
  const items = (r.results ?? []).map((a) => ({ ...a, asset_id: a.id }));
  const byType: Record<string, { count: number; total_value: number }> = {};
  for (const a of items) {
    const t = (byType[a.asset_type] ??= { count: 0, total_value: 0 });
    t.count += 1;
    t.total_value += a.book_value;
  }
  return c.json({
    success: true,
    data: {
      report: "aset_wakaf",
      period: { date_from: dateFrom ?? null, date_to: dateTo ?? null },
      items,
      total_assets: items.length,
      total_value: items.reduce((s, a) => s + a.book_value, 0),
      distribution_by_type: byType,
    },
  });
});

reportRoutes.get("/activities", async (c) => {
  const db = c.env.DB;
  const dateFrom = c.req.query("date_from") ?? "0000-01-01";
  const dateTo = c.req.query("date_to") ?? "9999-12-31";
  // Pendapatan & beban per akun dari jurnal terposting (termasuk jurnal penyesuaian)
  const r = await db
    .prepare(
      `SELECT a.id AS account_id, a.code, a.name, a.account_type,
              COALESCE(SUM(jl.debit), 0) AS debit, COALESCE(SUM(jl.credit), 0) AS credit
       FROM accounts a
       JOIN journal_lines jl ON jl.account_id = a.id
       JOIN journal_entries je ON je.id = jl.journal_id
       WHERE je.status = 'posted' AND a.account_type IN ('pendapatan','beban')
         AND je.entry_date >= ? AND je.entry_date <= ?
       GROUP BY a.id, a.code, a.name, a.account_type
       ORDER BY a.code`
    )
    .bind(dateFrom, dateTo)
    .all<{ account_id: number; code: string; name: string; account_type: string; debit: number; credit: number }>();
  const rows = r.results ?? [];
  const pendapatan = rows
    .filter((x) => x.account_type === "pendapatan")
    .map((x) => ({ account_id: x.account_id, code: x.code, name: x.name, account_type: x.account_type, amount: x.credit - x.debit }));
  const beban = rows
    .filter((x) => x.account_type === "beban")
    .map((x) => ({ account_id: x.account_id, code: x.code, name: x.name, account_type: x.account_type, amount: x.debit - x.credit }));
  const totalPendapatan = pendapatan.reduce((s, x) => s + x.amount, 0);
  const totalBeban = beban.reduce((s, x) => s + x.amount, 0);
  return c.json({
    success: true,
    data: {
      report: "aktivitas_pengelolaan",
      date_from: c.req.query("date_from") ?? null,
      date_to: c.req.query("date_to") ?? null,
      groups: buildActivityGroups([...pendapatan, ...beban]),
      pendapatan,
      beban,
      total_pendapatan: totalPendapatan,
      total_beban: totalBeban,
      net_change: totalPendapatan - totalBeban,
    },
  });
});

interface CashLine { journal_id: number; account_id: number; code: string; name: string; debit: number; credit: number }

/** Arus kas metode langsung: kas/bank dialokasikan ke akun lawan di tiap jurnal, lalu diklasifikasi. */
reportRoutes.get("/cash-flow", async (c) => {
  const db = c.env.DB;
  const dateFrom = c.req.query("date_from") ?? "0000-01-01";
  const dateTo = c.req.query("date_to") ?? "9999-12-31";

  const opening = await db
    .prepare(
      `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS n
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.status = 'posted' AND a.code IN ('111','112') AND je.entry_date < ?`
    )
    .bind(dateFrom)
    .first<{ n: number }>();

  const lines = await db
    .prepare(
      `SELECT jl.journal_id, a.id AS account_id, a.code, a.name, jl.debit, jl.credit
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.status = 'posted' AND je.entry_date >= ? AND je.entry_date <= ?
         AND jl.journal_id IN (
           SELECT jl2.journal_id FROM journal_lines jl2 JOIN accounts a2 ON a2.id = jl2.account_id
           WHERE a2.code IN ('111','112'))
       ORDER BY jl.journal_id, jl.line_number`
    )
    .bind(dateFrom, dateTo)
    .all<CashLine>();

  const byJournal = new Map<number, CashLine[]>();
  for (const l of lines.results ?? []) {
    const arr = byJournal.get(l.journal_id) ?? [];
    arr.push(l);
    byJournal.set(l.journal_id, arr);
  }

  type Section = "operating" | "investing" | "financing";
  const sectionOf = (code: string): Section =>
    code.startsWith("12") ? "investing"
    : code === "411-5" || code === "211" || code === "212" ? "financing"
    : "operating";

  const buckets = new Map<string, { section: Section; description: string; amount: number }>();
  for (const ls of byJournal.values()) {
    const cash = ls.filter((l) => l.code === "111" || l.code === "112");
    const other = ls.filter((l) => l.code !== "111" && l.code !== "112");
    const net = cash.reduce((s, l) => s + l.debit - l.credit, 0);
    if (net === 0) continue;
    // arus masuk -> lawan di sisi kredit; arus keluar -> lawan di sisi debit. Alokasikan dari yang terbesar.
    const counter = other
      .map((l) => ({ l, amt: net > 0 ? l.credit : l.debit }))
      .filter((x) => x.amt > 0)
      .sort((x, y) => y.amt - x.amt);
    let left = Math.abs(net);
    for (const { l, amt } of counter) {
      if (left <= 0) break;
      const take = Math.min(left, amt);
      left -= take;
      const signed = net > 0 ? take : -take;
      const key = `${l.code}|${net > 0 ? "in" : "out"}`;
      const b = buckets.get(key) ?? {
        section: sectionOf(l.code),
        description: `${net > 0 ? "Penerimaan" : "Pembayaran"} — ${l.name}`,
        amount: 0,
      };
      b.amount += signed;
      buckets.set(key, b);
    }
  }
  const pick = (s: Section) =>
    [...buckets.values()].filter((b) => b.section === s).map(({ description, amount }) => ({ description, amount }));
  const all = [...buckets.values()];
  const netChange = all.reduce((s, b) => s + b.amount, 0);
  const beginning = opening?.n ?? 0;
  return c.json({
    success: true,
    data: {
      report: "arus_kas",
      date_from: c.req.query("date_from") ?? null,
      date_to: c.req.query("date_to") ?? null,
      operating: pick("operating"),
      investing: pick("investing"),
      financing: pick("financing"),
      beginning_balance: beginning,
      net_change: netChange,
      ending_balance: beginning + netChange,
      penerimaan: all.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0),
      pengeluaran: -all.filter((b) => b.amount < 0).reduce((s, b) => s + b.amount, 0),
    },
  });
});

/**
 * Kertas kerja: neraca saldo (sebelum AJP), jurnal penyesuaian, neraca saldo setelah disesuaikan.
 * Jurnal penyesuaian dikenali dari nomor berawalan "AJP-".
 */
reportRoutes.get("/worksheet", async (c) => {
  const date = c.req.query("date") ?? "9999-12-31";
  const r = await c.env.DB
    .prepare(
      `SELECT a.id AS account_id, a.code, a.name, a.account_type,
              COALESCE(SUM(CASE WHEN je.journal_number NOT LIKE 'AJP-%' THEN jl.debit ELSE 0 END), 0) AS u_debit,
              COALESCE(SUM(CASE WHEN je.journal_number NOT LIKE 'AJP-%' THEN jl.credit ELSE 0 END), 0) AS u_credit,
              COALESCE(SUM(CASE WHEN je.journal_number LIKE 'AJP-%' THEN jl.debit ELSE 0 END), 0) AS a_debit,
              COALESCE(SUM(CASE WHEN je.journal_number LIKE 'AJP-%' THEN jl.credit ELSE 0 END), 0) AS a_credit
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted' AND je.entry_date <= ?
       GROUP BY a.id, a.code, a.name, a.account_type
       ORDER BY a.code`
    )
    .bind(date)
    .all<{ account_id: number; code: string; name: string; account_type: string; u_debit: number; u_credit: number; a_debit: number; a_credit: number }>();
  const side = (net: number) => ({ debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  const rows = (r.results ?? [])
    .filter((x) => x.u_debit + x.u_credit + x.a_debit + x.a_credit > 0)
    .map((x) => {
      const u = side(x.u_debit - x.u_credit);
      const adj = { debit: x.a_debit, credit: x.a_credit };
      const f = side(x.u_debit - x.u_credit + x.a_debit - x.a_credit);
      return {
        account_id: x.account_id, code: x.code, name: x.name, account_type: x.account_type,
        unadjusted_debit: u.debit, unadjusted_credit: u.credit,
        adjustment_debit: adj.debit, adjustment_credit: adj.credit,
        adjusted_debit: f.debit, adjusted_credit: f.credit,
      };
    });
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, x) => s + (x[k] as number), 0);
  const totals = {
    unadjusted_debit: sum("unadjusted_debit"), unadjusted_credit: sum("unadjusted_credit"),
    adjustment_debit: sum("adjustment_debit"), adjustment_credit: sum("adjustment_credit"),
    adjusted_debit: sum("adjusted_debit"), adjusted_credit: sum("adjusted_credit"),
  };
  return c.json({
    success: true,
    data: {
      report: "kertas_kerja",
      as_of: date === "9999-12-31" ? null : date,
      rows,
      totals,
      balanced:
        totals.unadjusted_debit === totals.unadjusted_credit &&
        totals.adjustment_debit === totals.adjustment_credit &&
        totals.adjusted_debit === totals.adjusted_credit,
    },
  });
});

const ASSET_GROUPS: Array<{ name: string; codes: string[] }> = [
  { name: "Tanah", codes: ["121-1"] },
  { name: "Tanah Perkebunan", codes: ["121-2"] },
  { name: "Kendaraan", codes: ["122", "126-2"] },
  { name: "Mesin", codes: ["123", "126-3"] },
  { name: "Peralatan Kantor", codes: ["124", "126-1"] },
  { name: "Kolam & Bibit Ikan", codes: ["125"] },
];

/** Laporan perubahan aset kelolaan: saldo awal, penambahan, pengurangan, revaluasi, penyusutan, saldo akhir. */
reportRoutes.get("/managed-assets", async (c) => {
  const db = c.env.DB;
  const from = c.req.query("date_from") ?? "0000-01-01";
  const to = c.req.query("date_to") ?? "9999-12-31";
  const r = await db
    .prepare(
      `SELECT a.code,
        COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jl.debit - jl.credit ELSE 0 END), 0) AS opening,
        COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? AND je.journal_number NOT LIKE 'AJP-%' THEN jl.debit ELSE 0 END), 0) AS add_d,
        COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? AND je.journal_number NOT LIKE 'AJP-%' THEN jl.credit ELSE 0 END), 0) AS add_c,
        COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? AND je.journal_number LIKE 'AJP-%' THEN jl.debit ELSE 0 END), 0) AS adj_d,
        COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? AND je.journal_number LIKE 'AJP-%' THEN jl.credit ELSE 0 END), 0) AS adj_c
       FROM accounts a
       JOIN journal_lines jl ON jl.account_id = a.id
       JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted'
       WHERE a.code LIKE '12%'
       GROUP BY a.code`
    )
    .bind(from, from, to, from, to, from, to, from, to)
    .all<{ code: string; opening: number; add_d: number; add_c: number; adj_d: number; adj_c: number }>();
  const byCode = new Map((r.results ?? []).map((x) => [x.code, x] as const));

  const items = ASSET_GROUPS.map((g) => {
    const xs = g.codes.map((k) => byCode.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
    const sum = (f: (x: (typeof xs)[number]) => number) => xs.reduce((s, x) => s + f(x), 0);
    const opening = sum((x) => x.opening);
    const penambahan = sum((x) => x.add_d);
    const pengurangan = sum((x) => x.add_c);
    const revaluasi = sum((x) => x.adj_d);
    const penyusutan = sum((x) => x.adj_c);
    return {
      name: g.name, opening, penambahan, pengurangan, revaluasi, penyusutan,
      closing: opening + penambahan - pengurangan + revaluasi - penyusutan,
    };
  });

  // Wakaf uang: kredit ke aset neto wakaf permanen yang berasal dari transaksi kas
  const cashWaqf = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jl.credit ELSE 0 END), 0) AS opening,
              COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? THEN jl.credit ELSE 0 END), 0) AS added
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE je.status = 'posted' AND a.code = '411-5'`
    )
    .bind(from, from, to)
    .first<{ opening: number; added: number }>();
  items.unshift({
    name: "Wakaf Uang (Kas)", opening: cashWaqf?.opening ?? 0, penambahan: cashWaqf?.added ?? 0,
    pengurangan: 0, revaluasi: 0, penyusutan: 0,
    closing: (cashWaqf?.opening ?? 0) + (cashWaqf?.added ?? 0),
  });

  const total = (k: "opening" | "penambahan" | "pengurangan" | "revaluasi" | "penyusutan" | "closing") =>
    items.reduce((s, x) => s + x[k], 0);
  return c.json({
    success: true,
    data: {
      report: "perubahan_aset_kelolaan",
      date_from: c.req.query("date_from") ?? null,
      date_to: c.req.query("date_to") ?? null,
      items,
      totals: {
        opening: total("opening"), penambahan: total("penambahan"), pengurangan: total("pengurangan"),
        revaluasi: total("revaluasi"), penyusutan: total("penyusutan"), closing: total("closing"),
      },
    },
  });
});

reportRoutes.get("/notes", async (c) => {
  const db = c.env.DB;
  const tb = await getTrialBalance(db, new Date().toISOString().slice(0, 10));
  const revenueRows = tb.rows.filter(
    (r) => r.account_type === "pendapatan" || r.account_type === "beban"
  );
  const pendapatan = revenueRows
    .filter((r) => r.account_type === "pendapatan")
    .reduce((s, r) => s + r.closing, 0);
  const beban = revenueRows
    .filter((r) => r.account_type === "beban")
    .reduce((s, r) => s + r.closing, 0);
  return c.json({
    success: true,
    data: {
      report: "catatan_atas_laporan",
      pendapatan,
      beban,
      surplus_defisit: pendapatan - beban,
      accounting_policy:
        "Basis akrual; seluruh transaksi tercatat melalui jurnal berpasangan (debit = kredit). Aset wakaf dinyatakan pada nilai perolehan.",
    },
  });
});

export { isDebitPositive };
export type { AccountType };

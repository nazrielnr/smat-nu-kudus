/**
 * Seed generator: runs under Node (tsx), produces SQL statements on stdout.
 * Password hashes are PBKDF2-SHA256 (100k iterations) computed with WebCrypto —
 * identical algorithm to the runtime (src/utils/password.ts).
 * Usage: tsx scripts/seed.ts > db/seed.sql
 */
import { randomBytes, webcrypto } from "node:crypto";
import { writeFileSync } from "node:fs";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const baseKey = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password).buffer as ArrayBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    baseKey,
    KEY_LENGTH * 8
  );
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

const YEAR = 2025;
const D = (day: number) => `${YEAR}-02-${String(day).padStart(2, "0")}`;

function q(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Kasus: Nadzir Wakaf Amanah Ummat — transaksi Februari 2025
// ---------------------------------------------------------------------------

// Chart of accounts mengikuti Excel "Wakaf_sansan_nirlaba_kedua". Kode 111, 112, 120, 411-6
// dipakai engine posting (src/accounting/engine.ts); 112/120/411-6 tidak dipakai di kasus ini.
// Akun 411/412/421/422/441 bertipe pendapatan karena Laporan Aktivitas Excel memasukkannya ke surplus.
const ACCOUNTS: Array<[number, string, string, string]> = [
  [1, "111", "Kas", "aset"],
  [2, "112", "Bank", "aset"],
  [3, "113", "Sewa Dibayar Dimuka", "aset"],
  [4, "114", "Perlengkapan Kantor", "aset"],
  [5, "115", "Piutang Pendapatan Penggilingan Padi", "aset"],
  [6, "116", "Piutang Imbalan Nazhir (kelebihan pembayaran)", "aset"],
  [7, "120", "Aset Wakaf Nonkas", "aset"],
  [8, "121-1", "Tanah", "aset"],
  [9, "121-2", "Tanah Perkebunan", "aset"],
  [10, "122", "Kendaraan", "aset"],
  [11, "123", "Mesin", "aset"],
  [12, "124", "Peralatan Kantor", "aset"],
  [13, "125", "Kolam & Bibit Ikan", "aset"],
  [14, "126-1", "Akumulasi Penyusutan Peralatan Kantor", "aset"],
  [15, "126-2", "Akumulasi Penyusutan Kendaraan", "aset"],
  [16, "126-3", "Akumulasi Penyusutan Mesin", "aset"],
  [17, "211", "Utang", "liabilitas"],
  [18, "212", "Liabilitas (Utang) - Wakaf Temporer", "liabilitas"],
  [19, "411-1", "Penerimaan Wakaf Permanen - Tanah", "pendapatan"],
  [20, "411-2", "Penerimaan Wakaf Permanen - Kendaraan", "pendapatan"],
  [21, "411-3", "Penerimaan Wakaf Permanen - Tanah Perkebunan", "pendapatan"],
  [22, "411-4", "Penerimaan Wakaf Permanen - Mesin", "pendapatan"],
  [23, "411-5", "Penerimaan Wakaf Permanen - Kas", "pendapatan"],
  [24, "411-6", "Penerimaan Wakaf Permanen - Aset Lainnya", "pendapatan"],
  [25, "412", "Penerimaan Hibah", "pendapatan"],
  [26, "421-1", "Pendapatan Pengelolaan Aset Wakaf - Tanah Perkebunan", "pendapatan"],
  [27, "421-2", "Pendapatan Pengelolaan Aset Wakaf - Penggilingan Padi", "pendapatan"],
  [28, "422", "Pendapatan Penjualan Wakaf - Hasil Panen Lele", "pendapatan"],
  [29, "441", "Penerimaan Wakaf - Penyesuaian Nilai Aset", "pendapatan"],
  [30, "511", "Beban Gaji", "beban"],
  [31, "512", "Beban Listrik", "beban"],
  [32, "513", "Beban Imbalan Nazhir", "beban"],
  [33, "514", "Beban Perlengkapan Kantor", "beban"],
  [34, "515-1", "Beban Penyusutan Peralatan Kantor", "beban"],
  [35, "515-2", "Beban Penyusutan Kendaraan", "beban"],
  [36, "515-3", "Beban Penyusutan Mesin", "beban"],
  [37, "516", "Beban Sewa", "beban"],
  [38, "521-1", "Penyaluran Manfaat Wakaf - Beasiswa", "beban"],
  [39, "521-2", "Penyaluran Manfaat Wakaf - Bantuan Sosial", "beban"],
];
const ACC = Object.fromEntries(ACCOUNTS.map(([id, code]) => [code, id])) as Record<string, number>;

// Kategori transaksi (hanya untuk transaksi satu-pasang yang lewat modul Transaksi)
const CATEGORIES: Array<[number, string, string, string]> = [
  [1, "Wakaf Uang Tunai", "penerimaan", "411-5"],
  [2, "Hibah", "penerimaan", "412"],
  [3, "Sewa Aset Wakaf (Tanah Perkebunan)", "penerimaan", "421-1"],
  [4, "Jasa Penggilingan Padi", "penerimaan", "421-2"],
  [5, "Hasil Panen Lele", "penerimaan", "422"],
  [6, "Penyaluran Beasiswa", "pengeluaran", "521-1"],
  [7, "Penyaluran Bantuan Sosial", "pengeluaran", "521-2"],
  [8, "Beban Gaji", "pengeluaran", "511"],
  [9, "Beban Listrik", "pengeluaran", "512"],
  [10, "Imbalan Nazhir", "pengeluaran", "513"],
];

const WAKIF: Array<[number, string, string, string | null]> = [
  [1, "Pemerintah Desa Sukamaju", "lembaga", "Desa Sukamaju"],
  [2, "Tuan Budi", "individu", null],
  [3, "Wakif (tidak disebutkan)", "individu", null],
];

// Transaksi satu-pasang (Kas vs akun kategori) -> tercatat di modul Transaksi + jurnal otomatis.
// Catatan: 29 Feb 2025 tidak ada, imbalan nazhir dicatat tgl 28.
type Tx = { date: number; type: "penerimaan" | "pengeluaran"; cat: number; wakif?: number; amount: number; desc: string };
const TXS: Tx[] = [
  { date: 3, type: "penerimaan", cat: 2, wakif: 2, amount: 100_000_000, desc: "Penerimaan hibah uang dari Tuan Budi untuk biaya operasional nazhir" },
  { date: 10, type: "penerimaan", cat: 3, amount: 40_000_000, desc: "Pendapatan pengelolaan aset wakaf - tanah perkebunan (sewa 1 tahun)" },
  { date: 12, type: "penerimaan", cat: 4, amount: 7_000_000, desc: "Pendapatan pengelolaan aset wakaf - penggilingan padi" },
  { date: 14, type: "pengeluaran", cat: 8, amount: 2_000_000, desc: "Gaji karyawan penggilingan padi bulan Februari" },
  { date: 16, type: "pengeluaran", cat: 6, amount: 4_000_000, desc: "Penyaluran manfaat wakaf - beasiswa 4 santri x Rp1.000.000" },
  { date: 18, type: "penerimaan", cat: 1, wakif: 3, amount: 4_000_000, desc: "Penerimaan wakaf permanen - kas" },
  { date: 22, type: "penerimaan", cat: 1, wakif: 3, amount: 4_000_000, desc: "Penerimaan wakaf permanen - kas" },
  { date: 23, type: "pengeluaran", cat: 7, amount: 1_200_000, desc: "Penyaluran manfaat wakaf - bantuan sosial 40 sembako x Rp30.000" },
  { date: 26, type: "pengeluaran", cat: 9, amount: 500_000, desc: "Pembayaran biaya listrik" },
  { date: 28, type: "penerimaan", cat: 5, amount: 5_000_000, desc: "Pendapatan penjualan wakaf - hasil panen lele" },
  { date: 28, type: "pengeluaran", cat: 10, amount: 5_000_000, desc: "Pembayaran imbalan nazhir (dikoreksi di AJP 4)" },
];

// Jurnal umum multi-akun / nonkas (manual). Baris: [kode akun, debit, kredit]
type Line = [string, number, number];
type Manual = { date: number; desc: string; lines: Line[] };
const MANUAL_GENERAL: Manual[] = [
  { date: 2, desc: "Penerimaan wakaf permanen - tanah (nilai wajar)", lines: [["121-1", 200_000_000, 0], ["411-1", 0, 200_000_000]] },
  { date: 4, desc: "Sewa ruko 6 bulan dibayar tunai", lines: [["113", 5_000_000, 0], ["111", 0, 5_000_000]] },
  { date: 5, desc: "Beli peralatan kantor Rp4.000.000, dibayar Rp2.000.000, sisa bulan depan", lines: [["124", 4_000_000, 0], ["211", 0, 2_000_000], ["111", 0, 2_000_000]] },
  { date: 6, desc: "Beli perlengkapan kantor tunai", lines: [["114", 1_500_000, 0], ["111", 0, 1_500_000]] },
  { date: 8, desc: "Penerimaan wakaf permanen - kendaraan (nilai wajar Rp55.000.000)", lines: [["122", 55_000_000, 0], ["411-2", 0, 55_000_000]] },
  { date: 9, desc: "Penerimaan wakaf permanen - tanah perkebunan 2 ha (nilai wajar)", lines: [["121-2", 400_000_000, 0], ["411-3", 0, 400_000_000]] },
  { date: 11, desc: "Penerimaan wakaf permanen - mesin penggilingan padi", lines: [["123", 15_000_000, 0], ["411-4", 0, 15_000_000]] },
  { date: 20, desc: "Wakaf temporer: kolam + 3.000 bibit lele", lines: [["125", 12_000_000, 0], ["212", 0, 12_000_000]] },
  { date: 24, desc: "Kerja sama pembiayaan produktif BMT Arrahmah (dicatat sebagai utang)", lines: [["111", 18_000_000, 0], ["211", 0, 18_000_000]] },
];

// Jurnal penyesuaian (AJP) per 28 Feb 2025, sesuai sheet AJP di Excel.
const AJP_DATE = 28;
const sewaTerpakai = Math.round(5_000_000 / 3); // Excel: Rp5.000.000 x 1/3
const perlengkapanTerpakai = 1_500_000 - 500_000;
const susutPeralatan = 4_000_000 * 0.05;
const susutKendaraan = 55_000_000 * 0.05;
const susutMesin = 15_000_000 * 0.05;
const piutangJasa = 1_000_000;
const naikTanahBengkok = 200_000_000 * 0.01; // Excel: hanya akun Tanah, bukan tanah perkebunan
const naikTanahSawit = 0;
// Excel: pendapatan bersih pengelolaan = sewa 40jt + jasa 7jt + lele 5jt = 52jt (sebelum AJP)
const pendapatanBersih = 40_000_000 + 7_000_000 + 5_000_000;
const imbalanSeharusnya = Math.round(pendapatanBersih * 0.06); // 3.120.000
const imbalanKelebihan = 5_000_000 - imbalanSeharusnya; // 1.880.000

const AJP: Array<{ no: number; desc: string; lines: Line[] }> = [
  { no: 1, desc: "AJP 1 — Beban sewa (Rp5.000.000 x 1/3)", lines: [["516", sewaTerpakai, 0], ["113", 0, sewaTerpakai]] },
  { no: 2, desc: "AJP 2 — Perlengkapan terpakai (sisa Rp500.000)", lines: [["514", perlengkapanTerpakai, 0], ["114", 0, perlengkapanTerpakai]] },
  {
    no: 3, desc: "AJP 3 — Penyusutan 5% peralatan, kendaraan, dan mesin",
    lines: [
      ["515-1", susutPeralatan, 0], ["126-1", 0, susutPeralatan],
      ["515-2", susutKendaraan, 0], ["126-2", 0, susutKendaraan],
      ["515-3", susutMesin, 0], ["126-3", 0, susutMesin],
    ],
  },
  { no: 4, desc: "AJP 4 — Imbalan nazhir 6% x Rp52.000.000 = Rp3.120.000; kelebihan bayar Rp1.880.000", lines: [["116", imbalanKelebihan, 0], ["513", 0, imbalanKelebihan]] },
  { no: 5, desc: "AJP 5 — Pendapatan jasa penggilingan yang belum diterima", lines: [["115", piutangJasa, 0], ["421-2", 0, piutangJasa]] },
  { no: 6, desc: "AJP 6 — Kenaikan nilai tanah 1% dari nilai perolehan", lines: [["121-1", naikTanahBengkok, 0], ["441", 0, naikTanahBengkok]] },
];

async function main() {
  const lines: string[] = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    "DELETE FROM journal_lines;",
    "DELETE FROM journal_entries;",
    "DELETE FROM transactions;",
    "DELETE FROM asset_transfer_logs;",
    "DELETE FROM asset_documents;",
    "DELETE FROM asset_valuations;",
    "DELETE FROM assets;",
    "DELETE FROM attachments;",
    "DELETE FROM notification_logs;",
    "DELETE FROM report_snapshots;",
    "DELETE FROM fiscal_periods;",
    "DELETE FROM rekenings;",
    "DELETE FROM audit_logs;",
    "DELETE FROM sessions;",
    "DELETE FROM login_attempts;",
    "DELETE FROM transaction_categories;",
    "DELETE FROM accounts;",
    "DELETE FROM wakif;",
    "DELETE FROM users;",
    "DELETE FROM settings WHERE key = 'org_name';",
  ];

  // --- users (5 roles, password: Password123!) ---
  const users = [
    ["Administrator NU", "admin@nu-kudus.id", "admin"],
    ["Bendahara NU", "bendahara@nu-kudus.id", "bendahara"],
    ["Pengelola Aset", "pengelola.aset@nu-kudus.id", "pengelola_aset"],
    ["Pemeriksa", "pemeriksa@nu-kudus.id", "pemeriksa"],
    ["Pimpinan", "pimpinan@nu-kudus.id", "pimpinan"],
  ] as const;
  // Production: SEED_PASSWORDS_OUT=<file> -> random per-user passwords, written (mode 600) to that file.
  const passwordsOut = process.env.SEED_PASSWORDS_OUT;
  const credentials: string[] = [];
  for (const [name, email, role] of users) {
    const password = passwordsOut ? randomBytes(12).toString("base64url") : "Password123!";
    if (passwordsOut) credentials.push(`${email}\t${role}\t${password}`);
    const hash = await hashPassword(password);
    lines.push(
      `INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (${q(idOf(email))}, ${q(name)}, ${q(email)}, ${q(hash)}, ${q(role)}, 1);`
    );
  }

  if (passwordsOut) writeFileSync(passwordsOut, credentials.join("\n") + "\n", { mode: 0o600 });

  for (const [id, code, name, type] of ACCOUNTS) {
    lines.push(
      `INSERT INTO accounts (id, code, name, account_type, is_active) VALUES (${id}, ${q(code)}, ${q(name)}, ${q(type)}, 1);`
    );
  }

  for (const [id, name, type, accCode] of CATEGORIES) {
    lines.push(
      `INSERT INTO transaction_categories (id, name, transaction_type, default_account_id) VALUES (${id}, ${q(name)}, ${q(type)}, ${ACC[accCode]});`
    );
  }

  for (const [id, name, type, address] of WAKIF) {
    lines.push(
      `INSERT INTO wakif (id, name, type, address, is_active) VALUES (${id}, ${q(name)}, ${q(type)}, ${q(address)}, 1);`
    );
  }

  // --- aset wakaf (nilai wajar saat diterima; book_value = setelah penyesuaian per 28 Feb) ---
  // [id, kode, nama, tipe, wakif, tgl, nilai perolehan, nilai buku, pengelolaan, lokasi]
  const assets: Array<[number, string, string, string, number, number, number, number, string, string | null]> = [
    [1, `AST-${YEAR}-0001`, "Tanah Bengkok Desa Sukamaju", "tanah", 1, 2, 200_000_000, 200_000_000 + naikTanahBengkok, "diurus_sendiri", "Desa Sukamaju"],
    [2, `AST-${YEAR}-0002`, "Kendaraan Wakaf", "kendaraan", 3, 8, 55_000_000, 55_000_000 - susutKendaraan, "diurus_sendiri", null],
    [3, `AST-${YEAR}-0003`, "Tanah Perkebunan Sawit 2 Ha", "tanah", 3, 9, 400_000_000, 400_000_000 + naikTanahSawit, "disewakan", null],
    [4, `AST-${YEAR}-0004`, "Mesin Penggilingan Padi", "lainnya", 3, 11, 15_000_000, 15_000_000 - susutMesin, "diurus_sendiri", null],
    [5, `AST-${YEAR}-0005`, "Kolam + 3.000 Bibit Lele (wakaf sementara)", "lainnya", 3, 20, 12_000_000, 12_000_000, "diurus_sendiri", null],
  ];
  for (const [id, code, name, type, wakifId, day, acq, book, mgmt, loc] of assets) {
    lines.push(
      `INSERT INTO assets (id, asset_code, name, asset_type, wakif_id, acquisition_date, acquisition_value, book_value, location, status, management_status, created_by) VALUES (${id}, ${q(code)}, ${q(name)}, ${q(type)}, ${wakifId}, ${q(D(day))}, ${acq}, ${book}, ${q(loc)}, 'aktif', ${q(mgmt)}, 3);`
    );
  }
  lines.push(
    `INSERT INTO asset_valuations (asset_id, valuation_date, value, notes, created_by) VALUES (1, ${q(D(AJP_DATE))}, ${200_000_000 + naikTanahBengkok}, 'Kenaikan nilai 1% (AJP 6)', 3);`
  );

  // --- transaksi satu-pasang (diposting) + jurnal umum otomatis ---
  const bendaharaId = 2;
  const pemeriksaId = 4;
  let jn = 0;
  const jvNo = () => `JV-${YEAR}-${String(++jn).padStart(4, "0")}`;

  const dated: Array<{ date: number; emit: () => void }> = [];
  TXS.forEach((t, i) => {
    const id = i + 1;
    const number = `TX-${YEAR}-${String(id).padStart(4, "0")}`;
    const accCode = CATEGORIES.find((c) => c[0] === t.cat)![3];
    dated.push({
      date: t.date,
      emit: () => {
        lines.push(
          `INSERT INTO transactions (id, transaction_number, transaction_type, wakif_id, category_id, payment_method, amount, description, transaction_date, status, created_by, approved_at, approved_by, posted_at, posted_by) VALUES (${id}, ${q(number)}, ${q(t.type)}, ${q(t.wakif ?? null)}, ${t.cat}, 'tunai', ${t.amount}, ${q(t.desc)}, ${q(D(t.date))}, 'diposting', ${bendaharaId}, ${q(D(t.date) + " 12:00:00")}, ${pemeriksaId}, ${q(D(t.date) + " 12:00:00")}, ${pemeriksaId});`
        );
        const jl: Line[] =
          t.type === "penerimaan"
            ? [["111", t.amount, 0], [accCode, 0, t.amount]]
            : [[accCode, t.amount, 0], ["111", 0, t.amount]];
        emitJournal(jvNo(), D(t.date), `Auto journal for transaction ${number}`, "transaction_post", id, jl);
      },
    });
  });
  for (const m of MANUAL_GENERAL) {
    dated.push({ date: m.date, emit: () => emitJournal(jvNo(), D(m.date), m.desc, "manual", null, m.lines) });
  }

  let jid = 0;
  function emitJournal(number: string, date: string, desc: string, source: string, txId: number | null, ls: Line[]) {
    const id = ++jid;
    const total = ls.reduce((s, l) => s + l[1], 0);
    const credit = ls.reduce((s, l) => s + l[2], 0);
    if (total !== credit) throw new Error(`Jurnal tidak seimbang: ${number} (${total} != ${credit})`);
    lines.push(
      `INSERT INTO journal_entries (id, journal_number, entry_date, description, source_type, source_transaction_id, transaction_id, total_debit, total_credit, status, posted_at, created_by) VALUES (${id}, ${q(number)}, ${q(date)}, ${q(desc)}, ${q(source)}, ${q(txId)}, ${q(txId)}, ${total}, ${credit}, 'posted', ${q(date + " 12:00:00")}, ${pemeriksaId});`
    );
    ls.forEach(([code, d, c], i) => {
      lines.push(
        `INSERT INTO journal_lines (journal_id, account_id, debit, credit, line_number) VALUES (${id}, ${ACC[code]}, ${d}, ${c}, ${i + 1});`
      );
    });
  }

  dated.sort((a, b) => a.date - b.date);
  for (const d of dated) d.emit();

  // --- jurnal penyesuaian (AJP) ---
  for (const a of AJP) {
    emitJournal(`AJP-${YEAR}-${String(a.no).padStart(4, "0")}`, D(AJP_DATE), a.desc, "manual", null, a.lines);
  }

  lines.push(
    `INSERT INTO settings (key, value, description) VALUES ('org_name', 'Nadzir Wakaf Amanah Ummat', 'Nama organisasi');`
  );

  lines.push("COMMIT;");
  process.stdout.write(lines.join("\n") + "\n");
  console.error(`dasar imbalan = ${pendapatanBersih}; imbalan 6% = ${imbalanSeharusnya}`);
}

function idOf(email: string): number {
  const map: Record<string, number> = {
    "admin@nu-kudus.id": 1,
    "bendahara@nu-kudus.id": 2,
    "pengelola.aset@nu-kudus.id": 3,
    "pemeriksa@nu-kudus.id": 4,
    "pimpinan@nu-kudus.id": 5,
  };
  return map[email]!;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

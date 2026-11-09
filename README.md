# SMAT NU Kudus — Sistem Monitoring Aset Wakaf dan Tanah

Aplikasi monitoring aset wakaf dan tanah Nahdlatul Ulama Kabupaten Kudus: pencatatan wakif, transaksi keuangan wakaf, akuntansi berpasangan, laporan keuangan, serta pengelolaan aset beserta dokumennya.

## Struktur Repo

| Folder | Isi | Stack |
|---|---|---|
| `frontend/` | Aplikasi web (PWA) | React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod |
| `backend/` | REST API | Hono, Cloudflare Workers, D1 (SQLite), R2, Zod, Vitest |
| `demo-remotion/` | Video demo | Remotion |
| `demo-video/` | Komposisi video alternatif | HyperFrames |

## Fitur

- Dashboard ringkasan aset, transaksi, dan arus kas.
- Data wakif dan riwayat transaksinya.
- Alur transaksi: `draft` → `menunggu_persetujuan` → `disetujui` / `ditolak` → `diposting` / `dibatalkan`.
- Persetujuan berjenjang: pemeriksa tidak dapat menyetujui transaksi yang ia buat sendiri.
- Akuntansi otomatis (jurnal Dr/Cr per jenis transaksi), buku besar, neraca saldo, dan jurnal pembalik.
- Posting idempotent dan atomik (D1 batch).
- Laporan: posisi keuangan, aset wakaf, aktivitas, arus kas, dan catatan.
- Aset wakaf: data aset, riwayat, unggah dokumen (R2).
- Manajemen pengguna berbasis role (`admin`, `bendahara`, `pengelola_aset`, `pemeriksa`, `pimpinan`) dan audit log.

## Menjalankan Lokal

Butuh Node.js 20+ dan akun Cloudflare (untuk `wrangler`).

### Backend

```bash
cd backend
npm install

# Secret JWT lokal
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .dev.vars

# Migrasi + seed D1 lokal
npx wrangler d1 migrations apply DB --local
npx tsx scripts/seed.ts > db/seed.sql
npx wrangler d1 execute DB --local --file=db/seed.sql

npm run dev        # http://localhost:8788
```

Detail endpoint, aturan bisnis, dan alur verifikasi ada di [`backend/README.md`](backend/README.md).

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5174, proxy /api -> http://localhost:8788
```

### Akun Seed

Password semua akun: `Password123!`

| Email | Role |
|---|---|
| admin@nu-kudus.id | admin |
| bendahara@nu-kudus.id | bendahara |
| pengelola.aset@nu-kudus.id | pengelola_aset |
| pemeriksa@nu-kudus.id | pemeriksa |
| pimpinan@nu-kudus.id | pimpinan |

Untuk produksi, jalankan seed dengan `SEED_PASSWORDS_OUT=<file>` agar password dibuat acak per pengguna.

## Deploy

- **Backend** — Cloudflare Workers: `cd backend && npx wrangler deploy` (D1 `smat-nu-kudus`, R2 `smat-nu-kudus-docs`, binding di `wrangler.jsonc`).
- **Frontend** — Vercel (`frontend/vercel.json` me-rewrite `/api/*` ke Worker produksi) atau hosting statis apa pun setelah `npm run build`.

## Testing

```bash
cd backend
npm test           # vitest: akuntansi, posting, auth
npm run typecheck
```
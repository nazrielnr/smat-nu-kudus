# SIKW-BWI Kudus — Backend

Sistem Informasi Keuangan Wakaf BWI Kabupaten Kudus (SIKW-BWI Kudus) — Backend API.

**Stack**: Hono + Cloudflare Workers + D1 (SQLite) + R2, TypeScript strict, Zod validation, Vitest.

## Struktur

```
backend/
├── migrations/0001_init.sql   # 20 tabel + indeks (FK di transaction_date/status/wakif_id/account_id/journal_id)
├── scripts/seed.ts            # generator SQL seed (hash PBKDF2 via WebCrypto)
├── db/seed.sql                # hasil generate (committed untuk kenyamanan)
├── src/
│   ├── index.ts               # Hono app: CORS, error handler, auth middleware, routing
│   ├── middleware/auth.ts     # requireAuth (cookie/bearer), requireRoles, HttpError
│   ├── routes/                # auth, users, wakif, transactions, assets, accounting, reports, dashboard, audit-logs
│   ├── services/ (digabung di routes — repos terpisah)
│   ├── repositories/          # thin D1 wrappers: users, wakif, transactions, accounts, categories, journals, assets, audit
│   ├── accounting/            # engine (jurnal, validasi balance, ledger, trial balance), posting (atomic batch + idempotent + reverse), queries
│   ├── validators/            # zod schemas semua input
│   └── utils/                 # jwt (WebCrypto HMAC HS256), password (PBKDF2-SHA256 100k), numbers, pagination
└── test/                      # vitest: engine jurnal, posting idempotency, reversal, jwt, password
```

## Setup

```bash
cd backend
npm install

# 1. Secret untuk JWT (lokal)
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .dev.vars

# 2. Migrasi D1 lokal
npx wrangler d1 migrations apply DB --local

# 3. Seed: kasus Nadzir Wakaf Amanah Ummat Feb 2025 (5 user, 39 akun, 11 transaksi, 26 jurnal termasuk 6 AJP, 5 aset wakaf)
npx tsx scripts/seed.ts > db/seed.sql
npx wrangler d1 execute DB --local --file=db/seed.sql

# 4. Jalankan dev server (port 8787)
npx wrangler dev --port 8787
```

Frontend Vite dev berjalan di `http://localhost:5173` (CORS allow-origin via `CORS_ORIGIN` var).

## Akun Seed (password: `Password123!`)

| Email | Role |
|---|---|
| admin@bwi-kudus.id | admin |
| bendahara@bwi-kudus.id | bendahara |
| pengelola.aset@bwi-kudus.id | pengelola_aset |
| pemeriksa@bwi-kudus.id | pemeriksa |
| pimpinan@bwi-kudus.id | pimpinan |

## Alur Verifikasi (contoh)

```bash
BASE=http://localhost:8787/api/v1

# login (set cookie `session` HttpOnly)
curl -c c.txt -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"bendahara@bwi-kudus.id","password":"Password123!"}'

# buat penerimaan
curl -b c.txt -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d '{"transaction_type":"penerimaan","wakif_id":1,"category_id":1,"payment_method":"tunai","amount":15000000,"description":"Wakaf uang","transaction_date":"2026-11-01"}'

# submit → login pemeriksa → approve → post (idempotent) → journals → ledger → trial-balance → reports
curl -b c.txt -X POST $BASE/transactions/6/submit
curl -b p.txt -X POST $BASE/transactions/6/approve
curl -b p.txt -X POST $BASE/transactions/6/post    # {"idempotent":false}
curl -b p.txt -X POST $BASE/transactions/6/post    # {"idempotent":true}
curl -b p.txt $BASE/journals/3                     # debit = credit
curl -b p.txt "$BASE/ledger?account_id=1"          # saldo berjalan
curl -b p.txt "$BASE/trial-balance?date=2026-11-08" # balanced: true
curl -b p.txt "$BASE/reports/financial-position?date=2026-11-08"
```

## Aturan Bisnis

- **Uang**: integer rupiah (tanpa float). Tanggal: `YYYY-MM-DD`.
- **Status transaksi**: draft → menunggu_persetujuan → disetujui → ditolak | diposting | dibatalkan.
- **Posting**: atomic via D1 batch (insert journal_entries + journal_lines + update transaksi), **idempotent** (repost saat sudah diposting → return jurnal existing, tanpa duplikasi).
- **Approval guard**: hanya pemeriksa/admin yang bisa approve/reject/post; **tidak bisa menyetujui transaksi buatan sendiri** (approved_by ≠ created_by).
- **Reverse**: jurnal kebalikan (debit↔credit), transaksi jadi `dibatalkan` + `is_reversed=1`; reverse kedua kali juga idempotent.
- **Jurnal otomatis**:
  - Penerimaan uang: Dr Kas/Bank (per payment_method/rekening), Cr Pendapatan (default_account kategori)
  - Penerimaan aset nonkas: Dr Aset Wakaf Nonkas, Cr Aset Wakaf (aset neto)
  - Pengeluaran: Dr akun beban kategori, Cr Kas/Bank
- **Nomor jurnal**: `JV-<tahun>-0001` berurutan.

## Endpoint Utama (`/api/v1`)

Auth: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`
Transaksi: `GET|POST /transactions`, `GET|PUT /transactions/:id`, `POST /transactions/:id/submit|approve|reject|post|reverse`
Wakif: `GET|POST|PUT /wakif`, `GET /wakif/:id/transactions`
Aset: `GET|POST /assets`, `GET|PUT /assets/:id`, `GET /assets/:id/history`, `POST|GET /assets/:id/documents`, `GET /assets/:id/documents/:docId/file`
Akuntansi: `GET|POST /accounts`, `GET|POST /transaction-categories`, `GET /journals`, `GET /journals/:id`, `POST /journals/:id/post`, `GET /ledger`, `GET /trial-balance`
Laporan: `/reports/financial-position`, `/reports/waqf-assets`, `/reports/activities`, `/reports/cash-flow`, `/reports/notes`
Dashboard: `/dashboard/summary`, `/dashboard/transactions`, `/dashboard/cash-flow`, `/dashboard/assets`
Lainnya: `GET /audit-logs`, `GET|POST|PUT /users` + `PATCH /users/:id/status` (admin), `GET /health`

## Tests

```bash
npx vitest run    # 28 tests: balanced journals, posting idempotency, reversal, jwt, password
npx tsc --noEmit  # clean
```

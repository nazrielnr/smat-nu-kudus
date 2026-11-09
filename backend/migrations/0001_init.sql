-- SMAT NU Kudus — initial schema (PRD §5)
-- All money values stored as INTEGER rupiah. Dates as TEXT 'YYYY-MM-DD'.

PRAGMA foreign_keys = ON;

-- 1. users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','bendahara','pengelola_aset','pemeriksa','pimpinan')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. wakif (donors)
CREATE TABLE wakif (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individu' CHECK (type IN ('individu','organisasi','lembaga')),
  nik TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. accounts (Chart of Accounts)
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('aset','liabilitas','aset_neto','pendapatan','beban')),
  parent_id INTEGER REFERENCES accounts(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. transaction_categories
CREATE TABLE transaction_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('penerimaan','pengeluaran')),
  default_account_id INTEGER NOT NULL REFERENCES accounts(id),
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. transactions
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_number TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('penerimaan','pengeluaran')),
  wakif_id INTEGER REFERENCES wakif(id),
  category_id INTEGER REFERENCES transaction_categories(id),
  payment_method TEXT,
  rekening TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT,
  transaction_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','menunggu_persetujuan','disetujui','ditolak','diposting','dibatalkan')),
  attachment_url TEXT,
  rejection_reason TEXT,
  is_reversed INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TEXT,
  submitted_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  approved_by INTEGER REFERENCES users(id),
  rejected_at TEXT,
  rejected_by INTEGER REFERENCES users(id),
  posted_at TEXT,
  posted_by INTEGER REFERENCES users(id),
  reversed_at TEXT,
  reversed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_wakif_id ON transactions(wakif_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);

-- 6. journal_entries
CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_number TEXT NOT NULL UNIQUE,
  entry_date TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','transaction_post','transaction_reversal')),
  source_transaction_id INTEGER REFERENCES transactions(id),
  transaction_id INTEGER REFERENCES transactions(id),
  total_debit INTEGER NOT NULL DEFAULT 0,
  total_credit INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  posted_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_transaction_id ON journal_entries(transaction_id);
CREATE INDEX idx_journal_entries_source_transaction_id ON journal_entries(source_transaction_id);

-- 7. journal_lines
CREATE TABLE journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  description TEXT,
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  line_number INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_journal_lines_journal_id ON journal_lines(journal_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);

-- 8. assets (wakaf assets)
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('tanah','bangunan','uang','kendaraan','lainnya')),
  wakif_id INTEGER REFERENCES wakif(id),
  acquisition_date TEXT NOT NULL,
  acquisition_value INTEGER NOT NULL DEFAULT 0,
  book_value INTEGER NOT NULL DEFAULT 0,
  acquisition_method TEXT,
  location TEXT,
  certificate_number TEXT,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','tidak_aktif','dihapus','dipindahtangkan')),
  management_status TEXT NOT NULL DEFAULT 'diurus_sendiri' CHECK (management_status IN ('diurus_sendiri','dikuasakan','disewakan','dijual')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_assets_wakif_id ON assets(wakif_id);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);

-- 9. asset_documents
CREATE TABLE asset_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  document_type TEXT NOT NULL DEFAULT 'lainnya',
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  object_key TEXT NOT NULL,
  description TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_asset_documents_asset_id ON asset_documents(asset_id);

-- 10. asset_valuations (history / revaluation)
CREATE TABLE asset_valuations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  valuation_date TEXT NOT NULL,
  value INTEGER NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_asset_valuations_asset_id ON asset_valuations(asset_id);

-- 11. asset_transfer_logs (history of changes)
CREATE TABLE asset_transfer_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  change_type TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  changed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_asset_transfer_logs_asset_id ON asset_transfer_logs(asset_id);

-- 12. audit_logs (append-only)
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- 13. settings (app settings, admin editable)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. sessions (audit of issued sessions; JWT is stateless, this is for tracking)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- 15. reports_snapshots (cached/generated report metadata)
CREATE TABLE report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  params TEXT,
  generated_by INTEGER REFERENCES users(id),
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. cash_accounts / rekening (bank accounts for payment routing)
CREATE TABLE rekenings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  bank_name TEXT,
  account_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. notification_logs
CREATE TABLE notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);

-- 18. fiscal_periods
CREATE TABLE fiscal_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  UNIQUE(year, month)
);

-- 19. attachments (generic file registry)
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  object_key TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);

-- 20. migration tracker is D1-native; last table: login_attempts (rate/audit aid)
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_address TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at);

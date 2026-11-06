-- HHBA AI apply credits: additive to the existing HHBA_PNVS_AUTH_DB D1.
-- Apply only after backup and preview verification; never backfill fake purchases.
-- Available credits are derived from PAID orders minus RESERVED/COMPLETED tasks;
-- browsers never supply a price, balance, or paid status.
CREATE TABLE IF NOT EXISTS hhba_apply_orders (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 package_uses INTEGER NOT NULL CHECK (package_uses IN (10,20,50,100)),
 amount_fen INTEGER NOT NULL CHECK (amount_fen = package_uses * 30),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','closed','refunded')),
 provider TEXT NOT NULL DEFAULT 'alipay_f2f' CHECK (provider='alipay_f2f'),
 provider_trade_no TEXT UNIQUE,
 qr_code TEXT,
 created_at TEXT NOT NULL,
 paid_at TEXT,
 checked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_orders_phone_time ON hhba_apply_orders(phone,created_at DESC);
CREATE TABLE IF NOT EXISTS hhba_apply_tasks (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK (status IN ('reserved','completed','released')),
 created_at TEXT NOT NULL,
 finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_tasks_phone_time ON hhba_apply_tasks(phone,created_at DESC);
-- Immutable events are added in a later migration only after the trusted
-- payment and task settling boundaries have completed their acceptance tests.

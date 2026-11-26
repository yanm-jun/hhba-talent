-- Separate smart-match SKU. Never mint paid rows from a browser or test flag.
CREATE TABLE IF NOT EXISTS hhba_match_orders (
 id TEXT PRIMARY KEY NOT NULL,
 phone TEXT NOT NULL,
 amount_fen INTEGER NOT NULL CHECK(amount_fen=1990),
 status TEXT NOT NULL CHECK(status IN ('pending','paid','closed','refunded')),
 provider_trade_no TEXT UNIQUE,
 qr_code TEXT,
 created_at TEXT NOT NULL,
 paid_at TEXT,
 checked_at TEXT,
 task_binding TEXT UNIQUE,
 bound_at TEXT,
 task_closed_at TEXT,
 CHECK(status<>'paid' OR (provider_trade_no IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS hhba_match_one_active_order ON hhba_match_orders(phone) WHERE status IN ('pending','paid') AND task_closed_at IS NULL;
CREATE INDEX IF NOT EXISTS hhba_match_orders_owner ON hhba_match_orders(phone,created_at DESC);

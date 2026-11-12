-- HHBA standalone administrator password login. This is a NEW isolated
-- credential database, not the existing employer, applicant or metrics DB.
CREATE TABLE IF NOT EXISTS hhba_console_owner (
 id TEXT PRIMARY KEY CHECK(id='owner'),
 email TEXT NOT NULL,
 salt_b64 TEXT NOT NULL,
 hash_b64 TEXT NOT NULL,
 iterations INTEGER NOT NULL CHECK(iterations >= 100000),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hhba_console_sessions (
 token_hash TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES hhba_console_owner(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 issued_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_console_sessions_expiry ON hhba_console_sessions(expires_at);
CREATE TABLE IF NOT EXISTS hhba_console_login_limits (
 identity_hash TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0,
 lock_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_console_login_limit_time ON hhba_console_login_limits(updated_at);

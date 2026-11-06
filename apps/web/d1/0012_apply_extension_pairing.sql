-- Phase 3 - candidate-to-browser-extension limited pairing. No login token copied.
-- Additive migration for HHBA_PNVS_AUTH_DB after backups & preview acceptance.
CREATE TABLE IF NOT EXISTS hhba_apply_pair_codes (
 code_hash TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_pair_codes_phone
 ON hhba_apply_pair_codes(phone,expires_at);
CREATE TABLE IF NOT EXISTS hhba_apply_extension_sessions (
 token_hash TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 extension_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT,
 last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_extension_sessions_phone
 ON hhba_apply_extension_sessions(phone,expires_at);
CREATE TABLE IF NOT EXISTS hhba_apply_pair_attempts (
 id TEXT PRIMARY KEY,
 ip_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_pair_attempts_time
 ON hhba_apply_pair_attempts(ip_hash,created_at);

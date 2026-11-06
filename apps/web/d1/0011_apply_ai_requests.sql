-- Usage-only AI request audit: no resume text or field labels stored.
CREATE TABLE IF NOT EXISTS hhba_apply_ai_requests (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_apply_ai_requests_user
 ON hhba_apply_ai_requests(phone,created_at DESC);

-- HHBA candidate AI resume optimization request budget; no resumes or provider output stored.
-- Apply separately to PREVIEW and PRODUCTION HHBA_PNVS_AUTH_DB before enabling.
CREATE TABLE IF NOT EXISTS hhba_resume_optimization_requests(
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_optimization_day ON hhba_resume_optimization_requests(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_optimization_account_day ON hhba_resume_optimization_requests(day_utc, account_hash);

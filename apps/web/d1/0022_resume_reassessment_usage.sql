-- Same-engine verified mainland ATS job rescore budget.
-- This table stores no resume, JD, phone, skill list, or analysis output.
CREATE TABLE IF NOT EXISTS hhba_resume_reassess_requests (
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_reassess_day ON hhba_resume_reassess_requests(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_reassess_account_day
 ON hhba_resume_reassess_requests(day_utc,account_hash);

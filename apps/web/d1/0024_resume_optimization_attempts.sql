-- Bounded optimization attempts, including failed upstream calls.
-- A failed model response does not consume a successful-generation quota,
-- but MUST still count as a daily attempt to bound paid provider retries.
CREATE TABLE IF NOT EXISTS hhba_resume_optimization_attempts (
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_attempts_day
 ON hhba_resume_optimization_attempts(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_attempts_account_day
 ON hhba_resume_optimization_attempts(day_utc,account_hash);

-- HHBA AI resume matching only: signed-in candidate usage accounting.
-- Separate from prepaid credits, application history, or R2 resume metadata.
-- Never store raw resume text, document names, IPs, tokens or provider outputs.
CREATE TABLE IF NOT EXISTS hhba_resume_match_requests(
  request_id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  account_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resume_match_requests_day ON hhba_resume_match_requests(day_utc);
CREATE INDEX IF NOT EXISTS idx_resume_match_requests_user_day ON hhba_resume_match_requests(day_utc,account_hash);

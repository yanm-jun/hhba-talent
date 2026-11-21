-- Preview-first: no changes to existing auth/resume records.
-- Counts expensive original Word previews and layout verification attempts.
CREATE TABLE IF NOT EXISTS hhba_resume_word_attempts (
  request_id TEXT PRIMARY KEY NOT NULL,
  day_utc TEXT NOT NULL,
  account_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('preview','export')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_word_attempts_owner_day
  ON hhba_resume_word_attempts(day_utc,account_hash,action);

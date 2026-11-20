-- Optional preview-only visual document understanding. No raw PDF/DOCX
-- files, parsed text or AI image payloads are stored in D1.
-- Run against isolated Preview HHBA_PNVS_AUTH_DB after migration review.
CREATE TABLE IF NOT EXISTS hhba_resume_visual_attempts (
  request_id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  account_hash TEXT NOT NULL,
  resume_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_visual_attempts_owner_day
  ON hhba_resume_visual_attempts(day_utc,account_hash);

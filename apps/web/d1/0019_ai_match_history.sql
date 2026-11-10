-- HHBA account-bound AI recommendation history, never a job application log.
-- Additive; run separately on PREVIEW and PRODUCTION HHBA_PNVS_AUTH_DB.
-- No resume text, document bytes, passwords, tokens, contact information,
-- or automatic outbound applications are stored in this table.
CREATE TABLE IF NOT EXISTS hhba_ai_match_history (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  resume_id TEXT,
  resume_label TEXT NOT NULL DEFAULT '本次上传的简历（未保存）',
  role_hint TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  job_count INTEGER NOT NULL CHECK(job_count BETWEEN 0 AND 10),
  best_score INTEGER CHECK(best_score IS NULL OR best_score BETWEEN 0 AND 100),
  new_job_count INTEGER NOT NULL DEFAULT 0 CHECK(new_job_count BETWEEN 0 AND 10),
  improved_job_count INTEGER NOT NULL DEFAULT 0 CHECK(improved_job_count BETWEEN 0 AND 10),
  jobs_json TEXT NOT NULL CHECK(length(jobs_json)<=75000)
);
CREATE INDEX IF NOT EXISTS idx_hhba_ai_match_history_owner_time
 ON hhba_ai_match_history(phone,created_at DESC);

-- Delivery notifications are NOT enabled by this migration.
-- A future opt-in monitoring service must be implemented and tested separately.

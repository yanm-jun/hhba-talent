-- HHBA real candidate account workspace. Apply only to the existing PNVS D1 database
-- bound in Pages as HHBA_PNVS_AUTH_DB, after review and before exposing this API.
-- Additive schema: preserves all pre-existing genuine users, sessions and SMS data.
-- No mock / browser account rows may be imported into these tables.
CREATE TABLE IF NOT EXISTS hhba_candidate_profiles (
  phone TEXT PRIMARY KEY REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '',
  preferred_role TEXT NOT NULL DEFAULT '',
  preferred_city TEXT NOT NULL DEFAULT '',
  work_mode TEXT NOT NULL DEFAULT '不限'
    CHECK (work_mode IN ('不限','远程','现场','混合办公')),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hhba_candidate_saved_jobs (
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (phone,job_id)
);
CREATE INDEX IF NOT EXISTS idx_hhba_candidate_saved_phone_time
  ON hhba_candidate_saved_jobs(phone,saved_at DESC);

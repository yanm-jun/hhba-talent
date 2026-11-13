-- Private, one-time structured resume analysis. Deploy to HHBA_PNVS_AUTH_DB
-- only after backup/checkpoint. Never store original resume bytes or raw text.
CREATE TABLE IF NOT EXISTS hhba_candidate_resume_profiles (
  resume_id TEXT PRIMARY KEY REFERENCES hhba_candidate_resumes(id) ON DELETE CASCADE,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  file_sha256 TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('RUNNING','READY')),
  profile_json TEXT,
  attempt_id TEXT NOT NULL,
  lease_until TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_profile_owner
 ON hhba_candidate_resume_profiles(phone,resume_id);

-- Small separate usage ledger: it contains no resume content, names or phone numbers.
-- Atomic COUNT + INSERT guards this feature on paid accounts too; the account's
-- other Workers AI consumption is separate and must be checked in Cloudflare.
CREATE TABLE IF NOT EXISTS hhba_resume_profile_ai_calls (
  id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_profile_ai_day
 ON hhba_resume_profile_ai_calls(day_utc);

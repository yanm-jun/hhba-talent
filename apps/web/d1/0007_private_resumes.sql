-- HHBA private resume metadata. Run on HHBA_PNVS_AUTH_DB only after
-- verifying existing users/sessions and creating a restore checkpoint.
-- Resumes themselves MUST live in a PRIVATE R2 bucket, never public assets.
-- Additive migration: no changes to the existing genuine users or sessions.
CREATE TABLE IF NOT EXISTS hhba_candidate_resumes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 3145728),
  sha256 TEXT NOT NULL,
  storage_consent_version TEXT NOT NULL CHECK(storage_consent_version='private-resume-storage-v1'),
  storage_consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(phone,sha256)
);
CREATE INDEX IF NOT EXISTS idx_hhba_candidate_resumes_owner_time
  ON hhba_candidate_resumes(phone,created_at DESC);

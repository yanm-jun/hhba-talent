-- Account-owned snapshots of confirmed resume evidence, never original PDF/DOCX.
-- Run on the HHBA_PNVS_AUTH_DB in each environment before enabling storage.
CREATE TABLE IF NOT EXISTS hhba_targeted_resume_versions (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 job_id TEXT NOT NULL,
 job_title TEXT NOT NULL,
 company TEXT NOT NULL,
 content_json TEXT NOT NULL CHECK(length(content_json) BETWEEN 2 AND 24000),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_targeted_resume_versions_owner
 ON hhba_targeted_resume_versions(phone,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hhba_targeted_resume_versions_job
 ON hhba_targeted_resume_versions(phone,job_id,created_at DESC);

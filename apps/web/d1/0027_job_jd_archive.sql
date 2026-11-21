-- HHBA public employer JD archive (isolated HHBA_JOB_JD_DB).
-- Apply ONLY to the dedicated JD database, never the candidate auth database.
-- No resumes, users, contact details, secrets, or AI outputs belong here.
-- Every version links to an allowlisted, directly fetched official posting.
CREATE TABLE IF NOT EXISTS hhba_job_jd_versions (
 id TEXT PRIMARY KEY,
 canonical_url TEXT NOT NULL,
 url_sha256 TEXT NOT NULL,
 company TEXT NOT NULL,
 title TEXT NOT NULL,
 location TEXT NOT NULL,
 jd_sha256 TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 text_bytes INTEGER NOT NULL CHECK(text_bytes BETWEEN 80 AND 80000),
 proof_method TEXT NOT NULL CHECK(proof_method='DIRECT_EMPLOYER_HTML_V1'),
 content_status TEXT NOT NULL CHECK(content_status='VERIFIED_SECTIONS'),
 first_verified_at TEXT NOT NULL,
 last_verified_at TEXT NOT NULL,
 UNIQUE(canonical_url,jd_sha256)
);
CREATE INDEX IF NOT EXISTS idx_hhba_job_jd_url_latest
 ON hhba_job_jd_versions(canonical_url,last_verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_hhba_job_jd_verified_at
 ON hhba_job_jd_versions(last_verified_at DESC);

-- Only hashed account identities and request dates are kept for fetch safety.
-- Cached reads do not spend a new external-fetch allowance.
CREATE TABLE IF NOT EXISTS hhba_job_jd_fetch_attempts (
 id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_job_jd_attempts_day
 ON hhba_job_jd_fetch_attempts(day_utc,account_hash);

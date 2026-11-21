-- Separate public ATS posting cache. Existing direct-employer D1 table has a
-- DIRECT_EMPLOYER_HTML_V1 CHECK, and must not be rewritten in place.
-- Apply to the existing environment-specific non-user HHBA_JOB_JD_DB.
-- Only public job text: NO resumes, usernames, emails, or private results.
CREATE TABLE IF NOT EXISTS hhba_job_ats_jd_versions (
 id TEXT PRIMARY KEY,
 canonical_url TEXT NOT NULL,
 url_sha256 TEXT NOT NULL,
 company TEXT NOT NULL,
 title TEXT NOT NULL,
 location TEXT NOT NULL,
 jd_sha256 TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 text_bytes INTEGER NOT NULL CHECK(text_bytes BETWEEN 80 AND 80000),
 proof_method TEXT NOT NULL CHECK(proof_method='PUBLIC_EMPLOYER_ATS_V1'),
 content_status TEXT NOT NULL CHECK(content_status='VERIFIED_SECTIONS'),
 first_verified_at TEXT NOT NULL,
 last_verified_at TEXT NOT NULL,
 UNIQUE(canonical_url,jd_sha256)
);
CREATE INDEX IF NOT EXISTS idx_hhba_job_ats_jd_url_latest
 ON hhba_job_ats_jd_versions(canonical_url,last_verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_hhba_job_ats_jd_verified_at
 ON hhba_job_ats_jd_versions(last_verified_at DESC);

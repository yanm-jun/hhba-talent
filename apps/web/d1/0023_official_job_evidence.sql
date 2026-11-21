-- Public official job evidence cache; NEVER store applicant data here.
-- Every row is derived from a direct, no-redirect HTTPS fetch of an exact allowlisted
-- employer vacancy URL, and expires for reassessment after 24 hours.
CREATE TABLE IF NOT EXISTS hhba_official_job_evidence (
 id TEXT PRIMARY KEY,
 canonical_url TEXT NOT NULL UNIQUE,
 company TEXT NOT NULL,
 title TEXT NOT NULL,
 location TEXT NOT NULL,
 requirements TEXT NOT NULL,
 jd_hash TEXT NOT NULL,
 proof_method TEXT NOT NULL CHECK(proof_method = 'DIRECT_EMPLOYER_HTML_V1'),
 checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_official_job_evidence_checked
 ON hhba_official_job_evidence(checked_at);
CREATE TABLE IF NOT EXISTS hhba_official_verify_requests (
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_official_verify_day ON hhba_official_verify_requests(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_official_verify_person ON hhba_official_verify_requests(day_utc,account_hash);

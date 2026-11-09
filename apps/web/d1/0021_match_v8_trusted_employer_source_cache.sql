-- HHBA V8 source-level proof ONLY. No resumes, job bodies, user data, search queries or URLs per user.
-- A cached employer->recruitment relationship is NOT evidence that any
-- individual vacancy is open, is in Mainland China, or suits a candidate.
CREATE TABLE IF NOT EXISTS hhba_match_trusted_employer_sources (
 employer_claim TEXT NOT NULL CHECK(length(employer_claim) BETWEEN 2 AND 65),
 job_hostname TEXT NOT NULL CHECK(length(job_hostname) BETWEEN 4 AND 130),
 proof_scope TEXT NOT NULL CHECK(length(proof_scope) BETWEEN 12 AND 420),
 proof_method TEXT NOT NULL CHECK(proof_method IN (
  'CORPORATE_DOMAIN_AND_BRAND','CORPORATE_EXACT_JOB_LINK','CORPORATE_NAMED_BOARD_LINK')),
 employer_site TEXT NOT NULL CHECK(length(employer_site) BETWEEN 12 AND 420),
 verified_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 PRIMARY KEY(employer_claim,job_hostname,proof_scope)
);
CREATE INDEX IF NOT EXISTS idx_hhba_v8_trusted_source_expiry
 ON hhba_match_trusted_employer_sources(expires_at);

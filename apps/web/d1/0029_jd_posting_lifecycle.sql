-- JD lifecycle control for BOTH existing public JD tables; additive D1 only.
-- Run on the environment's HHBA_JOB_JD_DB, never auth/resume D1.
-- No candidate personal data or archived JD text is added here.
CREATE TABLE IF NOT EXISTS hhba_jd_posting_lifecycle (
 canonical_url TEXT PRIMARY KEY NOT NULL,
 proof_method TEXT NOT NULL CHECK(proof_method IN
  ('DIRECT_EMPLOYER_HTML_V1','PUBLIC_EMPLOYER_ATS_V1')),
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','RECHECK','CLOSED')),
 last_active_at TEXT,
 last_checked_at TEXT NOT NULL,
 next_check_at TEXT NOT NULL,
 first_gone_at TEXT,
 last_gone_at TEXT,
 gone_count INTEGER NOT NULL DEFAULT 0 CHECK(gone_count BETWEEN 0 AND 20),
 closed_at TEXT,
 uncertain_count INTEGER NOT NULL DEFAULT 0 CHECK(uncertain_count BETWEEN 0 AND 10000),
 last_reason TEXT NOT NULL DEFAULT 'SOURCE_VERIFIED',
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_jd_lifecycle_next_check
 ON hhba_jd_posting_lifecycle(next_check_at,status);
CREATE INDEX IF NOT EXISTS idx_hhba_jd_lifecycle_closed
 ON hhba_jd_posting_lifecycle(status,closed_at);

-- Never store a resume, phone or account identifier in a cleanup audit.
CREATE TABLE IF NOT EXISTS hhba_jd_retention_audit (
 event_id TEXT PRIMARY KEY,
 jd_version_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('PURGED','SKIPPED_PINNED','SKIPPED_ERROR')),
 event_at TEXT NOT NULL,
 reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_jd_retention_audit_event
 ON hhba_jd_retention_audit(event_at DESC);

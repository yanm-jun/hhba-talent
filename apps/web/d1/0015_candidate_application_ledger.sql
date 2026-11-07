-- HHBA user-owned job application ledger. Independent of billing tasks.
-- "confirmed" means a user-observed success indication, not employer acceptance.
-- There is intentionally no resume text, email, phone, screenshot or ATS page HTML.
CREATE TABLE IF NOT EXISTS hhba_candidate_applications (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  job_key TEXT NOT NULL,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  application_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','confirmed','manual')),
  source TEXT NOT NULL CHECK(source IN ('edge','manual')),
  evidence_kind TEXT NOT NULL CHECK(evidence_kind IN ('none','success_notice','receipt_marker','self_report')),
  recorded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(phone,job_key)
);
CREATE INDEX IF NOT EXISTS idx_hhba_candidate_applications_phone_updated
 ON hhba_candidate_applications(phone,updated_at DESC);

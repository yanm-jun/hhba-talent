-- HHBA S4: trusted official recruitment SEARCH SCOPE, NOT a job recommendation index.
-- Stage2 discovered URLs and Stage3 AI labels CANNOT automatically promote into this table.
-- Only evidence-reviewed employer domains and official employer-linked ATS tenants.
CREATE TABLE IF NOT EXISTS hhba_reviewed_recruitment_sources (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  legal_subject TEXT,
  official_company_url TEXT NOT NULL,
  recruitment_base_url TEXT NOT NULL UNIQUE,
  ownership_evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(review_status IN ('PENDING','VERIFIED','SUSPENDED','REJECTED')),
  industry_tags_json TEXT NOT NULL DEFAULT '[]',
  business_tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_reviewed_sources_search
 ON hhba_reviewed_recruitment_sources(review_status,expires_at,reviewed_at DESC);
-- Distinct from discovered candidates: no automatic INSERT/UPDATE from DeepSeek Search.
-- Recruitment URL / ATS tenant ownership is recorded by a separate editorial review.

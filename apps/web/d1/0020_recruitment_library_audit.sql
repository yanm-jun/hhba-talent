-- HHBA enterprise recruitment library admin audit, run ONLY after preview acceptance
-- against the existing HHBA_METRICS_DB D1 database. No employer table replacement.
CREATE TABLE IF NOT EXISTS hhba_library_admin_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('add','edit','delete','import')),
  actor_email TEXT NOT NULL,
  source_key TEXT NOT NULL,
  industry_id TEXT NOT NULL,
  enterprise TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hhba_library_audit_by_key
  ON hhba_library_admin_audit(source_key,created_at);
-- Reduce browse queries to the selected industry without changing existing rows.
CREATE INDEX IF NOT EXISTS idx_hhba_library_industry_enterprise
  ON hhba_industry_employer_links(industry_id,enterprise,source_key);

-- Exact case-insensitive URL equality lookup for each batch of <=100 URLs.
-- Non-UNIQUE because historical records may intentionally share a parent-group URL.
CREATE INDEX IF NOT EXISTS idx_hhba_library_normalized_url
  ON hhba_industry_employer_links(industry_id,lower(rtrim(recruitment_url,'/')))
  WHERE recruitment_url IS NOT NULL;

-- HHBA enterprise resource library; separate from candidate/resume data.
-- Apply to the existing METRICS D1 binding before enabling admin writes.
CREATE TABLE IF NOT EXISTS hhba_employer_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_employer_library_industry ON hhba_employer_library(industry_id);
CREATE TABLE IF NOT EXISTS hhba_employer_library_audit (
  batch_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  item_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

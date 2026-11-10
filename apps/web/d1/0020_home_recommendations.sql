-- HHBA personalized recommendations. This migration is additive and opt-in only.
-- Apply to HHBA_PNVS_AUTH_DB after staging verification; do not copy resume text into this table.
CREATE TABLE IF NOT EXISTS hhba_recommendation_consents (
  phone TEXT PRIMARY KEY REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_recommendation_consents_enabled
 ON hhba_recommendation_consents(enabled);

-- Free-only AI recommendations, with strict reservation and private result caching.
-- Preview-only rollout; checkpoint D1 before applying to production.
CREATE TABLE IF NOT EXISTS hhba_free_ai_provider_calls(
  id TEXT PRIMARY KEY,
  day_utc TEXT NOT NULL,
  owner_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('cloudflare','groq','openrouter')),
  budget_units INTEGER NOT NULL CHECK(budget_units>0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_free_ai_provider_day
 ON hhba_free_ai_provider_calls(day_utc,provider);
CREATE INDEX IF NOT EXISTS idx_hhba_free_ai_provider_owner
 ON hhba_free_ai_provider_calls(day_utc,owner_hash);
CREATE INDEX IF NOT EXISTS idx_hhba_free_ai_provider_minute
 ON hhba_free_ai_provider_calls(provider,created_at);

CREATE TABLE IF NOT EXISTS hhba_candidate_free_match_cache(
  cache_key TEXT PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES hhba_candidate_resumes(id) ON DELETE CASCADE,
  file_sha256 TEXT NOT NULL,
  snapshot_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('RUNNING','READY')),
  result_json TEXT,
  attempt_id TEXT NOT NULL,
  lease_until TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_free_match_cache_resume
 ON hhba_candidate_free_match_cache(phone,resume_id);

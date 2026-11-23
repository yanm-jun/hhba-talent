-- Preview-only provider preflight diagnostics.
-- Do not store résumé, person/session identifiers, provider response bodies,
-- outbound HTTP headers, API tokens, prompts, job URLs or raw error messages.
CREATE TABLE IF NOT EXISTS hhba_match_v2_provider_probes (
 id TEXT PRIMARY KEY,
 tested_at TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('CANDIDATE_PREFLIGHT','OPERATOR_PREFLIGHT')),
 outcome TEXT NOT NULL CHECK (outcome IN ('READY','FAILED')),
 stage TEXT NOT NULL CHECK (stage IN ('basic_responses','structured_json','web_search_sources','completed','unknown')),
 error_code TEXT,
 upstream_status INTEGER,
 duration_ms INTEGER NOT NULL,
 sources_returned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_match_v2_provider_probes_tested_at
 ON hhba_match_v2_provider_probes(tested_at DESC);

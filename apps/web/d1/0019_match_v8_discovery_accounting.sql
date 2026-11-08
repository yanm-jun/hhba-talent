-- HHBA V8: per-matching-action usage/cost estimates. No resumes, queries, URLs or PII.
-- For V8 only; preflight checks table existence before spending paid Search/Fetch.
CREATE TABLE IF NOT EXISTS hhba_match_discovery_accounting(
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 model_attempts INTEGER NOT NULL CHECK(model_attempts BETWEEN 0 AND 4),
 search_attempts INTEGER NOT NULL CHECK(search_attempts BETWEEN 0 AND 8),
 fetch_attempts INTEGER NOT NULL CHECK(fetch_attempts BETWEEN 0 AND 20),
 billable_search INTEGER NOT NULL CHECK(billable_search BETWEEN 0 AND 8),
 billable_fetch INTEGER NOT NULL CHECK(billable_fetch BETWEEN 0 AND 20),
 model_input_tokens INTEGER NOT NULL CHECK(model_input_tokens >= 0),
 model_cached_input_tokens INTEGER NOT NULL CHECK(model_cached_input_tokens >= 0),
 model_output_tokens INTEGER NOT NULL CHECK(model_output_tokens >= 0),
 model_estimated_cny REAL NOT NULL CHECK(model_estimated_cny >= 0),
 tools_estimated_cny REAL NOT NULL CHECK(tools_estimated_cny >= 0),
 total_estimated_cny REAL NOT NULL CHECK(total_estimated_cny >= 0),
 peak_price_upper_estimate_cny REAL NOT NULL CHECK(peak_price_upper_estimate_cny >= 0),
 pricing_basis TEXT NOT NULL,
 estimate_complete INTEGER NOT NULL CHECK(estimate_complete IN (0,1)),
 status TEXT NOT NULL CHECK(status IN ('COMPLETE','PARTIAL')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_v8_accounting_day ON hhba_match_discovery_accounting(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_v8_accounting_account_day ON hhba_match_discovery_accounting(day_utc,account_hash);

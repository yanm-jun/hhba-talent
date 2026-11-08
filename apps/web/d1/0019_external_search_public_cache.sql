-- Global 24-hour cache for fetched PUBLIC job evidence only.
-- No resume content, personal details or plaintext search terms.
-- cache_key = sha256(server pepper + normalized abstract role)
CREATE TABLE IF NOT EXISTS hhba_external_search_cache (
 cache_key TEXT PRIMARY KEY,
 payload_json TEXT NOT NULL CHECK(length(payload_json)<=64000),
 checked_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_external_search_cache_expiry
 ON hhba_external_search_cache(expires_at);

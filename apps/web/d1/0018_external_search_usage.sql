-- Independent Preview pilot request budget. Never store search terms, resumes, PII or URLs.
CREATE TABLE IF NOT EXISTS hhba_external_search_requests(
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_external_search_day ON hhba_external_search_requests(day_utc);
CREATE INDEX IF NOT EXISTS idx_hhba_external_search_user_day ON hhba_external_search_requests(day_utc,account_hash);

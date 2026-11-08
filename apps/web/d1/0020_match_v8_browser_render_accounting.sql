-- HHBA V8 preview-only Browser Rendering accounting, separate from DeepSeek.
-- Never store resumes, employer URLs, Search snippets, HTML or other PII.
-- Browser Rendering costs are NOT included in DeepSeek RMB estimates.
CREATE TABLE IF NOT EXISTS hhba_match_browser_render_accounting(
 request_id TEXT PRIMARY KEY,
 day_utc TEXT NOT NULL,
 account_hash TEXT NOT NULL,
 render_attempts INTEGER NOT NULL CHECK(render_attempts BETWEEN 0 AND 2),
 render_recovered INTEGER NOT NULL CHECK(render_recovered BETWEEN 0 AND render_attempts),
 render_failures INTEGER NOT NULL CHECK(render_failures BETWEEN 0 AND render_attempts),
 browser_fee_estimate_complete INTEGER NOT NULL DEFAULT 0 CHECK(browser_fee_estimate_complete = 0),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_v8_browser_day ON hhba_match_browser_render_accounting(day_utc);

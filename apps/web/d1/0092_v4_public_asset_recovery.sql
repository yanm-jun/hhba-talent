-- Apply after 0090, to public JD D1 only.
CREATE TABLE IF NOT EXISTS hhba_v4_public_job_closed(url TEXT PRIMARY KEY NOT NULL,closed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hhba_v4_public_job_leads(url TEXT PRIMARY KEY NOT NULL,company TEXT NOT NULL,title TEXT NOT NULL,location TEXT NOT NULL,checked_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hhba_v4_public_job_leads_fresh ON hhba_v4_public_job_leads(checked_at DESC);
CREATE TABLE IF NOT EXISTS hhba_v4_public_asset_outbox(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hhba_v4_public_asset_outbox_time ON hhba_v4_public_asset_outbox(created_at);
CREATE TABLE IF NOT EXISTS hhba_v4_public_employer_research(employer_key TEXT PRIMARY KEY NOT NULL,company TEXT NOT NULL,origin TEXT NOT NULL,excerpts TEXT NOT NULL,checked_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hhba_v4_public_asset_daily(day TEXT PRIMARY KEY NOT NULL,reference_hits INTEGER NOT NULL DEFAULT 0);

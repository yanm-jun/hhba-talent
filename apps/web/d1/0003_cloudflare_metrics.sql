-- Cloudflare-only HHBA metrics; no Railway imports. Created initially in an isolated preview D1.
CREATE TABLE IF NOT EXISTS hhba_metrics_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT OR IGNORE INTO hhba_metrics_metadata(key,value) VALUES('installed_at',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS hhba_traffic_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 day TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('page_view','job_view','job_search','official_apply_click')),
 visitor_day_hash TEXT NOT NULL,
 minute_bucket TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(day,event_type,visitor_day_hash,minute_bucket)
);
CREATE INDEX IF NOT EXISTS idx_hhba_traffic_day_type ON hhba_traffic_events(day,event_type);
CREATE TABLE IF NOT EXISTS hhba_device_saved(
 device_hash TEXT NOT NULL,
 job_id TEXT NOT NULL,
 saved_at TEXT NOT NULL,
 PRIMARY KEY(device_hash,job_id)
);
CREATE INDEX IF NOT EXISTS idx_hhba_device_saved_date ON hhba_device_saved(saved_at);

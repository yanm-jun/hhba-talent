CREATE TABLE IF NOT EXISTS match_watchdog_instances (instance_id TEXT PRIMARY KEY, next_check INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS match_watchdog_due ON match_watchdog_instances(next_check, instance_id);

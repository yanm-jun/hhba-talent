-- Opt-in, authenticated product engagement. Separate from PNVS identity DB.
-- account_hash is HMAC(phone, secret), never raw phone or profile data.
-- One row per account / UTC day / broad function area; no paths or search terms.
CREATE TABLE IF NOT EXISTS hhba_account_activity (
  account_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  area TEXT NOT NULL CHECK(area IN ('general','jobs','companies','policies','tools','job_save')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_hash,day,area)
);
CREATE INDEX IF NOT EXISTS idx_hhba_account_activity_day ON hhba_account_activity(day,area);
CREATE INDEX IF NOT EXISTS idx_hhba_account_activity_cohort ON hhba_account_activity(account_hash,day);
INSERT OR IGNORE INTO hhba_metrics_metadata(key,value)
VALUES ('account_activity_installed_at',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Anonymous per-research-run measurements. No applicant IDs, task keys,
-- resume content, model text, search queries or job URLs are stored.
CREATE TABLE IF NOT EXISTS hhba_v4_search_speed_runs (
 run_id TEXT PRIMARY KEY,
 day TEXT NOT NULL,
 status TEXT NOT NULL,
 observed_unique INTEGER NOT NULL DEFAULT 0 CHECK(observed_unique>=0),
 milestone_1_ms INTEGER,
 milestone_50_ms INTEGER,
 milestone_100_ms INTEGER,
 milestone_300_ms INTEGER,
 milestone_500_ms INTEGER,
 updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_v4_speed_day ON hhba_v4_search_speed_runs(day);

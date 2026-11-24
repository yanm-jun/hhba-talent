-- Large research results are split into D1-sized segments, not discarded.
-- Owner authorization always uses the parent history row.
CREATE TABLE IF NOT EXISTS hhba_ai_match_history_segments (
 history_id TEXT NOT NULL REFERENCES hhba_ai_match_history(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0),
 jobs_json TEXT NOT NULL CHECK(json_valid(jobs_json)),
 PRIMARY KEY(history_id,position)
);

-- Durable V4 research progress, no CV, private prompt or model analysis text.
CREATE TABLE IF NOT EXISTS hhba_v4_research_checkpoints (
 task_id TEXT PRIMARY KEY REFERENCES hhba_v4_match_tasks(id) ON DELETE CASCADE,
 completed_round INTEGER NOT NULL CHECK(completed_round>=0),
 search_complete INTEGER NOT NULL DEFAULT 0 CHECK(search_complete IN (0,1))
);

-- Private, explicitly authorized background research. Raw source lives in a
-- separate private R2 namespace, not D1. Every completed stage is checkpointed.
CREATE TABLE IF NOT EXISTS hhba_v4_background_tasks (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL,
 resume_id TEXT,
 role_hint TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL CHECK(state IN ('UPLOADING','QUEUED','RUNNING','PAUSED','COMPLETE','CANCELLED')),
 phase TEXT NOT NULL DEFAULT 'SEARCH',
 uploaded_parts INTEGER NOT NULL DEFAULT 0,
 source_part INTEGER NOT NULL DEFAULT 0,
 research_round INTEGER NOT NULL DEFAULT 0,
 lease TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 error TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hhba_v4_background_due ON hhba_v4_background_tasks(state,next_at,lease_until);
CREATE INDEX IF NOT EXISTS hhba_v4_background_owner ON hhba_v4_background_tasks(phone,id);

-- Additive: V4 server-owned search history; no CV content or credentials.
CREATE TABLE IF NOT EXISTS hhba_v4_match_tasks (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 resume_id TEXT, resume_label TEXT NOT NULL, role_hint TEXT NOT NULL,
 created_at TEXT NOT NULL, research_pending INTEGER NOT NULL DEFAULT 1 CHECK(research_pending IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_hhba_v4_match_tasks_owner ON hhba_v4_match_tasks(phone,created_at DESC);
CREATE TABLE IF NOT EXISTS hhba_v4_match_jobs (
 task_id TEXT NOT NULL REFERENCES hhba_v4_match_tasks(id) ON DELETE CASCADE,
 job_url TEXT NOT NULL, match_score INTEGER CHECK(match_score IS NULL OR match_score BETWEEN 0 AND 100),
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 PRIMARY KEY(task_id,job_url)
);
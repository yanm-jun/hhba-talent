-- V4: remove product-specific Top10 storage constraints, preserve existing rows.
-- Apply using D1 migrations to the environment-specific authentication DB.
-- Retain account FK and all score range checks; D1 platform row limits still apply.
CREATE TABLE hhba_ai_match_history_v4_migrate (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL REFERENCES hhba_auth_users(phone) ON DELETE CASCADE,
 resume_id TEXT,
 resume_label TEXT NOT NULL DEFAULT '本次上传的简历（未保存）',
 role_hint TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 job_count INTEGER NOT NULL CHECK(job_count>=0),
 best_score INTEGER CHECK(best_score IS NULL OR best_score BETWEEN 0 AND 100),
 new_job_count INTEGER NOT NULL DEFAULT 0 CHECK(new_job_count>=0),
 improved_job_count INTEGER NOT NULL DEFAULT 0 CHECK(improved_job_count>=0),
 jobs_json TEXT NOT NULL CHECK(json_valid(jobs_json))
);
INSERT INTO hhba_ai_match_history_v4_migrate SELECT * FROM hhba_ai_match_history;
DROP TABLE hhba_ai_match_history;
ALTER TABLE hhba_ai_match_history_v4_migrate RENAME TO hhba_ai_match_history;
CREATE INDEX idx_hhba_ai_match_history_owner_time ON hhba_ai_match_history(phone,created_at DESC);

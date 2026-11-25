-- Late PDF render tasks for revisions saved without a renderer.
-- No resume text, DOCX bytes or PDF bytes are stored here; only task state.
-- A task is keyed by the account hash, the resume, the job scope and the
-- exact revision entry, so one revision converts at most once at a time and
-- a failed conversion can be retried without re-saving the revision.
CREATE TABLE IF NOT EXISTS hhba_resume_word_render_tasks (
 account_hash TEXT NOT NULL,
 resume_id TEXT NOT NULL,
 job_scope_hash TEXT NOT NULL,
 entry_id TEXT NOT NULL,
 status TEXT NOT NULL,
 error_code TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY (account_hash, resume_id, job_scope_hash, entry_id)
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_word_render_tasks_updated
 ON hhba_resume_word_render_tasks(account_hash, updated_at);

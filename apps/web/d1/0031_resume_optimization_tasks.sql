-- Short-lived optimization leases. No resume text, JD text or AI output is stored.
CREATE TABLE IF NOT EXISTS hhba_resume_optimization_tasks (
 account_hash TEXT PRIMARY KEY,
 task_hash TEXT NOT NULL,
 lease_id TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_resume_optimization_tasks_expiry
 ON hhba_resume_optimization_tasks(expires_at);

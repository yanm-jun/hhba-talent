-- Private, generation-scoped per-vacancy work reservations. No resume text,
-- employer name, vacancy URL, salary, model output or user identifier.
CREATE TABLE IF NOT EXISTS hhba_v4_job_work_queue (
 task_key TEXT NOT NULL CHECK(length(task_key)=64),
 generation INTEGER NOT NULL CHECK(generation>=0),
 lane TEXT NOT NULL CHECK(lane IN ('verification','reporting')),
 job_key TEXT NOT NULL CHECK(length(job_key)=64),
 revision TEXT NOT NULL CHECK(length(revision)=64),
 state TEXT NOT NULL CHECK(state IN ('PENDING','LEASED','COMPLETED')),
 lease_owner TEXT,
 lease_until_ms INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at_ms INTEGER NOT NULL,
 updated_at_ms INTEGER NOT NULL,
 PRIMARY KEY(task_key,generation,lane,job_key),
 CHECK((state='LEASED' AND lease_owner IS NOT NULL) OR (state!='LEASED' AND lease_owner IS NULL))
);
CREATE INDEX IF NOT EXISTS hhba_v4_job_work_queue_ready
 ON hhba_v4_job_work_queue(task_key,generation,lane,state,lease_until_ms,updated_at_ms);

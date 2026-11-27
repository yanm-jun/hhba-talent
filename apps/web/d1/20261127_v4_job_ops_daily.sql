-- Aggregated independent JD/score/report execution observations only.
-- No resume, task key, job key, URL, prompt, identity or provider text.
CREATE TABLE IF NOT EXISTS hhba_v4_job_ops_daily (
 day TEXT NOT NULL,
 lane TEXT NOT NULL CHECK(lane IN ('verification','reporting')),
 outcome TEXT NOT NULL CHECK(outcome IN ('DONE','CACHED','CONTINUE','RETRY','STALE','FAILED')),
 error_code TEXT NOT NULL DEFAULT '-',
 executions INTEGER NOT NULL DEFAULT 0,
 elapsed_ms_total INTEGER NOT NULL DEFAULT 0,
 elapsed_ms_max INTEGER NOT NULL DEFAULT 0,
 verified_jds INTEGER NOT NULL DEFAULT 0,
 scored_jobs INTEGER NOT NULL DEFAULT 0,
 completed_reports INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,lane,outcome,error_code)
);

-- Aggregated operational outcomes, no job URL, raw resume, token, user ID or model content.
-- An execution is one authorized cloud phase; this is NOT a user conversion rate.
CREATE TABLE IF NOT EXISTS hhba_v4_phase_ops_daily (
 day TEXT NOT NULL,
 lane TEXT NOT NULL CHECK(lane IN ('discovery','verification','reporting','mixed')),
 outcome TEXT NOT NULL CHECK(outcome IN ('CONTINUE','COMPLETE','RESOURCE_YIELD','RETRYABLE_FAILURE','TERMINAL_FAILURE','CACHED')),
 error_code TEXT NOT NULL DEFAULT '-',
 executions INTEGER NOT NULL DEFAULT 0,
 recovered_attempts INTEGER NOT NULL DEFAULT 0,
 recovered_successes INTEGER NOT NULL DEFAULT 0,
 elapsed_ms_total INTEGER NOT NULL DEFAULT 0,
 elapsed_ms_max INTEGER NOT NULL DEFAULT 0,
 candidates INTEGER NOT NULL DEFAULT 0,
 jds INTEGER NOT NULL DEFAULT 0,
 scores INTEGER NOT NULL DEFAULT 0,
 reports INTEGER NOT NULL DEFAULT 0,
 first_candidate_ms_total INTEGER NOT NULL DEFAULT 0,
 first_candidate_known INTEGER NOT NULL DEFAULT 0,
 first_jd_ms_total INTEGER NOT NULL DEFAULT 0,
 first_jd_known INTEGER NOT NULL DEFAULT 0,
 first_report_ms_total INTEGER NOT NULL DEFAULT 0,
 first_report_known INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,lane,outcome,error_code)
);
CREATE INDEX IF NOT EXISTS hhba_v4_phase_ops_daily_day ON hhba_v4_phase_ops_daily(day DESC,lane);

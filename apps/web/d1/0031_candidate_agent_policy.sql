-- HHBA Candidate Agent stage 2: persistent admin policy, audit and anonymous execution log.
-- Apply ONLY to the candidate auth D1. Do not run against finance/admin-auth databases.
CREATE TABLE IF NOT EXISTS hhba_candidate_agent_policy (
  id TEXT PRIMARY KEY CHECK(id='default'),
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  skills_json TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>=1),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'system',
  request_id TEXT NOT NULL
);
INSERT OR IGNORE INTO hhba_candidate_agent_policy
(id,enabled,skills_json,revision,updated_at,updated_by,request_id)
VALUES('default',0,'["resume_evidence","official_job_search","fit_scoring","targeted_resume_rewrite"]',1,'1970-01-01T00:00:00Z','system','initial');

CREATE TABLE IF NOT EXISTS hhba_candidate_agent_policy_audit (
  event_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  skills_json TEXT NOT NULL,
  actor TEXT NOT NULL CHECK(actor='owner'),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_candidate_agent_policy_audit_time
  ON hhba_candidate_agent_policy_audit(created_at);

-- Only anonymous run metrics; NO candidate ID, resume, job URL or prompt.
CREATE TABLE IF NOT EXISTS hhba_candidate_agent_runs (
  run_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind='matching'),
  status TEXT NOT NULL CHECK(status IN ('complete','failed')),
  skill_count INTEGER NOT NULL CHECK(skill_count>=0 AND skill_count<=4),
  matched_count INTEGER NOT NULL CHECK(matched_count>=0 AND matched_count<=10),
  elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms>=0 AND elapsed_ms<=600000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hhba_candidate_agent_runs_time
  ON hhba_candidate_agent_runs(created_at);

-- HHBA Module 08: private enterprise appeals and protected employee issue reports.
-- Additive migration. Only apply to an isolated/approved authenticated HHBA database.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_appeal_cases_private (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('employer','employee_privacy')),
  issue TEXT NOT NULL CHECK (issue IN
    ('evidence_error','score_method','missing_proof','outdated_fact',
     'identity_risk','retaliation_risk','eligibility_error','consent_problem')),
  target_type TEXT CHECK (target_type IN ('evidence','scoring_run')),
  target_id UUID,
  explanation TEXT,
  -- Employee account identity must never appear in this general case table.
  employer_requester UUID,
  challenged_actor_id UUID,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK
    (status IN ('submitted','under_review','needs_more_info',
                'correction_required','rejected','resolved_after_correction')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (kind='employer' AND issue IN
      ('evidence_error','score_method','missing_proof','outdated_fact')
      AND target_type IS NOT NULL AND target_id IS NOT NULL
      AND employer_requester IS NOT NULL AND explanation IS NOT NULL
      AND char_length(explanation) BETWEEN 30 AND 1200)
    OR
    (kind='employee_privacy' AND
      issue IN ('identity_risk','retaliation_risk','eligibility_error','consent_problem')
      AND target_type IS NULL AND target_id IS NULL
      AND employer_requester IS NULL AND challenged_actor_id IS NULL
      AND explanation IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS hhba_appeal_org_idx
ON hhba_appeal_cases_private(organization_id,kind,status,created_at DESC);

CREATE TABLE IF NOT EXISTS hhba_appeal_employee_owners_private (
  appeal_id UUID PRIMARY KEY REFERENCES hhba_appeal_cases_private(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  issue TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period ~ '^20[2-9][0-9]-Q[1-4]$'),
  UNIQUE(employee_id,organization_id,issue,period)
);
CREATE INDEX IF NOT EXISTS hhba_appeal_employee_owner_idx
ON hhba_appeal_employee_owners_private(employee_id,appeal_id);

CREATE TABLE IF NOT EXISTS hhba_appeal_events_private (
  id UUID PRIMARY KEY,
  appeal_id UUID NOT NULL REFERENCES hhba_appeal_cases_private(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted','decision','clarification')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_appeal_events_case_idx
ON hhba_appeal_events_private(appeal_id,occurred_at);

CREATE OR REPLACE FUNCTION hhba_appeal_events_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_APPEAL_AUDIT';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_appeal_events_lock ON hhba_appeal_events_private;
CREATE TRIGGER hhba_appeal_events_lock
BEFORE UPDATE OR DELETE ON hhba_appeal_events_private
FOR EACH ROW EXECUTE FUNCTION hhba_appeal_events_immutable();

REVOKE ALL ON hhba_appeal_cases_private FROM PUBLIC;
REVOKE ALL ON hhba_appeal_employee_owners_private FROM PUBLIC;
REVOKE ALL ON hhba_appeal_events_private FROM PUBLIC;
COMMIT;

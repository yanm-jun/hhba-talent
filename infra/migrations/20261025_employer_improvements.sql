-- HHBA Module 09: vetted company improvement timeline. Additive; isolated staging only.
-- Linked original evidence is private. Public projection never exposes file paths or people.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_employer_improvements_private (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  evidence_id UUID NOT NULL UNIQUE REFERENCES hhba_employer_evidence(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN
    ('pay_and_contracts','social_insurance','working_hours','employee_development',
     'recruitment_integrity','business_integrity')),
  private_title TEXT NOT NULL CHECK (char_length(private_title) BETWEEN 8 AND 100),
  private_description TEXT NOT NULL CHECK (char_length(private_description) BETWEEN 30 AND 1200),
  effective_date DATE NOT NULL,
  submitted_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK
    (status IN ('submitted','needs_more_info','approved','rejected','revoked')),
  public_summary TEXT CHECK (public_summary IS NULL OR char_length(public_summary) BETWEEN 40 AND 240),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status='approved' AND public_summary IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR status!='approved'
  )
);
CREATE INDEX IF NOT EXISTS hhba_improvements_org_idx
ON hhba_employer_improvements_private(organization_id,status,effective_date DESC);
CREATE TABLE IF NOT EXISTS hhba_employer_improvement_events (
  id UUID PRIMARY KEY,
  improvement_id UUID NOT NULL REFERENCES hhba_employer_improvements_private(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('submitted','clarified','reviewed','revoked')),
  previous_status TEXT,
  next_status TEXT NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_improvement_events_item_idx
ON hhba_employer_improvement_events(improvement_id,created_at,id);

CREATE OR REPLACE FUNCTION hhba_protect_improvement_events() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_IMPROVEMENT_AUDIT'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_improvement_events_immutable ON hhba_employer_improvement_events;
CREATE TRIGGER hhba_improvement_events_immutable BEFORE UPDATE OR DELETE
ON hhba_employer_improvement_events FOR EACH ROW
EXECUTE FUNCTION hhba_protect_improvement_events();

REVOKE ALL ON hhba_employer_improvements_private FROM PUBLIC;
REVOKE ALL ON hhba_employer_improvement_events FROM PUBLIC;
COMMIT;

-- HHBA Module 10: signed-off public score releases. Staging only, feature OFF by default.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_publication_cases_private (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  scoring_run_id UUID NOT NULL REFERENCES hhba_scoring_runs_private(id) ON DELETE RESTRICT,
  rule_version TEXT NOT NULL,
  feedback_period TEXT NOT NULL CHECK(feedback_period ~ '^20[2-9][0-9]-Q[1-4]$'),
  input_fingerprint CHAR(64) NOT NULL,
  score_snapshot JSONB NOT NULL,
  prepared_by UUID NOT NULL,
  first_reviewer UUID,
  second_reviewer UUID,
  first_reason TEXT,
  second_reason TEXT,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK
    (status IN ('prepared','first_approved','published','rejected','revoked')),
  publication_version INTEGER CHECK(publication_version IS NULL OR publication_version >= 1),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(organization_id,scoring_run_id),
  UNIQUE(organization_id,publication_version),
  CHECK (
    (status='prepared' AND first_reviewer IS NULL AND second_reviewer IS NULL
      AND publication_version IS NULL)
    OR (status='first_approved' AND first_reviewer IS NOT NULL
      AND second_reviewer IS NULL AND publication_version IS NULL)
    OR (status='published' AND first_reviewer IS NOT NULL
      AND second_reviewer IS NOT NULL AND publication_version IS NOT NULL
      AND published_at IS NOT NULL)
    OR status IN ('rejected','revoked')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS hhba_only_one_published_score
ON hhba_publication_cases_private(organization_id) WHERE status='published';
CREATE INDEX IF NOT EXISTS hhba_publication_org_idx
ON hhba_publication_cases_private(organization_id,prepared_at DESC);

CREATE TABLE IF NOT EXISTS hhba_publication_events_private (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES hhba_publication_cases_private(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK(action IN
    ('prepared','first_approved','published','rejected','revoked')),
  previous_status TEXT,
  next_status TEXT NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_publication_event_idx
ON hhba_publication_events_private(publication_id,occurred_at,id);
CREATE OR REPLACE FUNCTION hhba_publication_events_immutable_fn() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_PUBLICATION_AUDIT'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_publication_events_immutable ON hhba_publication_events_private;
CREATE TRIGGER hhba_publication_events_immutable
BEFORE UPDATE OR DELETE ON hhba_publication_events_private
FOR EACH ROW EXECUTE FUNCTION hhba_publication_events_immutable_fn();
REVOKE ALL ON hhba_publication_cases_private FROM PUBLIC;
REVOKE ALL ON hhba_publication_events_private FROM PUBLIC;
COMMIT;

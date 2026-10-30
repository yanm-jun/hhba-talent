-- HHBA recruitment response responsibility, first-stage PRIVATE additive schema.
-- Apply ONLY to the authenticated hiring-service Postgres after schema/RBAC backup
-- and verifying application IDs/organization IDs correspond to the canonical app.
-- This table is intentionally not a substitute for the existing application table.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_recruitment_responsibilities_private(
  application_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  posting_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  response_due_at TIMESTAMPTZ NOT NULL,
  calendar_version TEXT NOT NULL CHECK(char_length(calendar_version) BETWEEN 3 AND 80),
  state TEXT NOT NULL DEFAULT 'awaiting' CHECK(state IN('awaiting','reviewing','responded','paused','withdrawn')),
  response_kind TEXT CHECK(response_kind IN ('continued','declined','cancelled')),
  first_meaningful_response_at TIMESTAMPTZ,
  responsible_user_id UUID,
  reminder_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hhba_recruitment_deadline_after_delivery CHECK(response_due_at>delivered_at),
  CONSTRAINT hhba_recruitment_response_pair CHECK ((state='responded') = (response_kind IS NOT NULL)),
  CONSTRAINT hhba_recruitment_response_timestamp CHECK ((state='responded') = (first_meaningful_response_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hhba_resp_org_post_due_idx ON hhba_recruitment_responsibilities_private(organization_id,posting_id,response_due_at);
CREATE INDEX IF NOT EXISTS hhba_resp_candidate_idx ON hhba_recruitment_responsibilities_private(candidate_id,response_due_at DESC);
CREATE INDEX IF NOT EXISTS hhba_resp_overdue_idx ON hhba_recruitment_responsibilities_private(response_due_at) WHERE state IN ('awaiting','reviewing');
CREATE TABLE IF NOT EXISTS hhba_recruitment_responsibility_events(
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES hhba_recruitment_responsibilities_private(application_id) ON DELETE RESTRICT,
  event_name TEXT NOT NULL CHECK(event_name IN('delivered','canonical_reviewing','canonical_shortlisted','canonical_interview','canonical_rejected','canonical_hired','canonical_withdrawn','canonical_cancelled','notification_delivered')),
  actor_id UUID,
  delivery_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS hhba_resp_events_application_idx ON hhba_recruitment_responsibility_events(application_id,occurred_at);
CREATE OR REPLACE FUNCTION hhba_protect_recruitment_audit() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_RECRUITMENT_RESPONSIBILITY_AUDIT'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_recruitment_events_immutable ON hhba_recruitment_responsibility_events;
CREATE TRIGGER hhba_recruitment_events_immutable BEFORE UPDATE OR DELETE ON hhba_recruitment_responsibility_events
FOR EACH ROW EXECUTE FUNCTION hhba_protect_recruitment_audit();
-- Do not grant access to browser/public roles. Privileged server only.
REVOKE ALL ON hhba_recruitment_responsibilities_private FROM PUBLIC;
REVOKE ALL ON hhba_recruitment_responsibility_events FROM PUBLIC;
COMMIT;

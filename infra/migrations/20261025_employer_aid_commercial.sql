-- HHBA Modules 11-12: private company help applications + verified commercial referrals.
-- Additive, opt-in, isolated tests only. Real business account and rules required before mount.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_aid_applications_private(
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  service_type TEXT NOT NULL CHECK(service_type IN ('client_introduction','supply_chain','visibility')),
  business_summary TEXT NOT NULL CHECK(char_length(business_summary) BETWEEN 40 AND 1000),
  capacity_summary TEXT NOT NULL CHECK(char_length(capacity_summary) BETWEEN 40 AND 1000),
  capacity_evidence_id UUID NOT NULL REFERENCES hhba_employer_evidence(id) ON DELETE RESTRICT,
  submitted_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN (
    'submitted','needs_info','approved','declined','suspended','closed')),
  approval_policy_version TEXT,
  approved_publication_id UUID REFERENCES hhba_publication_cases_private(id) ON DELETE RESTRICT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_aid_org_idx ON hhba_aid_applications_private(organization_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS hhba_aid_one_active
 ON hhba_aid_applications_private(organization_id,service_type)
 WHERE status IN ('submitted','needs_info','approved','suspended');
CREATE TABLE IF NOT EXISTS hhba_aid_events_private(
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES hhba_aid_applications_private(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('submitted','reviewed','suspended','closed')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_aid_events_idx ON hhba_aid_events_private(application_id,occurred_at);
CREATE TABLE IF NOT EXISTS hhba_commercial_introductions_private(
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES hhba_aid_applications_private(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL,
  -- Internal pseudonymous buyer reference only: no buyer identities/contacts in this table.
  buyer_reference TEXT NOT NULL CHECK(buyer_reference ~ '^[A-Za-z0-9_-]{8,60}$'),
  buyer_sector TEXT NOT NULL CHECK(buyer_sector IN ('manufacturing','retail','services','technology','logistics','other')),
  opportunity_type TEXT NOT NULL CHECK(opportunity_type IN ('sales','distribution','procurement','partnership')),
  purpose TEXT NOT NULL CHECK(char_length(purpose) BETWEEN 30 AND 500),
  introduced_by UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'identified' CHECK(stage IN (
    'identified','consent_verified','introduced','in_discussion','not_pursued','closed')),
  buyer_consent_verified_by UUID,
  buyer_consent_reference TEXT CHECK(buyer_consent_reference ~ '^[A-Za-z0-9_-]{8,60}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id,buyer_reference,opportunity_type)
);
CREATE INDEX IF NOT EXISTS hhba_commercial_org_idx ON hhba_commercial_introductions_private(organization_id,created_at DESC);
CREATE TABLE IF NOT EXISTS hhba_commercial_order_proofs_private(
  id UUID PRIMARY KEY,
  introduction_id UUID NOT NULL UNIQUE REFERENCES hhba_commercial_introductions_private(id) ON DELETE RESTRICT,
  evidence_reference TEXT NOT NULL CHECK(evidence_reference ~ '^[A-Za-z0-9_-]{8,60}$'),
  submitted_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  verification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hhba_commercial_events_private(
  id UUID PRIMARY KEY,
  introduction_id UUID NOT NULL REFERENCES hhba_commercial_introductions_private(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('identified','consent_verified','stage_changed','proof_submitted','proof_reviewed')),
  prior_stage TEXT,
  next_stage TEXT NOT NULL,
  explanation TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_commercial_events_idx ON hhba_commercial_events_private(introduction_id,occurred_at);
CREATE OR REPLACE FUNCTION hhba_business_audit_immutable_fn() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_BUSINESS_AUDIT'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_aid_events_lock ON hhba_aid_events_private;
CREATE TRIGGER hhba_aid_events_lock BEFORE UPDATE OR DELETE ON hhba_aid_events_private
FOR EACH ROW EXECUTE FUNCTION hhba_business_audit_immutable_fn();
DROP TRIGGER IF EXISTS hhba_commercial_events_lock ON hhba_commercial_events_private;
CREATE TRIGGER hhba_commercial_events_lock BEFORE UPDATE OR DELETE ON hhba_commercial_events_private
FOR EACH ROW EXECUTE FUNCTION hhba_business_audit_immutable_fn();
REVOKE ALL ON hhba_aid_applications_private FROM PUBLIC;
REVOKE ALL ON hhba_aid_events_private FROM PUBLIC;
REVOKE ALL ON hhba_commercial_introductions_private FROM PUBLIC;
REVOKE ALL ON hhba_commercial_order_proofs_private FROM PUBLIC;
REVOKE ALL ON hhba_commercial_events_private FROM PUBLIC;
COMMIT;

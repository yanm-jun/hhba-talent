-- HHBA Module 06, pseudonymous employee feedback (isolated, additive).
-- Must not be migrated on Railway until authenticated HHBA employee and verifier
-- services exist. Never place free-text, employee name or account ID in raw ratings.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_feedback_tickets_private (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  period TEXT NOT NULL CHECK(period ~ '^20[2-9][0-9]-Q[1-4]$'),
  subject_hmac CHAR(64) NOT NULL,
  token_hmac CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed BOOLEAN NOT NULL DEFAULT FALSE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period, subject_hmac)
);
CREATE INDEX IF NOT EXISTS hhba_feedback_ticket_expiry
  ON hhba_feedback_tickets_private(expires_at);
CREATE TABLE IF NOT EXISTS hhba_employee_feedback_private (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  period TEXT NOT NULL CHECK(period ~ '^20[2-9][0-9]-Q[1-4]$'),
  pay SMALLINT NOT NULL CHECK(pay BETWEEN 1 AND 5),
  insurance SMALLINT NOT NULL CHECK(insurance BETWEEN 1 AND 5),
  rest SMALLINT NOT NULL CHECK(rest BETWEEN 1 AND 5),
  respect SMALLINT NOT NULL CHECK(respect BETWEEN 1 AND 5),
  development SMALLINT NOT NULL CHECK(development BETWEEN 1 AND 5)
  -- Intentionally NO user_id, token_id, identity hash, exact submission time,
  -- location, department, free-text, salary or device fingerprint.
);
CREATE INDEX IF NOT EXISTS hhba_feedback_rollup_quarter
  ON hhba_employee_feedback_private(organization_id, period);
-- Deny implicit PUBLIC grant. Deploy with distinct DB credentials/roles:
-- ticket issuer may access private ticket table, aggregate reader must have
-- only narrowly scoped access, enterprise roles must access neither table.
REVOKE ALL ON hhba_feedback_tickets_private FROM PUBLIC;
REVOKE ALL ON hhba_employee_feedback_private FROM PUBLIC;
COMMIT;

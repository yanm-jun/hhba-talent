-- HHBA employer scoring Module 07: INTERNAL DRAFTS ONLY.
-- Depends on 20261025_employer_evidence.sql and employee_feedback migration.
-- Do not apply to real employment or identity databases before approval.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_scoring_findings_private (
    id UUID PRIMARY KEY,
    sequence BIGSERIAL NOT NULL UNIQUE,
    organization_id UUID NOT NULL,
    evidence_id UUID NOT NULL REFERENCES hhba_employer_evidence(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK (category IN (
      'pay_and_contracts','social_insurance','working_hours',
      'employee_development','recruitment_integrity','business_integrity')),
    assessed_score SMALLINT NOT NULL CHECK (assessed_score BETWEEN 0 AND 100),
    assessment_reason TEXT NOT NULL CHECK (char_length(assessment_reason) BETWEEN 25 AND 1200),
    assessor_id UUID NOT NULL,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(evidence_id)
);
CREATE INDEX IF NOT EXISTS hhba_scoring_findings_by_org
ON hhba_scoring_findings_private(organization_id, category, sequence DESC);
CREATE TABLE IF NOT EXISTS hhba_scoring_runs_private (
    id UUID PRIMARY KEY,
    run_sequence BIGSERIAL UNIQUE NOT NULL,
    organization_id UUID NOT NULL,
    rule_version TEXT NOT NULL,
    input_fingerprint CHAR(64) NOT NULL,
    result JSONB NOT NULL,
    calculated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, rule_version, input_fingerprint)
);
CREATE INDEX IF NOT EXISTS hhba_scoring_runs_by_org
ON hhba_scoring_runs_private(organization_id, run_sequence DESC);
-- Independent score assessor records and calculated runs are append-only,
-- not editable history. Corrections require a new approved finding and run.
CREATE OR REPLACE FUNCTION hhba_reject_scoring_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'IMMUTABLE_SCORING_HISTORY';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_scoring_findings_immutable ON hhba_scoring_findings_private;
CREATE TRIGGER hhba_scoring_findings_immutable BEFORE UPDATE OR DELETE
ON hhba_scoring_findings_private FOR EACH ROW
EXECUTE FUNCTION hhba_reject_scoring_history_mutation();
DROP TRIGGER IF EXISTS hhba_scoring_runs_immutable ON hhba_scoring_runs_private;
CREATE TRIGGER hhba_scoring_runs_immutable BEFORE UPDATE OR DELETE
ON hhba_scoring_runs_private FOR EACH ROW
EXECUTE FUNCTION hhba_reject_scoring_history_mutation();
REVOKE ALL ON hhba_scoring_findings_private FROM PUBLIC;
REVOKE ALL ON hhba_scoring_runs_private FROM PUBLIC;
COMMIT;

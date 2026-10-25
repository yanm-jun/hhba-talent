-- HHBA enterprise evidence v0.1: additive PostgreSQL migration.
-- Apply only after backup and after inspecting the actual HHBA authenticated API database.
-- This migration intentionally does NOT touch the recruiting, organization, or talent tables.
BEGIN;
CREATE TABLE IF NOT EXISTS hhba_employer_evidence (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
      'pay_and_contracts','social_insurance','working_hours',
      'employee_development','recruitment_integrity','business_integrity')),
    statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 12 AND 1200),
    private_storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    file_mime TEXT NOT NULL CHECK (file_mime IN ('application/pdf','image/jpeg','image/png')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 10485760),
    sha256 CHAR(64) NOT NULL,
    security_status TEXT NOT NULL DEFAULT 'pending_scan' CHECK (security_status IN ('pending_scan','clean','rejected')),
    submitted_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
      'pending_review','verified','needs_more_info','rejected','expired','disputed')),
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_evidence_org_status_idx
  ON hhba_employer_evidence(organization_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS hhba_evidence_reviews (
    id UUID PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES hhba_employer_evidence(id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL,
    old_status TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('verified','needs_more_info','rejected')),
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 12 AND 1200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_evidence_reviews_item_idx ON hhba_evidence_reviews(evidence_id, created_at);
CREATE TABLE IF NOT EXISTS hhba_evidence_audit (
    id UUID PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES hhba_employer_evidence(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL,
    event_name TEXT NOT NULL CHECK (event_name IN ('submitted','reviewed')),
    before_status TEXT,
    after_status TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hhba_evidence_audit_item_idx ON hhba_evidence_audit(evidence_id, occurred_at);
-- Audit and review rows must never be deleted/updated; append new entries for corrections.
CREATE OR REPLACE FUNCTION hhba_protect_evidence_audit()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_EVIDENCE_HISTORY';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS hhba_evidence_audit_immutable ON hhba_evidence_audit;
CREATE TRIGGER hhba_evidence_audit_immutable BEFORE UPDATE OR DELETE
ON hhba_evidence_audit FOR EACH ROW EXECUTE FUNCTION hhba_protect_evidence_audit();
DROP TRIGGER IF EXISTS hhba_evidence_reviews_immutable ON hhba_evidence_reviews;
CREATE TRIGGER hhba_evidence_reviews_immutable BEFORE UPDATE OR DELETE
ON hhba_evidence_reviews FOR EACH ROW EXECUTE FUNCTION hhba_protect_evidence_audit();
COMMIT;

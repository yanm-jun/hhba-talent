-- HHBA Career Library V1 ingestion guard, Preview first.
-- New companies: create PENDING source, assign precisely one PRIMARY hall,
-- add optional SECONDARY halls, then upgrade source to VERIFIED.
-- Existing reviewed sources are unaffected when classification has been seeded.
CREATE VIEW IF NOT EXISTS hhba_library_unclassified_verified AS
 SELECT s.id,s.display_name
 FROM hhba_reviewed_recruitment_sources s
 WHERE s.review_status='VERIFIED' AND NOT EXISTS (
  SELECT 1 FROM hhba_library_employer_halls e
  WHERE e.employer_source_id=s.id AND e.membership_type='PRIMARY'
 );
CREATE TRIGGER IF NOT EXISTS hhba_library_require_primary_before_verification
 BEFORE UPDATE OF review_status ON hhba_reviewed_recruitment_sources
 WHEN NEW.review_status='VERIFIED' AND OLD.review_status<>'VERIFIED'
 AND NOT EXISTS (
  SELECT 1 FROM hhba_library_employer_halls e
  WHERE e.employer_source_id=OLD.id AND e.membership_type='PRIMARY'
 )
 BEGIN SELECT RAISE(ABORT,'HHBA_LIBRARY_PRIMARY_HALL_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS hhba_library_no_direct_verified_insert
 BEFORE INSERT ON hhba_reviewed_recruitment_sources
 WHEN NEW.review_status='VERIFIED'
 BEGIN SELECT RAISE(ABORT,'HHBA_LIBRARY_INSERT_PENDING_THEN_CLASSIFY'); END;

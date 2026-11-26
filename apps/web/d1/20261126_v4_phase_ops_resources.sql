-- Classified binding-call samples, no personally identifying inputs.
-- These are best-effort program-observed counts, NOT Cloudflare billing.
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN resource_samples INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN external_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN service_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN d1_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN r2_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN browser_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN maintenance_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hhba_v4_phase_ops_daily ADD COLUMN d1_statements INTEGER NOT NULL DEFAULT 0;

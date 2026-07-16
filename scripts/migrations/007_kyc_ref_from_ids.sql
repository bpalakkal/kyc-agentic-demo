-- =============================================================================
-- Migration 007 — kyc_ref is always <entity_id>_<case_id>
-- =============================================================================
-- The master schema (entity_data) carries entity_id + case_id, not kyc_ref. This
-- makes kyc_ref (the app's case key + Forge datastore name) a DB-derived value:
-- entity_id and case_id are required, and kyc_ref is auto-set to
-- entity_id || '_' || case_id on every insert/update. Impossible to violate —
-- functionally a generated column, done via a trigger because kyc_ref is a PK
-- referenced by FKs (a literal GENERATED column would need dropping/recreating
-- the PK and every FK).
--
-- Decision: wipe + re-onboard. This CLEARS all existing case data (entities and
-- everything that references it via ON DELETE CASCADE). Run once in Supabase.
-- =============================================================================

-- 1. Wipe existing case data (cascades to attributes, persons, snapshots,
--    exceptions, agent_runs, case_files, confirmations, overrides, screening).
TRUNCATE TABLE entities CASCADE;

-- 2. Add the source-of-truth columns (required).
ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_id text NOT NULL DEFAULT '';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS case_id   text NOT NULL DEFAULT '';
ALTER TABLE entities ALTER COLUMN entity_id DROP DEFAULT;
ALTER TABLE entities ALTER COLUMN case_id   DROP DEFAULT;

-- 3. Trigger: kyc_ref := entity_id || '_' || case_id on insert/update.
CREATE OR REPLACE FUNCTION entities_derive_kyc_ref() RETURNS trigger AS $$
BEGIN
  IF NEW.entity_id IS NULL OR NEW.entity_id = ''
     OR NEW.case_id IS NULL OR NEW.case_id = '' THEN
    RAISE EXCEPTION 'entity_id and case_id are required (kyc_ref is derived from them)';
  END IF;
  NEW.kyc_ref := NEW.entity_id || '_' || NEW.case_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entities_derive_kyc_ref_trg ON entities;
CREATE TRIGGER entities_derive_kyc_ref_trg
  BEFORE INSERT OR UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION entities_derive_kyc_ref();

COMMENT ON COLUMN entities.entity_id IS 'From master schema entity_data.entity_id. Required.';
COMMENT ON COLUMN entities.case_id   IS 'From master schema entity_data.case_id. Required.';
COMMENT ON TRIGGER entities_derive_kyc_ref_trg ON entities IS
  'Derives kyc_ref = entity_id || ''_'' || case_id (DB-enforced, like a generated column).';

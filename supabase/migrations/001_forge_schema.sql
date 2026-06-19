-- ─── Forge Integration Schema ────────────────────────────────────────────────
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- Assumes the following tables already exist:
--   entities(kyc_ref TEXT PRIMARY KEY, ...)
--   entity_snapshots(id UUID PRIMARY KEY, kyc_ref TEXT, data JSONB, created_at TIMESTAMPTZ, ...)
--   exceptions(kyc_ref TEXT, exception_number INT, status TEXT, ...)

-- ─── entity_attributes ───────────────────────────────────────────────────────
-- One row per top-level Forge attribute per snapshot.
-- Scalar / WGQ / array-level exception metadata live here.
-- Person sub-attributes live in entity_persons instead.
CREATE TABLE IF NOT EXISTS entity_attributes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref             TEXT        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  snapshot_id         UUID        NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,
  attribute_name      TEXT        NOT NULL,
  attribute_group     TEXT        NOT NULL DEFAULT 'core',  -- 'core' | 'wgq' | 'person' | 'document'
  display_value       TEXT,                -- lineage[0].value cast to text (best/first value)
  id_flag             BOOLEAN     NOT NULL DEFAULT FALSE,
  id_source           TEXT,
  verification_flag   BOOLEAN     NOT NULL DEFAULT FALSE,
  verification_source TEXT[],
  exception_flag      BOOLEAN     NOT NULL DEFAULT FALSE,
  exception_type      TEXT,               -- matches ExceptionType enum in schema
  lineage             JSONB,              -- full lineage array for Tracing panel
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ea_kyc_snapshot   ON entity_attributes(kyc_ref, snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ea_exception       ON entity_attributes(kyc_ref) WHERE exception_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_ea_attribute_name  ON entity_attributes(attribute_name);

-- ─── entity_persons ──────────────────────────────────────────────────────────
-- One row per person record (across all role types) per snapshot.
-- Covers: acting_person, authorized_signatory, beneficial_owner, board_director,
--         corporate_officer, investment_advisor, key_controller, power_of_attorney, trustee
CREATE TABLE IF NOT EXISTS entity_persons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_ref         TEXT        NOT NULL REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  snapshot_id     UUID        NOT NULL REFERENCES entity_snapshots(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL,  -- 'beneficial_owner' | 'trustee' | etc.
  person_index    INT         NOT NULL,  -- position within the role array (0-based)
  full_name       TEXT,                  -- extracted from *_full_name lineage[0].value
  ownership_pct   NUMERIC(6,2),          -- extracted for beneficial_owner only
  nationality     TEXT,                  -- extracted from *_nationality lineage[0].value
  attributes      JSONB       NOT NULL,  -- full sub-attribute block (with lineage) for Tracing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_kyc_role  ON entity_persons(kyc_ref, role);
CREATE INDEX IF NOT EXISTS idx_ep_snapshot  ON entity_persons(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ep_name      ON entity_persons(full_name);

-- ─── Extend exceptions table ─────────────────────────────────────────────────
-- Adds columns needed to distinguish Forge-promoted vs. analyst-created exceptions
-- and to link back to the originating attribute.
ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS attribute_name TEXT,
  ADD COLUMN IF NOT EXISTS source_type    TEXT NOT NULL DEFAULT 'analyst';
  -- source_type: 'analyst' (manually created) | 'forge' (auto-promoted from snapshot)

-- Prevent duplicate Forge exceptions for the same attribute on the same entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_exc_kyc_attr_open
  ON exceptions(kyc_ref, attribute_name)
  WHERE source_type = 'forge' AND status != 'resolved';

-- =============================================================================
-- Migration 008 — entity_persons nullable snapshot + DD reasoning columns
-- =============================================================================
-- Run AFTER 007.
--
-- 1. Allow agent-run person records in entity_persons without a Forge snapshot
--    (no-Forge API runners write persons directly; snapshot_id stays NULL).
--    NULL is already allowed by the FK definition in Postgres — we just drop
--    the NOT NULL constraint.
--
-- 2. Add DD audit columns to entity_attributes so that the DdRunner can
--    store per-attribute reasoning alongside the existing id_flag / verification_flag.
--
-- 3. Change verification_source from text to jsonb so we can store multiple
--    independent verification sources as a proper array.
-- =============================================================================

-- ── 1. entity_persons: make snapshot_id nullable ─────────────────────────────
ALTER TABLE entity_persons
  ALTER COLUMN snapshot_id DROP NOT NULL;

-- ── 2. entity_attributes: DD reasoning columns ───────────────────────────────
ALTER TABLE entity_attributes
  ADD COLUMN IF NOT EXISTS id_reasoning text;

ALTER TABLE entity_attributes
  ADD COLUMN IF NOT EXISTS verification_reasoning text;

-- ── 3. entity_attributes: promote verification_source to jsonb ───────────────
-- Safe USING clause: NULL stays NULL; JSON-array strings are cast directly;
-- bare strings (e.g. "Companies House") become a single-element array.
ALTER TABLE entity_attributes
  ALTER COLUMN verification_source TYPE jsonb
  USING CASE
    WHEN verification_source IS NULL     THEN NULL
    WHEN left(trim(verification_source), 1) = '[' THEN verification_source::jsonb
    ELSE jsonb_build_array(verification_source)
  END;

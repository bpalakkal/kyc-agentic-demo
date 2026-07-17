-- Migration 009: person_overrides table + agent_runs step/output columns
-- Run once in Supabase SQL Editor.

-- Durable analyst edits to person records.
-- One row per edited field; upserted on conflict so re-editing is safe.
CREATE TABLE IF NOT EXISTS person_overrides (
  kyc_ref       text        NOT NULL,
  role          text        NOT NULL,
  person_index  integer     NOT NULL,
  field         text        NOT NULL,
  value         text,
  overridden_by text        NOT NULL,
  overridden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kyc_ref, role, person_index, field)
);
CREATE INDEX IF NOT EXISTS person_overrides_kyc_ref_idx ON person_overrides (kyc_ref);

-- Persist thinking log and raw output for historical AgentRunsPanel view.
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS steps      jsonb;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS raw_output jsonb;

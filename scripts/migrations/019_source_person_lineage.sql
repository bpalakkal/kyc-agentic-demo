-- Source-scoped person persistence for parallel sourcing agents.
ALTER TABLE entity_persons
  ADD COLUMN IF NOT EXISTS agent_run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS entity_persons_agent_run_idx
  ON entity_persons (agent_run_id)
  WHERE agent_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS entity_persons_source_idx
  ON entity_persons (kyc_ref, source, created_at DESC)
  WHERE snapshot_id IS NULL;

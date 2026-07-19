-- Distinguish a successful business outcome from an operational failure.
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_reason text;

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_outcome_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('data_found', 'no_data'));

COMMENT ON COLUMN agent_runs.outcome IS
  'Business result of a successfully executed agent, independent of lifecycle status.';
COMMENT ON COLUMN agent_runs.outcome_reason IS
  'Human-readable explanation, especially when outcome is no_data.';

CREATE INDEX IF NOT EXISTS agent_runs_outcome_idx
  ON agent_runs (kyc_ref, outcome, started_at DESC);

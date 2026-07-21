-- Migration 016: distinguish an authoritative manual-registry requirement
-- from a provider failure or a confirmed no-match.
-- Apply after 015_us_sourcing_agents.sql.

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_outcome_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('data_found', 'no_data', 'manual_review'));

COMMENT ON COLUMN agent_runs.outcome IS
  'Business result: data_found, confirmed no_data, or manual_review when the authoritative source requires interactive verification.';

UPDATE agent_registry
SET required_env = ARRAY[]::text[], updated_at = now()
WHERE slug IN ('nfa', 'delaware', 'puerto-rico');

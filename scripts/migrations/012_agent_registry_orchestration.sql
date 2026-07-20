-- Migration 012: registry-driven UI visibility and dependency orchestration.
-- Apply after 011_agent_run_outcomes.sql.

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS top_level_trigger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_triggerable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pre_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS post_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS child_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS child_execution text NOT NULL DEFAULT 'parallel',
  ADD COLUMN IF NOT EXISTS failure_policy text NOT NULL DEFAULT 'fail_fast';

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_pre_agents_array_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_pre_agents_array_check
  CHECK (jsonb_typeof(pre_agents) = 'array');
ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_post_agents_array_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_post_agents_array_check
  CHECK (jsonb_typeof(post_agents) = 'array');
ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_child_agents_array_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_child_agents_array_check
  CHECK (jsonb_typeof(child_agents) = 'array');
ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_child_execution_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_child_execution_check
  CHECK (child_execution IN ('parallel', 'sequential'));
ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_failure_policy_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_failure_policy_check
  CHECK (failure_policy IN ('fail_fast', 'continue'));

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_execution_mode_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_execution_mode_check
  CHECK (execution_mode IN ('generic', 'screening', 'orchestrator'));

-- Existing aggregate agents become the top-level quick triggers. Existing
-- no-Forge slugs remain unchanged so runner resolution and history stay valid.
UPDATE agent_registry SET top_level_trigger = true
WHERE slug IN ('uk-sourcing-flow', 'us-sourcing-flow', 'dd-all-in-one', 'screening');

UPDATE agent_registry SET top_level_trigger = false
WHERE slug NOT IN ('uk-sourcing-flow', 'us-sourcing-flow', 'dd-all-in-one', 'screening');

UPDATE agent_registry SET execution_mode = 'orchestrator', child_execution = 'parallel', failure_policy = 'continue',
  child_agents = '["fca", "companies-house"]'::jsonb
WHERE slug = 'uk-sourcing-flow';

UPDATE agent_registry SET execution_mode = 'orchestrator', child_execution = 'parallel', failure_policy = 'continue',
  child_agents = '["gleif", "sec", "iapd", "nyse"]'::jsonb
WHERE slug = 'us-sourcing-flow';

UPDATE agent_registry SET execution_mode = 'orchestrator', child_execution = 'parallel', failure_policy = 'continue',
  child_agents = '["ria-entity-name-idv", "ria-cip-classification-id", "ria-legal-structure-idv", "ria-evidence-of-existence-idv", "ria-beneficial-owner-idv", "ria-authorized-signatory-idv", "ria-corporate-officer-idv", "ria-registered-address-idv", "ria-principal-business-address-idv", "ria-regulator-idv", "ria-government-identification-idv", "ria-parent-publicly-listed-id", "ria-securities-exchange-act-id", "ria-sole-proprietorship-id", "ria-commodities-indicator-id", "ria-transacting-funds-id", "ria-source-of-wealth-idv", "ria-proxy-bo-idv"]'::jsonb
WHERE slug = 'dd-all-in-one';

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_phase text NOT NULL DEFAULT 'main';

ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_phase_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_phase_check
  CHECK (run_phase IN ('orchestrator', 'pre', 'main', 'post'));

CREATE INDEX IF NOT EXISTS agent_runs_parent_run_idx
  ON agent_runs (parent_run_id, started_at);

COMMENT ON COLUMN agent_registry.user_triggerable IS
  'Whether analysts can invoke this agent directly; dependency-only utility agents set false.';
COMMENT ON COLUMN agent_registry.pre_agents IS
  'Ordered registry slugs executed before this agent.';
COMMENT ON COLUMN agent_registry.post_agents IS
  'Ordered registry slugs executed after this agent succeeds.';
COMMENT ON COLUMN agent_registry.child_agents IS
  'Registry-owned main-stage membership for virtual orchestrator agents.';

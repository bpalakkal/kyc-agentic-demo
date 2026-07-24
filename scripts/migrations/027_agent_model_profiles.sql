-- Migration 027: registry-selected Bedrock model profiles and immutable run attribution.
-- Apply after 026_normalized_exception_assessments.sql.

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS model_profile text;

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_model_profile_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_model_profile_check
  CHECK (
    model_profile IS NULL OR model_profile IN (
      'bedrock-claude-haiku',
      'bedrock-claude-sonnet',
      'bedrock-claude-opus'
    )
  );

UPDATE agent_registry
SET model_profile = 'bedrock-claude-haiku',
    required_env = array_remove(required_env, 'ANTHROPIC_API_KEY'),
    updated_at = now()
WHERE slug IN ('jersey-fsc', 'screening', 'document-processing-flow')
   OR agent_kind = 'document_digitizer';

UPDATE agent_registry
SET model_profile = 'bedrock-claude-sonnet',
    required_env = array_remove(required_env, 'ANTHROPIC_API_KEY'),
    updated_at = now()
WHERE category = 'due_diligence'
  AND execution_mode <> 'orchestrator';

UPDATE agent_registry
SET model_profile = NULL,
    required_env = array_remove(required_env, 'ANTHROPIC_API_KEY'),
    updated_at = now()
WHERE slug = 'dd-all-in-one';

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_model_id text,
  ADD COLUMN IF NOT EXISTS llm_profile_key text;

COMMENT ON COLUMN agent_registry.model_profile IS
  'Logical model profile resolved by the backend; credentials and concrete IDs remain environment variables.';
COMMENT ON COLUMN agent_runs.llm_model_id IS
  'Exact model or inference-profile ID resolved when the run started.';

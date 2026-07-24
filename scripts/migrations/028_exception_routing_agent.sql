-- Migration 028: grouped exception assessments and routing metadata.
-- Apply after 027_agent_model_profiles.sql.

ALTER TABLE entity_attributes
  ADD COLUMN IF NOT EXISTS exception_assessments jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE entity_attributes ea
SET exception_assessments = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'exception_type', type_item.value,
    'exception_reasoning', COALESCE(ea.exception_reason ->> ((type_item.ordinality - 1)::integer), '')
  ) ORDER BY type_item.ordinality)
  FROM jsonb_array_elements_text(ea.exception_type) WITH ORDINALITY AS type_item(value, ordinality)
), '[]'::jsonb)
WHERE ea.exception_assessments = '[]'::jsonb
  AND jsonb_typeof(ea.exception_type) = 'array'
  AND jsonb_array_length(ea.exception_type) > 0;

ALTER TABLE entity_attributes DROP CONSTRAINT IF EXISTS entity_attributes_exception_assessments_array_check;
ALTER TABLE entity_attributes
  ADD CONSTRAINT entity_attributes_exception_assessments_array_check
    CHECK (jsonb_typeof(exception_assessments) = 'array');

ALTER TABLE exceptions DROP CONSTRAINT IF EXISTS exceptions_exception_assessments_array_check;
ALTER TABLE exceptions DROP CONSTRAINT IF EXISTS exceptions_exception_queue_check;
ALTER TABLE exceptions DROP CONSTRAINT IF EXISTS exceptions_routing_confidence_check;
ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS exception_assessments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_queue text,
  ADD COLUMN IF NOT EXISTS guidance_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS routing_confidence integer;

UPDATE exceptions e
SET exception_assessments = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'exception_type', type_item.value,
    'exception_reasoning', COALESCE(e.reasoning ->> ((type_item.ordinality - 1)::integer), '')
  ) ORDER BY type_item.ordinality)
  FROM jsonb_array_elements_text(e.exception_types) WITH ORDINALITY AS type_item(value, ordinality)
), '[]'::jsonb)
WHERE e.exception_assessments = '[]'::jsonb
  AND jsonb_typeof(e.exception_types) = 'array'
  AND jsonb_array_length(e.exception_types) > 0;

ALTER TABLE exceptions
  ADD CONSTRAINT exceptions_exception_assessments_array_check
    CHECK (jsonb_typeof(exception_assessments) = 'array'),
  ADD CONSTRAINT exceptions_exception_queue_check
    CHECK (exception_queue IS NULL OR exception_queue IN ('Compliance', 'Analyst', 'Client', 'CRM', 'Auto-Resolve')),
  ADD CONSTRAINT exceptions_routing_confidence_check
    CHECK (routing_confidence IS NULL OR routing_confidence BETWEEN 0 AND 100);

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_agent_kind_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_agent_kind_check
  CHECK (agent_kind IN ('standard', 'document_flow', 'document_digitizer', 'exception_router'));

INSERT INTO agent_registry
  (slug, display_name, description, category, cip_classification, runner_type,
   output_type, required_env, enabled, trigger_all, sort_order, user_triggerable,
   execution_mode, pre_agents, post_agents, child_agents, child_execution,
   failure_policy, agent_kind, model_profile)
VALUES
  ('exception-routing', 'Exception Routing', 'Consolidates post-DD findings into enum-aligned exception assessments and routes them to the appropriate review queue.',
   'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor',
   'api', 'both', ARRAY[]::text[], true, false, 590, false,
   'generic', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'sequential',
   'fail_fast', 'exception_router', 'bedrock-claude-sonnet')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  user_triggerable = EXCLUDED.user_triggerable,
  agent_kind = EXCLUDED.agent_kind,
  model_profile = EXCLUDED.model_profile,
  updated_at = now();

UPDATE agent_registry
SET post_agents = CASE
    WHEN post_agents @> '["exception-routing"]'::jsonb THEN post_agents
    ELSE post_agents || '["exception-routing"]'::jsonb
  END,
  updated_at = now()
WHERE slug = 'dd-all-in-one';

-- Migration 030: jurisdiction-specific full KYC refresh orchestrators.
-- Sourcing and DD leaves execute sequentially; document processing, exception
-- routing, and screening follow as registered post-dependencies.

INSERT INTO agent_registry
  (slug, display_name, description, category, jurisdiction, runner_type,
   output_type, execution_mode, required_env, enabled, trigger_all, sort_order,
   top_level_trigger, user_triggerable, pre_agents, post_agents, child_agents,
   child_execution, failure_policy)
VALUES
  (
    'kyc-refresh-uk', 'Refresh KYC · UK',
    'Runs UK sourcing, due diligence, document processing, exception routing, and screening in policy order.',
    'sourcing', 'UK', 'api', 'both', 'orchestrator', ARRAY[]::text[], true, false, 5,
    true, true, '[]'::jsonb, '["screening"]'::jsonb,
    '["uk-sourcing-flow", "dd-all-in-one"]'::jsonb, 'sequential', 'continue'
  ),
  (
    'kyc-refresh-us', 'Refresh KYC · US',
    'Runs US sourcing, due diligence, document processing, exception routing, and screening in policy order.',
    'sourcing', 'US', 'api', 'both', 'orchestrator', ARRAY[]::text[], true, false, 6,
    true, true, '[]'::jsonb, '["screening"]'::jsonb,
    '["us-sourcing-flow", "dd-all-in-one"]'::jsonb, 'sequential', 'continue'
  )
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  jurisdiction = EXCLUDED.jurisdiction,
  runner_type = EXCLUDED.runner_type,
  output_type = EXCLUDED.output_type,
  execution_mode = EXCLUDED.execution_mode,
  required_env = EXCLUDED.required_env,
  enabled = EXCLUDED.enabled,
  trigger_all = EXCLUDED.trigger_all,
  sort_order = EXCLUDED.sort_order,
  top_level_trigger = EXCLUDED.top_level_trigger,
  user_triggerable = EXCLUDED.user_triggerable,
  pre_agents = EXCLUDED.pre_agents,
  post_agents = EXCLUDED.post_agents,
  child_agents = EXCLUDED.child_agents,
  child_execution = EXCLUDED.child_execution,
  failure_policy = EXCLUDED.failure_policy,
  updated_at = now();

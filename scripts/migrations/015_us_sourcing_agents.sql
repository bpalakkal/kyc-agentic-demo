-- Migration 015: complete the seven-agent US sourcing group.
-- Apply after 014_agent_registry_audit.sql.

INSERT INTO agent_registry
  (slug, display_name, description, category, cip_classification, jurisdiction,
   output_type, execution_mode, required_env, enabled, trigger_all, sort_order,
   top_level_trigger, user_triggerable, pre_agents, post_agents, child_agents,
   child_execution, failure_policy)
VALUES
  ('nfa', 'NFA BASIC', 'National Futures Association BASIC registration and membership research.', 'sourcing', NULL, 'US', 'attributes', 'generic', ARRAY[]::text[], true, false, 90, false, true, '[]', '[]', '[]', 'parallel', 'fail_fast'),
  ('delaware', 'State of Delaware', 'Delaware Division of Corporations entity registration research.', 'sourcing', NULL, 'US-DE', 'attributes', 'generic', ARRAY[]::text[], true, false, 100, false, true, '[]', '[]', '[]', 'parallel', 'fail_fast'),
  ('puerto-rico', 'State of Puerto Rico', 'Puerto Rico Department of State corporation and entity registration research.', 'sourcing', NULL, 'US-PR', 'attributes', 'generic', ARRAY[]::text[], true, false, 110, false, true, '[]', '[]', '[]', 'parallel', 'fail_fast')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, description = EXCLUDED.description,
  category = EXCLUDED.category, jurisdiction = EXCLUDED.jurisdiction,
  output_type = EXCLUDED.output_type, execution_mode = EXCLUDED.execution_mode,
  required_env = EXCLUDED.required_env, enabled = EXCLUDED.enabled,
  user_triggerable = EXCLUDED.user_triggerable, sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE agent_registry
SET description = 'Runs IAPD, SEC EDGAR, NYSE, NFA BASIC, Delaware, Puerto Rico, and GLEIF independently in parallel.',
    required_env = ARRAY[]::text[],
    child_agents = '["iapd", "sec", "nyse", "nfa", "delaware", "puerto-rico", "gleif"]'::jsonb,
    child_execution = 'parallel', failure_policy = 'continue', updated_at = now()
WHERE slug = 'us-sourcing-flow';

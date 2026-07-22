-- Align persisted orchestration and credential readiness with the sourcing spec.
UPDATE agent_registry
SET child_agents = '["fca", "companies-house", "jersey-fsc"]'::jsonb,
    description = 'Runs FCA, Companies House, and Jersey FSC independently in parallel.',
    updated_at = now()
WHERE slug = 'uk-sourcing-flow';

UPDATE agent_registry
SET required_env = ARRAY['ANTHROPIC_API_KEY', 'FIRECRAWL_API_KEY']::text[], updated_at = now()
WHERE slug = 'jersey-fsc';

UPDATE agent_registry
SET required_env = ARRAY['FIRECRAWL_API_KEY']::text[], updated_at = now()
WHERE slug IN ('nyse', 'nfa', 'delaware');

UPDATE agent_registry
SET required_env = ARRAY['FIRECRAWL_API_KEY']::text[], updated_at = now()
WHERE slug = 'puerto-rico';

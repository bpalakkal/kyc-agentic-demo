-- Migration 017: make Delaware availability depend on Firecrawl Browser API.
-- Apply after 016_agent_run_manual_review_outcome.sql.

UPDATE agent_registry
SET description = 'Delaware Division of Corporations entity registration search through a disposable Firecrawl browser session.',
    required_env = ARRAY['FIRECRAWL_API_KEY'],
    updated_at = now()
WHERE slug = 'delaware';

-- Migration 018: sourcing agents provide values/lineage, not ID/V decisions.
-- Apply after 017_delaware_firecrawl.sql.

UPDATE entity_attributes AS ea
SET id_flag = false,
    id_source = NULL,
    id_reasoning = NULL,
    verification_flag = false,
    verification_source = NULL,
    verification_reasoning = NULL
FROM agent_runs AS ar
WHERE ea.agent_run_id = ar.id
  AND ar.agent_slug NOT LIKE 'ria-%'
  AND (
    ea.id_flag OR ea.verification_flag
    OR ea.id_source IS NOT NULL OR ea.id_reasoning IS NOT NULL
    OR ea.verification_source IS NOT NULL OR ea.verification_reasoning IS NOT NULL
  );

-- Legacy/imported snapshot rows are source data, not DD decisions. This also
-- clears old manual-import flags; explicit analyst confirmations are stored
-- separately and are not represented by these source rows.
UPDATE entity_attributes
SET id_flag = false,
    id_source = NULL,
    id_reasoning = NULL,
    verification_flag = false,
    verification_source = NULL,
    verification_reasoning = NULL
WHERE agent_run_id IS NULL
  AND (
    id_flag OR verification_flag
    OR id_source IS NOT NULL OR id_reasoning IS NOT NULL
    OR verification_source IS NOT NULL OR verification_reasoning IS NOT NULL
  );

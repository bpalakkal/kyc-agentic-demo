-- Migration 029: selectable Amazon Bedrock or Anthropic API Claude profiles.
-- Apply after 028_exception_routing_agent.sql.

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_model_profile_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_model_profile_check
  CHECK (
    model_profile IS NULL OR model_profile IN (
      'bedrock-claude-haiku',
      'bedrock-claude-sonnet',
      'bedrock-claude-opus',
      'anthropic-claude-haiku',
      'anthropic-claude-sonnet',
      'anthropic-claude-opus'
    )
  );

CREATE OR REPLACE FUNCTION switch_agent_model_provider(
  p_provider text,
  p_changed_by uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_provider NOT IN ('aws-bedrock', 'anthropic') THEN
    RAISE EXCEPTION 'Unsupported model provider: %', p_provider;
  END IF;

  WITH targets AS (
    SELECT
      ar.slug,
      to_jsonb(ar) AS old_config,
      CASE p_provider
        WHEN 'aws-bedrock' THEN replace(ar.model_profile, 'anthropic-', 'bedrock-')
        ELSE replace(ar.model_profile, 'bedrock-', 'anthropic-')
      END AS new_profile
    FROM agent_registry ar
    WHERE ar.execution_mode <> 'orchestrator'
      AND (
        ar.model_profile LIKE 'bedrock-claude-%'
        OR ar.model_profile LIKE 'anthropic-claude-%'
      )
  ),
  audits AS (
    INSERT INTO agent_registry_audit
      (agent_slug, changed_by, old_config, new_config)
    SELECT
      targets.slug,
      p_changed_by,
      targets.old_config,
      jsonb_set(targets.old_config, '{model_profile}', to_jsonb(targets.new_profile))
    FROM targets
    WHERE targets.old_config->>'model_profile' IS DISTINCT FROM targets.new_profile
    RETURNING agent_slug
  )
  UPDATE agent_registry ar
  SET model_profile = targets.new_profile,
      updated_at = now()
  FROM targets
  WHERE ar.slug = targets.slug
    AND ar.model_profile IS DISTINCT FROM targets.new_profile;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION switch_agent_model_provider(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION switch_agent_model_provider(text, uuid) TO service_role;

COMMENT ON FUNCTION switch_agent_model_provider(text, uuid) IS
  'Atomically switches every model-backed leaf agent between equivalent Bedrock and Anthropic Claude tiers and writes one audit row per changed agent.';

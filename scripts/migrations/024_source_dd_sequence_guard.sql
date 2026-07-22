-- Prevent sourcing and due-diligence roots from overlapping for one entity.
-- A pending-review run remains active because its proposed data has not yet
-- been accepted or rejected.

CREATE OR REPLACE FUNCTION enforce_source_dd_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_conflict text;
BEGIN
  IF NEW.parent_run_id IS NOT NULL OR NEW.status NOT IN ('running', 'pending_review') THEN
    RETURN NEW;
  END IF;

  SELECT category INTO v_category FROM agent_registry WHERE slug = NEW.agent_slug;
  IF v_category NOT IN ('sourcing', 'due_diligence') THEN
    RETURN NEW;
  END IF;

  -- Serialize competing starts for this entity across server instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.kyc_ref, 0));
  v_conflict := CASE v_category WHEN 'sourcing' THEN 'due_diligence' ELSE 'sourcing' END;

  IF EXISTS (
    SELECT 1
    FROM agent_runs ar
    JOIN agent_registry reg ON reg.slug = ar.agent_slug
    WHERE ar.kyc_ref = NEW.kyc_ref
      AND ar.parent_run_id IS NULL
      AND ar.status IN ('running', 'pending_review')
      AND reg.category = v_conflict
  ) THEN
    RAISE EXCEPTION 'AGENT_SEQUENCE_CONFLICT: % cannot start while % is running or awaiting review for entity %',
      replace(v_category, '_', ' '), replace(v_conflict, '_', ' '), NEW.kyc_ref;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_runs_source_dd_sequence_guard ON agent_runs;
CREATE TRIGGER agent_runs_source_dd_sequence_guard
BEFORE INSERT ON agent_runs
FOR EACH ROW EXECUTE FUNCTION enforce_source_dd_sequence();

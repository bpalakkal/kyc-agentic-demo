-- Guarantee unique sequential exception numbers when many DD agents publish in
-- parallel. Some environments retained the original MAX()+1 implementation,
-- which returned the same number to concurrent callers.

CREATE TABLE IF NOT EXISTS exception_number_counters (
  kyc_ref      text PRIMARY KEY REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  next_number integer NOT NULL CHECK (next_number > 0)
);

INSERT INTO exception_number_counters (kyc_ref, next_number)
SELECT kyc_ref, MAX(exception_number) + 1
FROM exceptions
GROUP BY kyc_ref
ON CONFLICT (kyc_ref) DO UPDATE
SET next_number = GREATEST(exception_number_counters.next_number, EXCLUDED.next_number);

CREATE OR REPLACE FUNCTION alloc_exception_numbers(p_kyc_ref text, p_count integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start integer;
BEGIN
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'p_count must be greater than zero';
  END IF;

  -- Transaction-scoped and entity-scoped: unrelated cases remain concurrent,
  -- while reservations for one case are strictly serialized.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_kyc_ref, 0));

  SELECT GREATEST(
    COALESCE((SELECT next_number FROM exception_number_counters WHERE kyc_ref = p_kyc_ref), 1),
    COALESCE((SELECT MAX(exception_number) + 1 FROM exceptions WHERE kyc_ref = p_kyc_ref), 1)
  )
  INTO v_start;

  INSERT INTO exception_number_counters (kyc_ref, next_number)
  VALUES (p_kyc_ref, v_start + p_count)
  ON CONFLICT (kyc_ref) DO UPDATE
  SET next_number = EXCLUDED.next_number;

  RETURN v_start;
END;
$$;

REVOKE ALL ON exception_number_counters FROM anon, authenticated;
REVOKE ALL ON FUNCTION alloc_exception_numbers(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alloc_exception_numbers(text, integer) TO authenticated, service_role;

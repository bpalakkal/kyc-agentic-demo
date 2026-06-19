-- ─── Atomic exception number allocation ──────────────────────────────────────
-- Replaces the MAX(exception_number)+1 pattern in syncForgeExceptions, which
-- is not safe under concurrent snapshot saves for the same entity.
--
-- The function uses a dedicated sequences table with an atomic upsert so that
-- multiple concurrent callers for the same kyc_ref each get a distinct block
-- of numbers with no gaps or duplicates.

CREATE TABLE IF NOT EXISTS exception_number_sequences (
  kyc_ref  text PRIMARY KEY REFERENCES entities(kyc_ref) ON DELETE CASCADE,
  next_num int  NOT NULL DEFAULT 1
);

-- Allocates p_count consecutive exception numbers for p_kyc_ref and returns
-- the first number in the allocated block.
-- Safe to call concurrently: INSERT ... ON CONFLICT DO UPDATE is atomic in PG.
CREATE OR REPLACE FUNCTION alloc_exception_numbers(p_kyc_ref text, p_count int)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_start int;
BEGIN
  INSERT INTO exception_number_sequences (kyc_ref, next_num)
  VALUES (p_kyc_ref, 1 + p_count)
  ON CONFLICT (kyc_ref) DO UPDATE
    SET next_num = exception_number_sequences.next_num + p_count
  RETURNING next_num - p_count
  INTO v_start;

  RETURN v_start;
END;
$$;

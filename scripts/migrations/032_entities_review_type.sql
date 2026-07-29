-- Migration 032: give the Work Queue onboarding and periodic-refresh tabs real data.
-- 031 is already used by the concurrent exception-number allocator in No Forge.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'periodic_refresh';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entities_review_type_check'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT entities_review_type_check
      CHECK (review_type IN ('onboarding', 'periodic_refresh'));
  END IF;
END $$;

COMMENT ON COLUMN entities.review_type IS
  'Review workflow used by the Work Queue onboarding and periodic-refresh tabs.';

CREATE INDEX IF NOT EXISTS entities_review_type_idx ON entities (review_type);

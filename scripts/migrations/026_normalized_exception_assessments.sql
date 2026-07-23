-- Migration 026: normalized, multi-valued exception assessments.
-- Apply after 025_work_queue_agent_batches.sql.

-- The entity-data block remains the current assessment. JSON arrays allow an
-- attribute to carry more than one type, reason, or recommendation.
ALTER TABLE entity_attributes
  ALTER COLUMN exception_type TYPE jsonb
    USING CASE
      WHEN exception_type IS NULL OR btrim(exception_type) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(exception_type)
    END,
  ALTER COLUMN exception_type SET DEFAULT '[]'::jsonb,
  ALTER COLUMN exception_type SET NOT NULL,
  ADD COLUMN IF NOT EXISTS exception_reason jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exception_recommendation jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE entity_attributes
  DROP CONSTRAINT IF EXISTS entity_attributes_exception_type_array_check,
  DROP CONSTRAINT IF EXISTS entity_attributes_exception_reason_array_check,
  DROP CONSTRAINT IF EXISTS entity_attributes_exception_recommendation_array_check;

ALTER TABLE entity_attributes
  ADD CONSTRAINT entity_attributes_exception_type_array_check
    CHECK (jsonb_typeof(exception_type) = 'array'),
  ADD CONSTRAINT entity_attributes_exception_reason_array_check
    CHECK (jsonb_typeof(exception_reason) = 'array'),
  ADD CONSTRAINT entity_attributes_exception_recommendation_array_check
    CHECK (jsonb_typeof(exception_recommendation) = 'array');

-- The separate table owns review lifecycle and history. Existing reasoning and
-- recommended_actions columns remain canonical for workflow details.
ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS exception_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entity_attribute_id uuid
    REFERENCES entity_attributes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_person_id uuid
    REFERENCES entity_persons(id) ON DELETE SET NULL;

ALTER TABLE exceptions
  DROP CONSTRAINT IF EXISTS exceptions_exception_types_array_check;

ALTER TABLE exceptions
  ADD CONSTRAINT exceptions_exception_types_array_check
    CHECK (jsonb_typeof(exception_types) = 'array');

CREATE INDEX IF NOT EXISTS exceptions_entity_attribute_id_idx
  ON exceptions (entity_attribute_id)
  WHERE entity_attribute_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exceptions_entity_person_id_idx
  ON exceptions (entity_person_id)
  WHERE entity_person_id IS NOT NULL;

-- Preserve existing workflow rows by deriving a type from their best available
-- legacy description. This is intentionally conservative and never overwrites
-- a populated exception_types array.
UPDATE exceptions
SET exception_types = '["Legacy Exception"]'::jsonb
WHERE exception_types = '[]'::jsonb;

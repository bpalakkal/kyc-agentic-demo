-- Idempotent post-sourcing document classification and digitization.
ALTER TABLE case_files
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS digitized_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS processing_agent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL;

ALTER TABLE case_files DROP CONSTRAINT IF EXISTS case_files_processing_status_check;
ALTER TABLE case_files ADD CONSTRAINT case_files_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'complete', 'failed', 'duplicate', 'not_applicable'));

UPDATE case_files SET processing_status = 'not_applicable' WHERE file_category = 'screenshot';
UPDATE case_files SET processing_status = 'pending' WHERE file_category = 'document' AND processing_status = 'not_applicable';

CREATE UNIQUE INDEX IF NOT EXISTS case_files_entity_document_sha256_uidx
  ON case_files (kyc_ref, content_sha256)
  WHERE file_category = 'document' AND content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS case_files_pending_processing_idx
  ON case_files (kyc_ref, created_at)
  WHERE file_category = 'document' AND processing_status IN ('pending', 'failed');

INSERT INTO agent_registry
  (slug, display_name, description, category, output_type, execution_mode,
   required_env, enabled, trigger_all, sort_order, top_level_trigger,
   user_triggerable, pre_agents, post_agents, child_agents, child_execution, failure_policy)
VALUES
  ('document-processing-flow', 'Document Classification & Digitization',
   'Deduplicates, classifies, and digitizes newly sourced documents once per entity.',
   'sourcing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY']::text[], true, false, 115,
   false, false, '[]', '[]', '[]', 'sequential', 'fail_fast')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, description = EXCLUDED.description,
  output_type = EXCLUDED.output_type, execution_mode = EXCLUDED.execution_mode,
  required_env = EXCLUDED.required_env, enabled = EXCLUDED.enabled,
  user_triggerable = EXCLUDED.user_triggerable, updated_at = now();

UPDATE agent_registry
SET post_agents = '["document-processing-flow"]'::jsonb, updated_at = now()
WHERE slug IN (
  'uk-sourcing-flow', 'us-sourcing-flow', 'fca', 'companies-house', 'jersey-fsc',
  'iapd', 'sec', 'nyse', 'nfa', 'delaware', 'puerto-rico', 'gleif'
);

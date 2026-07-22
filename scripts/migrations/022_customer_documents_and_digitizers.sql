-- Customer document uploads and dependency-only, document-specific digitizers.
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS agent_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_category_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_category_check
  CHECK (category IN ('sourcing', 'due_diligence', 'screening', 'document_processing'));

ALTER TABLE agent_registry DROP CONSTRAINT IF EXISTS agent_registry_agent_kind_check;
ALTER TABLE agent_registry ADD CONSTRAINT agent_registry_agent_kind_check
  CHECK (agent_kind IN ('standard', 'document_flow', 'document_digitizer'));

CREATE UNIQUE INDEX IF NOT EXISTS agent_registry_document_digitizer_type_uidx
  ON agent_registry (document_type)
  WHERE agent_kind = 'document_digitizer' AND enabled = true;

UPDATE agent_registry SET agent_kind = 'document_flow', category = 'document_processing',
  user_triggerable = false, top_level_trigger = false, updated_at = now()
WHERE slug = 'document-processing-flow';

INSERT INTO agent_registry
  (slug, display_name, description, category, output_type, execution_mode,
   required_env, enabled, trigger_all, sort_order, top_level_trigger,
   user_triggerable, pre_agents, post_agents, child_agents, child_execution,
   failure_policy, agent_kind, document_type)
VALUES
  ('digitize-10k-annual-report', 'Digitize 10K / Annual Report', 'Extracts canonical KYC data from a 10K or annual report.', 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 401, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', '10K/Annual Report'),
  ('digitize-annual-return', 'Digitize Annual Return', 'Extracts canonical KYC data from an annual return.', 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 402, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Annual Return'),
  ('digitize-articles-of-association', 'Digitize Articles of Association', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 403, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Articles of Association'),
  ('digitize-articles-of-incorporation', 'Digitize Articles of Incorporation', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 404, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Articles of Incorporation'),
  ('digitize-articles-of-organization', 'Digitize Articles of Organization', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 405, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Articles of Organization'),
  ('digitize-audited-financial-report', 'Digitize Audited Financial Report', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 406, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Audited Financial Report'),
  ('digitize-authorized-signers-list', 'Digitize Authorized Signers List', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 407, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Authorized signers list'),
  ('digitize-board-resolution', 'Digitize Board Resolution', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 408, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Board Resolution'),
  ('digitize-certificate-of-formation', 'Digitize Certificate of Formation', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 409, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Certificate of Formation'),
  ('digitize-certificate-of-incorporation', 'Digitize Certificate of Incorporation', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 410, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Certificate of Incorporation'),
  ('digitize-certificate-of-incumbency', 'Digitize Certificate of Incumbency', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 411, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Certificate of Incumbency'),
  ('digitize-certificate-of-name-change', 'Digitize Certificate of Name Change', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 412, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Certificate of Name Change'),
  ('digitize-declaration-of-trust', 'Digitize Declaration of Trust', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 413, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Declaration of Trust'),
  ('digitize-drivers-license', 'Digitize Drivers License', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 414, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Drivers License'),
  ('digitize-government-photo-id', 'Digitize Government Photo ID', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 415, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Government Photo ID'),
  ('digitize-investment-management-agreement', 'Digitize Investment Management Agreement', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 416, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Investment Management Agreement'),
  ('digitize-llc-lp-operating-agreement', 'Digitize LLC / LP Operating Agreement', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 417, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'LLC/LP Operating Agreement'),
  ('digitize-memorandum-of-association', 'Digitize Memorandum of Association', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 418, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Memorandum of Association'),
  ('digitize-offering-memorandum', 'Digitize Offering Memorandum', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 419, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Offering Memorandum'),
  ('digitize-organizational-structure', 'Digitize Organizational Structure', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 420, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Organizational Structure Document'),
  ('digitize-passport', 'Digitize Passport', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 421, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Passport'),
  ('digitize-prospectus', 'Digitize Prospectus', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 422, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Prospectus'),
  ('digitize-sec-form-adv', 'Digitize SEC Form ADV', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 423, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'SEC Form ADV'),
  ('digitize-trust-agreement', 'Digitize Trust Agreement', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 424, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Trust Agreement'),
  ('digitize-w9', 'Digitize W9', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 425, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'W9'),
  ('digitize-wolfsberg-questionnaire', 'Digitize Wolfsberg Questionnaire', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 426, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Wolfsberg Questionnaire'),
  ('digitize-worldcheck-report', 'Digitize WorldCheck Report', NULL, 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 427, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'WorldCheck Report'),
  ('digitize-generic-document', 'Digitize Other Document', 'Fallback digitizer for readable documents without a specialized extractor.', 'document_processing', 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 499, false, false, '[]', '[]', '[]', 'sequential', 'fail_fast', 'document_digitizer', 'Other')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, description = EXCLUDED.description,
  category = EXCLUDED.category, output_type = EXCLUDED.output_type,
  required_env = EXCLUDED.required_env, enabled = EXCLUDED.enabled,
  top_level_trigger = false, user_triggerable = false,
  agent_kind = EXCLUDED.agent_kind, document_type = EXCLUDED.document_type,
  updated_at = now();

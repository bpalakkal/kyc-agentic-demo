-- Migration 010: persistent golden-source agent registry.
-- Apply after 009_person_overrides_and_runs_columns.sql.

CREATE TABLE IF NOT EXISTS agent_registry (
  slug                text PRIMARY KEY,
  display_name        text NOT NULL,
  description         text,
  category            text NOT NULL CHECK (category IN ('sourcing', 'due_diligence', 'screening')),
  cip_classification  text,
  jurisdiction        text,
  runner_type         text NOT NULL DEFAULT 'api' CHECK (runner_type = 'api'),
  output_type         text NOT NULL CHECK (output_type IN ('attributes', 'exceptions', 'both', 'screening')),
  execution_mode      text NOT NULL DEFAULT 'generic' CHECK (execution_mode IN ('generic', 'screening')),
  required_env        text[] NOT NULL DEFAULT '{}',
  enabled             boolean NOT NULL DEFAULT true,
  trigger_all         boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_registry_category_sort_idx
  ON agent_registry (category, sort_order, display_name);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read agent registry" ON agent_registry;
CREATE POLICY "Authenticated users can read agent registry"
  ON agent_registry FOR SELECT TO authenticated USING (true);

-- Idempotent golden-source seed. Existing rows are updated so this migration can
-- also be used to reconcile non-production environments before a formal sync job exists.
INSERT INTO agent_registry
  (slug, display_name, description, category, cip_classification, jurisdiction,
   output_type, execution_mode, required_env, enabled, trigger_all, sort_order)
VALUES
  ('uk-sourcing-flow', 'UK - All Sources', 'Runs FCA Register and Companies House in parallel.', 'sourcing', NULL, 'UK', 'both', 'generic', ARRAY['COMPANIES_HOUSE_API_KEY','FCA_AUTH_EMAIL','FCA_API_KEY'], true, true, 10),
  ('companies-house', 'Companies House', 'Company details, officers, PSCs, filings, and incorporation documents.', 'sourcing', NULL, 'UK', 'both', 'generic', ARRAY['COMPANIES_HOUSE_API_KEY'], true, false, 20),
  ('fca', 'FCA Register', 'UK Financial Conduct Authority firm data.', 'sourcing', NULL, 'UK', 'attributes', 'generic', ARRAY['FCA_AUTH_EMAIL','FCA_API_KEY'], true, false, 30),
  ('jersey-fsc', 'JFSC', 'Jersey Financial Services Commission registry research.', 'sourcing', NULL, 'UK', 'attributes', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 40),
  ('us-sourcing-flow', 'US - All Sources', 'Runs GLEIF, SEC EDGAR, IAPD, and NYSE in parallel.', 'sourcing', NULL, 'US', 'attributes', 'generic', ARRAY['SEC_API_KEY'], true, true, 50),
  ('sec', 'SEC EDGAR', 'SEC EDGAR company and filing data.', 'sourcing', NULL, 'US', 'attributes', 'generic', ARRAY[]::text[], true, false, 60),
  ('iapd', 'IAPD', 'Investment Adviser Public Disclosure and Form ADV data.', 'sourcing', NULL, 'US', 'attributes', 'generic', ARRAY['SEC_API_KEY'], true, false, 70),
  ('nyse', 'NYSE', 'NYSE and NASDAQ listing data.', 'sourcing', NULL, 'US', 'attributes', 'generic', ARRAY[]::text[], true, false, 80),
  ('gleif', 'GLEIF', 'Global Legal Entity Identifier data.', 'sourcing', NULL, 'Global', 'attributes', 'generic', ARRAY[]::text[], true, false, 90),

  ('dd-all-in-one', 'RIA DD All in One', 'Runs all RIA due-diligence policies in one Claude request.', 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, true, 100),
  ('ria-entity-name-idv', 'Entity Name', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 110),
  ('ria-cip-classification-id', 'CIP Classification', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 120),
  ('ria-legal-structure-idv', 'Legal Structure', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 130),
  ('ria-evidence-of-existence-idv', 'Evidence of Existence', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 140),
  ('ria-beneficial-owner-idv', 'Beneficial Owner', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 150),
  ('ria-authorized-signatory-idv', 'Authorized Signatory', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 160),
  ('ria-corporate-officer-idv', 'Corporate Officer', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 170),
  ('ria-registered-address-idv', 'Registered Address', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 180),
  ('ria-principal-business-address-idv', 'Principal Business Address', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 190),
  ('ria-regulator-idv', 'Regulator', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 200),
  ('ria-government-identification-idv', 'Government Identification', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 210),
  ('ria-parent-publicly-listed-id', 'Parent Publicly Listed', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 220),
  ('ria-securities-exchange-act-id', 'Securities Exchange Act', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 230),
  ('ria-sole-proprietorship-id', 'Sole Proprietorship', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 240),
  ('ria-commodities-indicator-id', 'Commodities Indicator', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 250),
  ('ria-transacting-funds-id', 'Transacting Funds', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 260),
  ('ria-source-of-wealth-idv', 'Source of Wealth', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 270),
  ('ria-proxy-bo-idv', 'Proxy BO', NULL, 'due_diligence', 'Registered Investment Advisor or Commodity Trading Advisor', NULL, 'both', 'generic', ARRAY['ANTHROPIC_API_KEY'], true, false, 280),

  ('screening', 'Sanctions & PEP Screening', 'Screens entity parties with OpenSanctions and Claude-assisted discounting.', 'screening', NULL, 'Global', 'screening', 'screening', ARRAY['OPENSANCTIONS_API_KEY','ANTHROPIC_API_KEY'], true, true, 300)
ON CONFLICT (slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  description        = EXCLUDED.description,
  category           = EXCLUDED.category,
  cip_classification = EXCLUDED.cip_classification,
  jurisdiction       = EXCLUDED.jurisdiction,
  runner_type        = EXCLUDED.runner_type,
  output_type        = EXCLUDED.output_type,
  execution_mode     = EXCLUDED.execution_mode,
  required_env       = EXCLUDED.required_env,
  trigger_all        = EXCLUDED.trigger_all,
  sort_order         = EXCLUDED.sort_order,
  updated_at         = now();

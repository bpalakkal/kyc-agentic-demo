import Anthropic from '@anthropic-ai/sdk';
import { ApiRunner } from '../../base/ApiRunner.js';

const MODEL = 'claude-sonnet-4-6';
const CONFIDENCE = 85;

const CONFIGS = {
  nfa: {
    source: 'NFA BASIC',
    registry: 'National Futures Association BASIC',
    officialDomain: 'nfa.futures.org',
    sourceUrl: 'https://www.nfa.futures.org/basicnet/',
    extra: 'Return regulator as "National Futures Association (NFA)" and include all NFA/CFTC registration categories in other_business_activity.',
  },
  delaware: {
    source: 'Delaware Division of Corporations',
    registry: 'Delaware Division of Corporations entity search',
    officialDomain: 'icis.corp.delaware.gov',
    sourceUrl: 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx',
    extra: 'Return registration_country and country_of_incorporation as "United States" when a matching Delaware entity is found.',
  },
  'puerto-rico': {
    source: 'Puerto Rico Department of State',
    registry: 'Puerto Rico Department of State Registry of Corporations and Entities',
    officialDomain: 'estado.pr.gov',
    sourceUrl: 'https://rceweb.estado.pr.gov/en/entity-information/',
    extra: 'Return registration_country and country_of_incorporation as "Puerto Rico" when a matching entity is found.',
  },
};

class USRegistryResearchRunner extends ApiRunner {
  constructor(sb, slug) {
    super(sb);
    this.registrySlug = slug;
    this.config = CONFIGS[slug];
  }

  get slug() { return this.registrySlug; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required for US registry research agents');

    this.step(`Searching ${this.config.registry} for "${entityName}"…`);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, allowed_domains: [this.config.officialDomain] }],
      system: `You are a KYC registry research agent. Search only the named official registry and distinguish a valid no-match from an inability to access or search the registry. If the registry cannot be accessed or its results cannot be verified, set operational_error to a concise explanation; never report that as found=false. ${this.config.extra}

Return one JSON object only:
{"found":boolean,"operational_error":string|null,"entity_name":string|null,"registration_number":string|null,"entity_status":string|null,"date_of_incorporation":string|null,"legal_structure":string|null,"legal_registered_address":string|null,"country_of_incorporation":string|null,"registration_country":string|null,"regulator":string|null,"other_business_activity":string|null,"source_url":string|null}`,
      messages: [{ role: 'user', content: `Search ${this.config.registry} for the exact entity name: ${entityName}` }],
    });

    const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`${this.config.source} returned no structured result`);
    let data;
    try { data = JSON.parse(match[0]); } catch (error) { throw new Error(`${this.config.source} returned invalid JSON: ${error.message}`); }
    if (data.operational_error) throw new Error(`${this.config.source}: ${data.operational_error}`);
    if (!data.found) {
      this.step(`No matching record found in ${this.config.registry}`);
      return this.result(kycRef, [], startedAt, 'no_data', `No matching ${this.config.source} record`, data.source_url);
    }

    const attributes = this.toAttributes(data);
    this.step(`Found ${data.entity_name ?? entityName}; extracted ${attributes.length} attribute(s)`);
    return this.result(kycRef, attributes, startedAt, 'data_found', null, data.source_url);
  }

  toAttributes(data) {
    const sourceUrl = data.source_url ?? this.config.sourceUrl;
    const timestamp = new Date().toISOString();
    const attributes = [];
    const add = (attributeName, value, idFlag = false, verificationFlag = false) => {
      if (value == null || String(value).trim() === '') return;
      const displayValue = String(value).trim();
      attributes.push({
        attributeName, attributeGroup: 'core', displayValue,
        source: this.config.source, confidence: CONFIDENCE, idFlag, verificationFlag,
        exceptionFlag: false,
        lineage: [{ source: this.config.source, value: displayValue, source_url: sourceUrl, timestamp, confidence_score: CONFIDENCE / 100 }],
      });
    };
    add('entity_name', data.entity_name, true, true);
    add('registration_number', data.registration_number, true, true);
    add('entity_status', data.entity_status, true, true);
    add('date_of_incorporation', data.date_of_incorporation, true, true);
    add('legal_structure', data.legal_structure, true, true);
    add('legal_registered_address', data.legal_registered_address, true, true);
    add('country_of_incorporation', data.country_of_incorporation, true, true);
    add('registration_country', data.registration_country, true, true);
    add('regulator', data.regulator, true, true);
    add('other_business_activity', data.other_business_activity, true, true);
    if (this.slug === 'nfa') add('commodities_future_trading_commission_registered_indicator', 'Yes', true, false);
    add('verification_of_existence', 'Yes', true, true);
    return attributes;
  }

  result(kycRef, attributes, startedAt, outcome, outcomeReason, sourceUrl) {
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files: [],
      metadata: {
        outcome, outcomeReason, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
        sourcesConsulted: [sourceUrl ?? this.config.sourceUrl],
      },
    };
  }
}

export class NFARunner extends USRegistryResearchRunner { constructor(sb) { super(sb, 'nfa'); } }
export class DelawareRunner extends USRegistryResearchRunner { constructor(sb) { super(sb, 'delaware'); } }
export class PuertoRicoRunner extends USRegistryResearchRunner { constructor(sb) { super(sb, 'puerto-rico'); } }

import { ApiRunner } from '../../base/ApiRunner.js';
import { captureSourceScreenshot, scrapeBrowserEvidence } from './sourcingArtifacts.js';

const SOURCE = 'NYSE (New York Stock Exchange)';
const SOURCE_URL = 'https://www.nyse.com/listings_directory/stock';

export class NYSERunner extends ApiRunner {
  get slug() { return 'nyse'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    const startedAt = Date.now();
    const url = `${SOURCE_URL}?filter=${encodeURIComponent(entityName)}`;
    this.step(`Searching the official NYSE listings directory for "${entityName}"...`);
    const { json } = await scrapeBrowserEvidence(url, {
      prompt: `Inspect only the official NYSE listing results and matched issuer page. Find an exact legal-name match for "${entityName}" after ignoring punctuation and ordinary legal suffixes. Do not infer or use outside knowledge. Return found=false for a partial or ambiguous match.`,
      schema: { type: 'object', properties: {
        found: { type: 'boolean' }, entity_name: { type: 'string' }, trading_names: { type: 'string' },
        listed_exchange: { type: 'string' }, website_address: { type: 'string' }, source_url: { type: 'string' },
        corporate_officers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, legal_structure: { type: 'string' } } } },
      }, required: ['found'] },
      filename: `nyse-listing-${kycRef}.png`, title: `NYSE listing evidence - ${entityName}`,
    });
    const exact = json.found && normalizeName(json.entity_name) === normalizeName(entityName);
    if (!exact) {
      const evidence = await captureSourceScreenshot(url, { filename: `nyse-listing-${kycRef}.png`, entityName, sourceName: SOURCE, outcome: 'no_data', outcomeReason: 'No unambiguous exact NYSE listing match' });
      return this._result(kycRef, startedAt, [], [], evidence, 'no_data', 'No unambiguous exact NYSE listing match', url);
    }

    const sourceUrl = json.source_url || url;
    const attributes = [
      this._attr('entity_name', json.entity_name, sourceUrl), this._attr('listing_status', 'Listed', sourceUrl),
      this._attr('trading_names', json.trading_names, sourceUrl), this._attr('listed_exchange', json.listed_exchange || 'NYSE', sourceUrl),
      this._attr('website_address', json.website_address, sourceUrl), this._attr('entity_source_url', sourceUrl, sourceUrl),
      this._attr('verification_of_existence', 'Yes', sourceUrl),
    ].filter(Boolean);
    const persons = (json.corporate_officers ?? []).filter(item => item.name).map((item, index) => ({
      role: 'corporate_officer', personIndex: index, fullName: item.name,
      attributes: { corporate_officer_name: this._value(item.name, sourceUrl), ...(item.role ? { corporate_officer_role: this._value(item.role, sourceUrl) } : {}), ...(item.legal_structure ? { corporate_officer_legal_structure: this._value(item.legal_structure, sourceUrl) } : {}) },
    }));
    const evidence = await captureSourceScreenshot(sourceUrl, { filename: `nyse-listing-${kycRef}.png`, entityName, sourceName: SOURCE, outcome: 'data_found', details: { entity_name: json.entity_name, trading_name: json.trading_names, exchange: json.listed_exchange || 'NYSE', website: json.website_address } });
    return this._result(kycRef, startedAt, attributes, persons, evidence, 'data_found', null, sourceUrl);
  }

  _value(value, sourceUrl) { return { id_flag: false, verification_flag: false, exception_flag: false, lineage: [{ source: SOURCE, value, source_url: sourceUrl, timestamp: new Date().toISOString(), confidence_score: 1 }] }; }
  _attr(attributeName, value, sourceUrl) { return value == null || String(value).trim() === '' ? null : { attributeName, attributeGroup: 'core', displayValue: String(value), source: SOURCE, confidence: 100, idFlag: false, verificationFlag: false, exceptionFlag: false, lineage: this._value(value, sourceUrl).lineage }; }
  _result(kycRef, startedAt, attributes, persons, screenshot, outcome, outcomeReason, sourceUrl) { return { agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, persons, personSource: SOURCE, files: [screenshot], metadata: { outcome, outcomeReason, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [sourceUrl] } }; }
}

function normalizeName(value) { return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(THE|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LP|LTD)\b/g, ' ').replace(/\s+/g, ' ').trim(); }

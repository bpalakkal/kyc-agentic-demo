import { ApiRunner } from '../../base/ApiRunner.js';

const NFA_API = 'https://www.nfa.futures.org/BasicNet/basic-api/DataHandlerSearch.ashx';
const NFA_SOURCE_URL = 'https://www.nfa.futures.org/basicnet/';
const PR_API = 'https://rceapi.estado.pr.gov/api/corporation/search';
const PR_SOURCE_URL = 'https://rcp.estado.pr.gov/en/search/';
const DELAWARE_SOURCE_URL = 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx';
const CONFIDENCE = 100;

function result(slug, kycRef, attributes, startedAt, outcome, outcomeReason, sourceUrl) {
  return {
    agentSlug: slug, kycRef, outputType: 'attributes', attributes, files: [],
    metadata: {
      outcome, outcomeReason, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
      sourcesConsulted: [sourceUrl],
    },
  };
}

function attribute(source, sourceUrl, attributeName, value, idFlag = false, verificationFlag = false) {
  if (value == null || String(value).trim() === '') return null;
  const displayValue = String(value).trim();
  return {
    attributeName, attributeGroup: 'core', displayValue, source, confidence: CONFIDENCE,
    idFlag, verificationFlag, exceptionFlag: false,
    lineage: [{ source, value: displayValue, source_url: sourceUrl, timestamp: new Date().toISOString(), confidence_score: 1 }],
  };
}

function normalizeName(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(THE|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LP|LTD)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

export class NFARunner extends ApiRunner {
  get slug() { return 'nfa'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    const startedAt = Date.now();
    this.step(`Searching NFA BASIC for "${entityName}"…`);
    const request = {
      id: 1, method: 'getFirmSearchResults', params: [entityName, {
        pageIndex: 0, pageSize: 50, totalPages: 0, totalCount: 0,
        sort: [{ active: true, column: 'FIRM_NAME', direction: 'asc', ctrl: 'sort_firm_name' }],
        filters: { memStatus: '', regTypes: '', regActions: '' },
        filterOptions: { memStatus: null, regTypes: null, regActions: null },
      }],
    };
    const response = await fetch(NFA_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: NFA_SOURCE_URL },
      body: JSON.stringify(request), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`NFA BASIC API HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error || payload.result?.success === false) throw new Error(`NFA BASIC search failed: ${payload.error?.message ?? payload.result?.message ?? 'unknown response'}`);
    const rows = payload.result?.result?.result?.rows;
    if (!Array.isArray(rows)) throw new Error('NFA BASIC returned an invalid response shape');
    const normalized = normalizeName(entityName);
    const exactRows = rows.filter((row) => normalizeName(row.FIRM_NAME) === normalized);
    const candidates = exactRows.length ? exactRows : rows;
    if (!candidates.length) {
      this.step(`No matching NFA BASIC firm record found for "${entityName}"`);
      return result(this.slug, kycRef, [], startedAt, 'no_data', 'No matching NFA BASIC firm record', NFA_SOURCE_URL);
    }
    const best = candidates.find((row) => /approved|member/i.test(row.PROCESSED_MEMBERSHIP_STATUS ?? '')) ?? candidates[0];
    const details = [best.CURRENT_REG_TYPES, best.PROCESSED_MEMBERSHIP_STATUS].filter(Boolean).join('; ');
    const attributes = [
      attribute('NFA BASIC', NFA_SOURCE_URL, 'entity_name', best.FIRM_NAME, true, true),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'registration_number', best.ENTITY_ID, true, true),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'entity_status', best.PROCESSED_MEMBERSHIP_STATUS, true, true),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'regulator', 'National Futures Association (NFA)', true, true),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'other_business_activity', details, true, true),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'commodities_future_trading_commission_registered_indicator', best.CURRENT_REG_TYPES && best.CURRENT_REG_TYPES !== '-' ? 'Yes' : 'No', true, false),
      attribute('NFA BASIC', NFA_SOURCE_URL, 'verification_of_existence', 'Yes', true, true),
    ].filter(Boolean);
    this.step(`Found NFA ID ${best.ENTITY_ID}; extracted ${attributes.length} attribute(s)`);
    return result(this.slug, kycRef, attributes, startedAt, 'data_found', null, NFA_SOURCE_URL);
  }
}

export class PuertoRicoRunner extends ApiRunner {
  get slug() { return 'puerto-rico'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    const startedAt = Date.now();
    this.step(`Searching Puerto Rico Department of State for "${entityName}"…`);
    const response = await fetch(PR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8', Referer: PR_SOURCE_URL },
      body: JSON.stringify({ cancellationMode: false, comparisonType: 1, corpName: entityName, isWorkFlowSearch: false, limit: 250, matchType: 2, method: null, onlyActive: false, registryNumber: null, advanceSearch: null }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Puerto Rico registry API HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.success !== true || payload.code !== 1 || !Array.isArray(payload.response?.records)) {
      throw new Error(`Puerto Rico registry rejected the search (code ${payload.code ?? 'unknown'})`);
    }
    const records = payload.response.records;
    if (!records.length) {
      this.step(`No matching Puerto Rico entity record found for "${entityName}"`);
      return result(this.slug, kycRef, [], startedAt, 'no_data', 'No matching Puerto Rico Department of State entity record', PR_SOURCE_URL);
    }
    const best = records.find((record) => record.statusEn === 'ACTIVE') ?? records[0];
    const attributes = [
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'entity_name', best.corpName, true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'registration_number', best.registrationIndex ?? best.registrationNumber, true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'entity_status', best.statusEn, true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'legal_structure', best.classEn, true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'country_of_incorporation', 'Puerto Rico', true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'registration_country', 'Puerto Rico', true, true),
      attribute('Puerto Rico Department of State', PR_SOURCE_URL, 'verification_of_existence', 'Yes', true, true),
    ].filter(Boolean);
    this.step(`Found registry ${best.registrationIndex ?? best.registrationNumber}; extracted ${attributes.length} attribute(s)`);
    return result(this.slug, kycRef, attributes, startedAt, 'data_found', null, PR_SOURCE_URL);
  }
}

export class DelawareRunner extends ApiRunner {
  get slug() { return 'delaware'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    const startedAt = Date.now();
    const reason = 'The Delaware Division of Corporations prohibits automated search tools; an analyst must perform the official entity search.';
    this.step(`Delaware requires manual authoritative verification for "${entityName}"`);
    this.step(`Manual search: ${DELAWARE_SOURCE_URL}`);
    return result(this.slug, kycRef, [], startedAt, 'manual_review', reason, DELAWARE_SOURCE_URL);
  }
}

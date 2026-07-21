import { ApiRunner } from '../../base/ApiRunner.js';

const NFA_API = 'https://www.nfa.futures.org/BasicNet/basic-api/DataHandlerSearch.ashx';
const NFA_SOURCE_URL = 'https://www.nfa.futures.org/basicnet/';
const PR_API = 'https://rceapi.estado.pr.gov/api/corporation/search';
const PR_SOURCE_URL = 'https://rcp.estado.pr.gov/en/search/';
const DELAWARE_SOURCE_URL = 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx';
const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

async function firecrawlRequest(path, { method = 'POST', body, timeout = 45_000 } = {}) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY environment variable is required for the Delaware runner');
  const response = await fetch(`${FIRECRAWL_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Firecrawl API HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return response.json();
}

function parseDelawareRows(stdout) {
  const marker = '__DELAWARE_RESULTS__';
  const resultSnapshot = String(stdout ?? '').split(marker).at(-1);
  if (!String(stdout ?? '').includes(marker) || !resultSnapshot.includes('FILE NUMBER') || !resultSnapshot.includes('ENTITY NAME')) {
    throw new Error('Firecrawl did not return a valid Delaware search-results page');
  }
  const rows = [];
  const rowPattern = /- cell "(\d{4,})"[^\n]*\n(?:[^\n]*\n){0,2}?\s*- cell "([^"]+)"[^\n]*/g;
  for (const match of resultSnapshot.matchAll(rowPattern)) rows.push({ fileNumber: match[1], entityName: match[2] });
  return rows;
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
    if (!String(entityName ?? '').trim()) throw new Error('Delaware search requires an entity name');
    this.step('Starting a disposable Firecrawl browser for Delaware…');
    let sessionId;
    try {
      const session = await firecrawlRequest('/browser', { body: { ttl: 150, activityTtl: 150, streamWebView: false } });
      if (!session.success || !session.id) throw new Error('Firecrawl did not create a browser session');
      sessionId = session.id;

      this.step(`Searching Delaware Division of Corporations for "${entityName}"…`);
      const code = [
        `agent-browser open ${shellQuote(DELAWARE_SOURCE_URL)}`,
        'agent-browser wait 2500',
        'agent-browser snapshot -i',
        `agent-browser fill @e38 ${shellQuote(entityName)}`,
        'agent-browser click @e40',
        'agent-browser wait 4000',
        'echo __DELAWARE_RESULTS__',
        'agent-browser get url',
        'agent-browser snapshot',
      ].join('\n');
      const execution = await firecrawlRequest(`/browser/${encodeURIComponent(sessionId)}/execute`, {
        body: { code, language: 'bash', timeout: 110 }, timeout: 125_000,
      });
      if (!execution.success || execution.exitCode !== 0 || execution.killed || execution.error) {
        throw new Error(`Firecrawl Delaware browser execution failed: ${execution.error || execution.stderr || `exit ${execution.exitCode}`}`);
      }

      const rows = parseDelawareRows(execution.stdout);
      const normalized = normalizeName(entityName);
      const best = rows.find((row) => normalizeName(row.entityName) === normalized);
      if (!best) {
        this.step(`No exact Delaware entity match found for "${entityName}"`);
        return result(this.slug, kycRef, [], startedAt, 'no_data', 'No exact Delaware Division of Corporations entity record', DELAWARE_SOURCE_URL);
      }
      const attributes = [
        attribute('Delaware Division of Corporations', DELAWARE_SOURCE_URL, 'entity_name', best.entityName, true, true),
        attribute('Delaware Division of Corporations', DELAWARE_SOURCE_URL, 'registration_number', best.fileNumber, true, true),
        attribute('Delaware Division of Corporations', DELAWARE_SOURCE_URL, 'country_of_incorporation', 'United States', true, true),
        attribute('Delaware Division of Corporations', DELAWARE_SOURCE_URL, 'registration_country', 'United States', true, true),
        attribute('Delaware Division of Corporations', DELAWARE_SOURCE_URL, 'verification_of_existence', 'Yes', true, true),
      ].filter(Boolean);
      this.step(`Found Delaware file number ${best.fileNumber}; extracted ${attributes.length} attribute(s)`);
      return result(this.slug, kycRef, attributes, startedAt, 'data_found', null, DELAWARE_SOURCE_URL);
    } finally {
      if (sessionId) {
        await firecrawlRequest(`/browser/${encodeURIComponent(sessionId)}`, { method: 'DELETE', timeout: 30_000 })
          .catch((error) => console.warn(`[delaware] Failed to close Firecrawl session: ${error.message}`));
      }
    }
  }
}

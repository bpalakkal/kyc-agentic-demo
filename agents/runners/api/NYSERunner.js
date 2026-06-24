import { ApiRunner } from '../../base/ApiRunner.js';

const API_URL    = 'https://www.nyse.com/api/quotes/filter';
const SOURCE     = 'NYSE (New York Stock Exchange / NASDAQ)';
const CONFIDENCE = 95;

// MIC code → exchange display name
const MIC_EXCHANGE = {
  XNYS: 'NYSE',
  XNGS: 'NASDAQ Global Select Market',
  XNMS: 'NASDAQ Global Market',
  XNCM: 'NASDAQ Capital Market',
  XASE: 'NYSE American',
};

export class NYSERunner extends ApiRunner {
  get slug()       { return 'nyse'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    this.step(`Searching NYSE/NASDAQ listings for "${entityName}"…`);

    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        instrumentType:    'EQUITY',
        pageNumber:        1,
        sortColumn:        'name',
        sortOrder:         'ASC',
        maxResultsPerPage: 10,
        filterToken:       entityName,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`NYSE API HTTP ${res.status}`);

    const results = await res.json();
    if (!Array.isArray(results) || !results.length) {
      this.step(`"${entityName}" not found in NYSE/NASDAQ listings`);
      return this._notListedResult(kycRef, startedAt);
    }

    // Prefer exact name match; fall back to first result
    const nameUpper = entityName.toUpperCase();
    const best      = results.find(r => r.instrumentName === nameUpper) ?? results[0];
    const micCode   = best.url?.match(/\/quote\/([A-Z]+):/)?.[1];
    const exchange  = MIC_EXCHANGE[micCode] ?? micCode ?? 'NYSE/NASDAQ';
    const sourceUrl = `https://www.nyse.com${best.url?.startsWith('http') ? new URL(best.url).pathname : (best.url ?? '')}`;

    this.step(`Found: ${best.normalizedTicker} on ${exchange}`);
    const attributes = this._toAttributes(best, exchange, sourceUrl);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files: [],
      metadata: { completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [sourceUrl] },
    };
  }

  _toAttributes(listing, exchange, sourceUrl) {
    const lin = v => [{ source: SOURCE, value: String(v), source_url: sourceUrl, timestamp: null, confidence_score: CONFIDENCE / 100 }];
    const attr = (name, value, opts = {}) => ({
      attributeName: name, attributeGroup: 'core', displayValue: String(value),
      source: SOURCE, confidence: CONFIDENCE,
      idFlag: opts.idFlag ?? false, verificationFlag: opts.verificationFlag ?? false,
      exceptionFlag: false, lineage: lin(value),
    });

    return [
      attr('listing_status',            'Listed'),
      attr('ticker_symbol',             listing.normalizedTicker, { idFlag: true }),
      attr('listed_exchange',           exchange),
      attr('verification_of_existence', 'Yes',                   { verificationFlag: true }),
      attr('entity_source_url',         sourceUrl),
    ];
  }

  _notListedResult(kycRef, startedAt) {
    const lin = v => [{ source: SOURCE, value: String(v), source_url: 'https://www.nyse.com', timestamp: null }];
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes',
      attributes: [
        { attributeName: 'listing_status',            attributeGroup: 'core', displayValue: 'Not Listed', source: SOURCE, confidence: CONFIDENCE, idFlag: false, verificationFlag: false, exceptionFlag: false, lineage: lin('Not Listed') },
        { attributeName: 'verification_of_existence', attributeGroup: 'core', displayValue: 'No',          source: SOURCE, confidence: CONFIDENCE, idFlag: false, verificationFlag: true,  exceptionFlag: false, lineage: lin('No') },
      ],
      files: [],
      metadata: { completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [API_URL] },
    };
  }
}

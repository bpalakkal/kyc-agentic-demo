import { ApiRunner } from '../../base/ApiRunner.js';

const API_URL    = 'https://www.sec.gov/files/company_tickers_exchange.json';
const SOURCE     = 'NYSE (New York Stock Exchange / NASDAQ)';
const CONFIDENCE = 100;

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
      headers: { 'User-Agent': `KYC-Platform/1.0 (${process.env.SUPPORT_EMAIL ?? 'support@example.com'})` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`NYSE API HTTP ${res.status}`);

    const payload = await res.json();
    const fields = payload.fields ?? [];
    const rows = (payload.data ?? []).map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
    const normalized = normalizeName(entityName);
    const best = rows.find((row) => normalizeName(row.name) === normalized)
      ?? rows.find((row) => normalizeName(row.name).includes(normalized) || normalized.includes(normalizeName(row.name)));
    if (!best) {
      this.step(`"${entityName}" not found in NYSE/NASDAQ listings`);
      return this._notListedResult(kycRef, startedAt);
    }

    const exchange  = MIC_EXCHANGE[best.exchange] ?? best.exchange ?? 'US exchange';
    const sourceUrl = `https://www.sec.gov/edgar/browse/?CIK=${best.cik}`;

    this.step(`Found: ${best.ticker} on ${exchange}`);
    const attributes = this._toAttributes(best, exchange, sourceUrl);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files: [],
      metadata: { completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [sourceUrl] },
    };
  }

  _toAttributes(listing, exchange, sourceUrl) {
    const fetchedAt = new Date().toISOString();
    const lin = v => [{ source: SOURCE, value: String(v), source_url: sourceUrl, timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }];
    const attr = (name, value, opts = {}) => ({
      attributeName: name, attributeGroup: 'core', displayValue: String(value),
      source: SOURCE, confidence: CONFIDENCE,
      idFlag: opts.idFlag ?? false, verificationFlag: opts.verificationFlag ?? false,
      exceptionFlag: false, lineage: lin(value),
    });

    return [
      attr('listing_status',            'Listed'),
      attr('other_business_activity',   `Ticker: ${listing.ticker}`),
      attr('listed_exchange',           exchange),
      attr('verification_of_existence', 'Yes',                   { verificationFlag: true }),
    ];
  }

  _notListedResult(kycRef, startedAt) {
    const fetchedAt = new Date().toISOString();
    const lin = v => [{ source: SOURCE, value: String(v), source_url: 'https://www.nyse.com', timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }];
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes',
      attributes: [
        { attributeName: 'listing_status',            attributeGroup: 'core', displayValue: 'Not Listed', source: SOURCE, confidence: CONFIDENCE, idFlag: false, verificationFlag: false, exceptionFlag: false, lineage: lin('Not Listed') },
        { attributeName: 'verification_of_existence', attributeGroup: 'core', displayValue: 'No',          source: SOURCE, confidence: CONFIDENCE, idFlag: false, verificationFlag: true,  exceptionFlag: false, lineage: lin('No') },
      ],
      files: [],
      metadata: { outcome: 'no_data', outcomeReason: 'No matching NYSE or NASDAQ listing', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [API_URL] },
    };
  }
}

function normalizeName(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(THE|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LP|LTD)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

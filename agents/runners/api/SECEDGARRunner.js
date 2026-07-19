import { ApiRunner } from '../../base/ApiRunner.js';

const SEARCH_BASE      = 'https://efts.sec.gov/LATEST/search-index';
const SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';
const SOURCE           = 'SEC EDGAR';
const CONFIDENCE       = 100;
// SEC requires a descriptive User-Agent: https://www.sec.gov/os/accessing-edgar-data
const USER_AGENT       = `KYC-Platform/1.0 (${process.env.SUPPORT_EMAIL ?? 'support@example.com'})`;

export class SECEDGARRunner extends ApiRunner {
  get slug()       { return 'sec'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    this.step(`Searching SEC EDGAR for "${entityName}"…`);

    // Step 1: Find CIK via full-text search
    const searchUrl = `${SEARCH_BASE}?q=%22${encodeURIComponent(entityName)}%22&forms=10-K`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!searchRes.ok) throw new Error(`EDGAR search HTTP ${searchRes.status}`);

    const searchData = await searchRes.json();
    const hit = searchData.hits?.hits?.[0]?._source;

    if (!hit?.ciks?.length) {
      this.step(`No EDGAR 10-K filer found for "${entityName}"`);
      return this._notFoundResult(kycRef, startedAt);
    }

    const rawCik    = hit.ciks[0];
    const paddedCik = rawCik.replace(/^0+/, '').padStart(10, '0');
    this.step(`Found CIK ${paddedCik} — fetching company details…`);

    // Step 2: Fetch full company profile from submissions API
    const subRes = await fetch(`${SUBMISSIONS_BASE}/CIK${paddedCik}.json`, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!subRes.ok) throw new Error(`EDGAR submissions HTTP ${subRes.status}`);

    const company    = await subRes.json();
    const attributes = this._toAttributes(company, paddedCik);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files: [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}`],
      },
    };
  }

  _toAttributes(c, paddedCik) {
    const sourceUrl  = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}&type=10-K`;
    const fetchedAt  = new Date().toISOString();
    const lin = v => [{ source: SOURCE, value: String(v), source_url: sourceUrl, timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }];
    const attr = (name, value, opts = {}) => {
      if (value == null || value === '') return null;
      return {
        attributeName: name, attributeGroup: 'core', displayValue: String(value),
        source: SOURCE, confidence: CONFIDENCE,
        idFlag: opts.idFlag ?? false, verificationFlag: opts.verificationFlag ?? false,
        exceptionFlag: false, lineage: lin(value),
      };
    };

    const bizAddr     = c.addresses?.business ?? c.addresses?.mailing;
    const fmtAddr     = a => a ? [a.street1, a.street2, a.city, a.stateOrCountryDescription, a.zipCode].filter(Boolean).join(', ') : null;
    const cikDisplay  = paddedCik.replace(/^0+/, '');
    const tickers     = (c.tickers  ?? []).join(', ') || null;
    const exchanges   = (c.exchanges ?? []).join(', ') || null;
    const prevNames   = (c.formerNames ?? []).map(n => n.name).join('; ') || null;

    return [
      attr('entity_name',               c.name),
      attr('us_registration_number',    cikDisplay,              { idFlag: true, verificationFlag: true }),
      attr('entity_status',             c.entityType === 'operating' ? 'Active' : c.entityType),
      attr('entity_nature_of_business', c.sicDescription),
      attr('other_business_activity',   c.sic ? `SIC ${c.sic}` : null),
      attr('us_entity_tax_id_number',   c.ein,                   { idFlag: true }),
      attr('lei_code',                  c.lei),
      attr('country_of_incorporation',  c.stateOfIncorporationDescription),
      attr('legal_registered_address',  fmtAddr(bizAddr)),
      attr('ticker_symbol',             tickers,                 { idFlag: !!tickers }),
      attr('listed_exchange',           exchanges),
      attr('previous_names',            prevNames),
      attr('website_address',           c.website),
      attr('verification_of_existence', 'Yes',                   { verificationFlag: true }),
      attr('entity_source_url',         sourceUrl),
    ].filter(Boolean);
  }

  _notFoundResult(kycRef, startedAt) {
    const fetchedAt = new Date().toISOString();
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes',
      attributes: [{
        attributeName: 'verification_of_existence', attributeGroup: 'core',
        displayValue: 'No', source: SOURCE, confidence: CONFIDENCE,
        idFlag: false, verificationFlag: true, exceptionFlag: false,
        lineage: [{ source: SOURCE, value: 'No', source_url: 'https://efts.sec.gov', timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }],
      }],
      files: [],
      metadata: { outcome: 'no_data', outcomeReason: 'No matching SEC EDGAR 10-K filer', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: ['https://efts.sec.gov'] },
    };
  }
}

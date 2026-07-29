import { ApiRunner } from '../../base/ApiRunner.js';
import { downloadSourceDocument } from './sourcingArtifacts.js';

const TICKERS_URL      = 'https://www.sec.gov/files/company_tickers.json';
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

    // Resolve the CIK from the SEC's published company-name/CIK dataset rather
    // than relying on the EDGAR website's undocumented search endpoint.
    const searchUrl = TICKERS_URL;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!searchRes.ok) throw new Error(`EDGAR search HTTP ${searchRes.status}`);

    const searchData = await searchRes.json();
    const normalized = normalizeName(entityName);
    const companies = Object.values(searchData ?? {});
    // Accept only one normalized exact legal-name match. The former substring
    // fallback could match short ticker names inside unrelated words (for
    // example, "ATI" inside "NATIONAL") and contaminate the entire KYC case.
    const exactMatches = companies.filter((company) => normalizeName(company.title) === normalized);
    const hit = exactMatches.length === 1 ? exactMatches[0] : null;

    if (!hit?.cik_str) {
      this.step(`No EDGAR filer found for "${entityName}"`);
      return this._notFoundResult(kycRef, startedAt);
    }

    const paddedCik = String(hit.cik_str).replace(/^0+/, '').padStart(10, '0');
    this.step(`Found CIK ${paddedCik} — fetching company details…`);

    // Step 2: Fetch full company profile from submissions API
    const subRes = await fetch(`${SUBMISSIONS_BASE}/CIK${paddedCik}.json`, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!subRes.ok) throw new Error(`EDGAR submissions HTTP ${subRes.status}`);

    const company    = await subRes.json();
    const attributes = this._toAttributes(company, paddedCik);
    const files = await this._downloadContractFilings(company, paddedCik);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files,
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}`],
      },
    };
  }

  async _downloadContractFilings(company, paddedCik) {
    const recent = company.filings?.recent ?? {};
    const rows = (recent.form ?? []).map((form, index) => ({
      form, filedAt: recent.filingDate?.[index], accession: recent.accessionNumber?.[index],
      primaryDocument: recent.primaryDocument?.[index],
    })).filter(row => row.accession && row.primaryDocument);
    const newest = candidates => candidates.sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0];
    const annual = newest(rows.filter(row => ['10-K', '10-K/A'].includes(row.form)))
      ?? newest(rows.filter(row => ['20-F', '40-F'].includes(row.form)));
    let prospectus;
    for (const form of ['497', '497K', '485BPOS', '485APOS']) {
      prospectus = newest(rows.filter(row => row.form === form));
      if (prospectus) break;
    }
    const selected = [
      annual && { ...annual, kind: 'Annual Report' },
      prospectus && { ...prospectus, kind: 'Prospectus' },
    ].filter(Boolean);
    const cik = paddedCik.replace(/^0+/, '');
    const files = [];
    for (const filing of selected) {
      const accessionPath = filing.accession.replaceAll('-', '');
      const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionPath}/${filing.primaryDocument}`;
      files.push(await downloadSourceDocument(url, {
        filename: `${cik}-${filing.form}-${filing.filedAt}-${filing.primaryDocument}`,
        title: `${filing.kind} (${filing.form})`, headers: { 'User-Agent': USER_AGENT },
      }));
    }
    return files;
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

    const bizAddr     = c.addresses?.business;
    const mailingAddr = c.addresses?.mailing;
    const fmtAddr     = a => a ? [a.street1, a.street2, a.city, a.stateOrCountryDescription, a.zipCode].filter(Boolean).join(', ') : null;
    const cikDisplay  = paddedCik.replace(/^0+/, '');
    const tickers     = (c.tickers  ?? []).join(', ') || null;
    const exchanges   = (c.exchanges ?? []).join(', ') || null;
    const prevNames   = (c.formerNames ?? []).map(n => n.name).join('; ') || null;

    return [
      attr('entity_name',               c.name),
      attr('listing_status',            exchanges ? 'Listed' : 'Not Listed'),
      attr('registration_number',       cikDisplay,              { idFlag: true, verificationFlag: true }),
      attr('entity_status',             c.entityType === 'operating' ? 'Active' : c.entityType),
      attr('entity_nature_of_business', c.sicDescription),
      attr('other_business_activity',   c.sic ? `SIC ${c.sic}` : null),
      attr('tax_identification_number', c.ein,                   { idFlag: true }),
      attr('lei_code',                  c.lei),
      attr('country_of_incorporation',  c.stateOfIncorporationDescription),
      attr('legal_registered_address',  fmtAddr(mailingAddr ?? bizAddr)),
      attr('principal_place_of_business', fmtAddr(bizAddr)),
      attr('regulatory_status',         'Active SEC filer'),
      attr('regulator_registration_number', cikDisplay),
      attr('regulator',                 'U.S. Securities and Exchange Commission (SEC)'),
      attr('other_business_activity',   tickers ? `Ticker: ${tickers}` : null),
      attr('listed_exchange',           exchanges),
      attr('previous_names',            prevNames),
      attr('website_address',           c.website),
      attr('verification_of_existence', 'Yes',                   { verificationFlag: true }),
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
      metadata: { outcome: 'no_data', outcomeReason: 'No matching SEC EDGAR filer', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [TICKERS_URL] },
    };
  }
}

function normalizeName(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(THE|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LP|LTD)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

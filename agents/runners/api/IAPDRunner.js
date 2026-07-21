import { ApiRunner } from '../../base/ApiRunner.js';

const API_URL    = 'https://api.sec-api.io/form-adv/firm';
const SOURCE     = 'IAPD (Investment Adviser Public Disclosure)';
const CONFIDENCE = 100;

export class IAPDRunner extends ApiRunner {
  get slug()       { return 'iapd'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    const apiKey = process.env.SEC_API_KEY;
    if (!apiKey) throw new Error('SEC_API_KEY environment variable is required for the IAPD runner');

    this.step(`Searching IAPD for "${entityName}"…`);

    const escapedName = entityName.replace(/[\\"+\-!(){}[\]^~*?:/]/g, '\\$&');
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body:    JSON.stringify({ query: `Info.BusNm:"${escapedName}" OR Info.LegalNm:"${escapedName}"`, from: 0, size: 5 }),
      signal:  AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`IAPD API HTTP ${res.status}: ${msg.slice(0, 200)}`);
    }

    const data  = await res.json();
    const firms = data.filings ?? [];

    if (!firms.length) {
      this.step(`"${entityName}" not found in IAPD — not a registered investment adviser`);
      return this._notFoundResult(kycRef, startedAt);
    }

    const firm = firms[0];
    const info = firm.Info ?? {};
    const crd  = info.FirmCrdNb;

    this.step(`Found CRD ${crd} — ${info.BusNm ?? info.LegalNm}`);
    const attributes = this._toAttributes(firm);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, files: [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`https://adviserinfo.sec.gov/firm/summary/${crd}`],
      },
    };
  }

  _toAttributes(firm) {
    const info      = firm.Info        ?? {};
    const formInfo  = firm.FormInfo?.Part1A ?? firm.FormInfo ?? {};
    const office    = firm.MainAddr ?? firm.OfcOfOrgnzt ?? {};
    const crd       = info.FirmCrdNb;
    const sourceUrl = crd
      ? `https://adviserinfo.sec.gov/firm/summary/${crd}`
      : 'https://adviserinfo.sec.gov';

    const fetchedAt = new Date().toISOString();
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

    const addrParts = [office.Strt1, office.Strt2, office.City, office.State, office.Cntry, office.PstlCd].filter(Boolean);
    const aum       = formInfo.Item5F?.Q5F2C ?? formInfo.Item5F?.RegAsstUndrMgmt?.Amt;
    const aumStr    = aum ? `$${Number(aum).toLocaleString()}` : null;
    const registration = Array.isArray(firm.Rgstn) ? firm.Rgstn[0] : firm.Rgstn;
    const regStatus = registration?.St ?? registration?.FirmType ?? 'Registered';

    return [
      attr('entity_name',                      info.BusNm ?? info.LegalNm),
      attr('registration_number',              info.SECNb ?? (crd ? String(crd) : null), { idFlag: true, verificationFlag: true }),
      attr('entity_status',                    regStatus),
      attr('legal_structure',                  formInfo.Item3?.Q3A ?? formInfo.Item1?.OrgFm),
      attr('regulator',                        'SEC (Securities and Exchange Commission)'),
      attr('principal_place_of_business',      addrParts.join(', ') || null),
      attr('website_address',                  formInfo.Item1?.WebAddrs?.WebAddr ?? info.Website),
      attr('other_business_activity',          aumStr ? `Regulatory assets under management: ${aumStr}` : null),
      attr('verification_of_existence',        'Yes', { verificationFlag: true }),
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
        lineage: [{ source: SOURCE, value: 'No', source_url: 'https://adviserinfo.sec.gov', timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }],
      }],
      files: [],
      metadata: { outcome: 'no_data', outcomeReason: 'No matching IAPD registered investment adviser', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: ['https://adviserinfo.sec.gov'] },
    };
  }
}

import { ApiRunner } from '../../base/ApiRunner.js';

const API_URL    = 'https://api.sec-api.io/form-adv/firm';
const SOURCE     = 'IAPD (Investment Adviser Public Disclosure)';
const CONFIDENCE = 90;

export class IAPDRunner extends ApiRunner {
  get slug()       { return 'iapd'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    const apiKey = process.env.SEC_API_KEY;
    if (!apiKey) throw new Error('SEC_API_KEY environment variable is required for the IAPD runner');

    this.step(`Searching IAPD for "${entityName}"…`);

    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body:    JSON.stringify({ query: `Info.FirmName:"${entityName}"`, from: '0', size: '5' }),
      signal:  AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`IAPD API HTTP ${res.status}: ${msg.slice(0, 200)}`);
    }

    const data  = await res.json();
    const firms = data.data ?? [];

    if (!firms.length) {
      this.step(`"${entityName}" not found in IAPD — not a registered investment adviser`);
      return this._notFoundResult(kycRef, startedAt);
    }

    const firm = firms[0];
    const info = firm.Info ?? {};
    const crd  = info.FirmCrdNb;

    this.step(`Found CRD ${crd} — ${info.FirmName}`);
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
    const formInfo  = firm.FormInfo    ?? {};
    const office    = firm.OfcOfOrgnzt ?? {};
    const crd       = info.FirmCrdNb;
    const sourceUrl = crd
      ? `https://adviserinfo.sec.gov/firm/summary/${crd}`
      : 'https://adviserinfo.sec.gov';

    const lin = v => [{ source: SOURCE, value: String(v), source_url: sourceUrl, timestamp: null, confidence_score: CONFIDENCE / 100 }];
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
    const aum       = formInfo.Item5F?.RegAsstUndrMgmt?.Amt;
    const aumStr    = aum ? `$${Number(aum).toLocaleString()}` : null;
    const regStatus = formInfo.Item1?.RegistrationStatus ?? 'Registered';

    return [
      attr('entity_name',                      info.FirmName),
      attr('registration_number',              crd ? String(crd) : null, { idFlag: true, verificationFlag: true }),
      attr('entity_status',                    regStatus),
      attr('legal_structure',                  formInfo.Item1?.OrgFm),
      attr('regulator',                        'SEC (Securities and Exchange Commission)'),
      attr('principal_place_of_business',      addrParts.join(', ') || null),
      attr('entity_website_address',           info.Website),
      attr('assets_under_management_aum',      aumStr),
      attr('verification_of_existence',        'Yes', { verificationFlag: true }),
      attr('entity_source_url',                sourceUrl),
    ].filter(Boolean);
  }

  _notFoundResult(kycRef, startedAt) {
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes',
      attributes: [{
        attributeName: 'verification_of_existence', attributeGroup: 'core',
        displayValue: 'No', source: SOURCE, confidence: CONFIDENCE,
        idFlag: false, verificationFlag: true, exceptionFlag: false,
        lineage: [{ source: SOURCE, value: 'No', source_url: 'https://adviserinfo.sec.gov', timestamp: null }],
      }],
      files: [],
      metadata: { completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: ['https://adviserinfo.sec.gov'] },
    };
  }
}

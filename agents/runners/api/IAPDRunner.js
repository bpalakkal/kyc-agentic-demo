import { ApiRunner } from '../../base/ApiRunner.js';
import { digitizeKycDocument, downloadSourceDocument, mergeStructuredAttributes } from './sourcingArtifacts.js';

const API_URL = 'https://api.sec-api.io/form-adv/firm';
const SOURCE = 'IAPD (Investment Adviser Public Disclosure)';
const CONFIDENCE = 100;

export class IAPDRunner extends ApiRunner {
  get slug() { return 'iapd'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    const startedAt = Date.now();
    const apiKey = process.env.SEC_API_KEY;
    if (!apiKey) throw new Error('SEC_API_KEY environment variable is required for the IAPD runner');
    this.step(`Searching IAPD for "${entityName}"...`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: `Info.LegalNm: "${String(entityName).toUpperCase().replace(/["\\]/g, '')}"`, from: 0, size: 10 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`IAPD API HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const payload = await response.json();
    const firm = this._selectFirm(payload.filings ?? [], entityName);
    if (!firm) return this._notFoundResult(kycRef, startedAt);

    const info = firm.Info ?? {};
    const crd = info.FirmCrdNb;
    if (!crd) throw new Error('Matched IAPD filing has no CRD number');
    this.step(`Matched CRD ${crd}: ${info.LegalNm ?? info.BusNm}`);

    const [status, ownerPayload, advFile] = await Promise.all([
      this._fetchFirmStatus(crd),
      this._getJson(`https://api.sec-api.io/form-adv/schedule-a-direct-owners/${crd}`, apiKey),
      downloadSourceDocument(`https://reports.adviserinfo.sec.gov/reports/ADV/${crd}/PDF/${crd}.pdf`, {
        filename: `${crd}-form-adv.pdf`, title: `Form ADV — ${info.LegalNm ?? info.BusNm ?? crd}`,
      }),
    ]);

    let attributes = this._toAttributes(firm, status);
    const persons = this._toPersons(ownerPayload, crd);
    const digitized = await digitizeKycDocument(advFile, {
      documentType: 'SEC Form ADV', source: SOURCE,
      scalarFields: ['entity_name', 'registration_number', 'principal_place_of_business', 'legal_structure', 'regulator', 'other_business_activity', 'website_address', 'document_date', 'registration_country', 'sole_proprietorship_indicator', 'entity_status', 'entity_classification_type', 'commodities_future_trading_commission_registered_indicator', 'verification_of_existence'],
      partyRoles: ['beneficial_owner', 'corporate_officer'],
    });
    attributes = mergeStructuredAttributes(attributes, digitized.attributes);
    persons.push(...digitized.persons);
    this.step(`Prepared ${attributes.length} attributes, ${persons.length} parties, and Form ADV evidence`);
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes', attributes, persons,
      personSource: SOURCE, files: [advFile],
      metadata: {
        outcome: 'data_found', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
        sourcesConsulted: [`https://adviserinfo.sec.gov/firm/summary/${crd}`, advFile.sourceUrl],
      },
    };
  }

  _selectFirm(firms, entityName) {
    const exactName = String(entityName).trim().toUpperCase();
    const exact = firms.filter(firm => String(firm.Info?.LegalNm ?? '').trim().toUpperCase() === exactName);
    if (exact.length === 1) return exact[0];
    const normalized = normalizeName(entityName);
    const relaxed = firms.filter(firm => [firm.Info?.LegalNm, firm.Info?.BusNm].some(name => normalizeName(name) === normalized));
    return relaxed.length === 1 ? relaxed[0] : null;
  }

  async _getJson(url, apiKey) {
    const response = await fetch(url, { headers: { Authorization: apiKey, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`IAPD API HTTP ${response.status} for ${url}`);
    return response.json();
  }

  async _fetchFirmStatus(crd) {
    const response = await fetch(`https://api.adviserinfo.sec.gov/search/firm/${crd}`, { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`IAPD firm status HTTP ${response.status}`);
    const payload = await response.json();
    const encoded = payload.hits?.hits?.[0]?._source?.iacontent;
    if (!encoded) return null;
    const content = typeof encoded === 'string' ? JSON.parse(encoded) : encoded;
    return content.registrationStatus?.[0]?.status ?? null;
  }

  _toAttributes(firm, firmStatus) {
    const info = firm.Info ?? {};
    const formInfo = firm.FormInfo?.Part1A ?? firm.FormInfo ?? {};
    const office = info.MainAddr ?? firm.MainAddr ?? firm.OfcOfOrgnzt ?? {};
    const crd = info.FirmCrdNb;
    const sourceUrl = `https://adviserinfo.sec.gov/firm/summary/${crd}`;
    const timestamp = new Date().toISOString();
    const attr = (attributeName, value) => value == null || value === '' ? null : ({
      attributeName, attributeGroup: 'core', displayValue: Array.isArray(value) ? value.join('; ') : String(value),
      source: SOURCE, confidence: CONFIDENCE, idFlag: false, verificationFlag: false, exceptionFlag: false,
      lineage: [{ source: SOURCE, value, source_url: sourceUrl, timestamp, confidence_score: 1 }],
    });
    const address = [office.Strt1, office.Strt2, office.City, office.State, office.Cntry, office.PstlCd].filter(Boolean).join(', ');
    const orgForm = formInfo.Item3A?.OrgFormNm ?? formInfo.Item3?.Q3A ?? formInfo.Item1?.OrgFm;
    const q6 = formInfo.Item6A ?? {};
    const labels = ['Broker-dealer', 'Registered representative of a broker-dealer', 'Commodity pool operator or commodity trading advisor', 'Futures commission merchant', 'Real estate broker, dealer, or agent', 'Insurance broker or agent', 'Bank', 'Trust company', 'Registered municipal advisor', 'Registered security-based swap dealer', 'Major security-based swap participant', 'Accountant or accounting firm', 'Lawyer or law firm', 'Other financial product salesperson'];
    const activities = labels.filter((_, i) => q6[`Q6A${i + 1}`] === 'Y').join('; ');
    return [
      attr('entity_name', info.LegalNm ?? info.BusNm), attr('registration_number', String(crd)),
      attr('entity_status', firmStatus), attr('legal_structure', orgForm),
      attr('regulator', 'U.S. Securities and Exchange Commission (SEC)'),
      attr('principal_place_of_business', address || null),
      attr('website_address', formInfo.Item1?.WebAddrs?.WebAddr ?? info.Website),
      attr('other_business_activity', activities || null), attr('document_date', firm.Filing?.Dt),
      attr('registration_country', formInfo.Item3C?.CntryNm),
      attr('sole_proprietorship_indicator', /sole proprietorship/i.test(orgForm ?? '') ? 'Yes' : 'No'),
      attr('entity_classification_type', 'Registered Investment Advisor or Commodity Trading Advisor'),
      attr('commodities_future_trading_commission_registered_indicator', q6.Q6A3 === 'Y' ? 'Yes' : 'No'),
      attr('verification_of_existence', 'Yes'), attr('entity_source_url', sourceUrl),
    ].filter(Boolean);
  }

  _toPersons(payload, crd) {
    const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.filings ?? [];
    const sourceUrl = `https://adviserinfo.sec.gov/firm/summary/${crd}`;
    const timestamp = new Date().toISOString();
    const wrapped = value => ({ id_flag: false, verification_flag: false, exception_flag: false, lineage: [{ value, source: SOURCE, source_url: sourceUrl, timestamp, confidence_score: 1 }] });
    const persons = rows.filter(owner => owner.ownershipCode === 'E').map((owner, index) => ({
      role: 'beneficial_owner', personIndex: index, fullName: owner.name, ownershipPct: 75,
      attributes: { beneficial_owner_name: wrapped(owner.name), beneficial_owner_percentage_of_ownership: wrapped('75'), beneficial_owner_legal_structure: wrapped(ownerLegalStructure(owner)) },
    }));
    const officers = new Map();
    for (const owner of rows.filter(item => item.ownerType === 'I')) {
      const key = String(owner.name ?? '').trim().toUpperCase();
      if (!key) continue;
      const current = officers.get(key) ?? { ...owner, roles: [] };
      for (const role of [owner.title, owner.position, owner.status].filter(Boolean)) if (!current.roles.includes(role)) current.roles.push(role);
      officers.set(key, current);
    }
    [...officers.values()].forEach((owner, index) => persons.push({
      role: 'corporate_officer', personIndex: index, fullName: owner.name,
      attributes: { corporate_officer_name: wrapped(owner.name), corporate_officer_role: wrapped(owner.roles.join('; ') || 'N/A'), corporate_officer_cip_classification: wrapped('Individual'), corporate_officer_legal_structure: wrapped('INDIVIDUAL') },
    }));
    return persons;
  }

  _notFoundResult(kycRef, startedAt) {
    return { agentSlug: this.slug, kycRef, outputType: 'attributes', attributes: [], persons: [], files: [], metadata: { outcome: 'no_data', outcomeReason: 'No unambiguous matching IAPD registered investment adviser', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: ['https://adviserinfo.sec.gov'] } };
  }
}

function normalizeName(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LLP|LP|LTD|LIMITED)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function ownerLegalStructure(owner) {
  if (owner.ownerType === 'I') return 'INDIVIDUAL';
  const name = String(owner.name ?? '').toUpperCase();
  if (/\bLLC\b|L\.L\.C\./.test(name)) return '(LLC) LIMITED LIABILITY COMPANY';
  if (/\bLLP\b|L\.L\.P\./.test(name)) return '(LLP) LIMITED LIABILITY PARTNERSHIP';
  if (/\bLP\b|L\.P\.|LIMITED PARTNERSHIP/.test(name)) return '(LP) LIMITED PARTNERSHIP';
  if (/\b(INC|INCORPORATED|CORP|CORPORATION)\b/.test(name)) return '(CORP INC) CORPORATION';
  if (/\bTRUST\b/.test(name)) return 'TRUST';
  return 'N/A';
}

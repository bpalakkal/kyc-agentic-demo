import { ApiRunner } from '../../base/ApiRunner.js';

const BASE       = 'https://api.gleif.org/api/v1';
const SOURCE     = 'GLEIF (Global Legal Entity Identifier Foundation)';
const CONFIDENCE = 100;

export class GLEIFRunner extends ApiRunner {
  get slug()       { return 'gleif'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    this.step(`Searching GLEIF for "${entityName}"…`);

    const url = `${BASE}/lei-records?filter[entity.legalName]=${encodeURIComponent(entityName)}&page[size]=5`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GLEIF API HTTP ${res.status}`);

    const json    = await res.json();
    const records = json.data ?? [];

    if (!records.length) {
      this.step(`No GLEIF record found for "${entityName}"`);
      return this._emptyResult(kycRef, startedAt);
    }

    const normalized = normalizeName(entityName);
    const exact = records.filter(record => normalizeName(record.attributes?.entity?.legalName?.name) === normalized);
    if (exact.length !== 1) {
      this.step(exact.length ? `Multiple exact GLEIF records found for "${entityName}"` : `No exact GLEIF record found for "${entityName}"`);
      return this._emptyResult(kycRef, startedAt, exact.length ? 'Ambiguous exact GLEIF match' : 'No exact GLEIF match');
    }
    const best   = exact[0];
    const lei    = best.attributes.lei;
    const entity = best.attributes.entity;

    this.step(`Found LEI ${lei} — ${entity.legalName?.name}`);
    const parents = await this._getParents(lei);
    const attributes = this._toAttributes(lei, entity, parents);
    this.step(`Extracted ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes,
      files: [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`https://search.gleif.org/#/record/${lei}`],
      },
    };
  }

  async _getParents(lei) {
    const fetchParent = async type => {
      const response = await fetch(`${BASE}/lei-records/${encodeURIComponent(lei)}/${type}-parent-relationship`, {
        headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GLEIF ${type} parent API HTTP ${response.status}`);
      const relationship = (await response.json()).data;
      const parentLei = relationship?.relationships?.['parent-lei-record']?.data?.id
        ?? relationship?.attributes?.relationship?.endNode?.nodeId;
      if (!parentLei) return null;
      const parentResponse = await fetch(`${BASE}/lei-records/${encodeURIComponent(parentLei)}`, {
        headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(15_000),
      });
      if (!parentResponse.ok) return { lei: parentLei, name: null };
      const parent = (await parentResponse.json()).data;
      return { lei: parentLei, name: parent?.attributes?.entity?.legalName?.name ?? null };
    };
    const [direct, ultimate] = await Promise.all([fetchParent('direct'), fetchParent('ultimate')]);
    return { direct, ultimate };
  }

  _toAttributes(lei, entity, parents = {}) {
    const sourceUrl  = `https://search.gleif.org/#/record/${lei}`;
    const fetchedAt  = new Date().toISOString();
    const lin = v => [{ source: SOURCE, value: String(v), source_url: sourceUrl, timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }];
    const attr = (name, value, opts = {}) => {
      if (value == null || value === '') return null;
      return {
        attributeName:    name,
        attributeGroup:   'core',
        displayValue:     String(value),
        source:           SOURCE,
        confidence:       CONFIDENCE,
        idFlag:           opts.idFlag           ?? false,
        verificationFlag: opts.verificationFlag ?? false,
        exceptionFlag:    false,
        lineage:          lin(value),
      };
    };

    const legalAddr = entity.legalAddress;
    const hqAddr    = entity.headquartersAddress;
    const fmtAddr   = a => a
      ? [...(a.addressLines ?? []), a.city, a.region, a.country, a.postalCode].filter(Boolean).join(', ')
      : null;

    const prevNames = (entity.otherNames ?? [])
      .filter(n => n.type === 'PREVIOUS_LEGAL_NAME')
      .map(n => n.name)
      .join('; ') || null;

    return [
      attr('entity_name',             entity.legalName?.name),
      attr('lei_code',                lei,                                             { idFlag: true, verificationFlag: true }),
      attr('entity_status',           entity.status),
      attr('entity_jurisdiction',     entity.jurisdiction),
      attr('legal_structure',         entity.legalForm?.name ?? entity.legalForm?.id),
      attr('registration_number',     entity.registeredAs, { idFlag: true }),
      attr('legal_registered_address', fmtAddr(legalAddr)),
      attr('principal_place_of_business', fmtAddr(hqAddr)),
      attr('date_of_incorporation',   entity.creationDate?.split('T')[0]),
      attr('registration_country',    legalAddr?.country),
      attr('country_of_incorporation', entity.jurisdiction?.split('-')[0]),
      attr('previous_names',          prevNames),
      attr('direct_parent_name',      parents.direct?.name),
      attr('direct_parent_lei',       parents.direct?.lei, { idFlag: true }),
      attr('ultimate_parent_name',    parents.ultimate?.name),
      attr('ultimate_parent_lei',     parents.ultimate?.lei, { idFlag: true }),
      attr('verification_of_existence', entity.status === 'ACTIVE' ? 'Yes' : 'No', { verificationFlag: true }),
      attr('entity_source_url',       sourceUrl),
    ].filter(Boolean);
  }

  _emptyResult(kycRef, startedAt, reason = 'No matching GLEIF record') {
    const fetchedAt = new Date().toISOString();
    return {
      agentSlug: this.slug, kycRef, outputType: 'attributes',
      attributes: [{
        attributeName: 'verification_of_existence', attributeGroup: 'core',
        displayValue: 'No', source: SOURCE, confidence: CONFIDENCE,
        idFlag: false, verificationFlag: true, exceptionFlag: false,
        lineage: [{ source: SOURCE, value: 'No', source_url: BASE, timestamp: fetchedAt, confidence_score: CONFIDENCE / 100 }],
      }],
      files: [],
      metadata: { outcome: 'no_data', outcomeReason: reason, completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [BASE] },
    };
  }
}

function normalizeName(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\b(THE|INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LLC|LP|LTD)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

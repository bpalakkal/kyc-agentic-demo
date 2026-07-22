/**
 * Companies House API runner — direct REST implementation.
 *
 * Phase 1 — Structured entity data (direct REST, no LLM):
 *   - Search for company number by entity name
 *   - Fetch company details, active officers, PSCs
 *   - Map all data to AttributeOutput[]
 *
 * Phase 2 — Document retrieval (CH API → Supabase Storage):
 *   - Fetch incorporation filing history
 *   - Download only the latest incorporation PDF from Companies House
 *   - Return as FileOutput[] (Buffer content)
 *
 * Phase 3 — Document digitization via Claude:
 *   - Send each PDF to claude-sonnet-4-6 as a document block
 *   - Extract additional attributes from the PDF content
 *   - Merge extracted attributes into the output
 *
 * Required env var: COMPANIES_HOUSE_API_KEY
 */

import { ApiRunner } from '../../base/ApiRunner.js';

const CH_BASE = 'https://api.company-information.service.gov.uk';

/** Description types from CH API v2 that we want to retrieve */
const INCORPORATION_DESCRIPTIONS = new Set([
  'incorporation-company',
  'memorandum-articles',
  'incorporation-limited-liability-partnership',
  'incorporation-community-interest-company',
]);

export class CompaniesHouseRunner extends ApiRunner {
  get slug()       { return 'companies-house'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'CompaniesHouseRunner: COMPANIES_HOUSE_API_KEY environment variable is not set'
      );
    }

    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

    // ── Phase 1: Find company number ─────────────────────────────────────────
    this.step(`Searching Companies House for "${entityName}"…`);
    const companyNumber = await this._resolveCompanyNumber(entityName, authHeader);
    if (!companyNumber) {
      const reason = `No Companies House company matched "${entityName}"`;
      this.step(reason);
      return {
        agentSlug: this.slug, kycRef, outputType: 'attributes', attributes: [], files: [],
        metadata: {
          outcome: 'no_data', outcomeReason: reason,
          completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
          sourcesConsulted: [`${CH_BASE}/search/companies`],
        },
      };
    }
    this.step(`Company number resolved: ${companyNumber}`);

    // ── Phase 1: Fetch company details, officers, and PSCs in parallel ───────
    this.step('Fetching company details, officers, and persons with significant control…');
    const [companyDetails, officersData, pscData] = await Promise.all([
      this._get(`/company/${companyNumber}`, authHeader),
      this._fetchAllOfficers(companyNumber, authHeader),
      this._fetchAllPSCs(companyNumber, authHeader),
    ]);

    if (!companyDetails) {
      throw new Error(`Companies House: failed to fetch details for company ${companyNumber}`);
    }
    this.step(`Company details retrieved — ${officersData.length} officer(s), ${pscData.length} PSC(s)`);

    // ── Phase 1: Map scalar attributes + save party records ─────────────────
    this.step('Extracting attributes from Companies House data…');
    const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;
    const phase1Attrs = this._mapToAttributes(companyDetails, companyNumber, sourceUrl);
    this.step(`${phase1Attrs.length} attribute(s) extracted from Companies House API`);

    const persons = this._mapToPersons(officersData, pscData, sourceUrl);
    this.step(`Prepared ${persons.length} source-scoped person record(s)`);

    // ── Phase 2: Download incorporation + name-change documents ──────────────
    this.step('Retrieving incorporation filing history…');
    const files = [];

    let incorpFilings = [];
    try {
      incorpFilings = await this._fetchFilings(companyNumber, 'incorporation', authHeader);
      this.step(`Found ${incorpFilings.length} incorporation filing(s)`);
    } catch (err) {
      this.step(`Warning: filing history fetch failed — ${err.message} (continuing)`);
    }

    const latestIncorporation = incorpFilings
      .filter(filing => INCORPORATION_DESCRIPTIONS.has(filing.description) && filing.links?.document_metadata)
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0];
    const allFilings = latestIncorporation ? [latestIncorporation] : [];
    this.step(`Downloading ${allFilings.length} document(s)…`);

    for (const filing of allFilings) {
      try {
        const fileResult = await this._downloadFiling(filing, companyNumber, authHeader);
        if (fileResult) {
          files.push(fileResult);
          this.step(`  Downloaded: ${fileResult.filename}`);
        }
      } catch (err) {
        this.step(`  Warning: failed to download "${filing.description}" — ${err.message}`);
      }
    }

    // Classification and digitization run once in the post-sourcing flow.
    const allAttrs = phase1Attrs;
    this.step(`Total: ${allAttrs.length} attribute(s) across all phases — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes: allAttrs,
      persons,
      personSource: 'Companies House',
      files,
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [
          sourceUrl,
          `https://api.company-information.service.gov.uk/company/${companyNumber}`,
        ],
      },
    };
  }

  // ── Phase 1: Company number resolution ─────────────────────────────────────

  async _resolveCompanyNumber(entityName, authHeader) {
    const data = await this._get(
      `/search/companies?q=${encodeURIComponent(entityName)}&items_per_page=20`,
      authHeader,
    );
    if (!data?.items?.length) return null;

    const normalize = s =>
      String(s || '').toLowerCase()
        .replace(/\s*\([^)]*\)\s*/g, '')
        .replace(/\b(ltd|plc|limited|llp|lp|inc|corp|gmbh|ag|bv|sa|nv|co)\b\.?/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const inputNorm = normalize(entityName);
    const exact = data.items.find(r => normalize(r.title) === inputNorm);
    const match = exact || (data.items.length === 1 ? data.items[0] : null);
    if (!match) return null;

    return String(match.company_number || '').trim() || null;
  }

  // ── Phase 1: Officer pagination ─────────────────────────────────────────────

  async _fetchAllOfficers(companyNumber, authHeader) {
    const allItems = [];
    let startIndex = 0;
    const pageSize = 100;

    while (true) {
      const data = await this._get(
        `/company/${companyNumber}/officers?status=active&items_per_page=${pageSize}&start_index=${startIndex}`,
        authHeader,
      );
      if (!data?.items?.length) break;
      allItems.push(...data.items);
      const totalCount = data.total_results ?? 0;
      if (startIndex + pageSize >= totalCount || data.items.length < pageSize) break;
      startIndex += pageSize;
    }

    return allItems;
  }

  // ── Phase 1: PSC pagination ─────────────────────────────────────────────────

  async _fetchAllPSCs(companyNumber, authHeader) {
    const allItems = [];
    let startIndex = 0;
    const pageSize = 100;

    while (true) {
      const data = await this._get(
        `/company/${companyNumber}/persons-with-significant-control?items_per_page=${pageSize}&start_index=${startIndex}`,
        authHeader,
      );
      if (!data?.items?.length) break;
      allItems.push(...data.items);
      const totalCount = data.total_results ?? 0;
      if (startIndex + pageSize >= totalCount || data.items.length < pageSize) break;
      startIndex += pageSize;
    }

    return allItems;
  }

  // ── Phase 1: Scalar attribute mapping ──────────────────────────────────────
  // Only entity-level scalar attributes go here.
  // Party data (officers, PSCs) is written to entity_persons via _mapToPersons().

  _mapToAttributes(company, companyNumber, sourceUrl) {
    const attrs = [];
    const fetchedAt = new Date().toISOString();
    const SOURCE = 'Companies House';

    const push = (attributeName, displayValue, extra = {}) => {
      if (displayValue === null || displayValue === undefined) return;
      const val = typeof displayValue === 'object'
        ? JSON.stringify(displayValue)
        : String(displayValue).trim();
      if (!val || val.toLowerCase() === 'n/a') return;

      attrs.push({
        attributeName,
        attributeGroup:   'core',
        displayValue:     val,
        source:           SOURCE,
        confidence:       100,
        idFlag:           extra.idFlag           ?? false,
        verificationFlag: extra.verificationFlag ?? false,
        exceptionFlag:    false,
        lineage: [{
          value:            val,
          source:           SOURCE,
          source_url:       sourceUrl,
          timestamp:        fetchedAt,
          confidence_score: 1.0,
        }],
      });
    };

    // Entity name
    push('entity_name', company.company_name, { idFlag: true });

    // UK registration number
    push('uk_registration_number', company.company_number, {
      idFlag: true,
      verificationFlag: true,
    });

    // Entity status — normalize to human-readable
    if (company.company_status) {
      push('entity_status', this._normalizeStatus(company.company_status));
    }

    // Date of incorporation
    push('date_of_incorporation', company.date_of_creation);

    // Registered address — join fields
    if (company.registered_office_address) {
      const addr = this._formatAddress(company.registered_office_address);
      if (addr) push('legal_registered_address', addr);
    }

    // Legal structure — normalize CH type to standard forms
    if (company.type) {
      push('legal_structure', this._normalizeCompanyType(company.type));
    }

    // Country of incorporation — from jurisdiction field
    if (company.jurisdiction) {
      push('country_of_incorporation', this._normalizeJurisdiction(company.jurisdiction));
    }

    // Source URL
    push('entity_source_url', sourceUrl);

    // Verification of existence
    push('verification_of_existence', 'true');

    // Previous company names
    if (Array.isArray(company.previous_company_names) && company.previous_company_names.length > 0) {
      const prevNames = company.previous_company_names
        .map(n => n.name)
        .filter(Boolean)
        .join('; ');
      if (prevNames) push('previous_names', prevNames);
    }

    return attrs;
  }

  // ── Phase 1: Person record mapping ─────────────────────────────────────────
  // Builds entity_persons rows for all PSCs (→ beneficial_owner + key_controller)
  // and officers (→ corporate_officer).  Each person's child attributes are stored
  // in the attributes jsonb using the full child-attribute name as key so that
  // buildEntityDataJson() can reconstruct the nested entity_data.json format.

  _mapToPersons(officers, pscs, sourceUrl) {
    const fetchedAt = new Date().toISOString();
    const SOURCE = 'Companies House';
    const persons = [];

    const lb = (value) => {
      if (value === null || value === undefined) return null;
      const val = String(value).trim();
      if (!val || val.toLowerCase() === 'n/a') return null;
      return {
        id_flag: false, id_source: null, id_reasoning: null,
        verification_flag: false, verification_source: [], verification_reasoning: null,
        exception_flag: false, exception_type: null,
        lineage: [{ value: val, source: SOURCE, source_url: sourceUrl, timestamp: fetchedAt, confidence_score: 1.0 }],
      };
    };

    // PSCs → beneficial_owner rows (and mirrored as key_controller)
    pscs.forEach((psc, i) => {
      const isCorporate = psc.kind?.includes('corporate');
      const dobStr      = this._formatDob(psc.date_of_birth);
      const addrStr     = psc.address ? this._formatAddress(psc.address) : null;
      const naturesStr  = (psc.natures_of_control ?? []).join('; ') || null;

      const boAttrs = {};
      const set = (k, v) => { const b = lb(v); if (b) boAttrs[k] = b; };
      set('beneficial_owner_name',                 psc.name);
      set('beneficial_owner_address',              addrStr);
      set('beneficial_owner_date_of_birth',        dobStr);
      set('beneficial_owner_nationality',          psc.nationality);
      set('beneficial_owner_country_of_residence', psc.country_of_residence);
      set('beneficial_owner_legal_structure',      isCorporate ? 'Corporate entity' : 'Individual');
      set('beneficial_owner_nature_of_control',    naturesStr);

      persons.push({
        role: 'beneficial_owner', personIndex: i,
        fullName: psc.name ?? null, ownershipPct: null,
        nationality: psc.nationality ?? null, attributes: boAttrs,
      });

      // key_controller mirrors the same PSC data with kc_ prefix
      const kcAttrs = {};
      for (const [k, v] of Object.entries(boAttrs)) {
        kcAttrs[k.replace('beneficial_owner_', 'key_controller_')] = v;
      }
      persons.push({
        role: 'key_controller', personIndex: i,
        fullName: psc.name ?? null, ownershipPct: null,
        nationality: psc.nationality ?? null, attributes: kcAttrs,
      });
    });

    // Officers → corporate_officer rows
    officers.forEach((officer, i) => {
      const dobStr  = this._formatDob(officer.date_of_birth);
      const addrStr = officer.address ? this._formatAddress(officer.address) : null;

      const coAttrs = {};
      const set = (k, v) => { const b = lb(v); if (b) coAttrs[k] = b; };
      set('corporate_officer_name',                   officer.name);
      set('corporate_officer_date_of_birth',          dobStr);
      set('corporate_officer_correspondence_address', addrStr);
      set('corporate_officer_nationality',            officer.nationality);
      set('corporate_officer_country_of_residence',   officer.country_of_residence);

      persons.push({
        role: 'corporate_officer', personIndex: i,
        fullName: officer.name ?? null, ownershipPct: null,
        nationality: officer.nationality ?? null, attributes: coAttrs,
      });
    });

    return persons;
  }

  _formatDob(dob) {
    if (!dob) return null;
    const parts = [dob.year, dob.month ? String(dob.month).padStart(2, '0') : null].filter(Boolean);
    return parts.length ? parts.join('-') : null;
  }

  // ── Phase 2: Filing history ─────────────────────────────────────────────────

  async _fetchFilings(companyNumber, category, authHeader) {
    const allFilings = [];
    let startIndex = 0;
    const pageSize = 50;

    while (true) {
      const data = await this._get(
        `/company/${companyNumber}/filing-history?category=${category}&items_per_page=${pageSize}&start_index=${startIndex}`,
        authHeader,
      );
      if (!data?.items?.length) break;
      allFilings.push(...data.items);
      const totalCount = data.total_count ?? 0;
      if (startIndex + pageSize >= totalCount || data.items.length < pageSize) break;
      startIndex += pageSize;
    }

    return allFilings;
  }

  // ── Phase 2: PDF download ───────────────────────────────────────────────────

  async _downloadFiling(filing, companyNumber, authHeader) {
    const metadataUrl = filing.links?.document_metadata;
    if (!metadataUrl) return null;

    // Step 1: Fetch the document metadata JSON to get the actual document URL
    const metaResp = await fetch(metadataUrl, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!metaResp.ok) {
      throw new Error(`Document metadata fetch failed (HTTP ${metaResp.status})`);
    }

    const meta = await metaResp.json();
    const documentUrl = meta?.links?.document;
    if (!documentUrl) {
      throw new Error('No document URL found in filing metadata');
    }

    // Step 2: Download the actual PDF bytes
    const pdfResp = await fetch(documentUrl, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/pdf',
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!pdfResp.ok) {
      throw new Error(`PDF download failed (HTTP ${pdfResp.status})`);
    }

    const contentType = pdfResp.headers.get('content-type') ?? 'application/pdf';
    const buffer = Buffer.from(await pdfResp.arrayBuffer());

    // Build a meaningful filename from the filing description and date
    const safeDesc = (filing.description ?? 'document').replace(/[^a-z0-9-]/g, '-');
    const dateStr = (filing.date ?? new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const filename = `${companyNumber}_${safeDesc}_${dateStr}.pdf`;

    const titleMap = {
      'incorporation-company': 'Certificate of Incorporation',
      'memorandum-articles': 'Memorandum and Articles of Association',
      'incorporation-limited-liability-partnership': 'Certificate of Incorporation (LLP)',
      'incorporation-community-interest-company': 'Certificate of Incorporation (CIC)',
    };
    const title = titleMap[filing.description] ?? `Filing: ${filing.description ?? 'Document'}`;

    return {
      filename,
      mimeType: contentType.split(';')[0].trim(),
      fileCategory: 'document',
      title,
      caption: `Companies House filing — ${filing.description ?? 'unknown'} (dated ${filing.date ?? 'unknown'})`,
      content: buffer,
      sourceUrl: documentUrl,
    };
  }

  // ── Normalization helpers ───────────────────────────────────────────────────

  _normalizeStatus(status) {
    const statusMap = {
      'active':                  'Active',
      'dissolved':               'Dissolved',
      'liquidation':             'In Liquidation',
      'receivership':            'In Receivership',
      'administration':          'In Administration',
      'voluntary-arrangement':   'Voluntary Arrangement',
      'converted-closed':        'Converted / Closed',
      'insolvency-proceedings':  'Insolvency Proceedings',
      'registered':              'Registered',
      'removed':                 'Removed',
      'closed':                  'Closed',
      'open':                    'Open',
    };
    return statusMap[status] ?? this._titleCase(status.replace(/-/g, ' '));
  }

  _normalizeCompanyType(type) {
    const typeMap = {
      'ltd':                                            'Limited Liability Company (LLC)',
      'plc':                                            'C Corporation (C Corp)',
      'llp':                                            'Limited Liability Partnership (LLP)',
      'private-limited-guarant-nsc':                    'C Corporation (C Corp)',
      'private-limited-guarant-nsc-limited-exemption':  'C Corporation (C Corp)',
      'private-unlimited':                              'Unlimited Company',
      'private-unlimited-nsc':                          'Unlimited Company',
      'old-public-company':                             'Public Company',
      'investment-company-with-variable-capital':       'Investment Company (ICVC)',
      'assurance-company':                              'Assurance Company',
      'european-public-limited-liability-company-se':   'Societas Europaea (SE)',
      'uk-establishment':                               'UK Establishment',
      'scottish-partnership':                           'Scottish Partnership',
      'scottish-qualifying-partnership':                'Scottish Qualifying Partnership',
      'charitable-incorporated-organisation':           'Charitable Incorporated Organisation (CIO)',
      'community-interest-company':                     'Community Interest Company (CIC)',
      'industrial-and-provident-society':               'Industrial and Provident Society',
      'registered-society-non-jurisdictional':          'Registered Society',
      'icvc-securities':                                'Investment Company (ICVC - Securities)',
      'icvc-warrant':                                   'Investment Company (ICVC - Warrant)',
      'icvc-umbrella':                                  'Investment Company (ICVC - Umbrella)',
      'protected-cell-company':                         'Protected Cell Company',
      'limited-partnership':                            'Limited Partnership (LP)',
    };
    return typeMap[type] ?? this._titleCase(type.replace(/-/g, ' '));
  }

  _normalizeJurisdiction(jurisdiction) {
    const jurisdictionMap = {
      'england-wales':    'United Kingdom',
      'scotland':         'United Kingdom',
      'northern-ireland': 'United Kingdom',
      'wales':            'United Kingdom',
      'england':          'United Kingdom',
      'united-kingdom':   'United Kingdom',
      'jersey':           'Jersey',
      'guernsey':         'Guernsey',
      'isle-of-man':      'Isle of Man',
      'eu-eea':           'European Union / EEA',
      'noneu':            'Non-EU',
    };
    return jurisdictionMap[jurisdiction] ?? this._titleCase(jurisdiction.replace(/-/g, ' '));
  }

  _formatAddress(addr) {
    if (!addr) return null;
    const parts = [
      addr.address_line_1,
      addr.address_line_2,
      addr.locality,
      addr.region,
      addr.postal_code,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ') || null;
  }

  _titleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── HTTP helper ─────────────────────────────────────────────────────────────

  async _get(path, authHeader) {
    const url = path.startsWith('http') ? path : `${CH_BASE}${path}`;
    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error(`[companies-house] HTTP ${resp.status} ${resp.statusText} for ${path} — ${body.slice(0, 300)}`);
        return null;
      }
      return await resp.json();
    } catch (err) {
      console.error(`[companies-house] Network error for ${path}: ${err.message}`);
      return null;
    }
  }
}

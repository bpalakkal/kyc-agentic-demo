/**
 * Companies House API runner — direct REST implementation.
 *
 * Phase 1 — Structured entity data (direct REST, no LLM):
 *   - Search for company number by entity name
 *   - Fetch company details, active officers, PSCs
 *   - Map all data to AttributeOutput[]
 *
 * Phase 2 — Document retrieval (CH API → Supabase Storage):
 *   - Fetch incorporation + name-change filing history
 *   - Download matched filing PDFs from Companies House
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
import Anthropic from '@anthropic-ai/sdk';

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
      throw new Error(`Companies House: company not found for "${entityName}"`);
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

    // ── Phase 1: Map to AttributeOutput[] ────────────────────────────────────
    this.step('Extracting attributes from Companies House data…');
    const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;
    const phase1Attrs = this._mapToAttributes(companyDetails, officersData, pscData, companyNumber, sourceUrl);
    this.step(`${phase1Attrs.length} attribute(s) extracted from Companies House API`);

    // ── Phase 2: Download incorporation + name-change documents ──────────────
    this.step('Retrieving incorporation and name-change filing history…');
    const files = [];

    let incorpFilings = [];
    let nameChangeFilings = [];
    try {
      [incorpFilings, nameChangeFilings] = await Promise.all([
        this._fetchFilings(companyNumber, 'incorporation', authHeader),
        this._fetchFilings(companyNumber, 'change-of-name', authHeader),
      ]);
      this.step(`Found ${incorpFilings.length} incorporation filing(s) and ${nameChangeFilings.length} name-change filing(s)`);
    } catch (err) {
      this.step(`Warning: filing history fetch failed — ${err.message} (continuing)`);
    }

    // Filter incorporation filings to only the description types we want,
    // and keep only the latest per description group.
    const filteredIncorp = this._selectLatestPerDescription(
      incorpFilings.filter(f => INCORPORATION_DESCRIPTIONS.has(f.description))
    );

    const allFilings = [...filteredIncorp, ...nameChangeFilings];
    this.step(`Downloading ${allFilings.length} document(s)…`);

    const downloadedFiles = [];
    for (const filing of allFilings) {
      try {
        const fileResult = await this._downloadFiling(filing, companyNumber, authHeader);
        if (fileResult) {
          files.push(fileResult);
          downloadedFiles.push({ filing, buffer: fileResult.content });
          this.step(`  Downloaded: ${fileResult.filename}`);
        }
      } catch (err) {
        this.step(`  Warning: failed to download "${filing.description}" — ${err.message}`);
      }
    }

    // ── Phase 3: Digitize documents via Claude ────────────────────────────────
    const phase3Attrs = [];
    if (downloadedFiles.length > 0) {
      this.step(`Digitizing ${downloadedFiles.length} document(s) with Claude…`);
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      for (const { filing, buffer } of downloadedFiles) {
        try {
          const extracted = await this._digitizeDocument(anthropic, buffer, filing, companyNumber);
          phase3Attrs.push(...extracted);
          this.step(`  Extracted ${extracted.length} attribute(s) from ${filing.description}`);
        } catch (err) {
          this.step(`  Warning: Claude digitization failed for "${filing.description}" — ${err.message} (skipping)`);
        }
      }
    }

    // Merge phase 1 + phase 3 attributes (phase 3 may add additional fields or
    // provide higher-confidence versions of structured fields).
    const allAttrs = [...phase1Attrs, ...phase3Attrs];
    this.step(`Total: ${allAttrs.length} attribute(s) across all phases — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes: allAttrs,
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

  // ── Phase 1: Attribute mapping ──────────────────────────────────────────────

  _mapToAttributes(company, officers, pscs, companyNumber, sourceUrl) {
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

    // Corporate officers (active only — already filtered by the API call)
    officers.forEach((officer, i) => {
      const name = officer.name;
      const role = officer.officer_role;
      if (name) {
        push(`corporate_officer_${i + 1}`, role ? `${name} (${role})` : name);
      }
    });

    // PSCs (Persons with Significant Control) — mapped to key_controller only.
    // CH does not provide verified beneficial ownership data; PSCs ≠ beneficial owners.
    pscs.forEach((psc, i) => {
      const name = psc.name;
      const kind = psc.kind; // 'individual-person-with-significant-control' | 'corporate-entity-...' etc.
      const isCorporate = kind && kind.includes('corporate');

      if (name) {
        const displayName = isCorporate ? `${name} (corporate)` : name;
        push(`key_controller_${i + 1}`, displayName);
      }
    });

    return attrs;
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

  /**
   * Given a list of filings, return the latest (most recent date) per description group.
   */
  _selectLatestPerDescription(filings) {
    const latestByDesc = new Map();
    for (const filing of filings) {
      const desc = filing.description;
      const existing = latestByDesc.get(desc);
      if (!existing || filing.date > existing.date) {
        latestByDesc.set(desc, filing);
      }
    }
    return Array.from(latestByDesc.values());
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

  // ── Phase 3: Claude document digitization ───────────────────────────────────

  async _digitizeDocument(anthropic, pdfBuffer, filing, companyNumber) {
    const base64 = pdfBuffer.toString('base64');
    const SOURCE = 'Companies House';
    const fetchedAt = new Date().toISOString();
    const sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

    const prompt = `You are a KYC document analysis assistant. Analyze this Companies House document and extract all relevant entity information.

The document is a "${filing.description ?? 'corporate filing'}" for company number ${companyNumber}.

Please extract the following fields if present (return as JSON object with snake_case keys):
- entity_name: Legal entity name as it appears in the document
- date_of_incorporation: Date of incorporation or registration (YYYY-MM-DD format if possible)
- country_of_incorporation: Country where the entity was incorporated
- registration_number: Company/registration number
- legal_structure: Type of legal entity (e.g., Private Limited Company, LLP, etc.)
- registered_office_address: Full registered office address
- directors: Array of director names as plain strings (e.g. ["John Smith", "Jane Doe"])
- share_capital: Authorized or issued share capital
- objects_clause: Company's objects or purpose clause (brief summary)

Return ONLY a JSON object with the fields you found. Use null for fields not present. Do not include fields not found in the document.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      }],
    });

    // Parse JSON from Claude's response
    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let extracted = {};
    try {
      // Find JSON block in response (Claude may wrap it in markdown)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      extracted = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return no attributes from this document
      console.warn(`[companies-house] Claude response could not be parsed as JSON for ${filing.description}`);
      return [];
    }

    const attrs = [];
    const confidence = 90;

    const push = (attributeName, displayValue) => {
      if (displayValue === null || displayValue === undefined) return;
      // Coerce objects and object arrays to strings — Claude sometimes returns structured
      // objects instead of plain strings for directors/shareholders fields.
      const coerce = v => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return v.name ?? v.officer_name ?? v.company_name ?? JSON.stringify(v);
        return String(v).trim();
      };
      const val = Array.isArray(displayValue)
        ? displayValue.map(coerce).filter(Boolean).join('; ')
        : coerce(displayValue);
      if (!val || val === 'null') return;

      attrs.push({
        attributeName,
        attributeGroup:   'core',
        displayValue:     val,
        source:           SOURCE,
        confidence,
        idFlag:           false,
        verificationFlag: false,
        exceptionFlag:    false,
        lineage: [{
          value:            val,
          source:           SOURCE,
          source_url:       sourceUrl,
          timestamp:        fetchedAt,
          confidence_score: confidence / 100,
        }],
      });
    };

    // Map extracted fields to AttributeOutput
    if (extracted.entity_name)               push('entity_name', extracted.entity_name);
    if (extracted.date_of_incorporation)     push('date_of_incorporation', extracted.date_of_incorporation);
    if (extracted.country_of_incorporation)  push('country_of_incorporation', extracted.country_of_incorporation);
    if (extracted.registration_number)       push('uk_registration_number', extracted.registration_number);
    if (extracted.legal_structure)           push('legal_structure', extracted.legal_structure);
    if (extracted.registered_office_address) push('legal_registered_address', extracted.registered_office_address);
    if (extracted.share_capital)             push('share_capital', extracted.share_capital);
    if (extracted.objects_clause)            push('objects_clause', extracted.objects_clause);

    if (Array.isArray(extracted.directors) && extracted.directors.length > 0) {
      extracted.directors.forEach((director, i) => {
        if (director) push(`corporate_officer_${i + 1}`, director);
      });
    }
    // Shareholders from incorporation documents are original subscribers, not current
    // beneficial owners — CH does not provide verified beneficial ownership data.

    return attrs;
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

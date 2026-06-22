/**
 * FCA Register runner — direct REST API implementation.
 *
 * Flow (mirrors fca_data_sourcing.json dataflow):
 *   1. Resolve FRN from entity name  (persona: 01-frn-resolution)
 *   2. Fetch firm data in parallel   (persona: 02-firm-data)
 *   3. Fetch individuals + CF pages  (persona: 03-individual-data)
 *   4. Merge raw data                (code node: fca/code/merge.js)
 *   5. Convert to AttributeOutput[]  (fca/code/toAttributes.js)
 *
 * Required env vars: FCA_AUTH_EMAIL, FCA_API_KEY
 */

import { ApiRunner } from '../../base/ApiRunner.js';
import { mergeFcaData }    from './fca/code/merge.js';
import { fcaToAttributes } from './fca/code/toAttributes.js';

const FCA_BASE = 'https://register.fca.org.uk/services/V0.1';

export class FCARunner extends ApiRunner {
  get slug()       { return 'fca'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    const headers = {
      'x-auth-email': process.env.FCA_AUTH_EMAIL || '',
      'x-auth-key':   process.env.FCA_API_KEY    || '',
      'Content-Type': 'application/json',
    };

    // Phase 1: Resolve FRN from entity name
    this.step(`Searching FCA register for "${entityName}"…`);
    const frn = await this._resolveFrn(entityName, headers);
    if (!frn) throw new Error(`FCA: FRN not found for entity "${entityName}"`);
    this.step(`FRN resolved: ${frn}`);

    // Phase 2: Fetch firm-level data in parallel (mirrors persona 02)
    this.step('Fetching firm data (core, address, permissions, regulators)…');
    const [firmCore, firmAddress, firmPermissions, firmRegulators] = await Promise.all([
      this._get(`/Firm/${frn}`,             headers),
      this._get(`/Firm/${frn}/Address`,     headers),
      this._get(`/Firm/${frn}/Permissions`, headers),
      this._get(`/Firm/${frn}/Regulators`,  headers),
    ]);
    this.step('Firm data retrieved');

    // Phase 3: Fetch individuals + controlled-function pages (mirrors persona 03)
    this.step('Fetching individuals and controlled-function pages…');
    const { firmIndividuals, firmCfPages } = await this._fetchIndividuals(frn, headers);
    this.step(`Individuals retrieved — ${firmCfPages.length} CF page(s)`);

    // Phase 4: Merge using the ported code node
    this.step('Merging data sources…');
    const merged = mergeFcaData({
      frn,
      firm_core:        firmCore,
      firm_address:     firmAddress,
      firm_permissions: firmPermissions,
      firm_regulators:  firmRegulators,
      firm_individuals: firmIndividuals,
      firm_cf_pages:    firmCfPages,
    });

    // Phase 5: Convert to AttributeOutput[]
    this.step('Extracting attributes…');
    const attributes = fcaToAttributes(merged, frn);
    this.step(`Found ${attributes.length} attribute(s) — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes,
      files: [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`register.fca.org.uk/s/firm?id=${frn}`],
      },
    };
  }

  // ─── Phase 1: FRN resolution ──────────────────────────────────────────────
  async _resolveFrn(entityName, headers) {
    const data = await this._get(
      `/Search?q=${encodeURIComponent(entityName)}&type=firm`,
      headers,
    );
    if (!data?.Data?.length) return null;

    const normalize = s =>
      String(s || '').toLowerCase()
        .replace(/\s*\([^)]*\)\s*/g, '')
        .replace(/\b(ltd|plc|limited|llp|lp|inc|corp|gmbh|ag|bv|sa|nv|co)\b\.?/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const inputNorm = normalize(entityName);
    const exact     = data.Data.find(r => normalize(r.Name) === inputNorm);
    const match     = exact || (data.Data.length === 1 ? data.Data[0] : null);
    if (!match) return null;

    return String(match['Reference Number'] || match.FRN || '').trim() || null;
  }

  // ─── Phase 3: Individuals + CF pages ─────────────────────────────────────
  async _fetchIndividuals(frn, headers) {
    const firmIndividuals = await this._get(`/Firm/${frn}/Individuals`, headers);

    // Adaptive pagination: read total_count from page 1, then cap further pages
    const page1      = await this._get(`/Firm/${frn}/CF?pgnp=1`, headers);
    const totalCount = parseInt(page1?.ResultInfo?.total_count || '0', 10);

    let cap = 1;
    if      (totalCount > 500) cap = 20;
    else if (totalCount > 100) cap = 10;
    else if (totalCount > 20)  cap =  5;

    const firmCfPages = [page1];
    for (let p = 2; p <= cap; p++) {
      const page = await this._get(`/Firm/${frn}/CF?pgnp=${p}`, headers);
      if (!page) break;
      if (Object.keys(page?.Data?.Current || {}).length === 0) break;
      firmCfPages.push(page);
    }

    return { firmIndividuals, firmCfPages };
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────
  async _get(path, headers) {
    const url = `${FCA_BASE}${path}`;
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error(`[FCA] HTTP ${resp.status} ${resp.statusText} for ${path} — ${body.slice(0, 300)}`);
        return null;
      }
      return await resp.json();
    } catch (err) {
      console.error(`[FCA] Network error for ${path}: ${err.message}`);
      return null;
    }
  }
}

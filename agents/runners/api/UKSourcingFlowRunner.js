/**
 * UK Data Sourcing Flow — server-side orchestrator.
 *
 * Runs three sources in parallel and merges their attribute outputs:
 *   1. FCA Register    — direct REST API (fast, no LLM)
 *   2. Companies House — GS Forge autonomous agent (async, Forge-managed)
 *   3. Jersey FSC      — GS Forge autonomous agent (async, Forge-managed)
 *
 * Extends ApiRunner so the existing two-phase preview/commit flow (diff modal)
 * works identically to the standalone FCA runner. The long-running Forge polls
 * execute inside startPreview()'s background promise — the HTTP response returns
 * immediately and the frontend polls /api/agent-run-api-status/:runId.
 */

import { ApiRunner }            from '../../base/ApiRunner.js';
import { FCARunner }            from './FCARunner.js';
import { chToAttributes }       from './ukSourcingFlow/chToAttributes.js';
import { jerseyToAttributes }   from './ukSourcingFlow/jerseyToAttributes.js';
import { mergeAttributeSources } from './ukSourcingFlow/mergeAttributes.js';

const AWS_AGENT_BASE  = process.env.AWS_AGENT_BASE ??
  'http://gs-forge-agentic-runtime-lb-1873180191.us-east-1.elb.amazonaws.com';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS  = 20 * 60 * 1_000; // 20 min

export class UKSourcingFlowRunner extends ApiRunner {
  get slug()       { return 'uk-sourcing-flow'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef, entityName } = ctx;
    const startedAt = Date.now();

    // ── Phase 1: FCA Register (direct, synchronous) ──────────────────────────
    this.step('Phase 1/3 — Querying FCA Register…');
    let fcaAttrs   = [];
    let fcaFiles   = [];
    let fcaSources = [];

    try {
      const fca = new FCARunner(this.sb);
      fca._onStep = msg => this.step(`  FCA ▸ ${msg}`);
      const fcaOut = await fca.execute(ctx);
      fcaAttrs   = fcaOut.attributes ?? [];
      fcaFiles   = fcaOut.files ?? [];
      fcaSources = fcaOut.metadata?.sourcesConsulted ?? [];
      this.step(`  FCA ▸ ${fcaAttrs.length} attribute(s)`);
    } catch (err) {
      this.step(`  FCA ▸ failed — ${err.message} (continuing with other sources)`);
    }

    // ── Phase 2: Invoke CH + Jersey on Forge (parallel) ──────────────────────
    this.step('Phase 2/3 — Invoking Companies House and Jersey FSC on Forge…');

    let chRunId, jerseyRunId;
    try {
      [chRunId, jerseyRunId] = await Promise.all([
        this._invokeForge('uk-companies-house', {
          entity_name:        entityName,
          out_document_store: 'all_unstructured_docs',
          jurisdiction:       'UK',
          async:              true,
        }),
        this._invokeForge('uk-jersey-financial-services-commission', {
          entity_name:  entityName,
          jurisdiction: 'UK',
          async:        true,
        }),
      ]);
      this.step(`  CH run ID:     ${chRunId}`);
      this.step(`  Jersey run ID: ${jerseyRunId}`);
    } catch (err) {
      throw new Error(`Failed to invoke Forge agents: ${err.message}`);
    }

    // ── Phase 3: Poll both to completion ─────────────────────────────────────
    this.step('Phase 3/3 — Polling Forge agents (this may take several minutes)…');

    const [chData, jerseyData] = await Promise.all([
      this._pollForge(chRunId,     'Companies House'),
      this._pollForge(jerseyRunId, 'Jersey FSC'),
    ]);

    // ── Map Forge outputs → AttributeOutput[] ────────────────────────────────
    const chAttrs     = chToAttributes(chData,     chRunId);
    const jerseyAttrs = jerseyToAttributes(jerseyData, jerseyRunId);

    this.step(`  CH: ${chAttrs.length} attr(s) | Jersey: ${jerseyAttrs.length} attr(s) | FCA: ${fcaAttrs.length} attr(s)`);

    // ── Merge — priority order: FCA → CH → Jersey ────────────────────────────
    // FCA is highest priority: it's a direct API call, no LLM inference.
    // CH next: structured MCP data. Jersey last: web-scraped.
    // All source values appear in lineage[] so the analyst can compare.
    const merged = mergeAttributeSources([
      { source: 'FCA Register',   attrs: fcaAttrs   },
      { source: 'Companies House', attrs: chAttrs   },
      { source: 'Jersey FSC',     attrs: jerseyAttrs },
    ]);

    this.step(`Merged ${merged.length} unique attribute(s) across 3 sources — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes: merged,
      files:      fcaFiles, // Forge screenshots are harvested separately by the snapshot endpoint
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [
          'FCA Register', 'Companies House (Forge)', 'Jersey FSC (Forge)',
          ...fcaSources,
        ],
      },
    };
  }

  // ── Forge helpers ──────────────────────────────────────────────────────────

  async _invokeForge(slug, body) {
    const res = await fetch(`${AWS_AGENT_BASE}/api/invoke/${slug}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`Forge invoke ${slug} HTTP ${res.status}: ${msg.slice(0, 200)}`);
    }
    const json = await res.json().catch(() => ({}));
    const runId = json.runId ?? json.run_id ?? json.id;
    if (!runId) throw new Error(`Forge ${slug}: no runId returned`);
    return String(runId);
  }

  async _pollForge(runId, label) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let lastLogMs  = 0;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      let data;
      try {
        const res = await fetch(`${AWS_AGENT_BASE}/api/runs/${runId}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue; // transient error, retry
        data = await res.json();
      } catch {
        continue; // network blip, retry
      }

      const status = String(data?.status ?? data?.state ?? '').toLowerCase();

      if (Date.now() - lastLogMs > 30_000) {
        this.step(`  ${label}: ${status || 'running'}…`);
        lastLogMs = Date.now();
      }

      if (['complete', 'completed', 'done', 'success'].includes(status)) {
        this.step(`  ${label}: complete ✓`);
        return data;
      }
      if (['failed', 'error', 'cancelled'].includes(status)) {
        throw new Error(`Forge ${label} run ${runId} ended with status: ${status}`);
      }
    }

    throw new Error(
      `Forge ${label} run ${runId} timed out after ${POLL_TIMEOUT_MS / 60_000} minutes`
    );
  }
}

/**
 * UK Data Sourcing Flow — server-side orchestrator.
 *
 * Runs three sources in parallel and merges their attribute outputs:
 *   1. FCA Register    — direct REST API (fast, no LLM)
 *   2. Companies House — direct REST API via CompaniesHouseRunner (no Forge)
 *   3. Jersey FSC      — GS Forge autonomous agent (async, Forge-managed)
 *
 * Extends ApiRunner so the existing two-phase preview/commit flow (diff modal)
 * works identically to the standalone FCA runner. The long-running Forge poll
 * for Jersey executes inside startPreview()'s background promise — the HTTP
 * response returns immediately and the frontend polls /api/agent-run-api-status/:runId.
 */

import { ApiRunner }              from '../../base/ApiRunner.js';
import { FCARunner }              from './FCARunner.js';
import { CompaniesHouseRunner }   from './CompaniesHouseRunner.js';
import { jerseyToAttributes }     from './ukSourcingFlow/jerseyToAttributes.js';
import { mergeAttributeSources }  from './ukSourcingFlow/mergeAttributes.js';

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

    // ── Phase 1: FCA Register + Companies House (direct, synchronous, parallel) ─
    this.step('Phase 1/3 — Querying FCA Register and Companies House…');
    let fcaAttrs   = [];
    let fcaFiles   = [];
    let fcaSources = [];
    let chAttrs    = [];
    let chFiles    = [];
    let chSources  = [];

    await Promise.all([
      // FCA Register
      (async () => {
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
      })(),

      // Companies House (direct API — no Forge)
      (async () => {
        try {
          const ch = new CompaniesHouseRunner(this.sb);
          ch._onStep = msg => this.step(`  CH ▸ ${msg}`);
          const chOut = await ch.execute(ctx);
          chAttrs   = chOut.attributes ?? [];
          chFiles   = chOut.files ?? [];
          chSources = chOut.metadata?.sourcesConsulted ?? [];
          this.step(`  CH ▸ ${chAttrs.length} attribute(s), ${chFiles.length} file(s)`);
        } catch (err) {
          this.step(`  CH ▸ failed — ${err.message} (continuing with other sources)`);
        }
      })(),
    ]);

    // ── Phase 2: Invoke Jersey FSC on Forge ──────────────────────────────────
    this.step('Phase 2/3 — Invoking Jersey FSC on Forge…');

    let jerseyRunId;
    try {
      jerseyRunId = await this._invokeForge('uk-jersey-financial-services-commission', {
        entity_name:  entityName,
        jurisdiction: 'UK',
        async:        true,
      });
      this.step(`  Jersey run ID: ${jerseyRunId}`);
    } catch (err) {
      this.step(`  Jersey FSC ▸ failed to invoke — ${err.message} (continuing without Jersey)`);
    }

    // ── Phase 3: Poll Jersey to completion ───────────────────────────────────
    let jerseyAttrs = [];
    if (jerseyRunId) {
      this.step('Phase 3/3 — Polling Jersey FSC (this may take several minutes)…');
      try {
        const jerseyData = await this._pollForge(jerseyRunId, 'Jersey FSC');
        jerseyAttrs = jerseyToAttributes(jerseyData, jerseyRunId);
        this.step(`  Jersey FSC ▸ ${jerseyAttrs.length} attribute(s)`);
      } catch (err) {
        this.step(`  Jersey FSC ▸ ${err.message} (continuing without Jersey data)`);
      }
    } else {
      this.step('Phase 3/3 — Skipping Jersey FSC poll (not invoked)');
    }

    this.step(`  CH: ${chAttrs.length} attr(s) | Jersey: ${jerseyAttrs.length} attr(s) | FCA: ${fcaAttrs.length} attr(s)`);

    // ── Merge — priority order: FCA → CH → Jersey ────────────────────────────
    // FCA is highest priority: it's a direct API call, no LLM inference.
    // CH next: direct API data (replaces Forge-based extraction). Jersey last: web-scraped.
    // All source values appear in lineage[] so the analyst can compare.
    const merged = mergeAttributeSources([
      { source: 'FCA Register',    attrs: fcaAttrs    },
      { source: 'Companies House', attrs: chAttrs     },
      { source: 'Jersey FSC',      attrs: jerseyAttrs },
    ]);

    this.step(`Merged ${merged.length} unique attribute(s) across 3 sources — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes: merged,
      files:      [...fcaFiles, ...chFiles],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [
          'FCA Register', 'Companies House (direct API)', 'Jersey FSC (Forge)',
          ...fcaSources,
          ...chSources,
        ],
      },
    };
  }

  // ── Forge helpers (Jersey FSC only) ───────────────────────────────────────

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
        this.step(`  ${label}: complete`);
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

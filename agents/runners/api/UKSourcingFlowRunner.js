/**
 * UK Data Sourcing Flow — server-side orchestrator.
 *
 * Runs two sources in parallel and merges their attribute outputs:
 *   1. FCA Register    — direct REST API (fast, no LLM)
 *   2. Companies House — direct REST API via CompaniesHouseRunner (no LLM)
 *
 * Extends ApiRunner so the two-phase preview/commit flow (diff modal) works
 * identically to the standalone FCA/CH runners.
 */

import { ApiRunner }             from '../../base/ApiRunner.js';
import { FCARunner }             from './FCARunner.js';
import { CompaniesHouseRunner }  from './CompaniesHouseRunner.js';
import { mergeAttributeSources } from './ukSourcingFlow/mergeAttributes.js';

export class UKSourcingFlowRunner extends ApiRunner {
  get slug()       { return 'uk-sourcing-flow'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef } = ctx;
    const startedAt = Date.now();

    this.step('Querying FCA Register and Companies House in parallel…');

    let fcaAttrs   = [];
    let fcaFiles   = [];
    let fcaSources = [];
    let chAttrs    = [];
    let chFiles    = [];
    let chSources  = [];

    await Promise.all([
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

    this.step(`  FCA: ${fcaAttrs.length} attr(s) | CH: ${chAttrs.length} attr(s)`);

    const merged = mergeAttributeSources([
      { source: 'FCA Register',    attrs: fcaAttrs },
      { source: 'Companies House', attrs: chAttrs  },
    ]);

    const multiSource = merged.filter(a => (a.lineage ?? []).length >= 2).length;
    this.step(`Merged ${merged.length} unique attribute(s) across 2 sources — ${multiSource} with multi-source lineage — ready for review`);

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
          'FCA Register', 'Companies House (direct API)',
          ...fcaSources,
          ...chSources,
        ],
      },
    };
  }
}

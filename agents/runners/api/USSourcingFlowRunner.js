import { ApiRunner }      from '../../base/ApiRunner.js';
import { GLEIFRunner }    from './GLEIFRunner.js';
import { SECEDGARRunner } from './SECEDGARRunner.js';
import { IAPDRunner }     from './IAPDRunner.js';
import { NYSERunner }     from './NYSERunner.js';
import { mergeAttributeSources } from './ukSourcingFlow/mergeAttributes.js';

export class USSourcingFlowRunner extends ApiRunner {
  get slug()       { return 'us-sourcing-flow'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    const { kycRef } = ctx;
    const startedAt  = Date.now();

    this.step('Querying GLEIF, SEC EDGAR, IAPD, and NYSE in parallel…');

    let gleifAttrs = [], gleifSources = [];
    let secAttrs   = [], secSources   = [];
    let iapdAttrs  = [], iapdSources  = [];
    let nyseAttrs  = [], nyseSources  = [];
    const failures = [];

    await Promise.all([
      (async () => {
        try {
          const r = new GLEIFRunner(this.sb);
          r._onStep = msg => this.step(`  GLEIF ▸ ${msg}`);
          const out = await r.execute(ctx);
          gleifAttrs   = out.attributes ?? [];
          gleifSources = out.metadata?.sourcesConsulted ?? [];
          this.step(`  GLEIF ▸ ${gleifAttrs.length} attribute(s)`);
        } catch (err) {
          failures.push(`GLEIF: ${err.message}`);
          this.step(`  GLEIF ▸ failed — ${err.message} (continuing)`);
        }
      })(),

      (async () => {
        try {
          const r = new SECEDGARRunner(this.sb);
          r._onStep = msg => this.step(`  SEC EDGAR ▸ ${msg}`);
          const out = await r.execute(ctx);
          secAttrs   = out.attributes ?? [];
          secSources = out.metadata?.sourcesConsulted ?? [];
          this.step(`  SEC EDGAR ▸ ${secAttrs.length} attribute(s)`);
        } catch (err) {
          failures.push(`SEC EDGAR: ${err.message}`);
          this.step(`  SEC EDGAR ▸ failed — ${err.message} (continuing)`);
        }
      })(),

      (async () => {
        try {
          const r = new IAPDRunner(this.sb);
          r._onStep = msg => this.step(`  IAPD ▸ ${msg}`);
          const out = await r.execute(ctx);
          iapdAttrs   = out.attributes ?? [];
          iapdSources = out.metadata?.sourcesConsulted ?? [];
          this.step(`  IAPD ▸ ${iapdAttrs.length} attribute(s)`);
        } catch (err) {
          failures.push(`IAPD: ${err.message}`);
          this.step(`  IAPD ▸ failed — ${err.message} (continuing)`);
        }
      })(),

      (async () => {
        try {
          const r = new NYSERunner(this.sb);
          r._onStep = msg => this.step(`  NYSE ▸ ${msg}`);
          const out = await r.execute(ctx);
          nyseAttrs   = out.attributes ?? [];
          nyseSources = out.metadata?.sourcesConsulted ?? [];
          this.step(`  NYSE ▸ ${nyseAttrs.length} attribute(s)`);
        } catch (err) {
          failures.push(`NYSE: ${err.message}`);
          this.step(`  NYSE ▸ failed — ${err.message} (continuing)`);
        }
      })(),
    ]);

    this.step(`  GLEIF: ${gleifAttrs.length} | SEC: ${secAttrs.length} | IAPD: ${iapdAttrs.length} | NYSE: ${nyseAttrs.length}`);
    if (failures.length === 4) throw new Error(`All US sourcing providers failed — ${failures.join(' | ')}`);
    if (failures.length) this.step(`⚠ Partial result — ${failures.join(' | ')}`);

    // Merge priority: GLEIF (ground truth for LEI) > SEC EDGAR > IAPD > NYSE
    const merged = mergeAttributeSources([
      { source: 'GLEIF',     attrs: gleifAttrs },
      { source: 'SEC EDGAR', attrs: secAttrs   },
      { source: 'IAPD',      attrs: iapdAttrs  },
      { source: 'NYSE',      attrs: nyseAttrs  },
    ]);

    const multiSource = merged.filter(a => (a.lineage ?? []).length >= 2).length;
    this.step(`Merged ${merged.length} unique attribute(s) across 4 sources — ${multiSource} with multi-source lineage — ready for review`);

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: 'attributes',
      attributes: merged,
      files:      [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: ['GLEIF', 'SEC EDGAR', 'IAPD', 'NYSE', ...gleifSources, ...secSources, ...iapdSources, ...nyseSources],
      },
    };
  }
}

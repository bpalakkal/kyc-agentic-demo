/**
 * Abstract base class for synchronous API-based runners.
 *
 * Subclasses must:
 *   - Override `get slug()` with the agent's identifier string
 *   - Override `get outputType()` if not 'attributes'
 *   - Implement `execute(ctx)` → Promise<AgentRunOutput>
 *
 * Calling `run(ctx)` handles the full lifecycle:
 *   create agent_runs row → execute → publish attrs/exceptions/files → finalize row
 */

import { AttributePublisher } from '../publishers/AttributePublisher.js';
import { ExceptionPublisher } from '../publishers/ExceptionPublisher.js';
import { FilePublisher      } from '../publishers/FilePublisher.js';

export class ApiRunner {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb) {
    if (!sb) throw new Error('ApiRunner requires a Supabase client (sb)');
    this.sb = sb;
  }

  get slug()       { throw new Error(`${this.constructor.name} must implement get slug()`); }
  get outputType() { return 'attributes'; }

  /**
   * Override in subclass.
   * @param {{ kycRef: string, entityName: string, initiatedBy?: string }} ctx
   * @returns {Promise<import('../types.js').AgentRunOutput>}
   */
  async execute(_ctx) {
    throw new Error(`${this.constructor.name}.execute() is not implemented`);
  }

  async run(ctx) {
    const agentRun = await this._createRun(ctx.kycRef, ctx.initiatedBy);
    try {
      const output = await this.execute(ctx);
      const stats  = await this._publish(ctx.kycRef, agentRun.id, output, ctx.initiatedBy);
      await this._finalizeRun(agentRun.id, {
        status:           'complete',
        outputType:       output.outputType,
        sourcesConsulted: output.metadata?.sourcesConsulted ?? [],
      });
      return { runId: agentRun.id, outputType: output.outputType, stats };
    } catch (err) {
      await this._finalizeRun(agentRun.id, { status: 'failed', error: err.message });
      throw err;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  async _createRun(kycRef, initiatedBy) {
    const { data, error } = await this.sb
      .from('agent_runs')
      .insert({
        kyc_ref:      kycRef,
        agent_slug:   this.slug,
        runner_type:  'api',
        initiated_by: initiatedBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async _finalizeRun(runId, { status, outputType, sourcesConsulted, error: errMsg }) {
    const patch = { status };
    if (outputType        !== undefined) patch.output_type       = outputType;
    if (sourcesConsulted  !== undefined) patch.sources_consulted = sourcesConsulted;
    if (errMsg            !== undefined) patch.error             = errMsg;
    if (status === 'complete' || status === 'failed') patch.completed_at = new Date().toISOString();
    await this.sb.from('agent_runs').update(patch).eq('id', runId);
  }

  async _publish(kycRef, agentRunId, output, initiatedBy) {
    const stats = { attrCount: 0, excCount: 0, fileStored: 0, fileErrors: [] };

    if (output.attributes?.length) {
      stats.attrCount = await new AttributePublisher(this.sb)
        .publish(kycRef, agentRunId, output.attributes)
        .catch(e => { console.error('[ApiRunner] AttributePublisher failed:', e.message); return 0; });
    }

    if (output.exceptions?.length) {
      stats.excCount = await new ExceptionPublisher(this.sb)
        .publish(kycRef, agentRunId, this.slug, output.exceptions)
        .catch(e => { console.error('[ApiRunner] ExceptionPublisher failed:', e.message); return 0; });
    }

    if (output.files?.length) {
      const { stored, errors } = await new FilePublisher(this.sb)
        .publish(kycRef, agentRunId, output.files, initiatedBy)
        .catch(e => { console.error('[ApiRunner] FilePublisher failed:', e.message); return { stored: 0, errors: [] }; });
      stats.fileStored = stored;
      stats.fileErrors = errors;
    }

    return stats;
  }
}

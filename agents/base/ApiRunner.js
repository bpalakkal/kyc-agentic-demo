/**
 * Abstract base class for synchronous API-based runners.
 *
 * Subclasses must:
 *   - Override `get slug()` with the agent's identifier string
 *   - Override `get outputType()` if not 'attributes'
 *   - Implement `execute(ctx)` → Promise<AgentRunOutput>
 *   - Call `this.step(msg)` at key phases so the dock can animate progress
 *
 * Two execution modes:
 *   startPreview(ctx, { onStep })  — creates DB row, executes in background,
 *                                    returns { runId, executionPromise } immediately.
 *                                    Does NOT publish. Sets status → 'pending_review'.
 *   commit(runId, kycRef, output)  — publishes a previewed output, sets status → 'complete'.
 *   run(ctx)                       — preview + immediate commit (backward-compat).
 */

import { AttributePublisher } from '../publishers/AttributePublisher.js';
import { ExceptionPublisher } from '../publishers/ExceptionPublisher.js';
import { FilePublisher      } from '../publishers/FilePublisher.js';
import { PersonPublisher    } from '../publishers/PersonPublisher.js';

export class ApiRunner {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb, options = {}) {
    if (!sb) throw new Error('ApiRunner requires a Supabase client (sb)');
    this.sb = sb;
    this.modelProfile = options.modelProfile ?? null;
    this._onStep = null;
  }

  get slug()       { throw new Error(`${this.constructor.name} must implement get slug()`); }
  get outputType() { return 'attributes'; }
  // Sourcing runners provide candidate values and lineage only. DD runners
  // override this to persist identification and verification decisions.
  get canSetIdvFlags() { return false; }

  /**
   * Override in subclass. Call this.step(msg) at each phase.
   * @param {{ kycRef: string, entityName: string, initiatedBy?: string }} ctx
   * @returns {Promise<import('../types.js').AgentRunOutput>}
   */
  async execute(_ctx) {
    throw new Error(`${this.constructor.name}.execute() is not implemented`);
  }

  /**
   * Emit a progress step. Subclasses call this at each meaningful phase.
   * @param {string} msg
   */
  step(msg) {
    console.log(`[${this.slug}] ${msg}`);
    if (this._onStep) this._onStep(msg);
  }

  /**
   * Start a preview run: creates the agent_runs DB row synchronously,
   * then kicks off execute() in the background without publishing.
   * Returns { runId, executionPromise } immediately after the DB row is created.
   *
   * @param {{ kycRef: string, entityName: string, initiatedBy?: string }} ctx
   * @param {{ onStep?: (msg: string) => void }} callbacks
   * @returns {Promise<{ runId: string, executionPromise: Promise<{ runId: string, output: object }> }>}
   */
  async startPreview(ctx, { onStep } = {}) {
    this._onStep = onStep ?? null;

    const agentRun = await this._createRun(ctx.kycRef, ctx.initiatedBy, ctx.parentRunId, ctx.runPhase);
    const runId = agentRun.id;

    const executionPromise = (async () => {
      try {
        const output = await this.execute({ ...ctx, currentRunId: runId });
        const { data: currentRun } = await this.sb.from('agent_runs').select('status').eq('id', runId).single();
        if (currentRun?.status === 'cancelled') throw Object.assign(new Error('Run cancelled by analyst'), { code: 'RUN_CANCELLED' });
        const outcome = output.metadata?.outcome ?? this._inferOutcome(output);
        const { error: statusErr } = await this.sb
          .from('agent_runs')
          .update({ status: 'pending_review', outcome, outcome_reason: output.metadata?.outcomeReason ?? null })
          .eq('id', runId);
        if (statusErr) throw new Error(`Failed to set pending_review status: ${statusErr.message}`);
        return { runId, output };
      } catch (err) {
        if (err.code !== 'RUN_CANCELLED') await this._finalizeRun(runId, { status: 'failed', error: err.message });
        throw err;
      }
    })();

    return { runId, executionPromise };
  }

  /**
   * Publish a previewed output that is waiting in 'pending_review'.
   * Optionally pass a filtered output (subset of attributes the user accepted).
   *
   * @param {string} runId
   * @param {string} kycRef
   * @param {object} output  — AgentRunOutput (possibly filtered)
   * @param {string} [initiatedBy]
   */
  async commit(runId, kycRef, output, initiatedBy) {
    const stats = await this._publish(kycRef, runId, output, initiatedBy);
    await this._finalizeRun(runId, {
      status:           'complete',
      outputType:       output.outputType,
      sourcesConsulted: output.metadata?.sourcesConsulted ?? [],
      outcome:          output.metadata?.outcome ?? this._inferOutcome(output),
      outcomeReason:    output.metadata?.outcomeReason ?? null,
    });
    return {
      runId, outputType: output.outputType, stats,
      outcome: output.metadata?.outcome ?? this._inferOutcome(output),
      outcomeReason: output.metadata?.outcomeReason ?? null,
    };
  }

  /**
   * Backward-compatible synchronous mode: preview + immediate commit.
   * Used when callers don't need the review step.
   */
  async run(ctx) {
    const agentRun = await this._createRun(ctx.kycRef, ctx.initiatedBy, ctx.parentRunId, ctx.runPhase);
    const steps = [];
    const externalOnStep = this._onStep;
    this._onStep = (message) => {
      steps.push(message);
      if (externalOnStep) externalOnStep(message);
    };
    try {
      const output = await this.execute({ ...ctx, currentRunId: agentRun.id });
      const stats  = await this._publish(ctx.kycRef, agentRun.id, output, ctx.initiatedBy);
      const outcome = output.metadata?.outcome ?? this._inferOutcome(output);
      const outcomeReason = output.metadata?.outcomeReason ?? null;
      await this._finalizeRun(agentRun.id, {
        status:           'complete',
        outputType:       output.outputType,
        sourcesConsulted: output.metadata?.sourcesConsulted ?? [],
        outcome,
        outcomeReason,
        steps,
        rawOutput:        output,
      });
      return { runId: agentRun.id, outputType: output.outputType, stats, outcome, outcomeReason };
    } catch (err) {
      await this._finalizeRun(agentRun.id, { status: 'failed', error: err.message, steps });
      throw err;
    } finally {
      this._onStep = externalOnStep;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  async _createRun(kycRef, initiatedBy, parentRunId, runPhase = 'main') {
    const model = this.modelProfile ?? null;
    const { data, error } = await this.sb
      .from('agent_runs')
      .insert({
        kyc_ref:      kycRef,
        agent_slug:   this.slug,
        runner_type:  'api',
        initiated_by: initiatedBy ?? null,
        status:       'running',
        parent_run_id: parentRunId ?? null,
        run_phase:     runPhase,
        ...(model ? {
          llm_provider: model.provider,
          llm_model_id: model.modelId,
          llm_profile_key: model.key,
        } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  _inferOutcome(output) {
    return (output.attributes?.length || output.exceptions?.length || output.files?.length)
      ? 'data_found'
      : 'no_data';
  }

  async _finalizeRun(runId, { status, outputType, sourcesConsulted, outcome, outcomeReason, error: errMsg, steps, rawOutput }) {
    const patch = { status };
    if (outputType        !== undefined) patch.output_type       = outputType;
    if (sourcesConsulted  !== undefined) patch.sources_consulted = sourcesConsulted;
    if (outcome           !== undefined) patch.outcome            = outcome;
    if (outcomeReason     !== undefined) patch.outcome_reason     = outcomeReason;
    if (errMsg            !== undefined) patch.error             = errMsg;
    if (steps             !== undefined) patch.steps             = steps;
    if (rawOutput         !== undefined) patch.raw_output        = rawOutput;
    if (status === 'complete' || status === 'failed') patch.completed_at = new Date().toISOString();
    await this.sb.from('agent_runs').update(patch).eq('id', runId);
  }

  async _publish(kycRef, agentRunId, output, initiatedBy) {
    const stats = { attrCount: 0, personCount: 0, excCount: 0, fileStored: 0, fileErrors: [] };

    if (output.attributes?.length) {
      const exceptionsByAttribute = new Map();
      for (const exception of (output.exceptions ?? [])) {
        if (!exception.attributeName) continue;
        const current = exceptionsByAttribute.get(exception.attributeName) ?? {
          types: [], reasons: [], recommendations: [], assessments: [],
        };
        const append = (target, value) => {
          for (const item of (Array.isArray(value) ? value : (value == null ? [] : [value]))) {
            const text = String(item ?? '').trim();
            if (text && !target.includes(text)) target.push(text);
          }
        };
        append(current.types, exception.exceptionType);
        append(current.reasons, exception.reasoning);
        append(current.recommendations, exception.recommendedActions);
        for (const item of (exception.assessments ?? [])) {
          if (item?.exceptionType && item?.exceptionReasoning) current.assessments.push(item);
        }
        exceptionsByAttribute.set(exception.attributeName, current);
      }

      const assessedAttributes = output.attributes.map(attribute => {
        const assessment = exceptionsByAttribute.get(attribute.attributeName);
        return assessment ? {
          ...attribute,
          exceptionFlag: true,
          exceptionType: assessment.types,
          exceptionReason: assessment.reasons,
          exceptionRecommendation: assessment.recommendations,
          exceptionAssessments: assessment.assessments,
        } : attribute;
      });
      stats.attrCount = await new AttributePublisher(this.sb)
        .publish(kycRef, agentRunId, assessedAttributes, { allowIdv: this.canSetIdvFlags });
    }

    if (output.exceptions?.length) {
      stats.excCount = await new ExceptionPublisher(this.sb)
        .publish(kycRef, agentRunId, this.slug, output.exceptions);
    }

    if (output.persons?.length) {
      stats.personCount = await new PersonPublisher(this.sb)
        .publish(kycRef, agentRunId, output.personSource ?? this.slug, output.persons);
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

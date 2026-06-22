/**
 * Base class for autonomous AWS ELB agents.
 *
 * Handles agent_runs row lifecycle around the existing async AWS polling flow.
 * Unlike ApiRunner, autonomous runs are non-blocking: `invoke()` starts the run
 * and returns immediately.  Completion is signalled via `finalize()` — called by
 * the server's snapshot endpoint when the frontend reports the run is done.
 *
 * Subclasses may override `buildRequestBody(ctx)` to customise the AWS payload.
 */

const AWS_AGENT_BASE =
  process.env.AWS_AGENT_BASE ??
  'http://gs-forge-agentic-runtime-lb-1873180191.us-east-1.elb.amazonaws.com';

export class AutonomousRunner {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} sb
   * @param {string} slug  — must match the AWS ELB slug
   */
  constructor(sb, slug) {
    if (!sb)   throw new Error('AutonomousRunner requires a Supabase client (sb)');
    if (!slug) throw new Error('AutonomousRunner requires a slug');
    this.sb   = sb;
    this._slug = slug;
  }

  get slug() { return this._slug; }

  /**
   * Override in subclass to customise the AWS request body.
   * @param {{ kycRef: string, entityName: string }} ctx
   */
  buildRequestBody(ctx) {
    return {
      entity_name:        ctx.entityName,
      out_document_store: 'all_unstructured_docs',
      async:              true,
    };
  }

  /**
   * Start the autonomous run:
   *   1. Create agent_runs row (status=running)
   *   2. POST to AWS ELB
   *   3. Store externalRunId
   *   4. Return { agentRunId, externalRunId } for the frontend to poll
   *
   * @param {{ kycRef: string, entityName: string, initiatedBy?: string }} ctx
   * @returns {Promise<{ agentRunId: string, externalRunId: string }>}
   */
  async invoke(ctx) {
    const { data: row, error: insertErr } = await this.sb
      .from('agent_runs')
      .insert({
        kyc_ref:      ctx.kycRef,
        agent_slug:   this.slug,
        runner_type:  'autonomous',
        initiated_by: ctx.initiatedBy ?? null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    const url  = `${AWS_AGENT_BASE}/api/invoke/${this.slug}`;
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(this.buildRequestBody(ctx)),
      signal:  AbortSignal.timeout(25_000),
    });

    const json = await res.json().catch(() => ({}));
    const externalRunId = json.runId ?? json.run_id ?? json.id;

    if (!externalRunId) {
      await this.sb.from('agent_runs')
        .update({ status: 'failed', error: json.error ?? 'AWS did not return a runId', completed_at: new Date().toISOString() })
        .eq('id', row.id);
      throw new Error(json.error ?? 'AWS did not return a runId');
    }

    await this.sb.from('agent_runs')
      .update({ external_run_id: externalRunId })
      .eq('id', row.id);

    return { agentRunId: row.id, externalRunId };
  }
}

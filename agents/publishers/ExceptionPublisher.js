/**
 * ExceptionPublisher — writes agent-raised exceptions to the exceptions table.
 *
 * Follows the same deduplication and number-allocation pattern as the existing
 * syncForgeExceptions() in supabase.js:
 *   - Skip exceptions already open for this agent+attribute combination
 *   - Allocate sequential exception numbers atomically via alloc_exception_numbers RPC
 *
 * source_type is set to "agent:<slug>" so the UI can distinguish agent-raised
 * exceptions from Forge-raised ones ("forge") and manual ones ("manual").
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} sb  Service-key client
 */
export class ExceptionPublisher {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb) {
    this.sb = sb;
  }

  /**
   * Insert new exceptions for one agent run; skips any already open for the
   * same entity + attribute + source agent.
   *
   * @param {string} kycRef
   * @param {string} agentRunId  — agent_runs.id (must already exist)
   * @param {string} agentSlug   — e.g. "sanctions", "adverse-media"
   * @param {import('../types.js').ExceptionOutput[]} exceptions
   * @returns {Promise<number>} count of new exception rows inserted
   */
  async publish(kycRef, agentRunId, agentSlug, exceptions) {
    if (!exceptions?.length) return 0;

    const sourceType = `agent:${agentSlug}`;
    const attrNames  = exceptions.map(e => e.attributeName);

    // Skip attributes that already have an open exception from this same agent.
    const { data: existing, error: fetchErr } = await this.sb
      .from('exceptions')
      .select('attribute_name')
      .eq('kyc_ref', kycRef)
      .eq('source_type', sourceType)
      .neq('status', 'resolved')
      .in('attribute_name', attrNames);
    if (fetchErr) throw fetchErr;

    const alreadyOpen = new Set((existing ?? []).map(r => r.attribute_name));
    const toInsert = exceptions.filter(e => !alreadyOpen.has(e.attributeName));
    if (toInsert.length === 0) return 0;

    // Atomically reserve a sequential block of exception numbers.
    const { data: startNum, error: rpcErr } = await this.sb.rpc('alloc_exception_numbers', {
      p_kyc_ref: kycRef,
      p_count:   toInsert.length,
    });
    if (rpcErr) throw rpcErr;
    let nextNum = startNum;

    const rows = toInsert.map(exc => ({
      kyc_ref:             kycRef,
      exception_number:    nextNum++,
      agent_run_id:        agentRunId,
      attribute_name:      exc.attributeName,
      field_name:          exc.fieldName,
      source_type:         sourceType,
      status:              'open',
      severity:            exc.severity ?? null,
      title:               exc.title,
      reasoning:           exc.reasoning ?? [],
      recommended_actions: exc.recommendedActions ?? [],
    }));

    const { error } = await this.sb.from('exceptions').insert(rows);
    if (error) throw Object.assign(error, { context: 'ExceptionPublisher.publish' });
    return rows.length;
  }
}

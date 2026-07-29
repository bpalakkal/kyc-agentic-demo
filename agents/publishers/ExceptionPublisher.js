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
import { withKeyedLock } from '../utils/keyedLock.js';

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
    return withKeyedLock(`exceptions:${kycRef}`, async () => {

    const sourceType = `agent:${agentSlug}`;
    const attrNames  = exceptions.map(e => e.attributeName);

    const asStringArray = value => {
      const values = Array.isArray(value) ? value : (value == null ? [] : [value]);
      return values.map(item => String(item ?? '').trim()).filter(Boolean);
    };

    // Skip only the same open issue from this agent. A different exception type
    // on the same attribute is a distinct workflow item and must be retained.
    const { data: existing, error: fetchErr } = await this.sb
      .from('exceptions')
      .select('attribute_name,exception_types')
      .eq('kyc_ref', kycRef)
      .eq('source_type', sourceType)
      .neq('status', 'resolved')
      .in('attribute_name', attrNames);
    if (fetchErr) throw fetchErr;

    const toInsert = exceptions.filter(exception => {
      const candidateTypes = asStringArray(exception.exceptionType);
      return !(existing ?? []).some(row =>
        row.attribute_name === exception.attributeName
        && asStringArray(row.exception_types).some(type => candidateTypes.includes(type))
      );
    });
    if (toInsert.length === 0) return 0;

    // Atomically reserve a sequential block of exception numbers.
    const { data: startNum, error: rpcErr } = await this.sb.rpc('alloc_exception_numbers', {
      p_kyc_ref: kycRef,
      p_count:   toInsert.length,
    });
    if (rpcErr) throw rpcErr;
    let nextNum = startNum;

    const { data: runAttributes, error: attributeError } = await this.sb
      .from('entity_attributes')
      .select('id,attribute_name')
      .eq('kyc_ref', kycRef)
      .eq('agent_run_id', agentRunId)
      .in('attribute_name', toInsert.map(exc => exc.attributeName));
    if (attributeError) throw attributeError;
    const attributeIds = new Map((runAttributes ?? []).map(row => [row.attribute_name, row.id]));

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
      exception_types:     asStringArray(exc.exceptionType),
      exception_assessments: Array.isArray(exc.assessments)
        ? exc.assessments.map(item => ({
            exception_type: String(item.exceptionType ?? '').trim(),
            exception_reasoning: String(item.exceptionReasoning ?? '').trim(),
          })).filter(item => item.exception_type && item.exception_reasoning)
        : [],
      reasoning:           exc.reasoning ?? [],
      recommended_actions: exc.recommendation ? [exc.recommendation] : (exc.recommendedActions ?? []),
      exception_queue:     exc.exceptionQueue ?? 'Analyst',
      guidance_references: asStringArray(exc.guidanceReferences),
      evidence_sources:    asStringArray(exc.evidenceSources),
      routing_confidence:  Number.isFinite(Number(exc.confidence))
        ? Math.max(0, Math.min(100, Math.round(Number(exc.confidence))))
        : null,
      entity_attribute_id: exc.entityAttributeId ?? attributeIds.get(exc.attributeName) ?? null,
      entity_person_id:    exc.entityPersonId ?? null,
    }));

    let insertError;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await this.sb.from('exceptions').insert(rows);
      if (!error) { insertError = null; break; }
      insertError = error;
      if (error.code !== '23505' || !/exceptions_kyc_ref_exception_number_key/i.test(error.message ?? '')) break;
      const { data: retryStart, error: retryError } = await this.sb.rpc('alloc_exception_numbers', {
        p_kyc_ref: kycRef, p_count: rows.length,
      });
      if (retryError) throw retryError;
      rows.forEach((row, index) => { row.exception_number = retryStart + index; });
    }
    if (insertError) throw Object.assign(insertError, { context: 'ExceptionPublisher.publish' });
    return rows.length;
    });
  }
}

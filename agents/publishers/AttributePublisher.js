import { normalizeForAttribute } from '../dd/enumNormalizer.js';

/** Normalize an enum-backed value to its canonical form; passthrough otherwise.
 * Single choke point: EVERY runner (sourcing, DD, future) writes through the
 * publisher, so all attribute values are canonicalized here. */
function normalizeValue(attributeName, value) {
  if (value == null) return { value, unmapped: false };
  const r = normalizeForAttribute(value, attributeName);
  if (!r.enumName && !r.dataType) return { value, unmapped: false };
  return { value: r.value, unmapped: !r.matched };
}

function asStringArray(value) {
  const values = Array.isArray(value) ? value : (value == null ? [] : [value]);
  return values
    .map(item => typeof item === 'string' ? item.trim() : String(item ?? '').trim())
    .filter(Boolean);
}

/**
 * AttributePublisher — writes agent-run attribute data to entity_attributes.
 *
 * Agent-run rows differ from imported-snapshot rows in two ways:
 *   - snapshot_id is NULL  (no snapshot JSON was produced)
 *   - agent_run_id is set  (links back to the agent_runs row)
 *
 * getAttributes() merges these into the attribute view as its "Layer 2" override
 * (completed runs only, most recent run wins per attribute_name). Use
 * getAttributesByRunId() to query the rows for a single run in isolation.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} sb  Service-key client
 */
export class AttributePublisher {
  /** @param {import('@supabase/supabase-js').SupabaseClient} sb */
  constructor(sb) {
    this.sb = sb;
  }

  /**
   * Bulk-insert attribute rows for one agent run.
   *
   * @param {string} kycRef
   * @param {string} agentRunId  — agent_runs.id (must already exist)
   * @param {import('../types.js').AttributeOutput[]} attributes
   * @returns {Promise<number>} count of rows inserted
   */
  async publish(kycRef, agentRunId, attributes, { allowIdv = false } = {}) {
    if (!attributes?.length) return 0;

    const rows = attributes.map(attr => {
      // Canonicalize enum-backed values (Country, etc.) for EVERY runner. Also
      // normalize each lineage entry's value so the audit trail matches.
      const norm = normalizeValue(attr.attributeName, attr.displayValue);
      const lineage = attr.lineage?.length
        ? attr.lineage.map(l => ({ ...l, value: normalizeValue(attr.attributeName, l.value).value }))
        : null;
      return {
        kyc_ref:                kycRef,
        snapshot_id:            null,          // direct runner output uses agent_run_id
        agent_run_id:           agentRunId,
        attribute_name:         attr.attributeName,
        attribute_group:        attr.attributeGroup,
        display_value:          norm.value ?? null,
        confidence:             attr.confidence  ?? null,
        id_flag:                allowIdv ? (attr.idFlag ?? false) : false,
        id_source:              allowIdv && attr.idFlag ? (attr.source ?? null) : null,
        id_reasoning:           allowIdv ? (attr.idReasoning ?? null) : null,
        verification_flag:      allowIdv ? (attr.verificationFlag ?? false) : false,
        // DD runners supply verificationSources (Forge array); sourcing runners use [source].
        verification_source:    allowIdv
                                  ? (attr.verificationSources ?? (attr.verificationFlag ? [attr.source] : null))
                                  : null,
        verification_reasoning: allowIdv ? (attr.verificationReasoning ?? null) : null,
        // Flag an unmapped enum value for analyst review (unless already flagged).
        exception_flag:         attr.exceptionFlag || norm.unmapped || false,
        exception_type:         asStringArray(attr.exceptionType ?? (norm.unmapped ? 'Unmapped Value' : null)),
        exception_reason:       asStringArray(attr.exceptionReason),
        exception_recommendation: asStringArray(attr.exceptionRecommendation),
        exception_assessments: Array.isArray(attr.exceptionAssessments)
          ? attr.exceptionAssessments.map(item => ({
              exception_type: String(item.exceptionType ?? '').trim(),
              exception_reasoning: String(item.exceptionReasoning ?? '').trim(),
            })).filter(item => item.exception_type && item.exception_reasoning)
          : [],
        lineage,
      };
    });

    const { error } = await this.sb.from('entity_attributes').insert(rows);
    if (error) throw Object.assign(error, { context: 'AttributePublisher.publish' });
    return rows.length;
  }
}

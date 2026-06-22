/**
 * AttributePublisher — writes agent-run attribute data to entity_attributes.
 *
 * Agent-run rows differ from Forge-snapshot rows in two ways:
 *   - snapshot_id is NULL  (no Forge JSON was produced)
 *   - agent_run_id is set  (links back to the agent_runs row)
 *
 * The existing getAttributes() function filters by snapshot_id, so these rows
 * are invisible to the current attribute view until Phase 6 adds the UI layer.
 * Use getAttributesByRunId() (added to supabase.js in Phase 2) to query them.
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
  async publish(kycRef, agentRunId, attributes) {
    if (!attributes?.length) return 0;

    const rows = attributes.map(attr => ({
      kyc_ref:              kycRef,
      snapshot_id:          null,          // no Forge snapshot; use agent_run_id instead
      agent_run_id:         agentRunId,
      attribute_name:       attr.attributeName,
      attribute_group:      attr.attributeGroup,
      display_value:        attr.displayValue ?? null,
      id_flag:              attr.idFlag ?? false,
      id_source:            attr.source ?? null,
      verification_flag:    attr.verificationFlag ?? false,
      verification_source:  attr.verificationFlag ? [attr.source] : null,
      exception_flag:       attr.exceptionFlag ?? false,
      exception_type:       attr.exceptionType ?? null,
      lineage:              attr.lineage?.length ? attr.lineage : null,
    }));

    const { error } = await this.sb.from('entity_attributes').insert(rows);
    if (error) throw Object.assign(error, { context: 'AttributePublisher.publish' });
    return rows.length;
  }
}

/** Persist party outputs without erasing parties produced by parallel sources. */
export class PersonPublisher {
  constructor(sb) { this.sb = sb; }

  async publish(kycRef, agentRunId, source, persons) {
    if (!persons?.length) return 0;
    const rows = persons.map(person => ({
      kyc_ref: kycRef,
      snapshot_id: null,
      agent_run_id: agentRunId,
      source: person.source ?? source,
      role: person.role,
      person_index: person.personIndex ?? 0,
      full_name: person.fullName ?? null,
      ownership_pct: person.ownershipPct ?? null,
      nationality: person.nationality ?? null,
      attributes: person.attributes ?? {},
    }));
    const { error } = await this.sb.from('entity_persons').insert(rows);
    if (error) throw Object.assign(error, { context: 'PersonPublisher.publish' });
    return rows.length;
  }
}

/**
 * Keep lifecycle wrappers in the durable audit trail while reporting the
 * concrete agents that performed work in dashboard metrics and activity.
 */
export function trackedAgentRuns(agentRuns, registry) {
  const agentKinds = new Map((registry ?? []).map(row => [row.slug, row.agent_kind]));
  return (agentRuns ?? []).filter(run => agentKinds.get(run.agent_slug) !== 'document_flow');
}


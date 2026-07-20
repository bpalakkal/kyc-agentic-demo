export type RunnableRegistryEntry = {
  slug: string;
  enabled: boolean;
  user_triggerable?: boolean;
  available?: boolean;
  runner_registered?: boolean;
};

export function registryEntryAvailable(agent: RunnableRegistryEntry): boolean {
  return agent.available ?? (agent.enabled && agent.runner_registered !== false);
}

export function filterRunnableAgentSlugs(requested: string[], registry: RunnableRegistryEntry[]): string[] {
  const bySlug = new Map(registry.map((agent) => [agent.slug, agent]));
  return [...new Set(requested)].filter((slug) => {
    const agent = bySlug.get(slug);
    return Boolean(agent && agent.enabled !== false && agent.user_triggerable !== false && registryEntryAvailable(agent));
  });
}

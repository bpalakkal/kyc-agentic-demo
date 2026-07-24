import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { registryEntryAvailable } from "@/lib/agentRegistry";

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

export type RegistryAgent = {
  slug: string;
  display_name: string;
  description?: string;
  category?: string;
  cip_classification?: string;
  jurisdiction?: string;
  runner_type?: string;
  output_type?: string;
  enabled: boolean;
  trigger_all?: boolean;
  top_level_trigger?: boolean;
  user_triggerable?: boolean;
  pre_agents?: string[];
  post_agents?: string[];
  child_agents?: string[];
  child_execution?: "parallel" | "sequential";
  failure_policy?: "fail_fast" | "continue";
  sort_order?: number;
  execution_mode?: "generic" | "screening" | "orchestrator";
  required_env?: string[];
  model_profile?: string | null;
  runner_registered?: boolean;
  available?: boolean;
  readiness_error?: string | null;
};

export type ModelProfile = {
  key: string;
  provider: string;
  display_name: string;
  model_env: string;
  available: boolean;
};

/**
 * During rolling deployments an older backend may omit runtime readiness.
 * Treat an enabled legacy row as runnable, but honor an explicit `available:
 * false` from the database-backed backend.
 */
export function isAgentAvailable(agent: RegistryAgent): boolean {
  return registryEntryAvailable(agent);
}

export function useAgentRegistry() {
  return useQuery<RegistryAgent[]>({
    queryKey: ["agent-registry"],
    queryFn: async () => {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Agent registry HTTP ${response.status}`);
      return Array.isArray(data) ? data : (data.agents ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useModelProfiles() {
  return useQuery<ModelProfile[]>({
    queryKey: ["model-profiles"],
    queryFn: async () => {
      const response = await apiFetch(`${AGENT_API_BASE}/api/model-profiles`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error ?? `Model profiles HTTP ${response.status}`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

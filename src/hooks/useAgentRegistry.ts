import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

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
  execution_mode?: "generic" | "screening";
  required_env?: string[];
  runner_registered?: boolean;
  available?: boolean;
  readiness_error?: string | null;
};

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

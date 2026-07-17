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
  forge_slug?: string;
};

export function useAgentRegistry() {
  return useQuery<RegistryAgent[]>({
    queryKey: ["agent-registry"],
    queryFn: () =>
      apiFetch(`${AGENT_API_BASE}/api/agents`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : (d.agents ?? []))),
    staleTime: 5 * 60 * 1000,
  });
}

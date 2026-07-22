import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

export type AgentSequenceState = {
  sourcing: boolean;
  due_diligence: boolean;
  pending_attribute_review: boolean;
  pending_attribute_count: number;
  pending_attributes: string[];
};

export function useAgentSequenceState(kycRef?: string | null) {
  return useQuery<AgentSequenceState>({
    queryKey: ["agent-sequence-state", kycRef],
    queryFn: async () => {
      const response = await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef ?? "")}/agent-sequence-state`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Sequence state HTTP ${response.status}`);
      return data;
    },
    enabled: !!kycRef,
    refetchInterval: 2_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";

export type ApiEntity = {
  kyc_ref: string;
  entity_name: string;
  entity_type: string | null;
  jurisdiction: string | null;
  risk_rating: "High" | "Medium" | "Low" | null;
  priority: "High" | "Medium" | "Low";
  status: string;
  due_date: string | null;
  open_exceptions_count: number;
  drgs: { name: string } | null;
  review_type?: "onboarding" | "periodic_refresh" | null;
};

export const ENTITIES_QUERY_KEY = ["entities"] as const;

export function useEntities() {
  return useQuery<ApiEntity[], Error>({
    queryKey: ENTITIES_QUERY_KEY,
    queryFn: async () => {
      const response = await apiFetch(`${AGENT_API_BASE}/api/entities`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: string }));
        throw new Error(`Server returned ${response.status}: ${body?.error ?? "unknown error"}`);
      }
      return response.json() as Promise<ApiEntity[]>;
    },
    staleTime: 60_000,
  });
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAgentRegistry, type RegistryAgent } from "@/hooks/useAgentRegistry";
import { useAgents, AGENT_API_BASE, type AgentId } from "@/components/AgentSystem";
import { apiFetch } from "@/lib/apiFetch";

const CATEGORIES = [
  { key: "sourcing",       label: "Sourcing" },
  { key: "due_diligence",  label: "Due Diligence" },
  { key: "screening",      label: "Screening" },
] as const;

type Category = typeof CATEGORIES[number]["key"];

function cipFilter(agent: RegistryAgent, entityCip: string | null): boolean {
  if (!agent.cip_classification) return true;
  if (!entityCip) return true;
  return agent.cip_classification === entityCip;
}

function CategorySection({
  category,
  label,
  agents,
  onRun,
}: {
  category: string;
  label: string;
  agents: RegistryAgent[];
  onRun: (slugs: string[], displayName: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const triggerAll = agents.find((a) => a.trigger_all);
  const individual = agents.filter((a) => !a.trigger_all && a.enabled !== false);

  if (!agents.length) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 bg-white rounded-md px-3 py-1.5 hover:bg-gray-50 shadow-sm"
      >
        {label}
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {triggerAll && (
              <>
                <button
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    onRun(
                      individual.map((a) => a.slug),
                      `All ${label}`
                    );
                    setOpen(false);
                  }}
                >
                  Trigger All {label}
                </button>
                {individual.length > 0 && <hr className="my-1 border-gray-100" />}
              </>
            )}
            {individual.map((agent) => (
              <button
                key={agent.slug}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  onRun([agent.slug], agent.display_name);
                  setOpen(false);
                }}
              >
                {agent.display_name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AgentTriggers ────────────────────────────────────────────────────────────

export function AgentTriggers({ caseKyc, entityName }: { caseKyc: string; entityName?: string }) {
  const registry = useAgentRegistry();
  const { runAgents, setEntityContext } = useAgents();

  // Fetch entity CIP for filtering
  const { data: attrRows } = useQuery<{ attribute_name: string; display_value: string | null }[]>({
    queryKey: ["entity-attrs-cip", caseKyc],
    queryFn: () =>
      apiFetch(`${AGENT_API_BASE}/api/entity/${caseKyc}/attributes`)
        .then((r) => r.json()),
    enabled: Boolean(caseKyc),
    staleTime: 2 * 60 * 1000,
  });

  const entityCip =
    attrRows?.find((a) => a.attribute_name === "cip_classification")?.display_value ?? null;

  const agents = registry.data ?? [];

  const handleRun = (slugs: string[], displayName: string) => {
    setEntityContext({ name: entityName ?? caseKyc, kyc: caseKyc });
    runAgents(slugs as AgentId[], displayName);
  };

  const agentsFor = (cat: Category) =>
    agents.filter((a) => a.category === cat && cipFilter(a, entityCip));

  return (
    <div className="flex items-center gap-2">
      {CATEGORIES.map(({ key, label }) => (
        <CategorySection
          key={key}
          category={key}
          label={label}
          agents={agentsFor(key)}
          onRun={handleRun}
        />
      ))}
    </div>
  );
}

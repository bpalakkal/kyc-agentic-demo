/**
 * AgentTriggers — three category dropdowns (Sourcing / Due Diligence / Screening).
 * All agents and all trigger actions come exclusively from the agent registry.
 * The registry entry with trigger_all:true in each category powers the "Trigger All"
 * button; every other entry in that category appears as an individual item.
 * No hardcoded agent lists, no schema-derived lists — registry is the single source.
 *
 * Agents with a cip_classification field are only shown when the current entity's
 * CIP classification attribute matches. Agents without it (or set to "all") always show.
 */
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Zap, Database, ClipboardList, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAgents } from "@/components/AgentSystem";
import { isAgentAvailable, useAgentRegistry, type RegistryAgent } from "@/hooks/useAgentRegistry";
import { apiFetch } from "@/lib/apiFetch";

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

function TriggerButton({ icon: Icon, label, children }: {
  icon: typeof Zap; label: string; children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-[11px] px-3 py-1.5 rounded-md bg-secondary text-foreground font-semibold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors border border-border">
          <Icon className="size-3" />
          {label} <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategorySection({
  icon, label, agents,
}: {
  icon: typeof Database;
  label: string;
  agents: RegistryAgent[];
}) {
  const { runAgents } = useAgents();
  const triggerAll = agents.find((a) => a.trigger_all);
  const individual = agents.filter((a) => !a.trigger_all);

  if (agents.length === 0) return null;

  return (
    <TriggerButton icon={icon} label={label}>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {triggerAll && (
        <DropdownMenuItem
          disabled={!isAgentAvailable(triggerAll)}
          title={triggerAll.readiness_error ?? undefined}
          onClick={() => runAgents([triggerAll.slug as Parameters<typeof runAgents>[0][number]], triggerAll.display_name)}
        >
          <Zap className="size-3 mr-2" /> {triggerAll.display_name}
        </DropdownMenuItem>
      )}
      {individual.length > 0 && <DropdownMenuSeparator />}
      {individual.map((a) => (
        <DropdownMenuItem
          key={a.slug}
          disabled={!isAgentAvailable(a)}
          title={a.readiness_error ?? undefined}
          onClick={() => runAgents([a.slug as Parameters<typeof runAgents>[0][number]], a.display_name)}
        >
          {a.display_name}
        </DropdownMenuItem>
      ))}
      {agents.length === 0 && (
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
          No agents registered for this category.
        </div>
      )}
    </TriggerButton>
  );
}

export function AgentTriggers({ caseKyc, entityName: _entityName }: { caseKyc: string; entityName: string }) {
  const { data: registry = [] } = useAgentRegistry();

  // Fetch this entity's attributes to determine CIP classification.
  // TanStack Query caches the result — other components fetching the same key share it.
  const { data: attributes = [] } = useQuery<Array<{ attribute_name: string; display_value: string | null }>>({
    queryKey: ["entity-attributes", caseKyc],
    queryFn: () =>
      apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(caseKyc)}/attributes`)
        .then((r) => r.json()),
    enabled: !!caseKyc,
    staleTime: 60_000,
  });

  const entityCip = attributes.find((a) => a.attribute_name === "cip_classification")?.display_value ?? null;

  // Show agents that are scoped to this entity's CIP type, plus any that have no
  // CIP restriction. If the entity has no CIP set yet, show everything.
  function cipFilter(a: RegistryAgent) {
    const agentCip = a.cip_classification;
    if (!agentCip || agentCip === "all") return true;
    if (!entityCip) return true;
    return agentCip === entityCip;
  }

  const sourcing     = registry.filter((a) => a.category?.toLowerCase() === "sourcing").filter(cipFilter);
  const dueDiligence = registry.filter((a) => a.category?.toLowerCase() === "due_diligence").filter(cipFilter);
  const screening    = registry.filter((a) => a.category?.toLowerCase() === "screening").filter(cipFilter);

  return (
    <div className="flex items-center gap-2">
      <CategorySection icon={Database}      label="Sourcing"        agents={sourcing} />
      <CategorySection icon={ClipboardList} label="Due Diligence"   agents={dueDiligence} />
      <CategorySection icon={ShieldCheck}   label="Screening"       agents={screening} />
    </div>
  );
}

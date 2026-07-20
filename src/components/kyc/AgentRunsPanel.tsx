/**
 * AgentRunsPanel — right-panel tab showing the LATEST run per agent (all stages:
 * sourcing, due diligence, screening) for a case. Each run expands into two
 * sections:
 *   - Thinking    — the persisted step/thinking log (agent_runs.steps, migration 009)
 *   - Attributes  — the values the run returned, pivoted by lineage source
 *                   (from agent_runs.raw_output, migration 008)
 */
import { useEffect, useMemo, useState } from "react";
import { Database, ChevronDown, Clock, Loader2, Inbox, Brain, ListTree } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { useAgentRegistry } from "@/hooks/useAgentRegistry";
import { cn } from "@/lib/utils";

type LineageEntry = { source?: string; value?: unknown };
type RawAttr = {
  attributeName?: string; attribute_name?: string;
  displayValue?: string;  display_value?: string;
  attributeGroup?: string; attribute_group?: string;
  lineage?: LineageEntry[];
};
type AgentRun = {
  id: string;
  agent_slug: string;
  status: string;
  outcome?: "data_found" | "no_data" | null;
  outcome_reason?: string | null;
  error?: string | null;
  completed_at?: string | null;
  started_at?: string | null;
  steps?: string[] | null;
  raw_output?: { agentSlug?: string; attributes?: RawAttr[]; metadata?: Record<string, unknown> } | null;
};

const fmtLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtTime = (t?: string | null) => (t ? new Date(t).toLocaleString() : "");
const attrName = (a: RawAttr) => a.attributeName ?? a.attribute_name ?? "";
const attrValue = (a: RawAttr) => a.displayValue ?? a.display_value ?? "";
const attrGroup = (a: RawAttr) => a.attributeGroup ?? a.attribute_group ?? "core";

// Pivot a run's attributes by lineage source: source → [{ name, value it gave }].
function groupBySource(attrs: RawAttr[]): { source: string; items: { name: string; value: string }[] }[] {
  const bySource = new Map<string, { name: string; value: string }[]>();
  const push = (source: string, name: string, value: string) => {
    const arr = bySource.get(source) ?? [];
    arr.push({ name, value });
    bySource.set(source, arr);
  };
  for (const a of attrs) {
    const name = attrName(a);
    if (!name || attrGroup(a) === "wgq") continue;
    const lineage = Array.isArray(a.lineage) ? a.lineage : [];
    if (lineage.length) {
      const seen = new Set<string>();
      for (const e of lineage) {
        const src = e.source || "Unattributed";
        if (seen.has(src)) continue;
        seen.add(src);
        push(src, name, String(e.value ?? ""));
      }
    } else {
      push("Merged value", name, attrValue(a));
    }
  }
  return [...bySource.entries()].map(([source, items]) => ({ source, items }));
}

export function AgentRunsPanel({ kycRef, focusAgentSlug }: { kycRef: string; focusAgentSlug?: string | null }) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRun, setOpenRun] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<Record<string, "thinking" | "attributes" | null>>({});
  const { data: registry = [] } = useAgentRegistry();

  const displayName = (slug: string) => registry.find((a) => a.slug === slug)?.display_name ?? fmtLabel(slug);

  useEffect(() => {
    if (!kycRef) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/runs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AgentRun[]) => { if (!cancelled) setRuns(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kycRef]);

  // Latest run per agent that produced something (attributes or a thinking log).
  const latest = useMemo(() => {
    const m = new Map<string, AgentRun>();
    for (const run of runs) {
      if (!["complete", "pending_review", "failed"].includes(run.status)) continue;
      const hasContent = (run.raw_output?.attributes?.length) || (run.steps?.length);
      if (!hasContent) continue;
      const prev = m.get(run.agent_slug);
      const t = run.completed_at ?? run.started_at ?? "";
      const pt = prev ? (prev.completed_at ?? prev.started_at ?? "") : "";
      if (!prev || t > pt) m.set(run.agent_slug, run);
    }
    return [...m.values()].sort((a, b) =>
      (b.completed_at ?? b.started_at ?? "").localeCompare(a.completed_at ?? a.started_at ?? ""));
  }, [runs]);

  useEffect(() => {
    if (!focusAgentSlug) return;
    const match = latest.find((run) => run.agent_slug === focusAgentSlug);
    if (!match) return;
    setOpenRun((prev) => ({ ...prev, [match.id]: true }));
    setSection((prev) => ({ ...prev, [match.id]: "attributes" }));
    requestAnimationFrame(() => {
      document.querySelector(`[data-agent-run-slug="${CSS.escape(focusAgentSlug)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [focusAgentSlug, latest]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> <span className="text-sm">Loading agent runs…</span>
      </div>
    );
  }
  if (latest.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground py-10 text-center px-4">
        <Inbox className="size-6 opacity-40" />
        <p className="text-[12px]">No agent runs yet.</p>
        <p className="text-[10px] text-muted-foreground/70">Trigger an agent — its thinking log and returned values will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto">
      {latest.map((run) => {
        const attrs = (run.raw_output?.attributes ?? []).filter((a) => attrName(a) && attrGroup(a) !== "wgq");
        const groups = groupBySource(attrs);
        const steps = run.steps ?? [];
        const isOpen = run.id in openRun ? openRun[run.id] : true;
        const sec = run.id in section ? section[run.id] : "attributes";
        const toggleSec = (s: "thinking" | "attributes") =>
          setSection((prev) => ({ ...prev, [run.id]: prev[run.id] === s ? null : s }));
        return (
          <div
            key={run.id}
            data-agent-run-slug={run.agent_slug}
            className={cn("rounded-lg border border-border bg-card overflow-hidden transition-shadow", focusAgentSlug === run.agent_slug && "ring-2 ring-primary/35 shadow-md")}
          >
            <button
              onClick={() => setOpenRun((prev) => ({ ...prev, [run.id]: !isOpen }))}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-secondary/50 hover:bg-secondary/70 transition-colors text-left border-b border-border"
            >
              <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !isOpen && "-rotate-90")} />
              <Database className="size-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-bold text-foreground flex-1 truncate">{displayName(run.agent_slug)}</span>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border",
                run.status === "failed" ? "bg-alert-soft text-alert border-alert/30"
                : run.outcome === "no_data" ? "bg-warning-soft text-warning-foreground border-warning/30"
                : run.status === "pending_review" ? "bg-primary/10 text-primary border-primary/20"
                : "bg-success-soft text-success border-success/20")}>
                {run.status === "failed" ? "failed"
                  : run.outcome === "no_data" ? "no data"
                  : run.status === "pending_review" ? "awaiting review"
                  : run.status}
              </span>
            </button>
            <div className="flex items-center gap-1 px-3 py-1.5 text-[9px] text-muted-foreground border-b border-border/60 bg-secondary/20">
              <Clock className="size-2.5" /> {fmtTime(run.completed_at ?? run.started_at) || "—"}
            </div>
            {isOpen && (
              <div>
                {(run.outcome_reason || run.error) && (
                  <p className={cn("mx-3 mt-3 rounded-lg border px-3 py-2 text-[10px]", run.status === "failed" ? "border-alert/25 bg-alert-soft text-alert" : "border-warning/25 bg-warning-soft text-warning-foreground")}>
                    {run.status === "failed" ? run.error : run.outcome_reason}
                  </p>
                )}
                {/* Section toggles */}
                <div className="flex items-center gap-1 px-2 pt-2">
                  <SectionTab active={sec === "attributes"} onClick={() => toggleSec("attributes")} icon={ListTree} label={`Attributes (${attrs.length})`} />
                  <SectionTab active={sec === "thinking"} onClick={() => toggleSec("thinking")} icon={Brain} label={`Thinking (${steps.length})`} />
                </div>

                {sec === "attributes" && (
                  <div className="p-1">
                    {attrs.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic px-2 py-3 text-center">This run returned no attribute values.</p>
                    )}
                    {groups.map(({ source, items }) => (
                      <div key={source} className="border-b border-border/50 last:border-b-0">
                        <div className="px-3 py-1.5 bg-secondary/20 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                          <span className="truncate">{source}</span><span className="shrink-0 ml-2">{items.length}</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {items.map(({ name, value }, i) => (
                            <div key={`${name}-${i}`} className="flex items-start gap-2 px-3 py-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground w-[42%] shrink-0">{fmtLabel(name)}</span>
                              <span className="text-[11px] text-foreground flex-1 min-w-0 break-words">
                                {value || <span className="italic text-muted-foreground/40">—</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sec === "thinking" && (
                  <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
                    {steps.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic text-center py-2">No thinking log recorded for this run.</p>
                    )}
                    {steps.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground font-mono leading-snug">
                        <span className="text-primary/50 mr-1">›</span>{s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTab({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: typeof Brain; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-colors",
        active ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}

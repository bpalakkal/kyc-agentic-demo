/**
 * AgentRunsPanel — right-panel tab showing the LATEST run per agent (all stages:
 * sourcing, due diligence, screening) for a case. Each run expands into two
 * sections:
 *   - Thinking    — the persisted step/thinking log (agent_runs.steps, migration 009)
 *   - Attributes  — the values the run returned, pivoted by lineage source
 *                   (from agent_runs.raw_output, migration 008)
 */
import { useEffect, useMemo, useState } from "react";
import { Database, ChevronDown, Clock, Loader2, Inbox, Brain, ListTree, RefreshCw, CheckCircle2 } from "lucide-react";
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
  outcome?: "data_found" | "no_data" | "manual_review" | null;
  outcome_reason?: string | null;
  error?: string | null;
  parent_run_id?: string | null;
  run_phase?: "orchestrator" | "pre" | "main" | "post";
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
type RunSection = "summary" | "attributes";

function categoryFor(slug: string, category?: string) {
  if (category) return category;
  if (slug === "screening" || slug.includes("screening")) return "screening";
  if (slug === "exception-routing") return "exception_routing";
  if (slug.startsWith("ria-") || slug.includes("due-diligence")) return "due_diligence";
  return "sourcing";
}

function summaryFirst(category: string) {
  return ["due_diligence", "screening", "exception_routing"].includes(category);
}

function runSummary(run: AgentRun, category: string, attributeCount: number) {
  if (run.status === "failed") return run.error || "The agent run failed before it could complete its assessment.";
  if (run.outcome_reason) return run.outcome_reason;
  if (category === "screening") return "Screening completed and saved party-level match results and dispositions.";
  if (category === "due_diligence") return "Due diligence assessed the available evidence and recorded verification decisions, findings, or exceptions.";
  if (category === "exception_routing") return "Exception routing evaluated the consolidated case evidence and applied routing policy.";
  if (attributeCount) return `${attributeCount} sourced attribute value${attributeCount === 1 ? " was" : "s were"} returned for review.`;
  return "The agent completed without returning a new attribute value.";
}

function emptyAttributesMessage(run: AgentRun, category: string) {
  if (run.agent_slug === "document-processing-flow") {
    return "Document processing delegates extraction to a document-specific digitizer. Review that child agent run for extracted values.";
  }
  if (category === "screening") return "Screening produces party matches and dispositions rather than KYC attribute values. Review the Run Summary and Screening tab.";
  if (category === "due_diligence") return "This agent assessed existing evidence and recorded verification decisions or exceptions; a new sourced value was not expected.";
  if (category === "exception_routing") return "Exception routing produces decisions and assignments rather than new attribute values.";
  return "This sourcing run returned no new attribute values.";
}

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<Record<string, boolean>>({});
  const [openGroup, setOpenGroup] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<Record<string, RunSection | null>>({});
  const { data: registry = [] } = useAgentRegistry();

  const displayName = (slug: string) => registry.find((a) => a.slug === slug)?.display_name ?? fmtLabel(slug);
  const runCategory = (slug: string) => categoryFor(slug, registry.find((a) => a.slug === slug)?.category);

  useEffect(() => {
    if (!kycRef) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/runs`)
      .then((r) => {
        if (!r.ok) throw new Error(`Unable to load agent runs (HTTP ${r.status})`);
        return r.json();
      })
      .then((data: AgentRun[]) => {
        if (!cancelled) {
          setRuns(Array.isArray(data) ? data : []);
          setLastUpdated(new Date());
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load agent runs");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kycRef, refreshKey]);

  useEffect(() => {
    if (!kycRef) return;
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), 10000);
    return () => window.clearInterval(timer);
  }, [kycRef]);

  const runGroups = useMemo(() => {
    const parents = new Map(runs.filter((run) => run.run_phase === "orchestrator").map((run) => [run.id, run]));
    const grouped = new Map<string, { id: string; parent?: AgentRun; runs: AgentRun[]; timestamp: string }>();
    for (const run of runs) {
      if (run.run_phase === "orchestrator" || !["complete", "pending_review", "failed"].includes(run.status)) continue;
      const id = run.parent_run_id || `standalone-${run.id}`;
      const timestamp = run.completed_at ?? run.started_at ?? "";
      const group = grouped.get(id) ?? { id, parent: run.parent_run_id ? parents.get(run.parent_run_id) : undefined, runs: [], timestamp };
      group.runs.push(run);
      if (timestamp > group.timestamp) group.timestamp = timestamp;
      grouped.set(id, group);
    }
    return [...grouped.values()]
      .map((group) => ({ ...group, runs: group.runs.sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? "")) }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [runs]);
  const visibleRunCount = runGroups.reduce((count, group) => count + group.runs.length, 0);

  useEffect(() => {
    if (!focusAgentSlug) return;
    const group = runGroups.find((candidate) => candidate.runs.some((run) => run.agent_slug === focusAgentSlug));
    const match = group?.runs.find((run) => run.agent_slug === focusAgentSlug);
    if (!match || !group) return;
    setOpenGroup((prev) => ({ ...prev, [group.id]: true }));
    setOpenRun((prev) => ({ ...prev, [match.id]: true }));
    const category = runCategory(match.agent_slug);
    const hasAttributes = (match.raw_output?.attributes ?? []).length > 0;
    setSection((prev) => ({ ...prev, [match.id]: summaryFirst(category) || !hasAttributes ? "summary" : "attributes" }));
    requestAnimationFrame(() => {
      document.querySelector(`[data-agent-run-slug="${CSS.escape(focusAgentSlug)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [focusAgentSlug, runGroups]);

  const toolbar = (
    <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
      <div>
        <p className="text-[11px] font-semibold">{runGroups.length} execution batch{runGroups.length === 1 ? "" : "es"} · {visibleRunCount} agent run{visibleRunCount === 1 ? "" : "s"}</p>
        <p className="text-[9px] text-muted-foreground">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Not refreshed yet"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setRefreshKey((key) => key + 1)}
        disabled={loading}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[10px] font-semibold text-primary shadow-sm hover:bg-primary/5 disabled:opacity-60"
        title="Refresh agent runs"
      >
        <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
      </button>
    </div>
  );

  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> <span className="text-sm">Loading agent runs…</span>
      </div>
    );
  }
  if (loadError) {
    return <div>{toolbar}<div className="rounded-xl border border-alert/25 bg-alert-soft px-4 py-5 text-center text-xs text-alert">{loadError}</div></div>;
  }
  if (runGroups.length === 0) {
    return (
      <div>{toolbar}<div className="flex flex-col items-center gap-2 text-muted-foreground py-10 text-center px-4">
        <Inbox className="size-6 opacity-40" />
        <p className="text-[12px]">No agent runs yet.</p>
        <p className="text-[10px] text-muted-foreground/70">Trigger an agent — its thinking log and returned values will appear here.</p>
      </div></div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto">
      {toolbar}
      {runGroups.map((group, groupIndex) => {
        const groupIsOpen = group.id in openGroup ? openGroup[group.id] : groupIndex === 0;
        const groupLabel = group.parent
          ? displayName(group.parent.agent_slug)
          : displayName(group.runs[0].agent_slug);
        return (
          <section key={group.id} className="overflow-hidden rounded-xl border border-border/80 bg-secondary/15">
            <button
              type="button"
              onClick={() => setOpenGroup((previous) => ({ ...previous, [group.id]: !groupIsOpen }))}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/40"
            >
              <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !groupIsOpen && "-rotate-90")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-foreground">{groupLabel}</span>
                <span className="block text-[9px] text-muted-foreground">{fmtTime(group.timestamp)} · {group.runs.length} agent{group.runs.length === 1 ? "" : "s"}</span>
              </span>
              {groupIndex > 0 && <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">Historical</span>}
            </button>
            {groupIsOpen && <div className="space-y-2 border-t border-border/70 p-2">
              {group.runs.map((run) => {
        const attrs = (run.raw_output?.attributes ?? []).filter((a) => attrName(a) && attrGroup(a) !== "wgq");
        const groups = groupBySource(attrs);
        const steps = run.steps ?? [];
        const isOpen = run.id in openRun ? openRun[run.id] : true;
        const category = runCategory(run.agent_slug);
        const prefersSummary = summaryFirst(category);
        const sec = run.id in section ? section[run.id] : (prefersSummary || attrs.length === 0 ? "summary" : "attributes");
        const toggleSec = (s: RunSection) =>
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
                : run.outcome === "manual_review" ? "bg-info-soft text-info-foreground border-info/30"
                : run.status === "pending_review" ? "bg-primary/10 text-primary border-primary/20"
                : "bg-success-soft text-success border-success/20")}>
                {run.status === "failed" ? "failed"
                  : run.outcome === "no_data" ? "no data"
                  : run.outcome === "manual_review" ? "manual review"
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
                  {prefersSummary && <SectionTab active={sec === "summary"} onClick={() => toggleSec("summary")} icon={Brain} label={`Run Summary (${steps.length})`} />}
                  {(attrs.length > 0 || !prefersSummary) && <SectionTab active={sec === "attributes"} onClick={() => toggleSec("attributes")} icon={ListTree} label={`Attributes (${attrs.length})`} />}
                  {!prefersSummary && <SectionTab active={sec === "summary"} onClick={() => toggleSec("summary")} icon={Brain} label={`Run Summary (${steps.length})`} />}
                </div>

                {sec === "attributes" && (
                  <div className="p-1">
                    {attrs.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic px-2 py-3 text-center">
                        {emptyAttributesMessage(run, category)}
                      </p>
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

                {sec === "summary" && (
                  <div className="p-3 max-h-80 overflow-y-auto">
                    <div className="mb-3 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-primary">Execution outcome</p>
                      <p className="text-[11px] leading-relaxed text-foreground">{runSummary(run, category, attrs.length)}</p>
                    </div>
                    {steps.length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic text-center py-2">No detailed execution steps were recorded for this historical run.</p>
                    )}
                    {steps.map((step, i) => (
                      <div key={i} className="relative flex gap-2.5 pb-3 last:pb-0">
                        {i < steps.length - 1 && <span className="absolute left-[6px] top-3 h-full w-px bg-border" />}
                        <CheckCircle2 className="relative z-[1] mt-0.5 size-3.5 shrink-0 bg-card text-success" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
              })}
            </div>}
          </section>
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

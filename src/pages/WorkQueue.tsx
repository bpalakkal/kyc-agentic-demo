/**
 * WorkQueue — entity selection table
 *
 * Displays KYC cases grouped by Dedicated Relationship Group (DRG).
 * Entities with no DRG are shown as flat rows below the groups.
 * Analysts select one or more entities and click "Review Selected" to open
 * the ExceptionReview page with the chosen entities pre-loaded.
 *
 * Data source
 * ──────────────────────────────────────────────────────────────
 * Fetches from GET /api/entities (Supabase-backed) at mount.
 * Falls back to an error banner if the server is unreachable.
 */

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, Lock, Loader2, X, Bot, Play, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { useAuth } from "@/contexts/AuthContext";
import { EMPTY_WORK_QUEUE_FILTERS, filterWorkQueueRows, type WorkQueueFilters } from "@/lib/workQueueFilters";
import { isAgentAvailable, useAgentRegistry } from "@/hooks/useAgentRegistry";

// ─── API types ────────────────────────────────────────────────────────────────

type ApiEntity = {
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
};

// ─── Row type ─────────────────────────────────────────────────────────────────

type FilterTab = "all" | "periodic-refresh" | "onboarding";

type Row = {
  id: string;
  name: string;
  kyc?: string;
  drg?: string;
  due: string;
  overdue?: boolean;
  confidence: string;
  customerType: string;
  jurisdiction: string;
  priority: "Low" | "Medium" | "High";
  risk: "Minimal" | "Moderate" | "Elevated";
  exc: number;
  status: "Complete" | "In Progress" | "Pending Feedback" | "Not Started";
  action: string;
  locked?: boolean;
  selectable?: boolean;
};

type Group = {
  id: string;
  name: string;
  priorityNote: string;
  priorityTone: "high" | "medium" | "low";
  rows: Row[];
};

type PreflightCase = { kycRef: string; entityName: string; eligible: boolean; reason: string | null };
type BatchItem = { id: string; kyc_ref: string; entity_name: string; status: "queued" | "running" | "complete" | "failed" | "skipped" | "cancelled"; eligibility_reason?: string | null; error?: string | null };
type AgentBatch = { id: string; agent_slug: string; status: string; total_count: number; queued_count: number; running_count: number; completed_count: number; failed_count: number; skipped_count: number; items: BatchItem[] };

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapRisk(r: ApiEntity["risk_rating"]): Row["risk"] {
  if (r === "High") return "Elevated";
  if (r === "Medium") return "Moderate";
  return "Minimal";
}

function mapStatus(s: string): Row["status"] {
  switch (s) {
    case "complete":          return "Complete";
    case "pending_feedback":  return "Pending Feedback";
    case "escalated":         return "In Progress";
    default:                  return "Not Started";
  }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toRow(e: ApiEntity): Row {
  const today = new Date();
  const due = e.due_date ? new Date(e.due_date) : null;
  return {
    id: e.kyc_ref,
    name: e.entity_name,
    kyc: e.kyc_ref,
    drg: e.drgs?.name ?? undefined,
    due: formatDate(e.due_date),
    overdue: due ? due < today : false,
    confidence: "High",
    customerType: e.entity_type ?? "—",
    jurisdiction: e.jurisdiction ?? "—",
    priority: e.priority,
    risk: mapRisk(e.risk_rating),
    exc: e.open_exceptions_count,
    status: mapStatus(e.status),
    action: "Periodic Refresh",
  };
}

// ─── Display builder ──────────────────────────────────────────────────────────

function buildDisplay(
  rows: Row[],
  drgByKyc: Record<string, string>,
  activeTab: FilterTab,
): { groups: Group[]; ungrouped: Row[] } {
  const filtered = rows.filter((row) => {
    if (activeTab === "all") return true;
    if (activeTab === "periodic-refresh") return row.action === "Periodic Refresh";
    if (activeTab === "onboarding") return row.action === "Onboarding";
    return true;
  });

  const drgMap = new Map<string, Row[]>();
  const ungrouped: Row[] = [];

  for (const row of filtered) {
    const drg = drgByKyc[row.kyc ?? ""];
    if (drg) {
      if (!drgMap.has(drg)) drgMap.set(drg, []);
      drgMap.get(drg)!.push(row);
    } else {
      ungrouped.push(row);
    }
  }

  // DRGs with only 1 case → flat rows
  for (const [, drgRows] of drgMap.entries()) {
    if (drgRows.length === 1) ungrouped.push(drgRows[0]);
  }
  const multiDrgMap = new Map([...drgMap.entries()].filter(([, r]) => r.length > 1));

  const groups: Group[] = Array.from(multiDrgMap.entries()).map(([drgName, drgRows], i) => {
    const highCount = drgRows.filter((r) => r.priority === "High").length;
    const tone: Group["priorityTone"] = highCount > 0 ? "high" : drgRows.some((r) => r.priority === "Medium") ? "medium" : "low";
    return {
      id: `drg-${i}`,
      name: drgName,
      priorityNote: `${highCount} High Priority Item${highCount !== 1 ? "s" : ""}`,
      priorityTone: tone,
      rows: drgRows,
    };
  });

  return { groups, ungrouped };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const COLS = "grid-cols-[40px_minmax(220px,1.6fr)_180px_110px_minmax(180px,1.4fr)_110px_100px_110px_70px_140px_140px]";

const statusColor = (s: Row["status"]) => {
  switch (s) {
    case "Complete":         return "text-success";
    case "In Progress":      return "text-primary";
    case "Pending Feedback": return "text-[hsl(30_70%_40%)]";
    case "Not Started":      return "text-muted-foreground";
  }
};

const FilterSelect = ({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-primary">
      <option value="all">All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const EntityRow = ({
  r,
  selected,
  onToggle,
  indent = false,
  batchStatus,
}: {
  r: Row;
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  indent?: boolean;
  batchStatus?: BatchItem;
}) => (
  <div
    className={cn(
      `grid ${COLS} gap-2 px-4 py-3 items-center text-sm border-t border-border/60 hover:bg-secondary/30`,
      indent && "pl-8"
    )}
  >
    <span className="flex justify-center">
      {r.locked ? (
        <Lock className="size-4 text-muted-foreground/50" title="Assigned to another analyst — read only" />
      ) : (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggle(r.id, e.target.checked)}
          className="size-4 accent-primary"
        />
      )}
    </span>
    <Link
      to={`/work-queue/review/${r.kyc ?? r.id}`}
      state={{ entities: [{ name: r.name, kyc: r.kyc ?? r.id, drg: r.drg }] }}
      className={cn(
        "text-[13px] hover:underline hover:text-primary transition-colors truncate",
        r.locked ? "text-muted-foreground pointer-events-none" : "text-foreground"
      )}
      onClick={(e) => e.stopPropagation()}
    >{r.name}</Link>
    <span>
      <Chip variant={r.overdue ? "high" : "medium"} className="font-medium">{r.due}</Chip>
    </span>
    <span className="text-[13px] text-muted-foreground">{r.confidence}</span>
    <span className="text-[13px] text-muted-foreground truncate">{r.customerType}</span>
    <span className="text-[13px] text-muted-foreground">{r.jurisdiction}</span>
    <span className="text-[13px]">{r.priority}</span>
    <span className={cn(
      "text-[13px] font-medium",
      r.risk === "Elevated" && "text-alert",
      r.risk === "Moderate" && "text-[hsl(30_70%_40%)]",
      r.risk === "Minimal"  && "text-success"
    )}>{r.risk}</span>
    <span className="text-[13px]">{r.exc}</span>
    <span className={cn("text-[13px] font-medium", statusColor(r.status))}>{r.status}</span>
    <span className="text-[13px] text-muted-foreground">
      {batchStatus ? (
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", batchStatus.status === "complete" ? "border-success/30 bg-success-soft text-success" : batchStatus.status === "failed" ? "border-alert/30 bg-alert-soft text-alert" : batchStatus.status === "running" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground")} title={batchStatus.error ?? batchStatus.eligibility_reason ?? undefined}>
          {batchStatus.status === "running" && <Loader2 className="size-2.5 animate-spin" />}{batchStatus.status}
        </span>
      ) : r.action}
    </span>
  </div>
);

// ─── Page component ───────────────────────────────────────────────────────────

const WorkQueue = () => {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "My";
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<WorkQueueFilters>(EMPTY_WORK_QUEUE_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [apiEntities, setApiEntities] = useState<ApiEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: registry = [] } = useAgentRegistry();
  const topAgents = registry.filter((agent) => agent.enabled !== false && agent.user_triggerable !== false && agent.top_level_trigger && isAgentAvailable(agent));
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentSlug, setAgentSlug] = useState("");
  const [preflight, setPreflight] = useState<{ agent: { slug: string; displayName: string; category: string }; cases: PreflightCase[] } | null>(null);
  const [batch, setBatch] = useState<AgentBatch | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${AGENT_API_BASE}/api/entities`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(`Server returned ${r.status}: ${body?.error ?? 'unknown error'}`);
        }
        return r.json() as Promise<ApiEntity[]>;
      })
      .then((data) => { setApiEntities(data); setLoading(false); })
      .catch((err: Error) => { setError(err.message); setLoading(false); });
  }, []);

  const rows = useMemo(() => apiEntities.map(toRow), [apiEntities]);
  const filteredRows = useMemo(() => filterWorkQueueRows(rows, query, filters), [rows, query, filters]);
  const jurisdictions = useMemo(() => [...new Set(rows.map((row) => row.jurisdiction).filter((value) => value !== "—"))].sort(), [rows]);
  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length;
  const drgByKyc = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of apiEntities) {
      if (e.drgs?.name) m[e.kyc_ref] = e.drgs.name;
    }
    return m;
  }, [apiEntities]);

  const { groups, ungrouped } = useMemo(
    () => buildDisplay(filteredRows, drgByKyc, activeTab),
    [filteredRows, drgByKyc, activeTab],
  );

  // Open first group by default
  const firstGroupId = groups[0]?.id;
  const effectiveOpen = useMemo<Record<string, boolean>>(() => {
    if (firstGroupId && !Object.keys(openGroups).includes(firstGroupId)) {
      return { [firstGroupId]: true, ...openGroups };
    }
    return openGroups;
  }, [groups, openGroups, firstGroupId]);

  const selectedEntities = rows
    .filter((r) => selected[r.id])
    .map((r) => ({ name: r.name, kyc: r.kyc ?? r.id, drg: drgByKyc[r.id] ?? undefined }));
  const selectedCount = selectedEntities.length;
  const batchItemsByKyc = useMemo(() => new Map((batch?.items ?? []).map((item) => [item.kyc_ref, item])), [batch]);

  useEffect(() => {
    if (!agentDialogOpen || agentSlug || !topAgents.length) return;
    setAgentSlug(topAgents[0].slug);
  }, [agentDialogOpen, agentSlug, topAgents]);

  useEffect(() => {
    if (!batch?.id || ["complete", "partial", "failed", "cancelled"].includes(batch.status)) return;
    const timer = window.setInterval(async () => {
      const response = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-run-batches/${batch.id}`);
      if (response.ok) setBatch(await response.json());
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [batch?.id, batch?.status]);

  const checkEligibility = async () => {
    if (!agentSlug || !selectedEntities.length) return;
    setBatchBusy(true); setBatchError(null); setPreflight(null);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-runs/preflight`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug, kycRefs: selectedEntities.map((entity) => entity.kyc) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Preflight HTTP ${response.status}`);
      setPreflight(data);
    } catch (error) { setBatchError(error instanceof Error ? error.message : "Preflight failed"); }
    finally { setBatchBusy(false); }
  };

  const startBatch = async () => {
    if (!preflight?.cases.some((item) => item.eligible)) return;
    setBatchBusy(true); setBatchError(null);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const response = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-run-batches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug, kycRefs: selectedEntities.map((entity) => entity.kyc), idempotencyKey }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Batch HTTP ${response.status}`);
      setSelected({});
      const statusResponse = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-run-batches/${data.batchId}`);
      if (!statusResponse.ok) throw new Error(`Batch status HTTP ${statusResponse.status}`);
      setBatch(await statusResponse.json()); setAgentDialogOpen(false); setPreflight(null);
    } catch (error) { setBatchError(error instanceof Error ? error.message : "Could not start batch"); }
    finally { setBatchBusy(false); }
  };

  const batchAction = async (action: "cancel" | "retry") => {
    if (!batch) return;
    setBatchBusy(true); setBatchError(null);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-run-batches/${batch.id}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `${action} HTTP ${response.status}`);
      const statusResponse = await apiFetch(`${AGENT_API_BASE}/api/work-queue/agent-run-batches/${batch.id}`);
      if (statusResponse.ok) setBatch(await statusResponse.json());
    } catch (error) { setBatchError(error instanceof Error ? error.message : `${action} failed`); }
    finally { setBatchBusy(false); }
  };

  const handleToggle = (id: string, checked: boolean) =>
    setSelected((s) => ({ ...s, [id]: checked }));

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",              label: "All" },
    { id: "periodic-refresh", label: "Periodic Refresh" },
    { id: "onboarding",       label: "Onboarding" },
  ];

  return (
    <div className="page-shell">
      <div className="mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="page-title">Work Queue</h1>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
            {loading ? "…" : `${apiEntities.length} entities`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Select entities to begin a review session. Locked rows are read-only.</p>
      </div>

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              className="w-full h-11 pl-10 pr-12 text-sm rounded-xl border border-input bg-card shadow-sm outline-none hover:border-foreground/20 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              placeholder="Search entities…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search work queue entities"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="size-4" />
              </button>
            ) : <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{loading ? "…" : filteredRows.length}</span>}
          </div>

          <div className="relative">
            <button type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-controls="work-queue-filters" className={cn("h-11 px-4 rounded-xl border bg-card text-sm font-semibold shadow-sm flex items-center gap-2 hover:bg-info-soft transition-colors", activeFilterCount ? "border-primary text-primary" : "border-input text-foreground")}>
              <SlidersHorizontal className="size-4" /> Filter
              {activeFilterCount > 0 && <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px]">{activeFilterCount}</span>}
            </button>
            {filterOpen && (
              <div id="work-queue-filters" className="absolute z-30 left-0 top-12 w-[300px] rounded-xl border border-border bg-popover p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Filter work queue</span>
                  <button type="button" onClick={() => setFilterOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close filters"><X className="size-4" /></button>
                </div>
                <div className="grid gap-3">
                  <FilterSelect label="Priority" value={filters.priority} options={["High", "Medium", "Low"]} onChange={(priority) => setFilters((current) => ({ ...current, priority: priority as WorkQueueFilters["priority"] }))} />
                  <FilterSelect label="Risk" value={filters.risk} options={["Elevated", "Moderate", "Minimal"]} onChange={(risk) => setFilters((current) => ({ ...current, risk: risk as WorkQueueFilters["risk"] }))} />
                  <FilterSelect label="Status" value={filters.status} options={["Complete", "In Progress", "Pending Feedback", "Not Started"]} onChange={(status) => setFilters((current) => ({ ...current, status: status as WorkQueueFilters["status"] }))} />
                  <FilterSelect label="Jurisdiction" value={filters.jurisdiction} options={jurisdictions} onChange={(jurisdiction) => setFilters((current) => ({ ...current, jurisdiction }))} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <button type="button" onClick={() => setFilters(EMPTY_WORK_QUEUE_FILTERS)} disabled={!activeFilterCount} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40">Clear filters</button>
                  <button type="button" onClick={() => setFilterOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Apply</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2 p-1 rounded-xl bg-secondary/70 border border-border shadow-inner">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "px-4 py-1 rounded-md text-sm transition-colors",
                  activeTab === t.id
                    ? "bg-card shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-card/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setAgentDialogOpen(true); setPreflight(null); setBatchError(null); }} disabled={selectedCount === 0 || selectedCount > 25 || topAgents.length === 0} className="h-10 px-4 rounded-lg border border-primary text-primary bg-card text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/5" title={selectedCount > 25 ? "Select no more than 25 cases" : undefined}>
          <Bot className="size-4" /> Run Agent <span className="size-5 rounded-full bg-primary/10 grid place-items-center text-[11px]">{selectedCount}</span>
        </button>
        <Link
          to={`/work-queue/review/${selectedEntities[0]?.kyc ?? ''}`}
          state={{ entities: selectedEntities }}
          onClick={(e) => {
            if (selectedCount === 0) e.preventDefault();
            else setSelected({});
          }}
          className={cn(
            "h-10 px-5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all",
            selectedCount > 0
              ? "bg-primary text-primary-foreground hover:opacity-95 cursor-pointer"
              : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none"
          )}
          aria-disabled={selectedCount === 0}
        >
          Review Selected
          <span className="size-5 rounded-full bg-white/20 grid place-items-center text-[11px]">{selectedCount}</span>
        </Link>
        </div>
      </div>

      {batch && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold">Batch: {registry.find((agent) => agent.slug === batch.agent_slug)?.display_name ?? batch.agent_slug}</p><p className="text-xs text-muted-foreground mt-0.5 capitalize">{batch.status} · {batch.completed_count} complete · {batch.running_count} running · {batch.queued_count} queued · {batch.failed_count} failed · {batch.skipped_count} skipped</p></div>
            <div className="flex gap-2">
              {batch.failed_count > 0 && <button type="button" disabled={batchBusy} onClick={() => void batchAction("retry")} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium flex items-center gap-1"><RotateCcw className="size-3" /> Retry failed</button>}
              {["queued", "running"].includes(batch.status) && <button type="button" disabled={batchBusy} onClick={() => void batchAction("cancel")} className="rounded-md border border-alert/30 px-3 py-1.5 text-xs font-medium text-alert">Cancel queued</button>}
              <button type="button" onClick={() => setBatch(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close batch panel"><X className="size-4" /></button>
            </div>
          </div>
          {batchError && <p className="mt-2 text-xs text-alert">{batchError}</p>}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        {/* Header row */}
        <div className={`grid ${COLS} gap-2 px-4 py-3 bg-muted/60 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
          <span />
          <span>Entity Name ⇅</span>
          <span>Due Date ↑</span>
          <span>Confidence ⇅</span>
          <span>Customer Type</span>
          <span>Jurisdiction</span>
          <span>Priority</span>
          <span>Risk ⇅</span>
          <span># Exc ⇅</span>
          <span>Status ⇅</span>
          <span>Action ⇅</span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading entities…
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="py-16 text-center text-sm text-alert">
            Failed to load entities: {error}
            <br />
            <span className="text-muted-foreground text-xs">Make sure the server is running (<code>npm run server</code>)</span>
          </div>
        )}

        {/* DRG groups */}
        {!loading && !error && groups.map((g) => {
          const open = !!effectiveOpen[g.id];
          return (
            <div key={g.id} className="border-b border-border last:border-0">
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
                className={cn(
                  "w-full grid grid-cols-[40px_40px_1fr] items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors",
                  g.priorityTone === "high"   && "border-l-2 border-l-alert",
                  g.priorityTone === "medium" && "border-l-2 border-l-warning",
                  g.priorityTone === "low"    && "border-l-2 border-l-muted-foreground/30"
                )}
              >
                <span className="size-4 rounded border border-border" />
                <span className="text-muted-foreground">
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{g.name}</span>
                  <span className={cn(
                    "text-xs",
                    g.priorityTone === "high"   && "text-alert",
                    g.priorityTone === "medium" && "text-[hsl(30_70%_40%)]",
                    g.priorityTone === "low"    && "text-success"
                  )}>{g.priorityNote}</span>
                </div>
              </button>

              {open && g.rows.map((r) => (
                <EntityRow
                  key={r.id}
                  r={r}
                  selected={!!selected[r.id]}
                  onToggle={handleToggle}
                  indent
                  batchStatus={batchItemsByKyc.get(r.kyc ?? r.id)}
                />
              ))}
            </div>
          );
        })}

        {/* Ungrouped entities */}
        {!loading && !error && ungrouped.length > 0 && (
          <>
            {groups.length > 0 && (
              <div className="px-4 py-2 bg-secondary/30 border-t border-border">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  No DRG assigned · {ungrouped.length} {ungrouped.length === 1 ? "entity" : "entities"}
                </span>
              </div>
            )}
            {ungrouped.map((r) => (
              <EntityRow
                key={r.id}
                r={r}
                selected={!!selected[r.id]}
                onToggle={handleToggle}
                batchStatus={batchItemsByKyc.get(r.kyc ?? r.id)}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && !error && groups.length === 0 && ungrouped.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No cases match the selected filter.
          </div>
        )}
      </div>

      {agentDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Run top-level agent">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border p-5"><div><h2 className="text-lg font-semibold">Run top-level agent</h2><p className="text-sm text-muted-foreground">Preflight {selectedCount} selected case{selectedCount === 1 ? "" : "s"} before creating the batch.</p></div><button type="button" onClick={() => setAgentDialogOpen(false)}><X className="size-5 text-muted-foreground" /></button></div>
            <div className="p-5 space-y-4">
              <label className="grid gap-1.5 text-sm font-medium">Agent<select value={agentSlug} onChange={(event) => { setAgentSlug(event.target.value); setPreflight(null); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{topAgents.map((agent) => <option key={agent.slug} value={agent.slug}>{agent.display_name}</option>)}</select></label>
              {!preflight && <button type="button" disabled={batchBusy || !agentSlug} onClick={() => void checkEligibility()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 flex items-center gap-2">{batchBusy && <Loader2 className="size-4 animate-spin" />} Check eligibility</button>}
              {batchError && <div className="rounded-md border border-alert/30 bg-alert-soft p-3 text-sm text-alert flex gap-2"><AlertCircle className="size-4 mt-0.5" />{batchError}</div>}
              {preflight && <div className="rounded-lg border border-border overflow-hidden"><div className="grid grid-cols-[1fr_120px_1.4fr] gap-3 bg-muted/60 px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground"><span>Case</span><span>Eligibility</span><span>Reason</span></div><div className="max-h-72 overflow-y-auto">{preflight.cases.map((item) => <div key={item.kycRef} className="grid grid-cols-[1fr_120px_1.4fr] gap-3 border-t border-border px-3 py-2.5 text-xs"><span><span className="font-medium block">{item.entityName}</span><span className="text-muted-foreground">{item.kycRef}</span></span><span className={cn("flex items-center gap-1 font-medium", item.eligible ? "text-success" : "text-alert")}>{item.eligible ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}{item.eligible ? "Ready" : "Blocked"}</span><span className="text-muted-foreground">{item.reason ?? "—"}</span></div>)}</div></div>}
            </div>
            <div className="flex items-center justify-between border-t border-border p-4"><span className="text-xs text-muted-foreground">{preflight ? `${preflight.cases.filter((item) => item.eligible).length} eligible · ${preflight.cases.filter((item) => !item.eligible).length} blocked` : "Maximum 25 cases · 3 run concurrently"}</span><div className="flex gap-2"><button type="button" onClick={() => setAgentDialogOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>{preflight && <button type="button" disabled={batchBusy || !preflight.cases.some((item) => item.eligible)} onClick={() => void startBatch()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 flex items-center gap-2">{batchBusy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run {preflight.cases.filter((item) => item.eligible).length} eligible</button>}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkQueue;

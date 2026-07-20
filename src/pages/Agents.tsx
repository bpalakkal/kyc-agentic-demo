/**
 * Agent Inventory — live view of the agent registry.
 * Reads from GET /api/agents.
 */
import { useEffect, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight, Pencil, ShieldCheck } from "lucide-react";
import { isAgentAvailable, useAgentRegistry, type RegistryAgent } from "@/hooks/useAgentRegistry";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PageSize = 10 | 20 | 50 | "all";
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50, "all"];

const relationshipFields = [
  ["pre_agents", "Pre-agents"], ["child_agents", "Child agents"], ["post_agents", "Post-agents"],
] as const;

function EditAgentDialog({ agent, agents, onClose, onSaved }: {
  agent: RegistryAgent; agents: RegistryAgent[]; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({ ...agent });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RegistryAgent>(key: K, value: RegistryAgent[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleRelation = (field: "pre_agents" | "child_agents" | "post_agents", slug: string) => {
    const values = draft[field] ?? [];
    set(field, values.includes(slug) ? values.filter((value) => value !== slug) : [...values, slug]);
  };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents/${encodeURIComponent(agent.slug)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.display_name, description: draft.description ?? "", enabled: draft.enabled,
          user_triggerable: draft.user_triggerable ?? false, top_level_trigger: draft.top_level_trigger ?? false,
          execution_mode: draft.execution_mode ?? "generic", pre_agents: draft.pre_agents ?? [],
          child_agents: draft.execution_mode === "orchestrator" ? (draft.child_agents ?? []) : [],
          post_agents: draft.post_agents ?? [], child_execution: draft.child_execution ?? "parallel",
          failure_policy: draft.failure_policy ?? "fail_fast", sort_order: draft.sort_order ?? 0,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Save failed (HTTP ${response.status})`);
      await onSaved(); toast.success(`${draft.display_name} updated`); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update agent"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Agent Register</DialogTitle><DialogDescription>{agent.slug} · changes are validated and audited.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">Display name<Input value={draft.display_name} onChange={(e) => set("display_name", e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold">Sort order<Input type="number" min={0} value={draft.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} /></label>
          <label className="space-y-1 text-xs font-semibold sm:col-span-2">Description<Textarea value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold">Execution mode
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.execution_mode ?? "generic"} onChange={(e) => set("execution_mode", e.target.value as RegistryAgent["execution_mode"])}>
              <option value="generic">Generic leaf</option><option value="screening">Screening leaf</option><option value="orchestrator">Orchestrator</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-xs">
            {(["enabled", "user_triggerable", "top_level_trigger"] as const).map((field) => (
              <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(draft[field])} onChange={(e) => set(field, e.target.checked)} />{field === "enabled" ? "Enabled" : field === "user_triggerable" ? "User triggerable" : "Top trigger"}</label>
            ))}
          </div>
          {draft.execution_mode === "orchestrator" && <>
            <label className="space-y-1 text-xs font-semibold">Child execution<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.child_execution ?? "parallel"} onChange={(e) => set("child_execution", e.target.value as RegistryAgent["child_execution"])}><option value="parallel">Parallel</option><option value="sequential">Sequential</option></select></label>
            <label className="space-y-1 text-xs font-semibold">Failure policy<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.failure_policy ?? "fail_fast"} onChange={(e) => set("failure_policy", e.target.value as RegistryAgent["failure_policy"])}><option value="continue">Continue</option><option value="fail_fast">Fail fast</option></select></label>
          </>}
          {relationshipFields.map(([field, label]) => (field !== "child_agents" || draft.execution_mode === "orchestrator") && (
            <fieldset key={field} className="rounded-xl border p-3 sm:col-span-2"><legend className="px-1 text-xs font-semibold">{label}</legend>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pt-2 sm:grid-cols-3">
                {agents.filter((option) => option.slug !== agent.slug).map((option) => <label key={option.slug} className="flex items-start gap-2 text-xs"><input className="mt-0.5" type="checkbox" checked={(draft[field] ?? []).includes(option.slug)} onChange={() => toggleRelation(field, option.slug)} /><span>{option.display_name}<span className="block text-[10px] text-muted-foreground">{option.slug}</span></span></label>)}
              </div>
            </fieldset>
          ))}
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <RefreshCw className="mr-1.5 size-4 animate-spin" />}Save configuration</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Agents() {
  const { data: agents = [], isLoading, isError, error, refetch, isFetching } = useAgentRegistry();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [editing, setEditing] = useState<RegistryAgent | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => { apiFetch(`${AGENT_API_BASE}/api/agents/access`).then((r) => r.ok ? r.json() : { canEdit: false }).then((body) => setCanEdit(Boolean(body.canEdit))).catch(() => setCanEdit(false)); }, []);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(agents.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = pageSize === "all"
    ? agents
    : agents.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function changePageSize(val: PageSize) {
    setPageSize(val);
    setPage(0);
  }

  const start = pageSize === "all" ? 1 : safePage * pageSize + 1;
  const end   = pageSize === "all" ? agents.length : Math.min((safePage + 1) * pageSize, agents.length);
  const readyCount = agents.filter(isAgentAvailable).length;

  return (
    <div className="page-shell space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Agentic workforce</p>
          <h1 className="page-title">Agent Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Live registry · {agents.length} agent{agents.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Registered</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length}</p></div>
        <div className="rounded-2xl border border-success/20 bg-success-soft p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-success">Ready</p><p className="mt-1 text-2xl font-bold tabular-nums text-success">{readyCount}</p></div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Readiness</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length ? Math.round((readyCount / agents.length) * 100) : 0}%</p></div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading registry…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load agents: {(error as Error)?.message}
        </p>
      )}
      {!isLoading && !isError && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>CIP Classification</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-20">Manage</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a) => {
                  const cipValue = a.cip_classification && a.cip_classification !== "all"
                    ? a.cip_classification
                    : null;
                  return (
                    <TableRow key={a.slug}>
                      <TableCell className="font-medium">
                        {a.display_name}
                        {a.description && (
                          <div className="text-xs font-normal text-muted-foreground">{a.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.slug}</TableCell>
                      <TableCell className="text-sm">{a.category ?? "—"}</TableCell>
                      <TableCell className="text-sm max-w-[180px]">
                        {cipValue
                          ? <span title={cipValue} className="block truncate text-xs">{cipValue}</span>
                          : <span className="text-muted-foreground text-xs">All</span>}
                      </TableCell>
                      <TableCell className="text-sm">{a.jurisdiction ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.runner_type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.output_type ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={isAgentAvailable(a) ? "default" : "secondary"}
                          title={a.readiness_error ?? undefined}
                        >
                          {!a.enabled ? "Disabled" : isAgentAvailable(a) ? "Ready" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      {canEdit && <TableCell><Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(a)}><Pencil className="mr-1 size-3" /> Edit</Button></TableCell>}
                    </TableRow>
                  );
                })}
                {agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8} className="py-8 text-center text-sm text-muted-foreground">
                      No agents registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => changePageSize(v === "all" ? "all" : Number(v) as PageSize)}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s === "all" ? "All" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              {agents.length > 0 && (
                <span>
                  {start}–{end} of {agents.length}
                </span>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={pageSize === "all" || safePage === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={pageSize === "all" || safePage >= totalPages - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      {canEdit && <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Registry edits are server-validated and written to the audit log.</div>}
      {editing && <EditAgentDialog agent={editing} agents={agents} onClose={() => setEditing(null)} onSaved={refetch} />}
    </div>
  );
}

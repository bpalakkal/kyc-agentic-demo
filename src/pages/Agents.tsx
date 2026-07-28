/**
 * Agent Inventory — live view of the agent registry.
 * Reads from GET /api/agents.
 */
import { useEffect, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight, Pencil, ShieldCheck, Search, X, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { isAgentAvailable, useAgentRegistry, useModelProfiles, type RegistryAgent } from "@/hooks/useAgentRegistry";
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
import { enumValues } from "@schema";

type PageSize = 10 | 20 | 50 | "all";
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50, "all"];
const CIP_CLASSIFICATIONS = enumValues("CIPClassification");
const MODEL_PROFILE_LABELS: Record<string, string> = {
  "bedrock-claude-haiku": "Haiku · Bedrock",
  "bedrock-claude-sonnet": "Sonnet · Bedrock",
  "bedrock-claude-opus": "Opus · Bedrock",
  "anthropic-claude-haiku": "Haiku · Anthropic",
  "anthropic-claude-sonnet": "Sonnet · Anthropic",
  "anthropic-claude-opus": "Opus · Anthropic",
};

function modelProfileLabel(agent: RegistryAgent) {
  if (agent.execution_mode === "orchestrator") return "Inherited";
  if (!agent.model_profile) return "No LLM";
  return MODEL_PROFILE_LABELS[agent.model_profile] ?? agent.model_profile;
}

const relationshipFields = [
  ["pre_agents", "Pre-agents"], ["child_agents", "Child agents"], ["post_agents", "Post-agents"],
] as const;

function RelationshipEditor({ label, required, agents, values, onToggle, onMove }: {
  label: string; required?: boolean; agents: RegistryAgent[]; values: string[];
  onToggle: (slug: string) => void; onMove: (from: number, to: number) => void;
}) {
  const bySlug = new Map(agents.map((agent) => [agent.slug, agent]));
  return (
    <fieldset className="rounded-xl border p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-semibold">{label}{required ? " (required)" : ""}</legend>
      {values.length > 0 && <div className="mb-3 space-y-1.5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Execution order</p>
        {values.map((slug, index) => <div key={slug} className="flex items-center gap-2 rounded-md border bg-secondary/30 px-2 py-1.5 text-xs">
          <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 font-bold text-primary">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{bySlug.get(slug)?.display_name ?? slug}<span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">{slug}</span></span>
          <Button type="button" variant="ghost" size="sm" className="size-7 p-0" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${slug} up`}><ArrowUp className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="sm" className="size-7 p-0" disabled={index === values.length - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${slug} down`}><ArrowDown className="size-3.5" /></Button>
        </div>)}
      </div>}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available agents</p>
      <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pt-2 sm:grid-cols-3">
        {agents.map((option) => <label key={option.slug} className="flex items-start gap-2 text-xs"><input className="mt-0.5" type="checkbox" checked={values.includes(option.slug)} onChange={() => onToggle(option.slug)} /><span>{option.display_name}<span className="block text-[10px] text-muted-foreground">{option.slug}{!option.enabled ? " · disabled" : ""}</span></span></label>)}
      </div>
    </fieldset>
  );
}

function EditAgentDialog({ agent, agents, onClose, onSaved }: {
  agent: RegistryAgent; agents: RegistryAgent[]; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({ ...agent });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: modelProfiles = [] } = useModelProfiles();
  const set = <K extends keyof RegistryAgent>(key: K, value: RegistryAgent[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleRelation = (field: "pre_agents" | "child_agents" | "post_agents", slug: string) => {
    const values = draft[field] ?? [];
    set(field, values.includes(slug) ? values.filter((value) => value !== slug) : [...values, slug]);
  };
  const moveRelation = (field: "pre_agents" | "child_agents" | "post_agents", from: number, to: number) => {
    const values = [...(draft[field] ?? [])];
    const [moved] = values.splice(from, 1); values.splice(to, 0, moved); set(field, values);
  };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents/${encodeURIComponent(agent.slug)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.display_name, description: draft.description ?? "", cip_classification: draft.cip_classification ?? null, enabled: draft.enabled,
          user_triggerable: draft.user_triggerable ?? false, top_level_trigger: draft.top_level_trigger ?? false,
          execution_mode: draft.execution_mode ?? "generic", pre_agents: draft.pre_agents ?? [],
          child_agents: draft.execution_mode === "orchestrator" ? (draft.child_agents ?? []) : [],
          post_agents: draft.post_agents ?? [], child_execution: draft.child_execution ?? "parallel",
          failure_policy: draft.failure_policy ?? "fail_fast", sort_order: draft.sort_order ?? 0,
          model_profile: draft.execution_mode === "orchestrator" ? null : (draft.model_profile ?? null),
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
          <label className="space-y-1 text-xs font-semibold">CIP classification
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.cip_classification ?? "all"} onChange={(e) => set("cip_classification", e.target.value === "all" ? undefined : e.target.value)}>
              <option value="all">All classifications</option>{CIP_CLASSIFICATIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">Execution mode
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.execution_mode ?? "generic"} onChange={(e) => set("execution_mode", e.target.value as RegistryAgent["execution_mode"])}>
              <option value="generic">Generic leaf</option><option value="screening">Screening leaf</option><option value="orchestrator">Orchestrator</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">Model profile
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.model_profile ?? "none"}
              disabled={draft.execution_mode === "orchestrator"}
              onChange={(e) => set("model_profile", e.target.value === "none" ? null : e.target.value)}
            >
              <option value="none">{draft.execution_mode === "orchestrator" ? "Configured by child agents" : "No LLM"}</option>
              {modelProfiles.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.display_name}{profile.available ? "" : " (not ready)"}
                </option>
              ))}
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
            <RelationshipEditor key={field} label={label} required={field === "child_agents"} agents={agents.filter((option) => option.slug !== agent.slug)} values={draft[field] ?? []} onToggle={(slug) => toggleRelation(field, slug)} onMove={(from, to) => moveRelation(field, from, to)} />
          ))}
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <RefreshCw className="mr-1.5 size-4 animate-spin" />}Save configuration</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateOrchestratorDialog({ agents, onClose, onSaved }: {
  agents: RegistryAgent[]; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    slug: "", display_name: "", description: "", category: "sourcing", cip_classification: "",
    jurisdiction: "", output_type: "both", enabled: true, user_triggerable: true,
    top_level_trigger: false, pre_agents: [] as string[], child_agents: [] as string[],
    post_agents: [] as string[], child_execution: "parallel", failure_policy: "continue", sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof draft, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleRelation = (field: "pre_agents" | "child_agents" | "post_agents", slug: string) => {
    const values = draft[field];
    set(field, values.includes(slug) ? values.filter((value) => value !== slug) : [...values, slug]);
  };
  const moveRelation = (field: "pre_agents" | "child_agents" | "post_agents", from: number, to: number) => {
    const values = [...draft[field]];
    const [moved] = values.splice(from, 1); values.splice(to, 0, moved); set(field, values);
  };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Create failed (HTTP ${response.status})`);
      await onSaved(); toast.success(`${draft.display_name} created`); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create orchestrator"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Orchestrator</DialogTitle><DialogDescription>Create a registry-driven virtual agent from existing registered agents. No leaf runner is created.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">Slug<Input value={draft.slug} placeholder="us-regulatory-review" onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></label>
          <label className="space-y-1 text-xs font-semibold">Display name<Input value={draft.display_name} onChange={(e) => set("display_name", e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold sm:col-span-2">Description<Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold">Category<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.category} onChange={(e) => set("category", e.target.value)}><option value="sourcing">Sourcing</option><option value="due_diligence">Due diligence</option><option value="screening">Screening</option></select></label>
          <label className="space-y-1 text-xs font-semibold">Output<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.output_type} onChange={(e) => set("output_type", e.target.value)}><option value="both">Attributes and exceptions</option><option value="attributes">Attributes</option><option value="exceptions">Exceptions</option><option value="screening">Screening</option></select></label>
          <label className="space-y-1 text-xs font-semibold">Jurisdiction<Input value={draft.jurisdiction} placeholder="US, UK, or Global" onChange={(e) => set("jurisdiction", e.target.value)} /></label>
          <label className="space-y-1 text-xs font-semibold">CIP classification<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.cip_classification || "all"} onChange={(e) => set("cip_classification", e.target.value === "all" ? "" : e.target.value)}><option value="all">All classifications</option>{CIP_CLASSIFICATIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold">Child execution<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.child_execution} onChange={(e) => set("child_execution", e.target.value)}><option value="parallel">Parallel</option><option value="sequential">Sequential</option></select></label>
          <label className="space-y-1 text-xs font-semibold">Failure policy<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.failure_policy} onChange={(e) => set("failure_policy", e.target.value)}><option value="continue">Continue</option><option value="fail_fast">Fail fast</option></select></label>
          <label className="space-y-1 text-xs font-semibold">Sort order<Input type="number" min={0} value={draft.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></label>
          <div className="flex items-center gap-4 rounded-xl border p-3 text-xs">
            {(["enabled", "user_triggerable", "top_level_trigger"] as const).map((field) => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={draft[field]} onChange={(e) => set(field, e.target.checked)} />{field === "enabled" ? "Enabled" : field === "user_triggerable" ? "User triggerable" : "Top trigger"}</label>)}
          </div>
          {relationshipFields.map(([field, label]) => <RelationshipEditor key={field} label={label} required={field === "child_agents"} agents={agents} values={draft[field]} onToggle={(slug) => toggleRelation(field, slug)} onMove={(from, to) => moveRelation(field, from, to)} />)}
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !draft.slug || !draft.display_name || draft.child_agents.length === 0}>{saving && <RefreshCw className="mr-1.5 size-4 animate-spin" />}Create orchestrator</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Agents() {
  const { data: agents = [], isLoading, isError, error, refetch, isFetching } = useAgentRegistry();
  const { data: modelProfiles = [] } = useModelProfiles();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [editing, setEditing] = useState<RegistryAgent | null>(null);
  const [creating, setCreating] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [switchingProvider, setSwitchingProvider] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const checkAccess = async () => {
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents/access`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Access check failed (HTTP ${response.status})`);
      setCanEdit(Boolean(body.canEdit));
      setAccessMessage(body.canEdit ? null : `Signed in as ${body.email ?? "an unknown account"}, but this account is not authorized by the Agent Register administrator allowlist.`);
    } catch (cause) {
      setCanEdit(false);
      setAccessMessage(cause instanceof Error ? cause.message : "Unable to verify Agent Register access");
    }
  };
  useEffect(() => { void checkAccess(); }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredAgents = normalizedSearch
    ? agents.filter((agent) => [
        agent.display_name, agent.slug, agent.description, agent.category,
        agent.jurisdiction, agent.cip_classification, agent.runner_type, agent.output_type,
        agent.model_profile, modelProfileLabel(agent),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch)))
    : agents;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = pageSize === "all"
    ? filteredAgents
    : filteredAgents.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function changePageSize(val: PageSize) {
    setPageSize(val);
    setPage(0);
  }

  const start = filteredAgents.length === 0 ? 0 : pageSize === "all" ? 1 : safePage * pageSize + 1;
  const end   = pageSize === "all" ? filteredAgents.length : Math.min((safePage + 1) * pageSize, filteredAgents.length);
  const readyCount = agents.filter(isAgentAvailable).length;
  const modelBackedAgents = agents.filter((agent) => agent.execution_mode !== "orchestrator" && agent.model_profile);
  const activeProviders = new Set(modelBackedAgents.map((agent) =>
    agent.model_profile?.startsWith("anthropic-") ? "anthropic" : "aws-bedrock"));
  const activeProvider = activeProviders.size === 1 ? [...activeProviders][0] : null;
  const requiredTiers = new Set(modelBackedAgents.map((agent) => agent.model_profile?.split("-").at(-1)));
  const providerReady = (provider: string) => [...requiredTiers].every((tier) =>
    modelProfiles.some((profile) => profile.provider === provider && profile.tier === tier && profile.available));
  const switchProvider = async (provider: "aws-bedrock" | "anthropic") => {
    if (provider === activeProvider || switchingProvider) return;
    const label = provider === "anthropic" ? "Anthropic API" : "Amazon Bedrock";
    if (!window.confirm(`Switch every model-backed agent to ${label}? This change will be audited.`)) return;
    setSwitchingProvider(provider);
    try {
      const response = await apiFetch(`${AGENT_API_BASE}/api/agents/model-provider`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Provider switch failed (HTTP ${response.status})`);
      await refetch();
      toast.success(`Model provider changed to ${label} for ${body.updated ?? 0} agents`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to switch model provider");
    } finally {
      setSwitchingProvider(null);
    }
  };

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
        <div className="flex items-center gap-2">
          {canEdit && modelBackedAgents.length > 0 && (
            <div className="flex items-center rounded-md border bg-background p-0.5" aria-label="Claude model provider">
              {([
                ["aws-bedrock", "Bedrock"],
                ["anthropic", "Anthropic"],
              ] as const).map(([provider, label]) => (
                <Button
                  key={provider}
                  size="sm"
                  variant={activeProvider === provider ? "default" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  disabled={Boolean(switchingProvider) || !providerReady(provider)}
                  title={providerReady(provider) ? `Use ${label}` : `${label} environment variables are not configured`}
                  onClick={() => void switchProvider(provider)}
                >
                  {switchingProvider === provider && <RefreshCw className="mr-1 size-3 animate-spin" />}
                  {label}
                </Button>
              ))}
            </div>
          )}
          {canEdit && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 size-4" />New Orchestrator</Button>}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Registered</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length}</p></div>
        <div className="rounded-2xl border border-success/20 bg-success-soft p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-success">Ready</p><p className="mt-1 text-2xl font-bold tabular-nums text-success">{readyCount}</p></div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Readiness</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length ? Math.round((readyCount / agents.length) * 100) : 0}%</p></div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading registry…</p>}
      {accessMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-foreground">
          <span>{accessMessage}</span>
          <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={checkAccess}>Retry access</Button>
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load agents: {(error as Error)?.message}
        </p>
      )}
      {!isLoading && !isError && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                placeholder="Search by agent, slug, category, jurisdiction, or classification…"
                className="pl-9 pr-9"
                aria-label="Search Agent Register"
              />
              {search && <button type="button" onClick={() => { setSearch(""); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="size-4" /></button>}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{filteredAgents.length} result{filteredAgents.length === 1 ? "" : "s"}</span>
          </div>
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
                  <TableHead>Model</TableHead>
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
                      <TableCell>
                        <Badge variant={a.model_profile ? "outline" : "secondary"}>
                          {modelProfileLabel(a)}
                        </Badge>
                      </TableCell>
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
                {filteredAgents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">
                      {search ? `No agents match “${search}”.` : "No agents registered yet."}
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
              {filteredAgents.length > 0 && (
                <span>
                  {start}–{end} of {filteredAgents.length}
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
      {creating && <CreateOrchestratorDialog agents={agents} onClose={() => setCreating(false)} onSaved={refetch} />}
    </div>
  );
}

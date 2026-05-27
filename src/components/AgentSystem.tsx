import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  Bot, Sparkles, ChevronDown, ChevronUp, X, Loader2, CheckCircle2, Play, Search,
  ShieldCheck, FileCheck2, Database, Mail, Scale, UserCheck, Globe, Brain, Zap, Minus, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentId =
  | "identity" | "document" | "regulatory" | "audit" | "outreach"
  | "sanctions" | "pep" | "adverse-media" | "beneficial-owner" | "risk-scoring"
  | "companies-house";

export type Agent = {
  id: AgentId;
  name: string;
  short: string;
  description: string;
  icon: typeof Bot;
  defaultThoughts: string[];
};

export const AGENTS: Agent[] = [
  { id: "identity", name: "Identity Verification Agent", short: "Identity", icon: UserCheck,
    description: "Cross-references identifiers (TIN, LEI, contact data) across entity records.",
    defaultThoughts: ["Loading entity identifier set…", "Matching TIN 13-3439889 across 4 records", "Confidence threshold met — passing to downstream agents"] },
  { id: "document", name: "Document Intelligence Agent", short: "Documents", icon: FileCheck2,
    description: "Parses charters, ADV filings, and signatory blocks to extract attributes.",
    defaultThoughts: ["Fetching Fund Charter (Pg. 3) and Form ADV (Pg. 12)", "Running OCR + layout parser on signatory block", "Extracted: title, date, signature presence"] },
  { id: "regulatory", name: "Regulatory Compliance Agent", short: "Regulatory", icon: Scale,
    description: "Maps findings to FATF, FinCEN, FCA and local AML guidance.",
    defaultThoughts: ["Loading FATF Recommendation 10 §6.2", "Evaluating title-variation exemption", "No regulatory breach detected"] },
  { id: "sanctions", name: "Sanctions Screening Agent", short: "Sanctions", icon: ShieldCheck,
    description: "Screens parties against OFAC, EU, UN, HMT consolidated lists.",
    defaultThoughts: ["Querying OFAC SDN, EU CFSP, UN 1267", "0 hits across 4 parties", "Last list refresh: 2h ago"] },
  { id: "pep", name: "PEP Screening Agent", short: "PEP", icon: UserCheck,
    description: "Identifies Politically Exposed Persons via Dow Jones / WorldCheck.",
    defaultThoughts: ["Screening 4 principals against WorldCheck", "1 match: L. Fink — declared", "No undisclosed PEP exposure"] },
  { id: "adverse-media", name: "Adverse Media Agent", short: "Adverse Media", icon: Globe,
    description: "Scans global news sources for negative coverage of entities/principals.",
    defaultThoughts: ["Crawling 14k news sources (12mo window)", "Filtering: financial crime, fraud, sanctions", "3 articles flagged for review"] },
  { id: "beneficial-owner", name: "Beneficial Ownership Agent", short: "UBO", icon: Database,
    description: "Builds the 25%+ ownership tree and identifies ultimate beneficial owners.",
    defaultThoughts: ["Resolving ownership graph at 25% threshold", "Traversed 3 layers — 2 UBOs identified", "All UBOs have valid ID documents on file"] },
  { id: "risk-scoring", name: "Risk Scoring Agent", short: "Risk Score", icon: Brain,
    description: "Aggregates signals into a composite KYC risk score.",
    defaultThoughts: ["Aggregating 12 signals from upstream agents", "Composite score: 62 (Elevated)", "No tier escalation triggered"] },
  { id: "outreach", name: "Client Outreach Agent", short: "Outreach", icon: Mail,
    description: "Drafts and routes clarification requests to the relationship manager.",
    defaultThoughts: ["Loading template TITLE_CLARIFICATION_v3", "Routing to RM: J. Mendes", "Pending client response — SLA 5d"] },
  { id: "audit", name: "Audit Trail Agent", short: "Audit", icon: ShieldCheck,
    description: "Writes decisions, sources, and evidence pointers to the immutable log.",
    defaultThoughts: ["Hashing decision payload (SHA-256)", "Committing to evidence locker", "Audit entry #A-29104 written"] },
  { id: "companies-house", name: "UK Companies House Agent", short: "Co. House", icon: Building2,
    description: "Queries the UK Companies House registry to verify incorporation, filing status, and directors.",
    defaultThoughts: ["Connecting to Companies House registry…", "Preparing company name search query…", "Awaiting API response…"] },
];

const AGENTS_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, Agent>;

// Recommended bundles per route context
export const RECOMMENDED_BUNDLES: { route: string; label: string; reason: string; agents: AgentId[] }[] = [
  { route: "/work-queue/review", label: "Resolve Title Discrepancy", reason: "Recommended for this exception · 92% historical resolution rate",
    agents: ["identity", "document", "regulatory", "audit"] },
  { route: "/work-queue", label: "Bulk Triage Selected Cases", reason: "Best for high-risk DRG entities in queue",
    agents: ["sanctions", "pep", "adverse-media", "risk-scoring"] },
  { route: "/", label: "Daily KYC Refresh", reason: "Recommended each morning · refreshes screening + risk",
    agents: ["sanctions", "pep", "adverse-media", "beneficial-owner", "risk-scoring"] },
];

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

type EntityCtx = { name: string; kyc?: string };

// Per-agent real API config. Add an entry here whenever a new agent is deployed to AWS.
type AgentApiConfig = {
  slug: string;
  buildBody: (ctx: EntityCtx | null) => Record<string, unknown>;
  fetchSteps: boolean;
  asyncMode?: boolean; // use async invoke + live step polling instead of blocking sync call
};
const AGENT_API_CONFIGS: Partial<Record<AgentId, AgentApiConfig>> = {
  "companies-house": {
    slug: "uk-ch-data-sourcing",
    buildBody: (ctx) => ({
      entity_name: ctx?.name ?? "",
      static_data_store: "reference_database",
      classification_defintions: "ddocument_classification_taxonomy",
    }),
    fetchSteps: true,
    asyncMode: true,
  },
};

function extractRawSteps(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw)) return raw as unknown[];
  const d = raw as Record<string, unknown>;

  // Actual AWS agent API: {"value": [{node_alias, agent_steps: [...]}, ...], "Count": N}
  if (Array.isArray(d.value)) {
    return (d.value as unknown[]).flatMap((node) => {
      if (!node || typeof node !== "object") return [];
      const n = node as Record<string, unknown>;
      const steps = Array.isArray(n.agent_steps) ? n.agent_steps : [];
      if (steps.length === 0) return [];
      // Synthetic header so the dock shows which node each step belongs to
      return [
        { type: "node_header", label: String(n.node_alias ?? "agent"), execution_time_ms: n.execution_time_ms },
        ...steps,
      ];
    });
  }

  // Fallback: node-level objects each containing their own steps array — flatten them
  const flattenNodes = (nodes: unknown[]) =>
    nodes.flatMap((node) => {
      if (!node || typeof node !== "object") return [node];
      const n = node as Record<string, unknown>;
      if (Array.isArray(n.agent_steps)) return n.agent_steps;
      if (Array.isArray(n.steps)) return n.steps;
      if (Array.isArray(n.messages)) return n.messages;
      if (Array.isArray(n.content)) return n.content;
      return [node];
    });

  if (Array.isArray(d.steps)) return flattenNodes(d.steps);
  if (Array.isArray(d.agentSteps)) return flattenNodes(d.agentSteps);
  if (Array.isArray(d.agent_steps)) return flattenNodes(d.agent_steps);
  if (Array.isArray(d.events)) return flattenNodes(d.events);
  if (Array.isArray(d.messages)) return d.messages as unknown[];
  return [];
}

function extractText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v.map((c) => (typeof c === "object" && c !== null
      ? String((c as Record<string, unknown>).text ?? (c as Record<string, unknown>).content ?? JSON.stringify(c))
      : String(c))).join("\n");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.text ?? o.content ?? o.message ?? JSON.stringify(v));
  }
  return String(v ?? "");
}

function buildThoughtsFromAgentSteps(steps: unknown[], apiData?: unknown): string[] {
  const thoughts: string[] = [];

  const processStep = (s: Record<string, unknown>) => {
    const type = String(s.type ?? s.role ?? "");

    if (type === "node_header") {
      const ms = s.execution_time_ms != null ? ` (${(Number(s.execution_time_ms) / 1000).toFixed(1)}s)` : "";
      thoughts.push(`📍 Node: ${String(s.label ?? "agent")}${ms}`);
      return;
    }

    // Nested content array (e.g. assistant message with multiple blocks)
    if (Array.isArray(s.content) && !["tool_result", "tool_use", "tool_call"].includes(type)) {
      for (const item of s.content) {
        if (item && typeof item === "object") processStep(item as Record<string, unknown>);
      }
      return;
    }

    if (type === "thinking" || type === "reasoning") {
      const text = extractText(s.thinking ?? s.content ?? s.text).trim();
      if (text) thoughts.push(`💭 ${text}`);
    } else if (type === "tool_use" || type === "tool_call") {
      const name = String(s.name ?? s.tool ?? "tool");
      const inputData = s.input ?? s.args;
      const inputStr = inputData ? JSON.stringify(inputData, null, 2) : "";
      thoughts.push(`🔧 ${name}${inputStr ? `\n${inputStr}` : ""}`);
    } else if (type === "tool_result") {
      const text = extractText(s.content ?? s.output ?? s.result).trim();
      if (text) thoughts.push(`📥 ${text}`);
    } else if (type === "text") {
      const text = extractText(s.text ?? s.content).trim();
      if (text) thoughts.push(`✓ ${text}`);
    } else if (type === "assistant" || type === "user") {
      const text = extractText(s.content ?? s.message).trim();
      if (text) thoughts.push(text);
    } else {
      // Unknown type — surface any readable content field
      const text = extractText(s.content ?? s.message ?? s.output ?? s.text).trim();
      if (text) thoughts.push(text);
    }
  };

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    processStep(step as Record<string, unknown>);
  }

  // Append result summary
  if (apiData && typeof apiData === "object") {
    const d = apiData as Record<string, unknown>;
    if (d.executionTime != null) thoughts.push(`⏱ Completed in ${d.executionTime}ms`);
    const results = d.results ?? d.output ?? d.data;
    if (results && typeof results === "object") {
      const entries = Object.entries(results as Record<string, unknown>)
        .filter(([, v]) => v != null && (typeof v === "string" || typeof v === "number"))
        .slice(0, 8);
      for (const [k, v] of entries) {
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        thoughts.push(`${label}: ${String(v)}`);
      }
    }
  }

  // If nothing was parsed, show a raw preview to help diagnose the format
  if (thoughts.length === 0 && steps.length > 0) {
    thoughts.push(`📦 Received ${steps.length} step(s) — raw preview:`);
    for (const step of steps.slice(0, 5)) {
      if (step && typeof step === "object") {
        thoughts.push(JSON.stringify(step).slice(0, 400));
      }
    }
  }

  return thoughts.length > 0 ? thoughts : ["✓ Agent completed — no structured steps returned"];
}

function buildThoughtsFromResult(data: unknown, agentId: AgentId): string[] {
  const agent = AGENTS_BY_ID[agentId];
  if (!data || typeof data !== "object") return [...agent.defaultThoughts, "✓ Run completed"];
  const d = data as Record<string, unknown>;
  const thoughts: string[] = [];
  if (d.executionTime != null) thoughts.push(`Completed in ${d.executionTime}ms`);
  if (d.status) thoughts.push(`Agent status: ${String(d.status)}`);
  const results = d.results ?? d.output ?? d.data;
  if (results && typeof results === "object") {
    const entries = Object.entries(results as Record<string, unknown>)
      .filter(([, v]) => v != null && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
      .slice(0, 6);
    for (const [k, v] of entries) {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      thoughts.push(`${label}: ${String(v)}`);
    }
  }
  if (d.runId) thoughts.push(`Run ID: ${String(d.runId)}`);
  if (thoughts.length < 2) thoughts.push("✓ Agent completed — no structured results returned");
  return thoughts;
}

type StepState = "pending" | "running" | "done";
type AgentRun = {
  id: string;
  agentId: AgentId;
  state: StepState;
  thoughts: string[];
  currentThought: number;
  startedAt: number;
  isReal?: boolean;
  result?: unknown;
};

type AgentContextValue = {
  runs: AgentRun[];
  isRunning: boolean;
  dockOpen: boolean;
  dockMinimized: boolean;
  setDockOpen: (v: boolean) => void;
  setDockMinimized: (v: boolean) => void;
  runAgents: (agentIds: AgentId[], label?: string) => void;
  clearRuns: () => void;
  currentLabel: string | null;
  entityContext: EntityCtx | null;
  setEntityContext: (ctx: EntityCtx | null) => void;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export const useAgents = () => {
  const v = useContext(AgentContext);
  if (!v) throw new Error("useAgents must be used within AgentProvider");
  return v;
};

export const AgentProvider = ({ children }: { children: ReactNode }) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockMinimized, setDockMinimized] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [entityContext, setEntityContext] = useState<EntityCtx | null>(null);
  // Ref so runAgents (stable useCallback) always reads the latest entity context
  const entityContextRef = useRef<EntityCtx | null>(null);
  entityContextRef.current = entityContext;

  const isRunning = runs.some((r) => r.state !== "done");

  const runAgents = useCallback((agentIds: AgentId[], label?: string) => {
    const newRuns: AgentRun[] = agentIds.map((id, i) => {
      const hasReal = !!AGENT_API_CONFIGS[id];
      return {
        id: `${Date.now()}-${i}`,
        agentId: id,
        state: (i === 0 ? "running" : "pending") as StepState,
        thoughts: hasReal
          ? [...AGENTS_BY_ID[id].defaultThoughts, "Awaiting API response…"]
          : AGENTS_BY_ID[id].defaultThoughts,
        currentThought: 0,
        startedAt: Date.now(),
        isReal: hasReal,
      };
    });
    setRuns(newRuns);
    setCurrentLabel(label ?? "Custom Agent Run");
    setDockOpen(true);
    setDockMinimized(false);

    // Snapshot entity context at call time (ref is always current)
    const ctx = entityContextRef.current;

    newRuns.forEach((run) => {
      const cfg = AGENT_API_CONFIGS[run.agentId];
      if (!cfg) return;

      const markDone = (thoughts: string[], result?: unknown) => {
        setRuns((prev) => {
          const idx = prev.findIndex((r) => r.id === run.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], state: "done", thoughts, currentThought: thoughts.length - 1, result };
          if (idx + 1 < next.length && next[idx + 1].state === "pending") {
            next[idx + 1] = { ...next[idx + 1], state: "running" };
          }
          return next;
        });
      };

      // Live-update the dock thoughts without marking the run done yet
      const updateLiveThoughts = (steps: unknown[]) => {
        if (steps.length === 0) return;
        const thoughts = buildThoughtsFromAgentSteps(steps);
        setRuns((prev) => {
          const idx = prev.findIndex((r) => r.id === run.id);
          if (idx === -1 || prev[idx].state !== "running") return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], thoughts, currentThought: thoughts.length - 1 };
          return next;
        });
      };

      // Poll agent-steps and run-status until complete
      const startPolling = (runId: string) => {
        let polls = 0;
        const poll = async () => {
          polls++;
          if (polls > 300) { markDone(["⚠ Agent run timed out after 10 minutes"]); return; }

          // Fetch latest thinking steps and show them live
          try {
            const sr = await fetch(`${AGENT_API_BASE}/api/agent-steps/${runId}`);
            const stepsRaw = await sr.json() as unknown;
            console.log("[agent-steps] raw:", JSON.stringify(stepsRaw).slice(0, 1000));
            updateLiveThoughts(extractRawSteps(stepsRaw));
          } catch { /* non-fatal — keep polling */ }

          // Check completion status
          try {
            const rr = await fetch(`${AGENT_API_BASE}/api/agent-run/${runId}`);
            const rd = await rr.json() as Record<string, unknown>;
            const status = String(rd.status ?? "");

            if (["complete", "completed", "done", "succeeded"].includes(status)) {
              // Final step fetch so we get every thought before marking done
              try {
                const sr = await fetch(`${AGENT_API_BASE}/api/agent-steps/${runId}`);
                const stepsRaw = await sr.json() as unknown;
                const steps = extractRawSteps(stepsRaw);
                markDone(
                  steps.length > 0 ? buildThoughtsFromAgentSteps(steps, rd) : buildThoughtsFromResult(rd, run.agentId),
                  rd,
                );
              } catch { markDone(buildThoughtsFromResult(rd, run.agentId), rd); }
              return;
            }
            if (["failed", "error", "cancelled"].includes(status)) {
              // Show whatever steps ran before the failure, then append the error
              const errLine = `⚠ Run ${status}: ${String(rd.error ?? rd.message ?? "unknown error")}`;
              try {
                const sr = await fetch(`${AGENT_API_BASE}/api/agent-steps/${runId}`);
                const stepsRaw = await sr.json() as unknown;
                const steps = extractRawSteps(stepsRaw);
                const thoughts = steps.length > 0
                  ? [...buildThoughtsFromAgentSteps(steps), errLine]
                  : [errLine];
                markDone(thoughts, rd);
              } catch { markDone([errLine], rd); }
              return;
            }
          } catch { /* non-fatal — keep polling */ }

          setTimeout(poll, 2000);
        };
        setTimeout(poll, 1500); // first poll after 1.5 s
      };

      fetch(`${AGENT_API_BASE}/api/agent/${cfg.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cfg.buildBody(ctx),
          ...(cfg.asyncMode ? { async: true } : {}),
        }),
      })
        .then(async (r) => {
          const text = await r.text();
          try { return JSON.parse(text); }
          catch { throw new Error(`Server returned non-JSON (HTTP ${r.status}). Is the proxy running? (npm start)`); }
        })
        .then(async (data: unknown) => {
          const d = data as Record<string, unknown>;
          const runId = d.runId ?? d.run_id ?? d.id;
          const status = String(d.status ?? "");

          // Already complete (sync response or instant agent)
          if (!runId || !cfg.asyncMode || ["complete", "completed", "done"].includes(status)) {
            let thoughts: string[] = [];
            if (cfg.fetchSteps && runId) {
              try {
                const sr = await fetch(`${AGENT_API_BASE}/api/agent-steps/${String(runId)}`);
                const stepsRaw = await sr.json() as unknown;
                const steps = extractRawSteps(stepsRaw);
                if (steps.length > 0) thoughts = buildThoughtsFromAgentSteps(steps, data);
              } catch { /* fall through */ }
            }
            markDone(thoughts.length > 0 ? thoughts : buildThoughtsFromResult(data, run.agentId), data);
            return;
          }

          // Async: start live polling
          startPolling(String(runId));
        })
        .catch((err: Error) => {
          markDone([...AGENTS_BY_ID[run.agentId].defaultThoughts, `⚠ API error: ${err.message}`]);
        });
    });
  }, []);

  const clearRuns = useCallback(() => setRuns([]), []);

  // Drive simulation: advance thoughts then mark done; real agents wait for their fetch callback
  useEffect(() => {
    if (runs.length === 0) return;
    const runningIdx = runs.findIndex((r) => r.state === "running");
    if (runningIdx === -1) return;
    const run = runs[runningIdx];
    // Real agents stop animation at last thought — fetch callback will mark them done
    if (run.isReal && run.currentThought >= run.thoughts.length - 1) return;
    const t = setTimeout(() => {
      setRuns((prev) => {
        const next = [...prev];
        const cur = { ...next[runningIdx] };
        if (cur.currentThought < cur.thoughts.length - 1) {
          cur.currentThought += 1;
          next[runningIdx] = cur;
        } else if (!cur.isReal) {
          cur.state = "done";
          next[runningIdx] = cur;
          if (runningIdx + 1 < next.length) {
            next[runningIdx + 1] = { ...next[runningIdx + 1], state: "running" };
          }
        }
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [runs]);

  const value = useMemo(() => ({
    runs, isRunning, dockOpen, dockMinimized, setDockOpen, setDockMinimized,
    runAgents, clearRuns, currentLabel, entityContext, setEntityContext,
  }), [runs, isRunning, dockOpen, dockMinimized, runAgents, clearRuns, currentLabel, entityContext, setEntityContext]);

  return (
    <AgentContext.Provider value={value}>
      {children}
      <AgentDock />
    </AgentContext.Provider>
  );
};

// =========== Top recommendation strip ===========

export const AgentRecommendationStrip = ({ route }: { route: string }) => {
  const { runAgents, entityContext } = useAgents();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<AgentId>>(new Set());

  const bundle = RECOMMENDED_BUNDLES.find((b) => b.route === route) ?? RECOMMENDED_BUNDLES[2];

  // Sync selection with recommended bundle by default
  useEffect(() => {
    setSelected(new Set(bundle.agents));
  }, [bundle]);

  const toggle = (id: AgentId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runRecommended = () => runAgents(bundle.agents, bundle.label);
  const runCustom = () => {
    if (selected.size === 0) return;
    runAgents(Array.from(selected), `Custom Run (${selected.size} agents)`);
    setOpen(false);
  };

  return (
    <div className="border-b border-border bg-gradient-to-r from-info-soft/60 via-card to-card">
      <div className="px-6 py-2.5 flex items-center gap-3 max-w-[1480px] mx-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="size-6 rounded-md bg-primary/10 text-primary grid place-items-center">
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recommended Agents
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[13px] font-medium truncate">{bundle.label}</span>
          <span className="text-[11px] text-muted-foreground truncate hidden md:inline">· {bundle.reason}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runRecommended}
            className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-95"
          >
            <Zap className="size-3.5" /> Run Recommended
          </button>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card flex items-center gap-1.5 hover:bg-secondary"
            >
              Run Agent <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-2 w-[340px] rounded-xl border border-border bg-card shadow-xl z-40 animate-fade-in">
                <div className="p-3 border-b border-border">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Select agents to run</p>
                  <p className="text-[11px] text-muted-foreground">Recommended pre-selected · pick any combination</p>
                </div>
                <div className="max-h-[320px] overflow-y-auto py-1">
                  {AGENTS.map((a) => {
                    const Icon = a.icon;
                    const isSel = selected.has(a.id);
                    const isRec = bundle.agents.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggle(a.id)}
                        className="w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-secondary/60 transition-colors"
                      >
                        <span className={cn(
                          "size-4 rounded border flex items-center justify-center mt-0.5 shrink-0",
                          isSel ? "bg-primary border-primary" : "border-border"
                        )}>
                          {isSel && <CheckCircle2 className="size-3 text-primary-foreground" />}
                        </span>
                        <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-medium truncate">{a.name}</p>
                            {isRec && <span className="text-[9px] px-1 rounded bg-success-soft text-success border border-success-soft-border uppercase tracking-wide">Rec</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">{a.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{selected.size} selected</span>
                  <button
                    onClick={runCustom}
                    disabled={selected.size === 0}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-95 disabled:opacity-40"
                  >
                    <Play className="size-3" /> Run Selected
                  </button>
                </div>

                {/* ── Live Data Source Agents ─────────────────────── */}
                <div className="border-t border-border bg-secondary/30">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-success inline-block" />
                    Live Data Sources
                  </p>
                  <button
                    disabled={!entityContext?.name}
                    onClick={() => { runAgents(["companies-house"], "UK Companies House Lookup"); setOpen(false); }}
                    className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-secondary/60"
                  >
                    <span className="size-7 rounded-md bg-success-soft text-success border border-success-soft-border grid place-items-center shrink-0 mt-0.5">
                      <Building2 className="size-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-medium">UK Companies House</p>
                        <span className="text-[9px] px-1 rounded bg-success-soft text-success border border-success-soft-border uppercase tracking-wide">Live API</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {entityContext?.name
                          ? <>Search <span className="font-medium text-foreground">{entityContext.name}</span> in the Companies House registry</>
                          : "Open an entity in the review page first"}
                      </p>
                    </div>
                    <span className="text-[11px] text-primary font-medium shrink-0 mt-1">Run →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========== Bottom-right Agent Console Dock ===========

const AgentDock = () => {
  const { runs, dockOpen, dockMinimized, setDockOpen, setDockMinimized, isRunning, currentLabel } = useAgents();

  if (!dockOpen || runs.length === 0) return null;

  const completed = runs.filter((r) => r.state === "done").length;
  const total = runs.length;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 w-[420px] rounded-xl border border-border bg-card shadow-2xl animate-fade-in overflow-hidden",
      dockMinimized && "w-[300px]"
    )}>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-info-soft/60 to-card">
        <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center relative shrink-0">
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {isRunning && <span className="absolute inset-0 rounded-md ring-2 ring-primary/30 animate-ping" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate">
            {isRunning ? "Agents Running" : "Agents Completed"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentLabel} · {completed}/{total} done
          </p>
        </div>
        <button onClick={() => setDockMinimized(!dockMinimized)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Minimize">
          {dockMinimized ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
        </button>
        <button onClick={() => setDockOpen(false)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      {!dockMinimized && (
        <>
          <div className="h-1 w-full bg-secondary">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
          <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
            {runs.map((r) => {
              const agent = AGENTS_BY_ID[r.agentId];
              const Icon = agent.icon;
              const visibleThoughts = r.thoughts.slice(0, r.state === "done" ? r.thoughts.length : r.currentThought + 1);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "rounded-lg border p-2.5 transition-all",
                    r.state === "running" && "border-primary bg-info-soft/40",
                    r.state === "done" && "border-success-soft-border bg-success-soft/20",
                    r.state === "pending" && "border-border bg-card opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "size-6 rounded-md grid place-items-center shrink-0",
                      r.state === "running" && "bg-primary/15 text-primary",
                      r.state === "done" && "bg-success-soft text-success",
                      r.state === "pending" && "bg-secondary text-muted-foreground",
                    )}>
                      {r.state === "running" ? <Loader2 className="size-3.5 animate-spin" /> :
                        r.state === "done" ? <CheckCircle2 className="size-3.5" /> :
                        <Icon className="size-3.5" />}
                    </span>
                    <p className="text-[12px] font-medium flex-1 truncate">{agent.name}</p>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium tracking-wide",
                      r.state === "running" && "bg-primary text-primary-foreground",
                      r.state === "done" && "bg-success-soft text-success border border-success-soft-border",
                      r.state === "pending" && "bg-secondary text-muted-foreground",
                    )}>{r.state}</span>
                  </div>
                  {r.state !== "pending" && (
                    <div className="mt-1.5 pl-8 space-y-0.5">
                      {visibleThoughts.map((t, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground font-mono leading-snug animate-fade-in">
                          <span className="text-primary/60">›</span> {t}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-secondary/30">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bot className="size-3" /> KYC Agent Orchestrator v2.1
            </p>
            {!isRunning && (
              <button onClick={() => setDockOpen(false)} className="text-[11px] text-primary hover:underline">Dismiss</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

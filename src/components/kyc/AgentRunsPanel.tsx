import { useState, useEffect, useCallback } from "react";
import { useAgentRegistry } from "@/hooks/useAgentRegistry";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { apiFetch } from "@/lib/apiFetch";

type AgentRun = {
  id: string;
  agent_slug: string;
  status: "running" | "pending_review" | "complete" | "failed";
  started_at: string;
  completed_at?: string | null;
  error?: string | null;
  steps?: string[] | null;
  raw_output?: Record<string, unknown> | null;
};

type AttrGroup = {
  source: string;
  attributes: { attribute_name: string; display_value: string | null }[];
};

function groupBySource(attrs: { attribute_name: string; display_value?: string | null; lineage?: { source?: string }[] }[]): AttrGroup[] {
  const map = new Map<string, { attribute_name: string; display_value: string | null }[]>();
  for (const attr of attrs) {
    const src = attr.lineage?.[0]?.source ?? "Agent";
    if (!map.has(src)) map.set(src, []);
    map.get(src)!.push({ attribute_name: attr.attribute_name, display_value: attr.display_value ?? null });
  }
  return Array.from(map.entries()).map(([source, attributes]) => ({ source, attributes }));
}

function StatusBadge({ status }: { status: AgentRun["status"] }) {
  const map: Record<AgentRun["status"], { label: string; className: string }> = {
    running:        { label: "Running",         className: "bg-blue-100 text-blue-700" },
    pending_review: { label: "Awaiting Review", className: "bg-purple-100 text-purple-700" },
    complete:       { label: "Complete",        className: "bg-emerald-100 text-emerald-700" },
    failed:         { label: "Failed",          className: "bg-red-100 text-red-700" },
  };
  const b = map[status] ?? map.running;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.className}`}>
      {b.label}
    </span>
  );
}

// ─── AgentRunsPanel ───────────────────────────────────────────────────────────

export function AgentRunsPanel({ kycRef }: { kycRef: string }) {
  const registry = useAgentRegistry();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!kycRef) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${AGENT_API_BASE}/api/entity/${kycRef}/runs`);
      const data = await r.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [kycRef]);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  // Deduplicate: keep latest run per agent_slug
  const latestBySlug = new Map<string, AgentRun>();
  for (const run of runs) {
    const existing = latestBySlug.get(run.agent_slug);
    if (!existing || run.started_at > existing.started_at) latestBySlug.set(run.agent_slug, run);
  }
  const displayRuns = Array.from(latestBySlug.values()).sort(
    (a, b) => b.started_at.localeCompare(a.started_at)
  );

  const slugToName = (slug: string) =>
    registry.data?.find((a) => a.slug === slug)?.display_name ?? slug;

  const rawAttrs = (run: AgentRun) => {
    const out = run.raw_output;
    if (!out) return [];
    if (Array.isArray((out as { attributes?: unknown }).attributes)) {
      return (out as { attributes: { attribute_name: string; display_value?: string | null; lineage?: { source?: string }[] }[] }).attributes;
    }
    if (Array.isArray(out)) return out;
    return [];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Agent Runs</h3>
        <button
          onClick={fetchRuns}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {displayRuns.length === 0 && !loading && (
          <p className="text-sm text-gray-400 italic px-4 py-6">No agent runs yet.</p>
        )}
        {displayRuns.map((run) => {
          const isOpen = expanded === run.id;
          const attrs = rawAttrs(run);
          const groups = groupBySource(attrs);

          return (
            <div key={run.id} className="border-b border-gray-100 last:border-0">
              {/* Row header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                onClick={() => setExpanded(isOpen ? null : run.id)}
              >
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    {slugToName(run.agent_slug)}
                  </span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{run.agent_slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Thinking steps */}
                  {run.steps && run.steps.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Thinking Log
                      </h5>
                      <ul className="space-y-1">
                        {run.steps.map((s, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-2">
                            <span className="text-gray-300 shrink-0">{i + 1}.</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Attribute outputs grouped by source */}
                  {groups.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Outputs
                      </h5>
                      {groups.map((g) => (
                        <div key={g.source} className="mb-3">
                          <span className="text-xs text-blue-600 font-medium block mb-1">{g.source}</span>
                          <div className="grid grid-cols-2 gap-1">
                            {g.attributes.map((a) => (
                              <div key={a.attribute_name} className="text-xs bg-gray-50 rounded px-2 py-1">
                                <span className="text-gray-400 block">{a.attribute_name}</span>
                                <span className="text-gray-700">{a.display_value ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {run.error && (
                    <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                      {run.error}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-gray-300">
                    Started {new Date(run.started_at).toLocaleString()}
                    {run.completed_at && ` · Completed ${new Date(run.completed_at).toLocaleString()}`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

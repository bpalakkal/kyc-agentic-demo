/**
 * Screening — separate master (screening_results_schema.json). Analyst-initiated
 * sanctions / PEP / adverse-media screening of the case's parties (entity + persons),
 * with a per-hit disposition workflow that persists across re-screens.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";

type Match = {
  id: string;
  caption?: string;
  score?: number;
  target?: boolean;
  topics?: string[];
  datasets?: string[];
  matched_name?: string[];
  disposition_status?: string;
  analyst_notes?: string;
};
type SubjectResult = {
  party_role: string;
  party_index: number | null;
  party_name: string;
  query_schema?: string;
  match_count: number;
  matches: Match[];
};
type Screening = {
  id?: string;
  screened_at?: string;
  screening_timestamp?: string;
  screening_results: SubjectResult[];
} | null;

// disposition_status shown per match comes from the flow (pending_review /
// discounted) until an analyst overrides it. Analyst actions:
const DISPOSITIONS = [
  { v: "pending_review", l: "Pending review" },
  { v: "true_match", l: "True match" },
  { v: "false_positive", l: "False positive" },
  { v: "escalated", l: "Escalate" },
];

export default function Screening({ kycRef: kycRefProp, embedded }: { kycRef?: string; embedded?: boolean } = {}) {
  const params = useParams<{ kycRef: string }>();
  const kycRef = kycRefProp ?? params.kycRef;
  const [data, setData] = useState<Screening>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!kycRef) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/screening`);
      setData(r.ok ? await r.json() : null);
    } finally {
      setLoading(false);
    }
  }, [kycRef]);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!kycRef) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/screening/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        setData(await r.json());
      } else {
        const body = await r.json().catch(() => ({}));
        setRunError(body.error ?? `HTTP ${r.status}`);
      }
    } catch (err) {
      setRunError((err as Error).message ?? "Network error");
    } finally {
      setRunning(false);
    }
  };

  const setDisposition = async (r: SubjectResult, m: Match, disposition: string) => {
    if (!kycRef) return;
    await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/screening/disposition`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyRole: r.party_role, partyIndex: r.party_index, matchId: m.id, disposition }),
    });
    setData((prev) =>
      prev
        ? {
            ...prev,
            screening_results: prev.screening_results.map((sr) =>
              sr === r
                ? { ...sr, matches: sr.matches.map((mm) => (mm.id === m.id ? { ...mm, disposition_status: disposition } : mm)) }
                : sr,
            ),
          }
        : prev,
    );
  };

  const results = data?.screening_results ?? [];
  const totalHits = results.reduce((n, r) => n + (r.match_count || 0), 0);
  const openHits = results.reduce(
    (n, r) => n + (r.matches?.filter((m) => (m.disposition_status ?? "open") === "open").length || 0),
    0,
  );

  return (
    <div className={embedded ? "" : "p-6 max-w-6xl mx-auto"}>
      <div className="flex items-center gap-3 mb-4">
        {!embedded && (
          <Link to={`/work-queue/review/${kycRef}`} className="text-xs text-muted-foreground hover:underline">
            ← Case {kycRef}
          </Link>
        )}
        {!embedded && <h1 className="text-lg font-bold flex-1">Screening</h1>}
        {embedded && <span className="flex-1" />}
        <button
          onClick={run}
          disabled={running}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {running ? "Screening…" : data ? "Re-screen" : "Screen"}
        </button>
      </div>

      {data && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
          <span>{results.length} subject{results.length !== 1 ? "s" : ""}</span>
          <span>{totalHits} hit{totalHits !== 1 ? "s" : ""}</span>
          <span>{openHits} open</span>
          <span>Last: {new Date(data.screened_at ?? data.screening_timestamp ?? Date.now()).toLocaleString()}</span>
        </div>
      )}

      {runError && (
        <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          <strong>Screening failed:</strong> {runError}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-muted-foreground">
          No screening yet. Click <strong>Screen</strong> to screen this case's parties (entity + beneficial owners,
          officers, signatories…) against sanctions / PEP / adverse-media lists.
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-3">
        {results.map((r) => (
          <div key={`${r.party_role}-${r.party_index}`} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
              <span className="text-[11px] font-bold uppercase tracking-widest">{r.party_name}</span>
              <span className="text-[10px] text-muted-foreground">
                {r.party_role.replace(/_/g, " ")}
                {r.party_index != null ? ` #${r.party_index + 1}` : ""}
              </span>
              <span
                className={
                  "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border " +
                  (r.match_count > 0 ? "bg-alert-soft text-alert border-alert-soft-border" : "bg-success-soft text-success border-success-soft-border")
                }
              >
                {r.match_count > 0 ? `${r.match_count} hit${r.match_count !== 1 ? "s" : ""}` : "Clear"}
              </span>
            </div>
            {r.matches?.length > 0 && (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-1.5">Matched entity</th>
                    <th className="text-left px-3 py-1.5">Score</th>
                    <th className="text-left px-3 py-1.5">Topics</th>
                    <th className="text-left px-3 py-1.5">Disposition</th>
                  </tr>
                </thead>
                <tbody>
                  {r.matches.map((m) => (
                    <tr key={m.id} className="border-t border-border/60">
                      <td className="px-3 py-1.5">{m.caption ?? m.id}</td>
                      <td className="px-3 py-1.5">{Math.round((m.score ?? 0) * 100)}%</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{(m.topics ?? []).join(", ")}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={m.disposition_status ?? "open"}
                          onChange={(e) => setDisposition(r, m, e.target.value)}
                          className="text-[11px] border border-border rounded px-1 py-0.5 bg-background"
                        >
                          {DISPOSITIONS.map((d) => (
                            <option key={d.v} value={d.v}>{d.l}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

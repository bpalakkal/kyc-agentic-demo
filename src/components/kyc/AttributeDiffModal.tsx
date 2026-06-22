/**
 * AttributeDiffModal — shown when an API runner completes with status 'pending_review'.
 *
 * Fetches /api/agent-run-api/:runId/diff to compare the agent's proposed attribute
 * values against what's currently stored for the entity. The user can accept all,
 * accept a subset, or reject entirely before anything is written to the database.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

export interface PendingDiff {
  runId: string;
  kycRef: string;
  agentId: string;
  onCommit: (result: unknown) => void;
  onCancel: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewAttribute {
  attributeName: string;
  attributeGroup: string;
  displayValue: string;
  source: string;
  confidence: number;
  idFlag: boolean;
  verificationFlag: boolean;
  exceptionFlag: boolean;
}

interface CurrentAttribute {
  attribute_name: string;
  attribute_group: string;
  display_value: string | null;
}

interface DiffRow {
  attributeName: string;
  attributeGroup: string;
  currentValue: string | null;
  newValue: string;
  source: string;
  confidence: number;
  status: "new" | "changed" | "unchanged";
}

interface DiffData {
  kycRef: string;
  agentSlug: string;
  newAttributes: NewAttribute[];
  currentAttributes: CurrentAttribute[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDiffRows(data: DiffData): DiffRow[] {
  const currentMap = new Map(data.currentAttributes.map(a => [a.attribute_name, a.display_value ?? null]));

  return data.newAttributes.map(attr => {
    const current = currentMap.get(attr.attributeName) ?? null;
    const changed  = current !== null && current.toLowerCase() !== attr.displayValue.toLowerCase();
    const isNew    = current === null;
    return {
      attributeName:  attr.attributeName,
      attributeGroup: attr.attributeGroup,
      currentValue:   current,
      newValue:       attr.displayValue,
      source:         attr.source,
      confidence:     attr.confidence,
      status:         isNew ? "new" : changed ? "changed" : "unchanged",
    };
  }).sort((a, b) => {
    // New and changed first, then unchanged; alpha within each group
    const order = { new: 0, changed: 1, unchanged: 2 };
    return (order[a.status] - order[b.status]) || a.attributeName.localeCompare(b.attributeName);
  });
}

function formatAttrName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  pending: PendingDiff;
}

export function AttributeDiffModal({ pending }: Props) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [rows, setRows]         = useState<DiffRow[]>([]);
  const [agentSlug, setAgentSlug] = useState("");
  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(`${AGENT_API_BASE}/api/agent-run-api/${pending.runId}/diff`)
      .then(r => r.json())
      .then((data: DiffData) => {
        const diffRows = buildDiffRows(data);
        setRows(diffRows);
        setAgentSlug(data.agentSlug ?? "");
        // Pre-select all new + changed attributes
        setChecked(new Set(diffRows.filter(r => r.status !== "unchanged").map(r => r.attributeName)));
      })
      .catch(err => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  }, [pending.runId]);

  const toggle = (name: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleAll = (names: string[]) => {
    const allOn = names.every(n => checked.has(n));
    setChecked(prev => {
      const next = new Set(prev);
      names.forEach(n => allOn ? next.delete(n) : next.add(n));
      return next;
    });
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const approvedNames = Array.from(checked);
      const r = await apiFetch(`${AGENT_API_BASE}/api/agent-run-api/${pending.runId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedNames }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const result = await r.json();
      pending.onCommit(result);
    } catch (err) {
      setError(String((err as Error).message));
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await apiFetch(`${AGENT_API_BASE}/api/agent-run-api/${pending.runId}`, { method: "DELETE" });
    } catch { /* best-effort */ }
    pending.onCancel();
  };

  const changedRows   = rows.filter(r => r.status === "changed");
  const newRows       = rows.filter(r => r.status === "new");
  const unchangedRows = rows.filter(r => r.status === "unchanged");
  const actionableNames = [...newRows, ...changedRows].map(r => r.attributeName);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !committing) handleCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            Review Agent Findings
            {agentSlug && (
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wide">
                {agentSlug}
              </Badge>
            )}
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Select which attributes to accept before saving to the database.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading diff…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-md p-3">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* New attributes */}
              {newRows.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-success flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" /> New ({newRows.length})
                    </h3>
                    <button
                      onClick={() => toggleAll(newRows.map(r => r.attributeName))}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {newRows.every(r => checked.has(r.attributeName)) ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <DiffTable rows={newRows} checked={checked} onToggle={toggle} />
                </section>
              )}

              {/* Changed attributes */}
              {changedRows.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" /> Changed ({changedRows.length})
                    </h3>
                    <button
                      onClick={() => toggleAll(changedRows.map(r => r.attributeName))}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {changedRows.every(r => checked.has(r.attributeName)) ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <DiffTable rows={changedRows} checked={checked} onToggle={toggle} showCurrent />
                </section>
              )}

              {/* Unchanged — collapsed by default */}
              {unchangedRows.length > 0 && (
                <section>
                  <button
                    onClick={() => setShowUnchanged(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                  >
                    {showUnchanged ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    Unchanged ({unchangedRows.length})
                  </button>
                  {showUnchanged && <DiffTable rows={unchangedRows} checked={checked} onToggle={toggle} dimmed />}
                </section>
              )}

              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No attributes returned by this agent run.</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border flex items-center justify-between gap-2 bg-secondary/20">
          <div className="text-[11px] text-muted-foreground">
            {checked.size > 0
              ? `${checked.size} attribute${checked.size === 1 ? "" : "s"} selected`
              : "Nothing selected — accept will save nothing"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={committing}>
              <XCircle className="size-3.5 mr-1.5" /> Reject all
            </Button>
            {actionableNames.length > 0 && (
              <Button variant="outline" size="sm" disabled={committing}
                onClick={() => { setChecked(new Set(actionableNames)); }}>
                Select new &amp; changed
              </Button>
            )}
            <Button size="sm" onClick={handleCommit} disabled={committing || checked.size === 0}>
              {committing
                ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Saving…</>
                : <><CheckCircle2 className="size-3.5 mr-1.5" /> Accept {checked.size > 0 ? `(${checked.size})` : ""}</>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-component: attribute table ───────────────────────────────────────────

function DiffTable({ rows, checked, onToggle, showCurrent = false, dimmed = false }: {
  rows: DiffRow[];
  checked: Set<string>;
  onToggle: (name: string) => void;
  showCurrent?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-border overflow-hidden", dimmed && "opacity-60")}>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-secondary/40 text-muted-foreground">
            <th className="w-8 py-1.5 px-2 text-left font-medium"></th>
            <th className="py-1.5 px-2 text-left font-medium">Attribute</th>
            {showCurrent && <th className="py-1.5 px-2 text-left font-medium">Current</th>}
            <th className="py-1.5 px-2 text-left font-medium">{showCurrent ? "Proposed" : "Value"}</th>
            <th className="py-1.5 px-2 text-right font-medium">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.attributeName}
              onClick={() => onToggle(row.attributeName)}
              className={cn(
                "border-t border-border cursor-pointer transition-colors",
                i % 2 === 0 ? "bg-card" : "bg-secondary/10",
                checked.has(row.attributeName) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/30",
              )}
            >
              <td className="py-1.5 px-2">
                <input
                  type="checkbox"
                  checked={checked.has(row.attributeName)}
                  onChange={() => onToggle(row.attributeName)}
                  onClick={e => e.stopPropagation()}
                  className="accent-primary"
                />
              </td>
              <td className="py-1.5 px-2 font-medium text-foreground">
                {formatAttrName(row.attributeName)}
                <span className="ml-1 text-muted-foreground font-normal">· {row.attributeGroup}</span>
              </td>
              {showCurrent && (
                <td className="py-1.5 px-2 text-muted-foreground line-through">
                  {row.currentValue ?? <span className="italic">—</span>}
                </td>
              )}
              <td className={cn("py-1.5 px-2", row.status === "new" ? "text-success font-medium" : row.status === "changed" ? "text-warning font-medium" : "text-foreground")}>
                {row.newValue || <span className="italic text-muted-foreground">empty</span>}
              </td>
              <td className="py-1.5 px-2 text-right text-muted-foreground">{row.confidence}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

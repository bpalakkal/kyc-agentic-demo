import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Bot, Play, Zap, Sparkles, ClipboardList, Database, ShieldCheck,
  ChevronRight, FileText, Paperclip, GitMerge, Loader2, CheckCircle2, Circle, XCircle, Pencil,
} from "lucide-react";
import type { ForgeLineageEntry } from "@/types/forgeTypes";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import type { AgentId, InlineProposal } from "@/components/AgentSystem";
import type { ForgeAttrRow } from "@/types/forgeTypes";
import { prettifyAttrLabel, lineageConflict } from "@/lib/attrLabel";
import {
  type AttrTrace, type EntityAttr, type AttrDoc, type AuditEntry,
  SOURCE_STYLE, DOC_KIND_META,
} from "@/data/kycMockData";

// ─── SourceStrip ─────────────────────────────────────────────────────────────
// Shows per-source values below an attribute when lineage has multiple sources.
// Green pill = source agrees with display_value; amber = different value.

type SourceStripProps = {
  lineage?: ForgeLineageEntry[] | null;
  displayValue?: string | null;
};

const SourceStrip = ({ lineage, displayValue }: SourceStripProps) => {
  if (!lineage || lineage.length < 2) return null;

  // Dedupe by source — keep first occurrence (highest priority wins in merge)
  const sources = lineage
    .filter(e => e.source)
    .reduce<{ source: string; value: string }[]>((acc, e) => {
      if (!acc.find(a => a.source === e.source)) {
        acc.push({ source: e.source!, value: String(e.value ?? "").trim() });
      }
      return acc;
    }, []);

  if (sources.length < 2) return null;

  const primary = (displayValue ?? "").toLowerCase().trim();
  const allAgree = sources.every(s => s.value.toLowerCase().trim() === primary);
  if (allAgree) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
      <GitMerge className="size-2.5 text-muted-foreground/40 shrink-0" />
      {(
        sources.map((s, i) => {
          const matches = s.value.toLowerCase().trim() === primary;
          const label = s.value.length > 28 ? s.value.slice(0, 28) + "…" : s.value;
          return (
            <span key={i} className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full border font-medium",
              matches
                ? "bg-success-soft text-success border-success/20"
                : "bg-warning-soft text-warning border-warning/30"
            )}>
              {s.source}: {label}
            </span>
          );
        })
      )}
    </div>
  );
};

// ─── SimpleFieldRow ───────────────────────────────────────────────────────────

export type SimpleFieldRowProps = {
  label: string;
  entity: string;
  forgeAttr?: ForgeAttrRow | null;
  savedOverrides: Record<string, { value: string; actor: string; timestamp: string; note?: string }>;
  openTraceFor: { label: string; entity: string } | null;
  setOpenTraceFor: Dispatch<SetStateAction<{ label: string; entity: string } | null>>;
  openOverrideFor: { label: string; entity: string } | null;
  setOpenOverrideFor: Dispatch<SetStateAction<{ label: string; entity: string } | null>>;
  trace: AttrTrace | null;
  traceDocs: { entity: string; attr: EntityAttr; doc: AttrDoc }[];
  runAgents: (agentIds: AgentId[], label?: string) => void;
  overrideDraft: string;
  setOverrideDraft: Dispatch<SetStateAction<string>>;
  overrideNote: string;
  setOverrideNote: Dispatch<SetStateAction<string>>;
  handleSaveOverride: (draftKey: string) => void;
  /** Attribute is optional for this entity type (collect if provided, no IDV). */
  optional?: boolean;
  /** A pending sourcing proposal for this attribute (inline review). */
  pendingProposal?: InlineProposal | null;
  onAcceptProposal?: () => void;
  onRejectProposal?: () => void;
};

export const SimpleFieldRow = ({
  label, entity,
  forgeAttr,
  savedOverrides, openTraceFor, setOpenTraceFor, openOverrideFor, setOpenOverrideFor,
  trace, traceDocs,
  runAgents, overrideDraft, setOverrideDraft, overrideNote, setOverrideNote, handleSaveOverride,
  optional, pendingProposal, onAcceptProposal, onRejectProposal,
}: SimpleFieldRowProps) => {
  const overrideKey = `${entity}::${label}`;
  const override = savedOverrides[overrideKey];
  const currentValue = override?.value ?? forgeAttr?.display_value ?? "";
  const isOverridden = !!override;
  const conflict = lineageConflict(forgeAttr?.lineage);
  // Sources disagree and the attribute has not been ID-confirmed → needs review.
  // Once the ID flag is set (confirmed), differing values no longer flag it.
  const conflictReview = !isOverridden && !!conflict && !!forgeAttr && !forgeAttr.id_flag && !forgeAttr.exception_flag;
  const isAlert = !isOverridden && !!forgeAttr?.exception_flag;
  const isWarn  = conflictReview;
  const isOpen  = openTraceFor?.label === label && openTraceFor?.entity === entity;
  const isOverrideOpen = openOverrideFor?.label === label && openOverrideFor?.entity === entity;
  // A trace is available if there is live DB data for this attribute.
  const hasTrace = !!forgeAttr;
  // Show audit trail only when there is an analyst override and no live DB data.
  const isAuditOnly = !forgeAttr && isOverridden;

  // ID/V badges are only green from real DB flags.
  const idOk  = forgeAttr?.id_flag ?? false;
  const vOk   = !conflictReview && (forgeAttr?.verification_flag ?? false);
  const vWarn = conflictReview || (!!forgeAttr && !forgeAttr.verification_flag && !forgeAttr.exception_flag && forgeAttr.id_flag);
  const vAlert = forgeAttr ? (!forgeAttr.verification_flag && forgeAttr.exception_flag) : false;

  const idLabel = idOk
    ? <span className="text-success font-bold">ID✓</span>
    : <span className="text-muted-foreground/50">ID–</span>;
  const vLabel = vOk    ? <span className="text-success font-bold">V✓</span>
               : vAlert ? <span className="text-alert font-bold">V✕</span>
               : vWarn  ? <span className="text-warning font-bold">V⚠</span>
               :          <span className="text-muted-foreground/50">V–</span>;

  const accentBorder = isOverridden ? "border-success" : isAlert ? "border-alert" : isWarn ? "border-warning" : "border-border";
  const accentBg     = isOverridden ? "bg-success-soft/30" : isAlert ? "bg-alert-soft/20" : isWarn ? "bg-warning-soft/20" : "bg-secondary/30";
  const accentBar    = isOverridden ? "bg-success" : isAlert ? "bg-alert" : isWarn ? "bg-warning" : "bg-border";
  const valueColor   = isAlert ? "text-alert" : isWarn ? "text-warning" : "text-foreground";

  return (
    <>
      <div className={cn("p-3 transition-colors", (isOpen || isOverrideOpen) && "col-span-2")}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none flex items-center gap-1.5">
            {prettifyAttrLabel(label)}
            {optional && (
              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border normal-case tracking-normal">
                optional
              </span>
            )}
            {conflictReview && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning border border-warning-soft-border normal-case tracking-normal">
                {conflict!.length} sources differ
              </span>
            )}
            {pendingProposal && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning border border-warning-soft-border normal-case tracking-normal inline-flex items-center gap-0.5">
                <Sparkles className="size-2.5" /> conflict
              </span>
            )}
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] whitespace-nowrap">
              {idLabel}<span className="text-muted-foreground/30 mx-0.5">/</span>{vLabel}
            </span>
            {forgeAttr?.exception_flag && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold bg-warning-soft text-warning border-warning/40">
                {forgeAttr.exception_type ?? "Exception"}
              </span>
            )}
          </div>
        </div>

        <div className={cn("rounded-md border flex items-center gap-2.5 px-2.5 py-2", accentBorder, accentBg)}>
          <div className={cn("w-[3px] self-stretch min-h-[18px] rounded-full shrink-0", accentBar)} />
          <span className={cn("flex-1 text-[13px] font-semibold leading-snug min-w-0", valueColor)}>
            {currentValue || <span className="text-muted-foreground/30 italic text-[11px] font-normal">—</span>}
            {isOverridden && (
              <span className="ml-2 text-[9px] font-semibold text-success border border-success/40 bg-success-soft rounded px-1.5 py-0.5">✎ Overridden</span>
            )}
          </span>

          {isAuditOnly ? (
            <button
              onClick={() => setOpenTraceFor(isOpen ? null : { label, entity })}
              className={cn(
                "flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border transition-colors shrink-0",
                isOpen
                  ? "bg-secondary text-foreground border-border"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground bg-card"
              )}
            >
              <ClipboardList className="size-3" />{isOpen ? "▲" : "Audit"}
            </button>
          ) : hasTrace ? (
            <button
              onClick={() => setOpenTraceFor(isOpen ? null : { label, entity })}
              className={cn(
                "flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border transition-colors shrink-0",
                isOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary bg-card"
              )}
            >
              <Bot className="size-3" />{isOpen ? "▲" : "Trace"}
            </button>
          ) : (
            // No DB data for this attribute yet — offer a direct manual entry shortcut.
            <button
              onClick={() => {
                setOverrideDraft("");
                setOverrideNote("");
                setOpenOverrideFor(isOverrideOpen ? null : { label, entity });
              }}
              className={cn(
                "flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border transition-colors shrink-0",
                isOverrideOpen
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary bg-card"
              )}
            >
              <Pencil className="size-3" />{isOverrideOpen ? "▲" : "Add"}
            </button>
          )}
        </div>
        {conflictReview && <SourceStrip lineage={forgeAttr?.lineage} displayValue={forgeAttr?.display_value} />}

        {/* Conflict proposal — agent found a different value; analyst must decide */}
        {pendingProposal && (
          <div className="mt-1.5 rounded-md border border-warning/30 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border/50">
              {/* Current stored value */}
              <div className="px-2.5 py-2 bg-secondary/60">
                <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Stored</div>
                <div className="text-[11px] text-muted-foreground/70 line-through leading-snug">
                  {pendingProposal.currentValue || <span className="not-italic no-underline text-muted-foreground/40">—</span>}
                </div>
              </div>
              {/* Agent-found value */}
              <div className="px-2.5 py-2 bg-warning-soft/30">
                <div className="text-[8px] font-bold uppercase tracking-widest text-warning/80 mb-1 flex items-center gap-1">
                  <Sparkles className="size-2.5" /> Agent found
                </div>
                <div className="text-[11px] font-semibold text-warning leading-snug" title={pendingProposal.proposedValue}>
                  {pendingProposal.proposedValue || <span className="italic font-normal text-muted-foreground">empty</span>}
                </div>
              </div>
            </div>
            {/* Footer: source + action buttons */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-secondary/20 border-t border-border/40">
              <span className="text-[9px] text-muted-foreground flex-1 truncate">{pendingProposal.source || pendingProposal.agentSlug}</span>
              <button
                onClick={onAcceptProposal}
                className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-success text-white hover:bg-success/90 transition-colors shrink-0"
              >
                Accept
              </button>
              <button
                onClick={onRejectProposal}
                className="text-[9px] font-semibold px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors shrink-0"
              >
                Keep current
              </button>
            </div>
          </div>
        )}
      </div>
      {isOverrideOpen && (
        <div className="col-span-2 px-4 py-3 border-l-2 border-warning bg-warning-soft/20 border-b border-border/60">
          <p className="text-[10px] font-semibold text-warning mb-2 flex items-center gap-1.5">
            <Zap className="size-3" /> Override value — <span className="font-normal text-muted-foreground">{label}</span>
          </p>
          {overrideDraft.length > 80 ? (
            <Textarea
              className="text-[12px] min-h-[60px] max-h-[120px] resize-y mb-2"
              value={overrideDraft}
              onChange={e => setOverrideDraft(e.target.value)}
              placeholder={`Enter corrected value for ${label}`}
              autoFocus
            />
          ) : (
            <Input
              className="h-8 text-[12px] mb-2"
              value={overrideDraft}
              onChange={e => setOverrideDraft(e.target.value)}
              placeholder={`Enter corrected value for ${label}`}
              autoFocus
            />
          )}
          <Textarea
            className="text-[11px] min-h-[48px] resize-none mb-3"
            value={overrideNote}
            onChange={e => setOverrideNote(e.target.value)}
            placeholder="Reason for override (optional)"
          />
          <div className="flex items-center gap-2">
            <button
              disabled={!overrideDraft.trim()}
              onClick={() => handleSaveOverride(`${entity}::${label}`)}
              className={cn(
                "text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors",
                overrideDraft.trim()
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Save override
            </button>
            <button
              onClick={() => { setOpenOverrideFor(null); setOverrideDraft(""); setOverrideNote(""); }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <span className="ml-auto text-[9px] text-muted-foreground">Confidence will be set to 1.0</span>
          </div>
        </div>
      )}
    </>
  );
};

// ─── InlineTraceDrawer ────────────────────────────────────────────────────────

type InlineTraceDrawerProps = {
  label: string;
  entity: string;
  isAuditOnly: boolean;
  kycRef?: string | null;
  forgeAttr?: ForgeAttrRow | null;
  savedOverrides: Record<string, { value: string; actor: string; timestamp: string; note?: string }>;
  trace: AttrTrace | null;
  traceDocs: { entity: string; attr: EntityAttr; doc: AttrDoc }[];
  runAgents: (agentIds: AgentId[], label?: string) => void;
  setOpenTraceFor: Dispatch<SetStateAction<{ label: string; entity: string } | null>>;
  openOverrideFor: { label: string; entity: string } | null;
  setOpenOverrideFor: Dispatch<SetStateAction<{ label: string; entity: string } | null>>;
  overrideDraft: string;
  setOverrideDraft: Dispatch<SetStateAction<string>>;
  setOverrideNote: Dispatch<SetStateAction<string>>;
};

export const InlineTraceDrawer = ({
  label, entity, isAuditOnly, kycRef,
  forgeAttr,
  savedOverrides, trace, traceDocs,
  runAgents, setOpenTraceFor,
  openOverrideFor, setOpenOverrideFor,
  overrideDraft, setOverrideDraft, setOverrideNote,
}: InlineTraceDrawerProps) => {
  // Source-document viewer (opens a datastore PDF via the auth-guarded proxy).
  const [docView, setDocView] = useState<{ file: string; blobUrl: string } | null>(null);
  const [docOpening, setDocOpening] = useState<string | null>(null);
  const openDoc = async (file: string) => {
    if (!kycRef) return;
    setDocOpening(file);
    try {
      const r = await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/artifact?file=${encodeURIComponent(file)}`);
      if (!r.ok) return;
      setDocView({ file, blobUrl: URL.createObjectURL(await r.blob()) });
    } catch { /* ignore */ } finally { setDocOpening(null); }
  };
  const closeDoc = () => { if (docView) URL.revokeObjectURL(docView.blobUrl); setDocView(null); };
  const isManualOverride = !!savedOverrides[`${entity}::${label}`];
  // Use real DB confidence (0-100 int)
  const rawConf = forgeAttr?.confidence ?? null;
  const displayConf = isManualOverride ? 100 : (rawConf ?? 0);
  const confLabel = isManualOverride ? "1.0" : `${Math.round(displayConf)}%`;
  const confColor = isManualOverride ? "text-success"
    : displayConf >= 90 ? "text-primary"
    : displayConf >= 70 ? "text-warning"
    : "text-alert";
  const confBarColor = isManualOverride ? "bg-success"
    : displayConf >= 90 ? "bg-primary"
    : displayConf >= 70 ? "bg-warning"
    : "bg-alert";

  // Audit log is always empty — real audit history comes from the DB lineage / Forge trace.
  const auditLog: AuditEntry[] = [];

  return (
    <div className="flex flex-col">
      {!isAuditOnly && (
        <div className="px-4 pt-4 pb-3 border-b border-border/60">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Confidence</p>
              <p className={cn("text-[32px] font-black leading-none", confColor)}>{confLabel}</p>
            </div>
            <div className="flex-1 pb-1.5">
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", confBarColor)} style={{ width: `${Math.min(displayConf, 100)}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                {isManualOverride ? "Manually overridden · locked at 1.0" : displayConf >= 90 ? "High confidence" : displayConf >= 70 ? "Moderate confidence — review advised" : "Low confidence — exception flagged"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── ID & Verification status — completed? by which source? ── */}
      {!isAuditOnly && forgeAttr && (() => {
        const idDone = forgeAttr.id_flag;
        const vDone  = forgeAttr.verification_flag;
        const vFailed = !vDone && forgeAttr.exception_flag;
        const vSources = Array.isArray(forgeAttr.verification_source)
          ? forgeAttr.verification_source.filter(Boolean)
          : (forgeAttr.verification_source ? [forgeAttr.verification_source] : []);
        const docEntry = forgeAttr.lineage?.find(l => l.document);
        const sourceDoc = docEntry?.document ?? null;
        const sourceDocType = docEntry?.document_type ?? null;
        return (
          <div className="px-4 py-3 border-b border-border/60 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-primary" /> ID &amp; Verification
              {forgeAttr.confirmed && (
                <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-success-soft text-success border border-success/30 normal-case tracking-normal">
                  Analyst-confirmed
                </span>
              )}
            </p>

            {/* Identification */}
            <div className="flex items-start gap-2">
              {idDone ? <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" /> : <Circle className="size-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground">
                  Identification — <span className={idDone ? "text-success" : "text-muted-foreground"}>{idDone ? "Completed" : "Not completed"}</span>
                </p>
                {idDone && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Database className="size-2.5 shrink-0" />
                    {forgeAttr.id_source ? <>Source: <span className="text-foreground font-medium">{forgeAttr.id_source}</span></> : "Source not recorded"}
                  </p>
                )}
                {sourceDoc && (
                  <button
                    onClick={() => openDoc(sourceDoc)}
                    disabled={!kycRef}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                  >
                    {docOpening === sourceDoc ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
                    View source document{sourceDocType ? ` · ${sourceDocType}` : ""}
                  </button>
                )}
              </div>
            </div>

            {/* Verification */}
            <div className="flex items-start gap-2">
              {vDone ? <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                : vFailed ? <XCircle className="size-3.5 text-alert shrink-0 mt-0.5" />
                : <Circle className="size-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground">
                  Verification — <span className={vDone ? "text-success" : vFailed ? "text-alert" : "text-muted-foreground"}>
                    {vDone ? "Verified" : vFailed ? "Failed" : "Not verified"}
                  </span>
                </p>
                {vDone && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Database className="size-2.5 shrink-0" />
                    {vSources.length ? <>Source: <span className="text-foreground font-medium">{vSources.join(", ")}</span></> : "Source not recorded"}
                  </p>
                )}
                {vFailed && forgeAttr.exception_type && (
                  <p className="text-[10px] text-alert mt-0.5">{forgeAttr.exception_type}</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-secondary/20">
        {!isAuditOnly && (
          <button
            onClick={() => trace && runAgents(trace.agents.map(a => a.id as AgentId), `Re-verify: ${label}`)}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="size-3" /> Re-run Agent
          </button>
        )}
        <button
          onClick={() => {
            const current = savedOverrides[`${entity}::${label}`]?.value
              ?? forgeAttr?.display_value
              ?? "";
            setOverrideDraft(current);
            setOverrideNote("");
            setOpenOverrideFor({ label, entity });
          }}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md border border-warning/60 bg-warning-soft text-warning hover:opacity-90 transition-opacity"
        >
          <Zap className="size-3" /> Override Value
        </button>
      </div>

      <div className="px-4 py-4 space-y-6">
        {!isAuditOnly && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" /> Agent Reasoning
            </p>
            {trace ? (
              <>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-success" /> Conclusion
                  </p>
                  <p className="text-[11px] leading-snug text-foreground">{trace.conclusion}</p>
                </div>
                <ol className="space-y-3">
                  {trace.agents.map((a, i) => (
                    <li key={a.id} className="relative pl-7">
                      <span className="absolute left-0 top-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0">{i + 1}</span>
                      {i < trace.agents.length - 1 && <span className="absolute left-[9px] top-6 bottom-[-12px] w-px bg-border" />}
                      <p className="text-[11px] font-semibold">{a.name} <span className="text-muted-foreground font-normal">→ {a.action}</span></p>
                      <p className="text-[10px] text-muted-foreground italic mt-0.5 leading-snug">"{a.thought}"</p>
                      <p className="text-[9px] text-primary mt-1 flex items-center gap-1"><Database className="size-2.5" />{a.source}</p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground italic text-center py-3">No agent trace available for this attribute.</p>
            )}
          </div>
        )}

        {/* ── Per-source values from real DB lineage ── */}
        {!isAuditOnly && forgeAttr?.lineage && forgeAttr.lineage.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <GitMerge className="size-3 text-primary" /> Source Data
            </p>
            <div className="space-y-1.5">
              {(forgeAttr.lineage as ForgeLineageEntry[])
                .filter(l => l.value != null && String(l.value).trim())
                .map((l, i) => {
                  const val = String(l.value ?? "").trim();
                  const isPrimary = val.toLowerCase() === (forgeAttr.display_value ?? "").toLowerCase().trim();
                  const conf = l.confidence_score != null ? Math.round(Number(l.confidence_score) * (Number(l.confidence_score) <= 1 ? 100 : 1)) : null;
                  return (
                    <div key={i} className={cn(
                      "rounded-md border px-3 py-2 text-[11px]",
                      isPrimary ? "border-success/30 bg-success-soft/20" : "border-border bg-secondary/40",
                    )}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-[9px] font-bold uppercase tracking-widest", isPrimary ? "text-success" : "text-muted-foreground")}>
                          {l.source ?? "Unknown source"}
                        </span>
                        {isPrimary && <span className="text-[8px] px-1 rounded bg-success/10 text-success border border-success/20">primary</span>}
                        {conf != null && (
                          <span className={cn("ml-auto text-[9px] font-semibold", conf >= 90 ? "text-primary" : conf >= 70 ? "text-warning" : "text-muted-foreground")}>
                            {conf}%
                          </span>
                        )}
                      </div>
                      <p className={cn("font-medium", isPrimary ? "text-foreground" : "text-muted-foreground")}>{val}</p>
                      {l.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{l.note}</p>}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 shrink-0">
              <ClipboardList className="size-3" /> Audit Trail
              {auditLog.length > 0 && <span className="font-normal text-[9px]">({auditLog.length})</span>}
            </p>
            <div className="flex-1 h-px bg-border" />
          </div>
          {auditLog.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">No audit history for this attribute.</p>
          ) : (
            <div className="space-y-0">
              {auditLog.map((entry, idx) => (
                <div key={idx} className="flex gap-3 relative pb-4">
                  {idx < auditLog.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                  <div className={cn(
                    "size-[22px] rounded-full border-2 flex items-center justify-center text-[9px] shrink-0 mt-0.5",
                    entry.type === "agent"      ? "border-primary/40 bg-info-soft text-primary"
                    : entry.type === "override" ? "border-success/40 bg-success-soft text-success"
                    :                             "border-warning/40 bg-warning-soft text-warning"
                  )}>
                    {entry.type === "agent" ? "🤖" : entry.type === "override" ? "✎" : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">
                      {entry.actor}
                      {entry.role && <span className="ml-1 font-normal text-muted-foreground text-[9px]">({entry.role})</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{entry.action}</p>
                    {(entry.valueBefore !== undefined || entry.valueAfter !== undefined) && (
                      <div className="mt-1 text-[9px] bg-secondary/50 rounded px-2 py-1 inline-flex items-center gap-1.5 border border-border">
                        {entry.valueBefore && <span className="line-through text-muted-foreground">{entry.valueBefore}</span>}
                        {entry.valueBefore && entry.valueAfter && <ChevronRight className="size-2.5 text-muted-foreground shrink-0" />}
                        {entry.valueAfter && <span className="font-semibold text-foreground">{entry.valueAfter}</span>}
                      </div>
                    )}
                    {entry.confidence !== undefined && (
                      <span className={cn(
                        "mt-1 inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border",
                        entry.isManual ? "bg-success-soft text-success border-success/30"
                        : entry.confidence >= 90 ? "bg-info-soft text-primary border-primary/20"
                        : entry.confidence >= 70 ? "bg-warning-soft text-warning border-warning/20"
                        : "bg-alert-soft text-alert border-alert/20"
                      )}>
                        Confidence {entry.isManual ? "1.0 · Manual" : `${Math.round(entry.confidence)}%`}
                      </span>
                    )}
                    {entry.source && <p className="text-[9px] text-primary mt-0.5 flex items-center gap-0.5"><Database className="size-2.5" />{entry.source}</p>}
                    <p className="text-[9px] text-muted-foreground mt-1">{entry.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {traceDocs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 shrink-0">
                <Paperclip className="size-3" /> Related Documents
                <span className="font-normal text-[9px]">({traceDocs.length})</span>
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              {traceDocs.map(({ doc, entity: docEntity }) => {
                const meta = DOC_KIND_META[doc.kind];
                return (
                  <div key={`${docEntity}-${doc.id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{doc.title}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{docEntity} · {doc.source} · {doc.date}</p>
                    </div>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide shrink-0", meta.tone)}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* PDF / image source-document viewer */}
      {docView && (
        <Dialog open onOpenChange={(o) => { if (!o) closeDoc(); }}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
            <DialogHeader className="px-4 py-2.5 border-b border-border">
              <DialogTitle className="text-[13px] truncate">{docView.file}</DialogTitle>
            </DialogHeader>
            <div className="bg-secondary/20 overflow-auto" style={{ height: "76vh" }}>
              <iframe src={docView.blobUrl} title={docView.file} className="w-full h-full border-0" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

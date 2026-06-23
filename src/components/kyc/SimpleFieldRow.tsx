import type { Dispatch, SetStateAction } from "react";
import {
  Bot, Play, Zap, Sparkles, ClipboardList, Database, ShieldCheck,
  ChevronRight, FileText, Paperclip, GitMerge,
} from "lucide-react";
import type { ForgeLineageEntry } from "@/types/forgeTypes";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AgentId } from "@/components/AgentSystem";
import type { ForgeAttrRow } from "@/types/forgeTypes";
import {
  type AttrTrace, type EntityAttr, type AttrDoc, type AuditEntry,
  ENTITY_PROFILES, ATTRIBUTE_TRACES, SOURCE_STYLE, DOT_STYLE,
  DOC_KIND_META, ATTR_AUDIT_LOG, NESTED_ATTR_PROFILES,
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

  return (
    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
      <GitMerge className="size-2.5 text-muted-foreground/40 shrink-0" />
      {allAgree ? (
        <>
          {sources.map((s, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-success-soft text-success border border-success/20 font-medium">
              {s.source}
            </span>
          ))}
          <span className="text-[9px] text-muted-foreground/50 italic">agree</span>
        </>
      ) : (
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
};

export const SimpleFieldRow = ({
  label, entity,
  forgeAttr,
  savedOverrides, openTraceFor, setOpenTraceFor, openOverrideFor, setOpenOverrideFor,
  trace, traceDocs,
  runAgents, overrideDraft, setOverrideDraft, overrideNote, setOverrideNote, handleSaveOverride,
}: SimpleFieldRowProps) => {
  const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
  const overrideKey = `${entity}::${label}`;
  const override = savedOverrides[overrideKey];
  const currentValue = override?.value ?? forgeAttr?.display_value ?? pa?.value ?? "";
  const isOverridden = !!override;
  const isAlert = !isOverridden && (forgeAttr?.exception_flag || pa?.status === "alert");
  const isWarn  = !isOverridden && !forgeAttr && pa?.status === "warn";
  const isOpen  = openTraceFor?.label === label && openTraceFor?.entity === entity;
  const isOverrideOpen = openOverrideFor?.label === label && openOverrideFor?.entity === entity;
  const hasTrace = !!(ATTRIBUTE_TRACES[label] || pa || forgeAttr);
  const isAuditOnly = !forgeAttr && (pa?.source === "CRM" || isOverridden);

  const idOk  = isOverridden ? true : (forgeAttr ? forgeAttr.id_flag : !!pa);
  const vOk   = isOverridden ? true : (forgeAttr ? forgeAttr.verification_flag : pa?.status === "ok");
  const vWarn = !isOverridden && !forgeAttr && pa?.status === "warn";
  const vAlert = !isOverridden && (forgeAttr ? (!forgeAttr.verification_flag && forgeAttr.exception_flag) : pa?.status === "alert");

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
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">{label}</label>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] whitespace-nowrap">
              {idLabel}<span className="text-muted-foreground/30 mx-0.5">/</span>{vLabel}
            </span>
            {forgeAttr?.exception_flag && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold bg-warning-soft text-warning border-warning/40">
                {forgeAttr.exception_type ?? "Exception"}
              </span>
            )}
            {!forgeAttr && pa && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold", SOURCE_STYLE[pa.source])}>
                {pa.source}
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
          ) : (
            <button
              disabled={!hasTrace}
              onClick={() => setOpenTraceFor(isOpen ? null : { label, entity })}
              className={cn(
                "flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border transition-colors shrink-0",
                isOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : hasTrace
                  ? "border-border text-muted-foreground hover:border-primary hover:text-primary bg-card"
                  : "border-border/30 text-muted-foreground/30 cursor-not-allowed bg-transparent"
              )}
            >
              <Bot className="size-3" />{isOpen ? "▲" : "Trace"}
            </button>
          )}
        </div>
        <SourceStrip lineage={forgeAttr?.lineage} displayValue={forgeAttr?.display_value} />
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
  label, entity, isAuditOnly,
  forgeAttr,
  savedOverrides, trace, traceDocs,
  runAgents, setOpenTraceFor,
  openOverrideFor, setOpenOverrideFor,
  overrideDraft, setOverrideDraft, setOverrideNote,
}: InlineTraceDrawerProps) => {
  const isManualOverride = !!savedOverrides[`${entity}::${label}`];
  // Prefer real DB confidence (0-100 int) over mock trace confidence
  const rawConf = forgeAttr?.confidence ?? (trace?.confidence ?? null);
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

  const auditLog: AuditEntry[] = ATTR_AUDIT_LOG[label] ?? [];

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

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-secondary/20">
        {!isAuditOnly && (
          <button
            onClick={() => trace && runAgents(trace.agents.map(a => a.id), `Re-verify: ${label}`)}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="size-3" /> Re-run Agent
          </button>
        )}
        <button
          onClick={() => {
            const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
            const current = savedOverrides[`${entity}::${label}`]?.value
              ?? forgeAttr?.display_value
              ?? pa?.value
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
    </div>
  );
};

// ─── NestedObjectBlock ────────────────────────────────────────────────────────

type NestedObjectBlockProps = {
  label: string;
  entity: string;
  openTraceFor: { label: string; entity: string } | null;
  setOpenTraceFor: React.Dispatch<React.SetStateAction<{ label: string; entity: string } | null>>;
  savedOverrides: Record<string, { value: string; actor: string; timestamp: string; note?: string }>;
  trace: AttrTrace | null;
  traceDocs: { entity: string; attr: EntityAttr; doc: AttrDoc }[];
  runAgents: (agentIds: AgentId[], label?: string) => void;
  openOverrideFor: { label: string; entity: string } | null;
  setOpenOverrideFor: React.Dispatch<React.SetStateAction<{ label: string; entity: string } | null>>;
  overrideDraft: string;
  setOverrideDraft: React.Dispatch<React.SetStateAction<string>>;
  setOverrideNote: React.Dispatch<React.SetStateAction<string>>;
};

export const NestedObjectBlock = ({
  label, entity,
  openTraceFor, setOpenTraceFor,
  savedOverrides, trace, traceDocs,
  runAgents, openOverrideFor, setOpenOverrideFor,
  overrideDraft, setOverrideDraft, setOverrideNote,
}: NestedObjectBlockProps) => {
  const entries = NESTED_ATTR_PROFILES[label];
  if (!entries) return null;

  const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
  const groupStatus: EntityAttr["status"] = entries.flatMap(e => e.fields).some(f => f.status === "alert")
    ? "alert" : entries.flatMap(e => e.fields).some(f => f.status === "warn") ? "warn" : "ok";
  const hasTrace = !!(ATTRIBUTE_TRACES[label] || pa);
  const isGroupOpen = openTraceFor?.label === label && openTraceFor?.entity === entity;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b border-border",
        groupStatus === "alert" ? "bg-alert-soft/20" : groupStatus === "warn" ? "bg-warning-soft/20" : "bg-secondary/30"
      )}>
        <div className={cn("size-1.5 rounded-full shrink-0", DOT_STYLE[groupStatus])} />
        <span className="text-[11px] font-semibold text-foreground flex-1">{label}</span>
        <span className="text-[9px] font-bold">
          <span className="text-success">ID✓</span>
          <span className="text-muted-foreground/30 mx-0.5">/</span>
          <span className={groupStatus === "ok" ? "text-success" : groupStatus === "warn" ? "text-warning" : "text-alert"}>
            {groupStatus === "ok" ? "V✓" : groupStatus === "warn" ? "V⚠" : "V✕"}
          </span>
        </span>
        {pa && <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold", SOURCE_STYLE[pa.source])}>{pa.source}</span>}
        <button
          disabled={!hasTrace}
          onClick={() => setOpenTraceFor(isGroupOpen ? null : { label, entity })}
          className={cn(
            "flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded border transition-colors",
            isGroupOpen ? "bg-primary text-primary-foreground border-primary"
              : hasTrace ? "border-border text-muted-foreground hover:border-primary hover:text-primary bg-card"
              : "border-border/30 text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          <Bot className="size-3" />{isGroupOpen ? "▲" : "Trace"}
        </button>
      </div>

      {entries.map((entry, ei) => (
        <div key={ei} className="border-b border-border/50 last:border-b-0">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/20">
            <div className={cn(
              "size-1.5 rounded-full shrink-0",
              entry.fields.some(f => f.status === "alert") ? "bg-alert"
                : entry.fields.some(f => f.status === "warn") ? "bg-warning"
                : "bg-success"
            )} />
            <span className="text-[10px] font-semibold text-foreground">{entry.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold">{entry.tag}</span>
          </div>
          {entry.fields.map(field => {
            const vOk = field.status === "ok";
            const vWarn = field.status === "warn";
            return (
              <div key={field.label} className={cn(
                "flex items-center gap-3 pl-8 pr-4 py-2 border-t border-border/30 hover:bg-secondary/20 transition-colors",
                field.status === "alert" ? "bg-alert-soft/10" : ""
              )}>
                <div className={cn("size-1.5 rounded-full shrink-0", DOT_STYLE[field.status])} />
                <span className="text-[10px] font-medium text-muted-foreground w-[120px] shrink-0">{field.label}</span>
                <span className={cn(
                  "flex-1 text-[10px]",
                  field.status === "alert" ? "text-alert font-semibold" : field.status === "warn" ? "text-warning" : "text-foreground"
                )}>{field.value}</span>
                <span className="text-[8px] font-bold whitespace-nowrap">
                  <span className="text-success">ID✓</span>
                  <span className="text-muted-foreground/30 mx-0.5">/</span>
                  <span className={vOk ? "text-success" : vWarn ? "text-warning" : "text-alert"}>
                    {vOk ? "V✓" : vWarn ? "V⚠" : "V✕"}
                  </span>
                </span>
                <span className={cn("text-[8px] px-1 py-0.5 rounded border font-semibold", SOURCE_STYLE[field.source])}>{field.source}</span>
                <button
                  disabled
                  className="flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground/30 cursor-not-allowed"
                  title="Trace available on the object level above"
                >
                  <Bot className="size-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

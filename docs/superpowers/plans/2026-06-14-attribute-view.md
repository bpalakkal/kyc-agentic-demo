# Attribute View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hidden right-pane Attributes tab with a full-width Attribute View accessible via an "Exception | Attributes" toggle in the center panel, featuring collapsible form sections, per-field ID/V status badges, inline agent trace drawers with confidence scores, audit timelines, manual override, and nested object blocks for multi-record attributes.

**Architecture:** All new components live in `src/pages/ExceptionReview.tsx` alongside the existing local types and constants they depend on (`ENTITY_PROFILES`, `ATTRIBUTE_TRACES`, `SOURCE_AGENT`, `ATTR_CATEGORY_ORDER`, etc.). `attrViewMode` state in the main `ExceptionReview` component controls which view the center panel renders. A new `AttributeFormView` component (and its sub-components) replaces `AttributeTree` in the UI while `AttributeTree` itself is left intact (it may be removed in a future cleanup pass).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui (`Input`, `Textarea`), lucide-react, existing project patterns.

---

## File Changed

**Modify:** `src/pages/ExceptionReview.tsx` (~4 466 lines before changes)

**Note:** This file is already very large. New components are kept here because they depend on module-level types and constants (`Exc`, `EntityAttr`, `AttrTrace`, `ENTITY_PROFILES`, `ATTRIBUTE_TRACES`, `ATTR_CATEGORY_ORDER`, `SOURCE_AGENT`, `DOT_STYLE`, `SOURCE_STYLE`, `categoryOf`) that cannot be imported elsewhere without a larger refactor. Flag file growth as DONE_WITH_CONCERNS if the file exceeds ~6 000 lines.

---

## Verification (run after every task)

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2
./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

---

## Task 1 — Imports, `attrViewMode` state, Exception/Attributes tab toggle, remove Attributes from right pane

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

### Step 1 — Add new imports

Current lucide import block (lines 35–40):
```ts
import {
  Info, X, AlertTriangle, FileText, ChevronDown, CheckCircle2,
  Send, Mail, Plus, Minus, Maximize2, ThumbsUp, ThumbsDown, RotateCw, Paperclip,
  ShieldCheck, Database, Search, Sparkles, ChevronRight, Play, Settings2, Building2, Clock,
  ShieldAlert, Briefcase, ArrowRight, UserCircle2, MessageSquare, Bot, Video, Calendar, Network,
} from "lucide-react";
```

Add `Zap` to the list:
```ts
import {
  Info, X, AlertTriangle, FileText, ChevronDown, CheckCircle2,
  Send, Mail, Plus, Minus, Maximize2, ThumbsUp, ThumbsDown, RotateCw, Paperclip,
  ShieldCheck, Database, Search, Sparkles, ChevronRight, Play, Settings2, Building2, Clock,
  ShieldAlert, Briefcase, ArrowRight, UserCircle2, MessageSquare, Bot, Video, Calendar, Network,
  Zap,
} from "lucide-react";
```

After the last existing import (`import { GraphView } from "@/components/GraphView";`), add:
```ts
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
```

- [ ] Apply the two edits above.

### Step 2 — Add `attrViewMode` state

Find line 1033 where `rightTab` is declared:
```ts
const [rightTab, setRightTab] = useState<"attrs" | "locker" | "collab">("attrs");
```

**Replace** that line with:
```ts
const [rightTab, setRightTab] = useState<"locker" | "collab">("locker");
const [attrViewMode, setAttrViewMode] = useState<"exception" | "attributes">("exception");
```

- [ ] Apply the edit above.

### Step 3 — Add the Exception / Attributes tab toggle to the center panel

The center panel starts just before the entity info card. Find this landmark (around line 1164):
```tsx
<div className="rounded-xl border border-border bg-card p-4 mb-4">
```
This is the entity header card. Immediately **before** that opening `<div>`, insert:

```tsx
{/* ── Exception / Attributes view toggle ──────────────────────────── */}
<div className="flex items-center justify-between mb-3">
  <div className="inline-flex text-[11px] font-semibold rounded-md border border-border overflow-hidden">
    <button
      onClick={() => setAttrViewMode("exception")}
      className={cn(
        "px-3 py-1.5 transition-colors",
        attrViewMode === "exception"
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary/60"
      )}
    >
      Exception
    </button>
    <button
      onClick={() => setAttrViewMode("attributes")}
      className={cn(
        "px-3 py-1.5 border-l border-border transition-colors",
        attrViewMode === "attributes"
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary/60"
      )}
    >
      Attributes
    </button>
  </div>
  {attrViewMode === "attributes" && (
    <div className="flex items-center gap-2">
      <button className="text-[11px] px-3 py-1.5 rounded-md border border-warning/60 bg-warning-soft text-warning font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
        <Zap className="size-3" /> Manual Override
      </button>
      <button
        onClick={() => runAgents(["document", "audit"], "Re-run all attributes")}
        className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
      >
        <RotateCw className="size-3" /> Re-run Agents
      </button>
    </div>
  )}
</div>
```

- [ ] Apply the edit above.

### Step 4 — Guard existing exception detail content with `attrViewMode === "exception"`

The center column content runs from the entity info card (line ~1164) through to the start of the right pane aside (line ~1682). Wrap that entire block:

Find the entity info card opening tag:
```tsx
<div className="rounded-xl border border-border bg-card p-4 mb-4">
```
And find the closing brace just before the right pane `<aside` opens. Wrap the whole center content:

```tsx
{attrViewMode === "exception" && (
  <>
    {/* paste the entire existing center-panel content here — entity card through resolution section */}
  </>
)}
{attrViewMode === "attributes" && (
  <div className="py-4 text-sm text-muted-foreground text-center">
    Attribute view — coming in next task
  </div>
)}
```

- [ ] Apply the guard wrapper.

### Step 5 — Remove Attributes tab from the right pane (open state)

Inside the open right pane `<aside>` (around line 1685), find and **delete** the Attributes tab button:
```tsx
<button
  onClick={() => setRightTab("attrs")}
  className={cn(
    "pb-2 text-sm flex items-center gap-1.5 -mb-px transition-colors",
    rightTab === "attrs"
      ? "font-medium border-b-2 border-primary"
      : "text-muted-foreground hover:text-foreground"
  )}
>
  <Settings2 className="size-3.5" /> Attributes
</button>
```

Also find and **delete** the attrs render branch (~line 1733):
```tsx
{rightTab === "attrs" && <AttributeTree selectedEntities={selectedEntities} exceptions={effectiveExceptions} />}
```

- [ ] Delete both blocks.

### Step 6 — Remove Attributes icon from collapsed right pane

In the collapsed pane block (around lines 1752–1759), find and **delete** the Attributes icon button and its separator:
```tsx
<button
  onClick={() => { setRightPaneOpen(true); setRightTab("attrs"); }}
  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary/60 [writing-mode:vertical-rl] rotate-180 flex items-center gap-1.5 py-3 px-1.5 rounded-md transition-colors"
  title="Attributes"
>
  <Settings2 className="size-3" /> Attributes
</button>
<div className="w-5 h-px bg-border/60" />
```

- [ ] Delete both elements.

### Step 7 — Verify TypeScript and commit

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2
./node_modules/.bin/tsc --noEmit
```

```bash
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add exception/attributes toggle, remove attrs from right pane"
```

- [ ] TypeScript passes. Commit made.

---

## Task 2 — `AttributeFormView` shell: status strip + collapsible sections

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

Add the `AuditEntry` type, `ATTR_AUDIT_LOG` mock constant, and the `AttributeFormView` component. Also wire the component into the `attrViewMode === "attributes"` placeholder from Task 1.

### Step 1 — Add `AuditEntry` type and `ATTR_AUDIT_LOG` mock data

Find the `TRACE_DOCS` constant (around line 2540). Immediately **after** its closing `};`, insert:

```ts
type AuditEntry = {
  type: "agent" | "analyst_action" | "override";
  actor: string;
  role?: string;
  action: string;
  valueBefore?: string;
  valueAfter?: string;
  confidence?: number;   // 0–100 for agents; 100 for overrides (rendered as "1.0")
  isManual?: boolean;    // true → render confidence as "1.0" in green
  timestamp: string;
  source?: string;
};

const ATTR_AUDIT_LOG: Record<string, AuditEntry[]> = {
  "LEI Number": [
    {
      type: "agent", actor: "Document Agent", action: "Retrieved from GLEIF registry",
      valueAfter: "549300TRJQK6NRSF5M51", confidence: 87,
      timestamp: "2024-10-28 · 14:32 UTC", source: "GLEIF Registry",
    },
    {
      type: "analyst_action", actor: "James Holloway", role: "Analyst",
      action: "Re-ran agent — value inconsistent with CRM record",
      timestamp: "2024-11-01 · 09:17 UTC",
    },
    {
      type: "agent", actor: "Document Agent", action: "Re-processed GLEIF + CRM cross-reference",
      valueBefore: "549300TRJQK6NRSF5M51", valueAfter: "549300TRJQK6NRSF5M52", confidence: 71,
      timestamp: "2024-11-01 · 09:18 UTC", source: "GLEIF + CRM",
    },
  ],
  "Incorporation Date": [
    {
      type: "agent", actor: "Document Agent", action: "Retrieved from Companies House filing",
      valueAfter: "2002-11-19", confidence: 87,
      timestamp: "2024-10-28 · 14:32 UTC", source: "Companies House",
    },
    {
      type: "analyst_action", actor: "James Holloway", role: "Analyst",
      action: "Re-ran agent — date inconsistent with articles of association",
      timestamp: "2024-11-01 · 09:17 UTC",
    },
    {
      type: "agent", actor: "Document Agent", action: "Re-processed Companies House + MoA",
      valueBefore: "2002-11-19", valueAfter: "2002-11-12", confidence: 71,
      timestamp: "2024-11-01 · 09:18 UTC", source: "Companies House + MoA",
    },
    {
      type: "override", actor: "Sarah Chen", role: "Senior Analyst",
      action: "Manual override — confirmed via incorporation certificate #IC-2002-441",
      valueBefore: "2002-11-12", valueAfter: "2002-11-14",
      confidence: 100, isManual: true,
      timestamp: "2024-11-02 · 11:45 UTC",
    },
  ],
  "Persons of Significant Control": [
    {
      type: "agent", actor: "Document Agent", action: "Retrieved from Companies House PSC register",
      valueAfter: "Alan Howard · 75–100% voting rights", confidence: 88,
      timestamp: "2024-11-01 · 10:05 UTC", source: "Companies House",
    },
    {
      type: "agent", actor: "Audit Agent", action: "Cross-referenced against OFAC + Refinitiv",
      confidence: 82, timestamp: "2024-11-01 · 10:06 UTC", source: "OFAC / Refinitiv",
    },
  ],
};
```

- [ ] Insert the type and constant.

### Step 2 — Add `AttributeFormView` component

Find the closing `};` of `AttributeTree` (around line 3368). Immediately after it, insert the full `AttributeFormView` component:

```tsx
// ── Attribute Form View ──────────────────────────────────────────────────────

const AttributeFormView = ({
  selectedEntities,
  exceptions: excs,
}: {
  selectedEntities: { name: string; kyc: string; drg?: string }[];
  exceptions: Exc[];
}) => {
  const [openTraceFor, setOpenTraceFor] = useState<{ label: string; entity: string } | null>(null);
  const [openOverrideFor, setOpenOverrideFor] = useState<{ label: string; entity: string } | null>(null);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [savedOverrides, setSavedOverrides] = useState<Record<string, { value: string; actor: string; timestamp: string }>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [traceStepsOpen, setTraceStepsOpen] = useState(false);
  const [traceDocsOpen, setTraceDocsOpen] = useState(false);
  const [traceTab, setTraceTab] = useState<"reasoning" | "audit">("reasoning");

  const { runAgents } = useAgents();

  // Reset disclosure state when selected trace changes
  useEffect(() => { setTraceStepsOpen(false); setTraceDocsOpen(false); setTraceTab("reasoning"); }, [openTraceFor]);
  // Close override form when trace changes
  useEffect(() => { setOpenOverrideFor(null); setOverrideDraft(""); setOverrideNote(""); }, [openTraceFor]);

  // Resolve trace for the currently open field (same logic as AttributeTree)
  const trace = useMemo(() => {
    if (!openTraceFor) return null;
    const curated = ATTRIBUTE_TRACES[openTraceFor.label];
    if (curated) return curated;
    const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(x => x.label === openTraceFor.label);
    if (!pa) return null;
    const agent = SOURCE_AGENT[pa.source];
    const status: "verified" | "flagged" = pa.status === "ok" ? "verified" : "flagged";
    return {
      value: pa.value,
      status,
      confidence: pa.status === "ok" ? 96 : pa.status === "warn" ? 82 : 64,
      agents: [
        { id: "document" as AgentId, name: agent.name, action: "Resolved attribute value", thought: `Returned "${pa.value}" from ${agent.system} for ${openTraceFor.entity}.`, source: agent.system },
        { id: "audit" as AgentId, name: "Audit Agent", action: "Stamped provenance entry", thought: "Wrote retrieval snapshot and source citation to the immutable audit log.", source: `Audit Log · ${openTraceFor.entity}` },
      ],
      conclusion: pa.status === "ok"
        ? "Attribute resolved cleanly against record-of-truth; no divergence detected."
        : pa.status === "warn"
        ? "Attribute resolved but a deviation was detected against linked sources — analyst review queued."
        : "Attribute violates policy threshold or required check — routed to exception queue for analyst action.",
    } as AttrTrace;
  }, [openTraceFor]);

  const traceDocs = useMemo(() => {
    if (!openTraceFor) return [] as { entity: string; attr: EntityAttr; doc: AttrDoc }[];
    const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(x => x.label === openTraceFor.label);
    if (pa?.docs?.length) return pa.docs.map(d => ({ entity: openTraceFor.entity, attr: pa, doc: d }));
    return (TRACE_DOCS[openTraceFor.label] ?? []).filter(d => d.entity === openTraceFor.entity);
  }, [openTraceFor]);

  // Categorize attributes for a given entity (no pending filter — show all in form view)
  const categorize = (entity: string, attrs: string[]) => {
    const profile = ENTITY_PROFILES[entity];
    const isFlagged = (label: string) => {
      const traceFlagged = ATTRIBUTE_TRACES[label]?.status === "flagged";
      const pa = profile?.attrs.find(x => x.label === label);
      const excFlagged = excs.some(
        exc => exc.entity === entity && exc.status === "Pending" &&
          (exc.attrLabel ? exc.attrLabel === label : exc.title === label)
      );
      return traceFlagged || pa?.status === "alert" || pa?.status === "warn" || excFlagged;
    };
    const buckets: Record<AttrCategory, { label: string; flagged: boolean }[]> = {
      "Entity Identification": [], "Registration & Regulatory": [], "Address & Operations": [],
      "Classification & Risk": [], "Financial Profile": [], "Officers & Signatories": [], "Ownership & Control": [],
    };
    for (const label of attrs) buckets[categoryOf(label)].push({ label, flagged: !!isFlagged(label) });
    return ATTR_CATEGORY_ORDER
      .map(c => ({ category: c, items: buckets[c] }))
      .filter(g => g.items.length > 0);
  };

  const isCatOpen = (key: string, idx: number) => {
    if (key in openCats) return openCats[key];
    return idx < 2; // first two sections open by default
  };

  // Build entitiesForTree (same shape as AttributeTree uses)
  const entitiesForTree = selectedEntities.map(e => {
    const profile = ENTITY_PROFILES[e.name];
    const profileLabels = profile?.attrs.map(a => a.label) ?? [];
    const excTitleLabels = profileLabels.length === 0
      ? excs.filter(exc => exc.kyc === e.kyc && !exc.id.startsWith("stub-") && !exc.attrLabel).map(exc => exc.title)
      : [];
    const dbAttrLabels = excs.filter(exc => exc.kyc === e.kyc && exc.attrLabel).map(exc => exc.attrLabel!);
    return {
      entity: e.name,
      kyc: e.kyc,
      attrs: Array.from(new Set([...profileLabels, ...excTitleLabels, ...dbAttrLabels])),
    };
  });

  // Status strip computation
  const allProfiles = entitiesForTree.map(e => ENTITY_PROFILES[e.entity]).filter(Boolean);
  const idComplete = allProfiles.length > 0 && allProfiles.every(p => p!.attrs.every(a => a.status !== "alert"));
  const vComplete = !excs.some(e => e.status === "Pending");
  const pendingCount = excs.filter(e => e.status === "Pending").length;

  const handleSaveOverride = (draftKey: string) => {
    const now = new Date().toISOString().replace("T", " · ").slice(0, 19) + " UTC";
    setSavedOverrides(prev => ({ ...prev, [draftKey]: { value: overrideDraft, actor: "You", timestamp: now } }));
    setOpenOverrideFor(null);
    setOverrideDraft("");
    setOverrideNote("");
  };

  return (
    <div className="space-y-0">
      {/* Status strip */}
      <div className="flex items-center gap-2 px-1 pb-3 flex-wrap">
        <span className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold",
          idComplete ? "bg-success-soft text-success border border-success-soft-border" : "bg-alert-soft text-alert border border-alert-soft-border"
        )}>
          {idComplete ? <CheckCircle2 className="size-3.5" /> : <X className="size-3.5" />}
          {idComplete ? "ID Complete" : "ID Incomplete"}
        </span>
        <span className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold",
          vComplete
            ? "bg-success-soft text-success border border-success-soft-border"
            : "bg-warning-soft text-warning border border-warning-soft-border"
        )}>
          {vComplete ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {vComplete ? "Verification Complete" : "Verification Pending"}
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-alert-soft text-alert border border-alert-soft-border">
            <X className="size-3.5" /> {pendingCount} Exception{pendingCount > 1 ? "s" : ""}
          </span>
        )}
        {entitiesForTree.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground font-medium truncate">
            {entitiesForTree.map(e => e.entity).join(" · ")}
          </span>
        )}
      </div>

      {/* Sections */}
      {entitiesForTree.map(({ entity, attrs }) => {
        const groups = categorize(entity, attrs);
        return (
          <div key={entity}>
            {entitiesForTree.length > 1 && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 py-2">{entity}</p>
            )}
            {groups.map(({ category, items }, idx) => {
              const catKey = `${entity}::${category}`;
              const open = isCatOpen(catKey, idx);
              const pendingInCat = items.filter(i => i.flagged).length;
              return (
                <div key={category} className="rounded-xl border border-border bg-card mb-3 overflow-hidden">
                  {/* Section header */}
                  <button
                    onClick={() => setOpenCats(prev => ({ ...prev, [catKey]: !open }))}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
                  >
                    <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")} />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex-1">{category}</span>
                    <span className="text-[10px] text-muted-foreground">{items.length} attribute{items.length !== 1 ? "s" : ""}</span>
                    {pendingInCat > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-semibold">{pendingInCat}</span>
                    )}
                  </button>

                  {/* Section body — placeholder for field rows (added in Task 3) */}
                  {open && (
                    <div className="divide-y divide-border/60">
                      {items.map(({ label, flagged }) => (
                        <div key={label} className="px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
                          <div className={cn("size-1.5 rounded-full shrink-0", flagged ? "bg-alert" : "bg-success")} />
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {entitiesForTree.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No entities selected.</p>
      )}
    </div>
  );
};
```

- [ ] Insert the `AttributeFormView` component after `AttributeTree`'s closing `};`.

### Step 3 — Wire `AttributeFormView` into the center panel

In Task 1 Step 4, you added a placeholder div when `attrViewMode === "attributes"`. Replace that placeholder:

```tsx
{/* old placeholder — delete: */}
{attrViewMode === "attributes" && (
  <div className="py-4 text-sm text-muted-foreground text-center">
    Attribute view — coming in next task
  </div>
)}

{/* replace with: */}
{attrViewMode === "attributes" && (
  <AttributeFormView
    selectedEntities={selectedEntities}
    exceptions={effectiveExceptions}
  />
)}
```

- [ ] Replace placeholder.

### Step 4 — Verify TypeScript and commit

```bash
./node_modules/.bin/tsc --noEmit
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add AttributeFormView shell with status strip and collapsible sections"
```

- [ ] TypeScript passes. Commit made.

---

## Task 3 — `SimpleFieldRow`: field rendering with ID/V badges, source badge, trace trigger

Replace the placeholder field list inside `AttributeFormView`'s section body with full `SimpleFieldRow` components.

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

### Step 1 — Add `SimpleFieldRow` component

Find the closing `};` of `AttributeFormView`. Just **before** it, insert the `SimpleFieldRow` component as a nested `const` (inside `AttributeFormView`):

```tsx
const SimpleFieldRow = ({ label, entity }: { label: string; entity: string }) => {
  const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
  const overrideKey = `${entity}::${label}`;
  const override = savedOverrides[overrideKey];
  const currentValue = override?.value ?? pa?.value ?? "";
  const isOverridden = !!override;
  const isAlert = !isOverridden && pa?.status === "alert";
  const isWarn  = !isOverridden && pa?.status === "warn";
  const isOpen  = openTraceFor?.label === label && openTraceFor?.entity === entity;
  const isOverrideOpen = openOverrideFor?.label === label && openOverrideFor?.entity === entity;
  const hasTrace = !!(ATTRIBUTE_TRACES[label] || pa);
  const flagged = isAlert || isWarn || ATTRIBUTE_TRACES[label]?.status === "flagged";

  // ID / V badge values
  const idOk  = !!pa;
  const vStatus: "ok" | "warn" | "alert" | "none" = isOverridden ? "ok" : (pa?.status ?? "none");

  const idLabel = idOk ? <span className="text-success font-bold">ID✓</span> : <span className="text-muted-foreground/50">ID–</span>;
  const vLabel = vStatus === "ok"    ? <span className="text-success font-bold">V✓</span>
               : vStatus === "warn"  ? <span className="text-warning font-bold">V⚠</span>
               : vStatus === "alert" ? <span className="text-alert font-bold">V✕</span>
               :                       <span className="text-muted-foreground/50">V–</span>;

  return (
    <>
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 transition-colors",
        isOpen ? "bg-info-soft/40 border-l-2 border-primary" : "",
        isOverridden ? "bg-success-soft/20 border-l-2 border-success" : "",
        isAlert && !isOpen ? "bg-alert-soft/20 border-l-2 border-alert" : "",
        isWarn  && !isOpen ? "bg-warning-soft/20 border-l-2 border-warning" : "",
        !isOpen && !isOverridden && !isAlert && !isWarn ? "hover:bg-secondary/30" : "",
      )}>
        {/* Status dot */}
        <div className={cn(
          "size-1.5 rounded-full shrink-0",
          isOverridden ? "bg-success" : pa ? DOT_STYLE[pa.status] : "bg-muted-foreground/30"
        )} />

        {/* Label */}
        <span className="text-[11px] font-medium text-muted-foreground w-[150px] shrink-0 truncate">{label}</span>

        {/* Value */}
        <span className={cn(
          "flex-1 text-[11px] truncate",
          isAlert ? "text-alert font-semibold" : isWarn ? "text-warning" : "text-foreground"
        )}>
          {currentValue || <span className="text-muted-foreground/40 italic">—</span>}
          {isOverridden && (
            <span className="ml-2 text-[9px] font-semibold text-success border border-success/40 bg-success-soft rounded px-1.5 py-0.5">✎ Overridden</span>
          )}
        </span>

        {/* ID / V inline text badges */}
        <span className="text-[9px] shrink-0 whitespace-nowrap">
          {idLabel}<span className="text-muted-foreground/30 mx-0.5">/</span>{vLabel}
        </span>

        {/* Source badge */}
        {pa && (
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0", SOURCE_STYLE[pa.source])}>
            {pa.source}
          </span>
        )}

        {/* 🤖 Trace button */}
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
      </div>
    </>
  );
};
```

- [ ] Insert `SimpleFieldRow` as a `const` nested inside `AttributeFormView`, just before `AttributeFormView`'s closing `};`.

### Step 2 — Use `SimpleFieldRow` in the section body

Inside `AttributeFormView`'s section body, find the placeholder field list:
```tsx
{open && (
  <div className="divide-y divide-border/60">
    {items.map(({ label, flagged }) => (
      <div key={label} className="px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
        <div className={cn("size-1.5 rounded-full shrink-0", flagged ? "bg-alert" : "bg-success")} />
        {label}
      </div>
    ))}
  </div>
)}
```

Replace with:
```tsx
{open && (
  <div className="divide-y divide-border/60">
    {items.map(({ label }) => (
      <SimpleFieldRow key={label} label={label} entity={entity} />
    ))}
  </div>
)}
```

- [ ] Replace placeholder list with `SimpleFieldRow`.

### Step 3 — Verify TypeScript and commit

```bash
./node_modules/.bin/tsc --noEmit
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add SimpleFieldRow with ID/V badges, source badge, and trace trigger"
```

- [ ] TypeScript passes. Commit made.

---

## Task 4 — `InlineTraceDrawer`: confidence score, Reasoning tab, Audit Trail tab, actions

The drawer expands below `SimpleFieldRow` when `isOpen` is true. Add it as a second component nested inside `AttributeFormView`, and render it from `SimpleFieldRow`.

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

### Step 1 — Add `InlineTraceDrawer` component

Inside `AttributeFormView`, after `SimpleFieldRow`'s closing `};` (but still before `AttributeFormView`'s own `};`), insert:

```tsx
const InlineTraceDrawer = ({ label, entity }: { label: string; entity: string }) => {
  const isManualOverride = !!savedOverrides[`${entity}::${label}`];
  const displayConf = isManualOverride
    ? 100
    : (trace?.confidence ?? 0);
  const confLabel = isManualOverride ? "1.0" : `${Math.round(displayConf)}%`;
  const confColor = isManualOverride
    ? "text-success"
    : displayConf >= 90 ? "text-primary"
    : displayConf >= 70 ? "text-warning"
    : "text-alert";
  const confBarColor = isManualOverride
    ? "bg-success"
    : displayConf >= 90 ? "bg-primary"
    : displayConf >= 70 ? "bg-warning"
    : "bg-alert";

  const auditLog = ATTR_AUDIT_LOG[label] ?? [];

  return (
    <div className="border-l-2 border-primary border-b border-border bg-gradient-to-br from-info-soft/30 to-background">
      {/* Top: field context + confidence score */}
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-2.5 border-b border-border/60">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5 mb-0.5">
            <Sparkles className="size-3" /> Agent Trace
          </p>
          <p className="text-[12px] font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{savedOverrides[`${entity}::${label}`]?.value ?? trace?.value ?? "—"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Confidence</p>
          <p className={cn("text-[22px] font-black leading-none", confColor)}>{confLabel}</p>
          <div className="w-16 h-1 rounded-full bg-border mt-1.5 ml-auto overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", confBarColor)} style={{ width: `${Math.min(displayConf, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        <button
          onClick={() => setTraceTab("reasoning")}
          className={cn(
            "flex-1 py-2 text-[10px] font-semibold transition-colors border-b-2",
            traceTab === "reasoning" ? "border-primary text-primary bg-background/60" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="size-3 inline mr-1" />Reasoning
        </button>
        <button
          onClick={() => setTraceTab("audit")}
          className={cn(
            "flex-1 py-2 text-[10px] font-semibold transition-colors border-b-2",
            traceTab === "audit" ? "border-primary text-primary bg-background/60" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronRight className="size-3 inline mr-1" />Audit Trail {auditLog.length > 0 && `(${auditLog.length})`}
        </button>
      </div>

      {/* Reasoning tab */}
      {traceTab === "reasoning" && trace && (
        <div className="px-4 py-3 space-y-3">
          {/* Conclusion */}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShieldCheck className="size-3 text-success" /> Conclusion
            </p>
            <p className="text-[11px] leading-snug text-foreground">{trace.conclusion}</p>
          </div>

          {/* Agent steps */}
          <button
            onClick={() => setTraceStepsOpen(v => !v)}
            className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 hover:bg-secondary/40 transition-colors"
          >
            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" /> Reasoning steps ({trace.agents.length})
            </span>
            <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", traceStepsOpen && "rotate-180")} />
          </button>
          {traceStepsOpen && (
            <ol className="space-y-3 px-1">
              {trace.agents.map((a, i) => (
                <li key={a.id} className="relative pl-7">
                  <span className="absolute left-0 top-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold">{i + 1}</span>
                  {i < trace.agents.length - 1 && <span className="absolute left-[9px] top-6 bottom-[-10px] w-px bg-border" />}
                  <p className="text-[11px] font-semibold">{a.name} <span className="text-muted-foreground font-normal">→ {a.action}</span></p>
                  <p className="text-[10px] text-muted-foreground italic mt-0.5 leading-snug">"{a.thought}"</p>
                  <p className="text-[9px] text-primary mt-1 flex items-center gap-1"><Database className="size-2.5" />{a.source}</p>
                </li>
              ))}
            </ol>
          )}

          {/* Source docs */}
          {traceDocs.length > 0 && (
            <>
              <button
                onClick={() => setTraceDocsOpen(v => !v)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 hover:bg-secondary/40 transition-colors"
              >
                <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Paperclip className="size-3 text-primary" /> Source documents ({traceDocs.length})
                </span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", traceDocsOpen && "rotate-180")} />
              </button>
              {traceDocsOpen && (
                <div className="space-y-1.5">
                  {traceDocs.map(({ doc, attr: docAttr, entity: docEntity }) => {
                    const meta = DOC_KIND_META[doc.kind];
                    return (
                      <div key={`${docEntity}-${doc.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-card text-left">
                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate">{doc.title}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{docEntity} · {doc.source}</p>
                        </div>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide shrink-0", meta.tone)}>{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {trace && !trace.agents.length && (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">No reasoning steps available.</p>
          )}
        </div>
      )}

      {traceTab === "reasoning" && !trace && (
        <p className="px-4 py-6 text-[11px] text-muted-foreground italic text-center">No agent trace available for this attribute.</p>
      )}

      {/* Audit Trail tab */}
      {traceTab === "audit" && (
        <div className="px-4 py-3">
          {auditLog.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-4">No audit history for this attribute.</p>
          ) : (
            <div className="space-y-0">
              {auditLog.map((entry, idx) => (
                <div key={idx} className="flex gap-3 relative pb-4">
                  {idx < auditLog.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                  )}
                  {/* Icon */}
                  <div className={cn(
                    "size-[22px] rounded-full border-2 flex items-center justify-center text-[9px] shrink-0 mt-0.5",
                    entry.type === "agent"         ? "border-primary/40 bg-info-soft text-primary"
                    : entry.type === "override"    ? "border-success/40 bg-success-soft text-success"
                    :                                "border-warning/40 bg-warning-soft text-warning"
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
                        entry.isManual
                          ? "bg-success-soft text-success border-success/30"
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
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/60 bg-secondary/20">
        <button
          onClick={() => trace && runAgents(trace.agents.map(a => a.id), `Re-verify: ${label}`)}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Play className="size-3" /> Re-run Agent
        </button>
        <button
          onClick={() => {
            const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
            const current = savedOverrides[`${entity}::${label}`]?.value ?? pa?.value ?? "";
            setOverrideDraft(current);
            setOverrideNote("");
            setOpenOverrideFor({ label, entity });
          }}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md border border-warning/60 bg-warning-soft text-warning hover:opacity-90 transition-opacity"
        >
          <Zap className="size-3" /> Override Value
        </button>
        {traceDocs.length > 0 && (
          <button className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip className="size-3" /> Source Docs
          </button>
        )}
        <button
          onClick={() => setOpenTraceFor(null)}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
};
```

- [ ] Insert `InlineTraceDrawer` inside `AttributeFormView`, after `SimpleFieldRow`'s closing `};`.

### Step 2 — Render `InlineTraceDrawer` from `SimpleFieldRow`

Inside `SimpleFieldRow`'s return, the current JSX returns a single `<>...</>` wrapping one `<div>`. Add the drawer as a second sibling inside that fragment:

Find the closing `</>` of `SimpleFieldRow`'s return and update to:
```tsx
return (
  <>
    <div className={cn(/* existing classes */)}>
      {/* existing row content unchanged */}
    </div>
    {isOpen && <InlineTraceDrawer label={label} entity={entity} />}
  </>
);
```

- [ ] Add `{isOpen && <InlineTraceDrawer label={label} entity={entity} />}` inside the fragment.

### Step 3 — Verify TypeScript and commit

```bash
./node_modules/.bin/tsc --noEmit
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add InlineTraceDrawer with confidence score, reasoning, and audit trail"
```

- [ ] TypeScript passes. Commit made.

---

## Task 5 — Override inline edit flow

When the analyst clicks "Override Value" in the drawer, the field's value in the row is replaced with an inline edit form. On save, confidence locks to 1.0 and the row gets green override styling.

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

### Step 1 — Add the override inline edit form inside `SimpleFieldRow`

Inside `SimpleFieldRow`, the current return JSX has `{isOpen && <InlineTraceDrawer .../>}`. Add the override form as a third sibling rendered when `isOverrideOpen`:

```tsx
return (
  <>
    <div className={cn(/* existing */)}>
      {/* existing row content */}
    </div>
    {isOpen && <InlineTraceDrawer label={label} entity={entity} />}
    {isOverrideOpen && (
      <div className="px-4 py-3 border-l-2 border-warning bg-warning-soft/20 border-b border-border/60">
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
```

- [ ] Add the override form JSX inside `SimpleFieldRow`'s fragment.

### Step 2 — Verify TypeScript and commit

```bash
./node_modules/.bin/tsc --noEmit
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add inline override edit flow with confidence 1.0 lock"
```

- [ ] TypeScript passes. Commit made.

---

## Task 6 — `NestedObjectBlock`: multi-record attributes (PSC, Beneficial Owners, Officers)

Attributes like "Persons of Significant Control" or "Beneficial Owner (25%+)" contain multiple named records. Define a data structure and render them with per-sub-field ID/V badges.

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

### Step 1 — Add `NestedAttrProfile` type and `NESTED_ATTR_PROFILES` mock data

Find the `ATTR_AUDIT_LOG` constant added in Task 2. Immediately after its closing `};`, insert:

```ts
type NestedSubField = {
  label: string;
  value: string;
  source: EntityAttr["source"];
  status: EntityAttr["status"];
};
type NestedEntry = { name: string; tag: string; fields: NestedSubField[] };

const NESTED_ATTR_PROFILES: Record<string, NestedEntry[]> = {
  "Persons of Significant Control": [
    {
      name: "Alan Howard", tag: "Founder · 75–100%",
      fields: [
        { label: "Name", value: "Alan Howard", source: "CRM", status: "ok" },
        { label: "Date of Birth", value: "1964-09-15", source: "CRM", status: "ok" },
        { label: "Country", value: "United Kingdom", source: "Forge", status: "ok" },
      ],
    },
    {
      name: "Nagi Kawkabani", tag: "CEO · 28%",
      fields: [
        { label: "Name", value: "Nagi Kawkabani", source: "CRM", status: "ok" },
        { label: "Date of Birth", value: "Unconfirmed", source: "3rd", status: "warn" },
        { label: "Country", value: "Switzerland", source: "3rd", status: "ok" },
      ],
    },
  ],
  "Persons with Significant Control": [
    {
      name: "Alan Howard", tag: "Founder · 75–100%",
      fields: [
        { label: "Name", value: "Alan Howard", source: "CRM", status: "ok" },
        { label: "Date of Birth", value: "1964-09-15", source: "CRM", status: "ok" },
        { label: "Country", value: "United Kingdom", source: "Forge", status: "ok" },
      ],
    },
  ],
  "Beneficial Owner (25%+)": [
    {
      name: "BH Capital Ltd (Cayman)", tag: "UBO · 61%",
      fields: [
        { label: "Entity Name", value: "BH Capital Ltd", source: "3rd", status: "ok" },
        { label: "Jurisdiction", value: "Cayman Islands", source: "Forge", status: "alert" },
        { label: "Ownership %", value: "61.4%", source: "CRM", status: "ok" },
      ],
    },
  ],
  "Directors": [
    {
      name: "Aron Landy", tag: "CEO",
      fields: [
        { label: "Name", value: "Aron Landy", source: "CRM", status: "ok" },
        { label: "Date of Birth", value: "1970-04-22", source: "CRM", status: "ok" },
        { label: "Nationality", value: "British", source: "3rd", status: "ok" },
      ],
    },
    {
      name: "Carsten Kengeter", tag: "Non-exec Director",
      fields: [
        { label: "Name", value: "Carsten Kengeter", source: "CRM", status: "ok" },
        { label: "Date of Birth", value: "1967-01-09", source: "CRM", status: "ok" },
        { label: "Nationality", value: "German", source: "3rd", status: "warn" },
      ],
    },
  ],
};
```

- [ ] Insert the type and constant after `ATTR_AUDIT_LOG`.

### Step 2 — Add `NestedObjectBlock` component

Inside `AttributeFormView`, after `InlineTraceDrawer`'s closing `};` (but before `AttributeFormView`'s own `};`), insert:

```tsx
const NestedObjectBlock = ({ label, entity }: { label: string; entity: string }) => {
  const entries = NESTED_ATTR_PROFILES[label];
  if (!entries) return null;

  const pa = ENTITY_PROFILES[entity]?.attrs.find(a => a.label === label);
  const groupStatus = entries.flatMap(e => e.fields).some(f => f.status === "alert")
    ? "alert" : entries.flatMap(e => e.fields).some(f => f.status === "warn") ? "warn" : "ok";
  const hasTrace = !!(ATTRIBUTE_TRACES[label] || pa);
  const isGroupOpen = openTraceFor?.label === label && openTraceFor?.entity === entity;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Object-level header */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b border-border",
        groupStatus === "alert" ? "bg-alert-soft/20" : groupStatus === "warn" ? "bg-warning-soft/20" : "bg-secondary/30"
      )}>
        <div className={cn("size-1.5 rounded-full shrink-0", DOT_STYLE[groupStatus])} />
        <span className="text-[11px] font-semibold text-foreground flex-1">{label}</span>
        {/* Group-level ID/V summary badge */}
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

      {/* Group-level trace drawer */}
      {isGroupOpen && <InlineTraceDrawer label={label} entity={entity} />}

      {/* Entries */}
      {entries.map((entry, ei) => (
        <div key={ei} className={cn("border-b border-border/50 last:border-b-0")}>
          {/* Entry header */}
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
          {/* Sub-fields */}
          {entry.fields.map(field => {
            const subKey = `${entity}::${label}::${ei}::${field.label}`;
            const idOk = true; // sub-fields always have an ID
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
```

- [ ] Insert `NestedObjectBlock` inside `AttributeFormView`, after `InlineTraceDrawer`.

### Step 3 — Use `NestedObjectBlock` for attributes that have nested entries

Inside `AttributeFormView`'s section body, `SimpleFieldRow` is rendered for every label. For labels that have entries in `NESTED_ATTR_PROFILES`, render `NestedObjectBlock` instead.

Find the section body render in `AttributeFormView`:
```tsx
{open && (
  <div className="divide-y divide-border/60">
    {items.map(({ label }) => (
      <SimpleFieldRow key={label} label={label} entity={entity} />
    ))}
  </div>
)}
```

Replace with:
```tsx
{open && (
  <div className="divide-y divide-border/60">
    {items.map(({ label }) =>
      NESTED_ATTR_PROFILES[label] ? (
        <div key={label} className="p-3">
          <NestedObjectBlock label={label} entity={entity} />
        </div>
      ) : (
        <SimpleFieldRow key={label} label={label} entity={entity} />
      )
    )}
  </div>
)}
```

- [ ] Apply the conditional render.

### Step 4 — Verify TypeScript and commit

```bash
./node_modules/.bin/tsc --noEmit
git add src/pages/ExceptionReview.tsx
git commit -m "feat: add NestedObjectBlock for PSC/UBO/officer attributes with per-sub-field ID/V badges"
```

- [ ] TypeScript passes. Commit made.

---

## Final Verification

1. Navigate to Work Queue → open any case → Exception Review loads normally.
2. Center panel shows "Exception | Attributes" toggle at top.
3. **Exception mode (default):** existing exception detail is unchanged; right pane shows only Document Locker and Collaboration.
4. Switch to **Attributes mode:**
   - Status strip shows ID Complete / Verification status / Exception count.
   - Re-run Agents and Manual Override buttons appear in header.
   - First two sections are expanded; remaining sections collapsed.
   - Click a section header → toggles expand/collapse.
5. **Simple field row:** shows status dot, label, value, `ID✓/V✓`, source badge, Trace button.
6. Click **Trace** on a field → inline drawer expands below that row.
   - Confidence score shown with colour bar.
   - Reasoning tab: conclusion, reasoning steps, source docs.
   - Audit Trail tab: chronological entries for attributes in `ATTR_AUDIT_LOG`.
7. Click **Override Value** in drawer → inline form appears; enter value → Save → row turns green, confidence label shows 1.0.
8. **Ownership & Control section:** PSC / Beneficial Owner attributes render as `NestedObjectBlock` with named entries and per-sub-field ID/V badges.
9. `./node_modules/.bin/tsc --noEmit` → no errors across all 6 commits.

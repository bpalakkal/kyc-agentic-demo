# UI Redesign — KYC Sentinel Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace KPMG branding with "KYC Sentinel / Powered by Forge", adopt Content First page headers, switch KPI cards to top-border accent style, tighten card padding, and sharpen the Work Queue table.

**Architecture:** Pure CSS/JSX changes — no new components, no data changes. All colours already flow through CSS variables so dark mode is automatic. The `Stat` component in Dashboard is updated in-place; the Reports `Card` component header padding is tightened in-place.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS 3.4, shadcn/ui, React Router v6 (`Link` from react-router-dom).

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/AppLayout.tsx` | Brand block: remove KPMG logo import, replace with clickable KYC Sentinel / Powered by Forge using `Link` |
| `src/pages/Dashboard.tsx` | h1 style; `Stat` component: `p-5→p-4`, `text-3xl font-semibold→text-2xl font-bold`; top KPI row: remove soft gradients, add `border-t-[3px]`; 4-shortcut row: split from unified card into 4 individual cards with top-border; section cards: `p-5→p-4` |
| `src/pages/WorkQueue.tsx` | h1 style; table header: `bg-secondary/60→bg-muted/60`; DRG group buttons: add `border-l-2` priority accent |
| `src/pages/Reports.tsx` | h1 style; KPI strip: remove icon badge, add `border-t-[3px]` accent, `font-semibold→font-bold`; `Card` component: header `px-5 py-3.5→px-4 py-2.5`, body `p-5→p-4` |
| `src/pages/ExceptionReview.tsx` | `p-5→p-4` on the two main panel sections (lines 1425 and 1683) |

---

## Task 1: Nav Rebrand — KYC Sentinel / Powered by Forge

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Remove the KPMG logo import and update the brand block**

Open `src/components/AppLayout.tsx`. Find and replace the following block (around line 309):

```tsx
// REMOVE this import at top of file:
import kpmgLogo from "@/assets/kpmg-logo-white.svg";
```

Find (around line 307–311):
```tsx
            <div className="flex items-center gap-3">
              <img src={kpmgLogo} alt="KPMG" className="h-5 w-auto" />
              <span className="font-semibold text-[15px]">KYC Platform</span>
            </div>
```

Replace with:
```tsx
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-[3px] h-[22px] rounded-full bg-gradient-to-b from-blue-500 to-indigo-500 shrink-0" />
              <div>
                <div className="text-[14px] font-bold text-nav-foreground tracking-tight leading-tight">KYC Sentinel</div>
                <div className="text-[9px] text-nav-muted uppercase tracking-widest leading-tight">Powered by Forge</div>
              </div>
            </Link>
```

Note: `Link` is already available — `NavLink` is imported from `react-router-dom` at the top. Add `Link` to that same import:
```tsx
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2 && ./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: rebrand nav to KYC Sentinel — Powered by Forge, clickable home link"
```

---

## Task 2: Dashboard — Content First Header + Top-Border KPI Cards

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Update the page h1 style**

Find (line 236):
```tsx
            <h1 className="text-[22px] font-semibold tracking-tight">Alex's Dashboard</h1>
```
Replace with:
```tsx
            <h1 className="text-[18px] font-bold tracking-tight">Alex's Dashboard</h1>
```

- [ ] **Step 2: Update the `Stat` component — tighten padding and bump number weight**

The `Stat` component renders two card variants. Find both `p-5` occurrences inside the `Stat` function (lines ~135 and ~144) and change to `p-4`. Also change `text-3xl font-semibold` (line ~107) to `text-2xl font-bold`:

Find:
```tsx
          <span className={cn("text-3xl font-semibold tracking-tight tabular-nums", accent && ACCENT_TEXT[accent])}>{value}</span>
```
Replace with:
```tsx
          <span className={cn("text-2xl font-bold tracking-tight tabular-nums", accent && ACCENT_TEXT[accent])}>{value}</span>
```

Find (in the `onClick` branch, line ~135):
```tsx
          "group rounded-xl border bg-card p-5 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
```
Replace with:
```tsx
          "group rounded-xl border bg-card p-4 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
```

Find (the non-clickable branch, line ~144):
```tsx
    <div className={cn("rounded-xl border bg-card p-5 flex items-start justify-between gap-4", cardBg)}>
```
Replace with:
```tsx
    <div className={cn("rounded-xl border bg-card p-4 flex items-start justify-between gap-4", cardBg)}>
```

- [ ] **Step 3: Switch top 3 KPI stat cards to top-border accent pattern**

The three `<Stat>` calls in the top stat row (around lines 244–279) currently use `soft` + `accent` props for gradient cards. Replace those calls and the donut card with top-border cards.

Find the entire top stat row block (lines 243–280):
```tsx
        {/* Top stat row — static queue summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Total Cases in Queue"
            value={String(totalCases)}
            unit="open cases"
            trend={{ dir: "up", text: "+3 since last week" }}
            icon={<FileText className="size-5" />}
          />
          <Stat
            label="SLA at Risk"
            value={String(slaAtRisk)}
            unit="cases"
            trend={{ dir: slaAtRisk === 0 ? "down" : "up", text: slaAtRisk === 0 ? "All SLAs on track" : "Due within 48 hours" }}
            accent={slaAtRisk === 0 ? "success" : slaAtRisk < 3 ? "warning" : "alert"}
            soft
            icon={<AlertTriangle className="size-5" />}
          />
          <div className="rounded-xl border border-border bg-card p-5 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">Cases Complete</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">48</span>
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-[hsl(30_70%_40%)] flex items-center gap-1 font-medium">
                <ArrowDownRight className="size-3" /> 3% vs yesterday
              </p>
            </div>
            <div className="relative size-14">
              <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3.6" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.6"
                  strokeDasharray="48 100" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-primary">48%</span>
            </div>
          </div>
        </div>
```

Replace with:
```tsx
        {/* Top stat row — static queue summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Total Cases in Queue"
            value={String(totalCases)}
            unit="open cases"
            trend={{ dir: "up", text: "+3 since last week" }}
            icon={<FileText className="size-5" />}
            topBorderClass="border-t-[3px] border-t-primary"
          />
          <Stat
            label="SLA at Risk"
            value={String(slaAtRisk)}
            unit="cases"
            trend={{ dir: slaAtRisk === 0 ? "down" : "up", text: slaAtRisk === 0 ? "All SLAs on track" : "Due within 48 hours" }}
            accent={slaAtRisk === 0 ? "success" : slaAtRisk < 3 ? "warning" : "alert"}
            topBorderClass={slaAtRisk === 0 ? "border-t-[3px] border-t-success" : slaAtRisk < 3 ? "border-t-[3px] border-t-warning" : "border-t-[3px] border-t-alert"}
            icon={<AlertTriangle className="size-5" />}
          />
          <div className="rounded-xl border border-border border-t-[3px] border-t-success bg-card p-4 flex items-start justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">Cases Complete</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight tabular-nums">48</span>
                <span className="text-lg text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-[hsl(30_70%_40%)] flex items-center gap-1 font-medium">
                <ArrowDownRight className="size-3" /> 3% vs yesterday
              </p>
            </div>
            <div className="relative size-12">
              <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3.6" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.6"
                  strokeDasharray="48 100" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-primary">48%</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 4: Add `topBorderClass` prop to the `Stat` component**

The `Stat` component needs to accept and apply the new prop. Update its props interface and card class logic.

Find the `Stat` props type (line ~98):
```tsx
const Stat = ({ label, value, unit, trend, accent, icon, soft = false, onClick, active }: {
  label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string };
  accent?: AccentVariant; icon?: React.ReactNode; soft?: boolean; onClick?: () => void; active?: boolean;
}) => {
```
Replace with:
```tsx
const Stat = ({ label, value, unit, trend, accent, icon, soft = false, onClick, active, topBorderClass }: {
  label: string; value: string; unit?: string; trend?: { dir: "up" | "down"; text: string };
  accent?: AccentVariant; icon?: React.ReactNode; soft?: boolean; onClick?: () => void; active?: boolean;
  topBorderClass?: string;
}) => {
```

Find (line ~127):
```tsx
  const cardBg = soft && accent ? ACCENT_CARD[accent] : "border-border";
```
Replace with:
```tsx
  const cardBg = topBorderClass ? `border-border ${topBorderClass}` : soft && accent ? ACCENT_CARD[accent] : "border-border";
```

Also add `shadow-sm` to both card render paths. In the `onClick` branch (line ~133), add `shadow-sm` to the class string:
```tsx
          "group rounded-xl border bg-card p-4 flex items-start justify-between gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm",
```

In the non-clickable branch:
```tsx
    <div className={cn("rounded-xl border bg-card p-4 flex items-start justify-between gap-4 shadow-sm", cardBg)}>
```

- [ ] **Step 5: Replace the 4-shortcut row with individual top-border cards**

Find the second stat row block (lines 283–309):
```tsx
        {/* Second stat row — clickable priority shortcuts */}
        <div className="rounded-xl border border-border bg-card divide-y md:divide-y-0 md:divide-x divide-border grid grid-cols-2 md:grid-cols-4 overflow-hidden">
          {([
            { label: "High Priority", value: highPriorityCount, icon: <AlertTriangle className="size-4" />, accent: true,  action: () => toggleKpi("high"),  active: kpiFilter === "high" },
            { label: "Due Today",     value: dueTodayCount,     icon: <Clock className="size-4" />,          accent: false, action: () => toggleKpi("today"), active: kpiFilter === "today" },
            { label: "Compliance Alerts", value: 2,             icon: <AlertTriangle className="size-4" />, accent: true,  action: goQueue,                   active: false },
            { label: "AI Actions for Today", value: aiActionsLive.filter(a => a.dot === "alert").length, icon: <Sparkles className="size-4" />, accent: false, action: () => setActionsFilter((p) => p === "today" ? "all" : "today"), active: actionsFilter === "today" },
          ] as const).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.action}
              className={cn(
                "text-left px-4 py-3 hover:bg-secondary/40 transition-colors focus:outline-none focus:bg-secondary/60 flex items-center gap-3",
                s.active && "bg-info-soft"
              )}
            >
              <span className={cn(
                "size-8 rounded-lg grid place-items-center shrink-0",
                s.accent ? "bg-alert/10 text-alert" : "bg-secondary text-muted-foreground"
              )}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">{s.label}</p>
                <p className={cn("text-lg font-semibold tabular-nums leading-tight", s.accent && "text-alert")}>{s.value}</p>
              </div>
            </button>
          ))}
        </div>
```

Replace with:
```tsx
        {/* Second stat row — clickable priority shortcuts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { label: "High Priority",        value: highPriorityCount,                                         borderClass: "border-t-[3px] border-t-alert",   textClass: "text-alert",    action: () => toggleKpi("high"),                                               active: kpiFilter === "high" },
            { label: "Due Today",            value: dueTodayCount,                                             borderClass: "border-t-[3px] border-t-warning", textClass: "text-warning",  action: () => toggleKpi("today"),                                              active: kpiFilter === "today" },
            { label: "Compliance Alerts",    value: 2,                                                         borderClass: "border-t-[3px] border-t-alert",   textClass: "text-alert",    action: goQueue,                                                               active: false },
            { label: "AI Actions for Today", value: aiActionsLive.filter(a => a.dot === "alert").length,      borderClass: "border-t-[3px] border-t-indigo-500", textClass: "text-indigo-500 dark:text-indigo-400", action: () => setActionsFilter((p) => p === "today" ? "all" : "today"), active: actionsFilter === "today" },
          ] as const).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.action}
              className={cn(
                "rounded-xl border border-border bg-card p-4 text-left flex flex-col gap-1 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                s.borderClass,
                s.active && "ring-2 ring-primary/40 -translate-y-0.5 shadow-md"
              )}
            >
              <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground">{s.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums leading-tight", s.textClass)}>{s.value}</p>
            </button>
          ))}
        </div>
```

- [ ] **Step 6: Tighten section card padding**

There are three section cards in the main column and one in the aside. Find each and change `p-5` to `p-4`:

Line ~315:
```tsx
          <section className="rounded-xl border border-border bg-card p-5">
```
→
```tsx
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
```

Line ~392:
```tsx
          <section className="rounded-xl border border-border bg-card p-5">
```
→
```tsx
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
```

Line ~447 (collab aside):
```tsx
        <section className="rounded-xl border border-border bg-card p-5">
```
→
```tsx
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2 && ./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: dashboard — content-first header, top-border KPI cards, tighter padding"
```

---

## Task 3: Work Queue — Header + Table Polish

**Files:**
- Modify: `src/pages/WorkQueue.tsx`

- [ ] **Step 1: Update the page h1 style**

Find (line ~298):
```tsx
        <h1 className="text-[22px] font-semibold tracking-tight">Alex's Work Queue</h1>
```
Replace with:
```tsx
        <h1 className="text-[18px] font-bold tracking-tight">Alex's Work Queue</h1>
```

- [ ] **Step 2: Strengthen the table column header row**

Find (line ~357):
```tsx
        <div className={`grid ${COLS} gap-2 px-4 py-3 bg-secondary/60 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
```
Replace with:
```tsx
        <div className={`grid ${COLS} gap-2 px-4 py-3 bg-muted/60 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}>
```

- [ ] **Step 3: Add priority-coloured left-border to DRG group header buttons**

Find the DRG group header button (line ~394):
```tsx
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
                className="w-full grid grid-cols-[40px_40px_1fr] items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
              >
```
Replace with:
```tsx
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !open }))}
                className={cn(
                  "w-full grid grid-cols-[40px_40px_1fr] items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors border-l-2",
                  g.priorityTone === "high"   && "border-l-alert",
                  g.priorityTone === "medium" && "border-l-warning",
                  g.priorityTone === "low"    && "border-l-muted-foreground/30"
                )}
              >
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2 && ./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/pages/WorkQueue.tsx
git commit -m "feat: work queue — bold header, stronger table column row, DRG priority left-border"
```

---

## Task 4: Reports — Header + Top-Border KPI Strip

**Files:**
- Modify: `src/pages/Reports.tsx`

- [ ] **Step 1: Update the page h1 style**

Find (line ~491):
```tsx
          <h1 className="text-[22px] font-semibold tracking-tight">Reports</h1>
```
Replace with:
```tsx
          <h1 className="text-[18px] font-bold tracking-tight">Reports</h1>
```

- [ ] **Step 2: Replace KPI strip with top-border cards**

The `KPIS` array has an `accent` field ("success" or "warning"). We'll use that to choose the top-border colour. Remove the icon badge and add a `border-t-[3px]` in the right colour.

Find the KPI strip block (lines ~502–524):
```tsx
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIS.map(k => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{k.value}</span>
                {k.unit && <span className="text-sm text-muted-foreground">{k.unit}</span>}
              </div>
              <p className={cn("mt-1.5 text-xs flex items-center gap-1 font-medium", k.trend.good ? "text-success" : "text-alert")}>
                {k.trend.dir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {k.trend.text}
              </p>
            </div>
            <div className={cn(
              "size-9 rounded-lg grid place-items-center shrink-0",
              k.accent === "success" ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
            )}>
              {k.icon}
            </div>
          </div>
        ))}
      </div>
```

Replace with:
```tsx
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPIS.map(k => (
          <div
            key={k.label}
            className={cn(
              "rounded-xl border border-border bg-card p-4 shadow-sm",
              k.accent === "success" ? "border-t-[3px] border-t-success" : "border-t-[3px] border-t-warning"
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums">{k.value}</span>
              {k.unit && <span className="text-sm text-muted-foreground">{k.unit}</span>}
            </div>
            <p className={cn("mt-1.5 text-xs flex items-center gap-1 font-medium", k.trend.good ? "text-success" : "text-alert")}>
              {k.trend.dir === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {k.trend.text}
            </p>
          </div>
        ))}
      </div>
```

- [ ] **Step 3: Tighten the `Card` component header and body padding**

Find the `Card` component (line ~179):
```tsx
const Card = ({
  title, subtitle, children, className,
}: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
    <div className="px-5 py-3.5 border-b border-border">
      <p className="text-[13px] font-semibold">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);
```

Replace with:
```tsx
const Card = ({
  title, subtitle, children, className,
}: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-card overflow-hidden shadow-sm", className)}>
    <div className="px-4 py-2.5 border-b border-border">
      <p className="text-[13px] font-bold">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2 && ./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reports.tsx
git commit -m "feat: reports — bold header, top-border KPI cards, tighter Card padding"
```

---

## Task 5: Exception Review — Tighten Panel Padding

**Files:**
- Modify: `src/pages/ExceptionReview.tsx`

- [ ] **Step 1: Tighten the main centre panel card**

Find (line ~1425):
```tsx
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
```
Replace with:
```tsx
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
```

- [ ] **Step 2: Tighten the right aside panel**

Find (line ~1683):
```tsx
          <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
```
Replace with:
```tsx
          <aside className="rounded-xl border border-border bg-card p-4 shadow-sm">
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/user/kyc-agentic2/kyc-agentic2 && ./node_modules/.bin/tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ExceptionReview.tsx
git commit -m "feat: exception review — tighten main panel and aside card padding"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

Open `http://localhost:8080` (or whichever port Vite reports).

- [ ] **Step 2: Check each page visually**

| What to check | Expected |
|---------------|----------|
| Nav brand | "KYC Sentinel" bold + "POWERED BY FORGE" muted below + blue→indigo vertical bar; clicking goes to "/" |
| Dashboard | h1 is `text-[18px] font-bold`; top 3 KPI cards have coloured top border, no gradient bg; 4 shortcut buttons are individual cards with coloured top border; section cards have `p-4` |
| Work Queue | h1 is `text-[18px] font-bold`; column header row is visibly darker; each DRG group button has coloured left border |
| Reports | h1 is `text-[18px] font-bold`; KPI cards have top-border accent, no icon badge; chart cards have tighter headers |
| Exception Review | Panel and aside padding slightly tighter |
| Dark mode | Click moon/sun toggle — all top-borders and text remain legible |

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

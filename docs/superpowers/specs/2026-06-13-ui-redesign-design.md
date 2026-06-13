# UI Redesign — KYC Sentinel Visual Refresh

**Date:** 2026-06-13  
**Status:** Approved

## Context

The app currently renders as a generic light-mode compliance tool. This spec covers a targeted visual refresh to make it feel more distinctive and polished — across both light and dark modes — without changing any functionality or data models.

## Decisions

### 1. Nav Rebrand

**Replace:** KPMG logo SVG + "KYC Platform" span  
**With:**
- A 3px vertical `bg-gradient-to-b from-blue-500 to-indigo-500` accent bar (rounded, `h-[22px]`)
- `<Link to="/">` wrapping the whole brand block (clickable, navigates home)
- **"KYC Sentinel"** — `text-[14px] font-bold text-nav-foreground tracking-tight`
- **"Powered by Forge"** — `text-[9px] text-nav-muted uppercase tracking-widest` on a second line below

File: `src/components/AppLayout.tsx`

### 2. Page Header — Content First

Remove any separate title strip. Page title lives at the top of the scrollable `<main>` content area.

Pattern (used on all 4 pages):
```tsx
<div className="px-6 pt-5 pb-2 flex items-baseline justify-between">
  <div className="flex items-baseline gap-3">
    <h1 className="text-[18px] font-bold tracking-tight text-foreground">Alex's Dashboard</h1>
    <span className="text-sm text-muted-foreground">47 cases need attention</span>
  </div>
  {/* right-side filters / actions */}
</div>
```

Files: `src/pages/Dashboard.tsx`, `src/pages/WorkQueue.tsx`, `src/pages/Reports.tsx`, `src/pages/ExceptionReview.tsx`

### 3. KPI Cards — Top-Border Accent

**Replace:** left-border accent style and icon-badge stat cards  
**With:** uniform card with a 3px semantic top-border, bolder number, tighter padding

```tsx
<div className="rounded-xl border border-border bg-card p-4 shadow-sm border-t-[3px] border-t-blue-500">
  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Queue</p>
  <p className="text-2xl font-bold tabular-nums text-foreground">247</p>
  <p className="text-[11px] text-muted-foreground mt-1">↑ 12 cases</p>
</div>
```

Semantic top-border colors:
- Queue / Info: `border-t-blue-500` (maps to `--primary`)
- SLA Risk / Alert: `border-t-red-500` (maps to `--alert`)
- Complete / Success: `border-t-emerald-500` (maps to `--success`)
- AI Actions: `border-t-indigo-500`

Files: `src/pages/Dashboard.tsx`, `src/pages/Reports.tsx`

### 4. Content Cards — Tightened

- Padding: `p-5` → `p-4` throughout all section cards
- Card headers: `font-semibold` → `font-bold`, vertical padding `py-3` → `py-2.5`
- All section cards: add `shadow-sm` if missing

Files: `src/pages/Dashboard.tsx`, `src/pages/WorkQueue.tsx`, `src/pages/Reports.tsx`, `src/pages/ExceptionReview.tsx`

### 5. Work Queue Table — Sharper

- DRG group header rows: add a `border-l-2` accent in priority color
  - High priority group: `border-l-alert`
  - Medium: `border-l-warning`
  - Low / None: `border-l-muted`
- Table column header row: `bg-secondary/30` → `bg-muted/60` for stronger column contrast

File: `src/pages/WorkQueue.tsx`

## Out of Scope

- No changes to routing, data fetching, or business logic
- No new pages or components
- Dark mode CSS variables already implemented (prior commit)
- AI chat floating button unchanged
- Agent dock unchanged

## Verification

1. `npm run dev` — visually check each page
2. Nav brand "KYC Sentinel / Powered by Forge" visible and clickable → goes to "/"
3. No hero band on any page — title sits in content area
4. KPI cards have top-border accent in correct semantic color
5. Work Queue DRG headers show priority-colored left border
6. Toggle dark mode — all new styles hold

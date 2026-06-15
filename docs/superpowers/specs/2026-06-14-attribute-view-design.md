# Attribute View Redesign — Design Spec

## Context

The existing attribute panel lives in a collapsible right pane alongside Document Locker and Collaboration tabs. Analysts find it hard to use because it is narrow, hidden by default, and read-only. This redesign pulls attributes into the main content area as a first-class view, reachable via a tab toggle, with a traditional form layout, per-field agent tracing, confidence scores, and a full audit trail.

---

## Layout

### Toggle placement
An **"Exception" | "Attributes"** segmented tab control sits in the main content header (same row as the Manual Override and Re-run Agents buttons). Switching to **Attributes** replaces the centre panel content entirely. The left exceptions list and right pane (Document Locker, Collaboration) remain visible and unchanged.

The existing **Attributes tab inside the right pane is removed**. Its content is superseded by this view.

### Attributes view structure
```
┌─ Page header ────────────────────────────────────────┐
│  [Exception] [Attributes ●]    [⚡ Override] [↻ Re-run] │
├─ Status strip ───────────────────────────────────────┤
│  ✓ ID Complete  ⚠ Verification Pending  ✕ 3 Exceptions │
│                              Entity Name →            │
├─ Collapsible section (expanded) ─────────────────────┤
│  ▼ ENTITY IDENTIFICATION          6 attributes        │
│   • Legal Name    Brevan Howard…   ID✓/V✓  CRM  🤖   │
│   • LEI Number    549300… ⚠        ID✓/V⚠  3rd  🤖   │
│   …                                                   │
├─ Collapsible section (expanded) ─────────────────────┤
│  ▼ REGISTRATION & REGULATORY      4 attributes  1 ●  │
│   …                                                   │
├─ Collapsible section (collapsed) ────────────────────┤
│  ► OWNERSHIP & CONTROL            2 attrs · 4 sub-records │
│  …                                                    │
└───────────────────────────────────────────────────────┘
```

---

## Sections

- Ordered by `ATTR_CATEGORY_ORDER` (existing constant): Entity Identification, Registration & Regulatory, Address & Operations, Classification & Risk, Financial Profile, Officers & Signatories, Ownership & Control.
- **First two sections expanded by default**; remainder collapsed.
- Section header: chevron ▼/►, category name (uppercase), attribute count, optional red pending badge (count of flagged attributes).
- Clicking any section header toggles it.

---

## Field Rows

Each simple attribute renders as a single row:

```
[status dot]  [Label — 150px]  [Value — flex]  [ID✓/V✓]  [Source]  [🤖 Trace]
```

- **Status dot**: 6 px circle — green (ok), amber (warn), red (alert/err).
- **Label**: 150 px fixed, `font-weight: 500`, muted colour.
- **Value**: flex, full colour. Alert values in red + bold. Warn values in amber.
- **ID / V badges** (Style 3 — inline text): `ID✓ / V✓` with per-status colour (green ok, amber warn, muted grey for `–`). Applied at individual sub-field level for nested objects.
- **Source badge**: coloured pill — CRM (blue), 3rd (purple), Forge (green).
- **🤖 Trace button**: opens the inline drawer (see below). Disabled/grey when no trace exists.

Alert-status rows have a left red border and faint red background. Warn rows have amber border + faint yellow. Manually overridden rows have green border + faint green background with a `✎ Manually overridden` badge on the value.

---

## Nested Object Fields

For attributes that contain multiple records (e.g. Persons with Significant Control, Beneficial Owners, Officers):

```
┌─ Object block ──────────────────────────────────────┐
│  [dot]  Persons with Significant Control   ID✓/V⚠  🤖 │
├─ Entry: John Armitage  [Shareholder · 32%] ─────────│
│    [dot]  Name            John Armitage   ID✓/V✓  CRM  🤖 │
│    [dot]  Date of Birth   1964-09-15      ID✓/V✓  CRM  🤖 │
│    [dot]  Country         United Kingdom  ID✓/V✓  Forge 🤖 │
├─ Entry: Nagi Kawkabani  [CEO · 28%] ────────────────│
│    [dot]  Name            Nagi Kawkabani  ID✓/V✓  CRM  🤖 │
│    [dot]  Date of Birth   1971-03-08 ⚠   ID✓/V⚠  3rd  🤖 │
│    [dot]  Country         Switzerland     ID–/V✓   3rd  🤖 │
└─────────────────────────────────────────────────────┘
```

- Object-level header shows a **group ID/V summary badge** (reflects worst status of sub-fields) and a group-level 🤖 for the overall attribute trace.
- Each entry has a name header + role/percentage tag.
- Sub-fields indent 24 px and carry their own individual ID/V badges, source badges, and 🤖 Trace buttons.

---

## Inline Trace Drawer

Clicking 🤖 Trace on any field (or sub-field) expands a drawer **immediately below that row**, pushing subsequent rows down. Only one drawer is open at a time — opening a second closes the first.

### Drawer anatomy

```
┌─ Field context + Confidence score ──────────────────┐
│  LEI Number                              Confidence  │
│  549300TRJQK… · Mismatch                    64%      │
│                                         ████░░░░░░  │
├─ [✦ Reasoning]  [📋 Audit Trail] ───────────────────┤
│                                                      │
│  (tab content — see below)                           │
│                                                      │
├─ Actions ───────────────────────────────────────────┤
│  [↻ Re-run Agent]  [⚡ Override Value]  [📄 Docs]  ✕ │
└─────────────────────────────────────────────────────┘
```

#### Confidence score
- Displayed as a large percentage number with a horizontal bar fill.
- Colour: ≥ 90% → blue (primary), 70–89% → amber, < 70% → red.
- **Manual override always shows `1.0`** in green, regardless of prior agent confidence.

#### Reasoning tab
Numbered steps, one per agent action:
- Agent name + action label (e.g. "Document Agent → Retrieved value")
- Agent's thought (italic, full sentence)
- Source citation + timestamp

Followed by a **Conclusion** block (white card with shield icon).

#### Audit Trail tab
Chronological timeline of all changes to this attribute:

| Icon | Actor | Shows |
|------|-------|-------|
| 🤖 | Agent run | Value retrieved, before → after, confidence %, timestamp |
| 👤 | Analyst action | Who re-ran the agent and why, timestamp |
| ✎ | Manual override | Who overrode, old → new value, justification note, confidence 1.0, timestamp |

Each entry shows: actor name + role, action description, `before → after` value change pill (where applicable), confidence badge, UTC timestamp.

#### Drawer actions
- **↻ Re-run Agent** — triggers re-execution for this single attribute.
- **⚡ Override Value** — opens an inline edit form replacing the value in the field row; analyst enters corrected value + optional justification note; on save, confidence locks to 1.0.
- **📄 Source Docs** — opens the existing document viewer (existing `DocumentViewerModal`) filtered to this attribute's docs.
- **✕ Close** — collapses the drawer.

---

## Status Strip (top of Attributes view)

Three pills:
- **✓ ID Complete** (green) / **✕ ID Incomplete** (red)
- **✓ Verification Complete** (green) / **⚠ Verification Pending** (amber) / **✕ Verification Failed** (red)
- **✕ N Exceptions** (red, count of unresolved exceptions for this entity)

Computed from `ENTITY_PROFILES` and `effectiveExceptions` at render time.

---

## Page-Level Actions (header row)

- **⚡ Manual Override** — scrolls to / highlights the first flagged attribute and opens its Override flow.
- **↻ Re-run Agents** — triggers re-run for all attributes of the selected entity (existing `runAgents` integration).

---

## Override Flow (inline)

When **⚡ Override Value** is clicked in a drawer:

1. The field's value cell becomes an editable `<Input>` (or `<Textarea>` for long values) pre-filled with the current value.
2. A small justification `<Textarea>` appears below (`placeholder="Reason for override (optional)"`).
3. **Save** and **Cancel** buttons appear.
4. On Save: value updates locally, confidence locks to 1.0, field row gets green override styling, new override entry appended to the audit trail (newest at bottom).
5. On Cancel: field restores without change.

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ExceptionReview.tsx` | Primary — all new components live here |
| Remove `Attributes` tab from right pane | `rightTab` type changes from `"attrs" \| "locker" \| "collab"` to `"locker" \| "collab"`; default value updated; `rightTab === "attrs"` render branch removed; collapsed-pane icon list removes the Attributes entry |
| Add `attrViewMode: "exception" \| "attributes"` state | Controls tab toggle |

No new files required. All new components (`AttributeFormView`, `FieldRow`, `NestedObjectBlock`, `InlineTraceDrawer`, `AuditTimeline`) are defined in `ExceptionReview.tsx` to preserve access to local types and constants.

---

## Verification

1. Navigate to Work Queue → open any case → Exception Review loads.
2. Main content header shows **Exception | Attributes** tab toggle.
3. Switching to Attributes shows the full-width form; switching back shows the exception detail unchanged.
4. First two sections expanded; others collapsed; clicking headers toggles them.
5. Simple fields show status dot, value, ID✓/V✓, source, 🤖 Trace button.
6. Ownership & Control section: expand to see nested object blocks with per-sub-field ID/V badges.
7. Click 🤖 Trace on any field → inline drawer expands below; Reasoning tab shows agent steps + conclusion.
8. Switch to Audit Trail tab → chronological timeline with agent, analyst, and override entries.
9. Click ⚡ Override Value → inline edit form appears; fill value + note → Save → confidence 1.0, green override styling, audit entry added.
10. Click ↻ Re-run Agent → existing `runAgents` hook fires for that attribute.
11. Right pane (Document Locker, Collaboration) remains unaffected throughout.
12. TypeScript: `./node_modules/.bin/tsc --noEmit` → no errors.

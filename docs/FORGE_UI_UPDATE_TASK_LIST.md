# Forge UI update task list

Purpose: port the recent user-interface improvements into the Forge version
without changing Forge agents, agent prompts, execution, orchestration, or the
separate engine that triggers them.

## Scope boundary

### Include

- React pages, components, styling, client-side state, and accessibility.
- Pure UI filtering and formatting utilities.
- UI-facing read models or adapters that consume data already exposed by the
  Forge platform.
- Frontend tests for the behavior below.

### Do not include

- Agent implementation, prompts, models, tools, or outputs.
- Agent registry configuration or agent administration changes.
- Parent/child, pre/post-agent, or dependency orchestration.
- Source runners, document classification, digitization, or sourcing behavior.
- No-Forge API runner infrastructure, publishers, migrations, or server routes.
- Any replacement for the Forge execution engine.

## 1. Work Queue search

- [ ] Add controlled search state to the Work Queue search input.
- [ ] Filter immediately as the analyst types; matching must be
  case-insensitive.
- [ ] Match across entity name, KYC reference, DRG, customer type,
  jurisdiction, priority, risk, status, and action.
- [ ] Add a clear-search control when a query is present.
- [ ] Show the filtered result count when the search box is empty.
- [ ] Preserve selected entities when they are temporarily hidden by a search.
- [ ] Ensure the Review Selected count and payload include all selected
  entities, including selections hidden by the current search.
- [ ] Show the existing empty state when no rows match.

Acceptance criteria:

- Searching by partial entity name, KYC reference, or DRG returns the expected
  rows.
- Search combines correctly with tabs and advanced filters.
- Clearing the query restores the prior filtered result set.

Reference implementation:

- `src/pages/WorkQueue.tsx`
- `src/lib/workQueueFilters.ts`
- `src/test/workQueueFilters.test.ts`

## 2. Work Queue advanced filters

- [ ] Make the Filter button open and close an anchored filter panel.
- [ ] Add filters for priority, risk, status, and jurisdiction.
- [ ] Populate jurisdiction choices from the loaded Work Queue entities.
- [ ] Apply filters cumulatively rather than treating them as alternatives.
- [ ] Combine advanced filters with search and the All / Periodic Refresh /
  Onboarding tabs.
- [ ] Display the number of active advanced filters on the Filter button.
- [ ] Add Clear filters, Apply/close, and close-icon controls.
- [ ] Preserve selections while filters change.
- [ ] Add appropriate labels and `aria-expanded` / `aria-controls` attributes.

Acceptance criteria:

- Every filter works independently and in combination.
- Clearing filters returns to the search-and-tab result set.
- The active-filter badge always equals the number of non-default filters.

## 3. Dashboard live-data presentation

- [ ] Remove hard-coded Most Frequent Agent Runs rows from the Dashboard.
- [ ] Bind the chart to the equivalent read-only metrics supplied by the Forge
  platform. Do not introduce or change agent execution to produce these values.
- [ ] Scale each bar relative to the largest returned run count instead of
  treating the raw count as a percentage.
- [ ] Remove hard-coded Exception Summary rows.
- [ ] Bind exception type, open count, severity, and age to Forge case/exception
  data.
- [ ] Render missing severity as an em dash rather than inventing a value.
- [ ] Remove hard-coded Recent Activity events.
- [ ] Bind recent activity to Forge audit/activity data and preserve links to the
  relevant entity review screen.
- [ ] Format activity timestamps consistently in the browser locale.
- [ ] Add empty states for no run history, no open exceptions, and no recent
  activity.
- [ ] Keep the existing entity KPI and priority-case presentation intact.

Forge integration note:

- Implement a frontend adapter around the existing Forge read APIs/dataflow
  outputs. The No-Forge `/api/dashboard/insights` route is only a reference for
  the UI response shape and must not be copied if it bypasses the Forge engine.
- Suggested view model:

```ts
type DashboardInsights = {
  frequentAgentRuns: { slug: string; name: string; runs: number }[];
  exceptionSummary: {
    type: string;
    open: number;
    severity: "high" | "medium" | "low" | null;
    ageDays: number;
  }[];
  recentActivity: {
    id: string;
    type: "ai" | "document" | "action";
    title: string;
    timestamp: string;
    kycRef: string;
    entityName: string;
    snippet: string | null;
  }[];
};
```

Acceptance criteria:

- None of the three Dashboard panels contains mock rows.
- Counts and activity update from Forge data without a frontend deployment.
- Empty datasets render a deliberate empty state without errors.

Reference implementation:

- `src/pages/Dashboard.tsx`

## 4. Customer-provided document upload

- [ ] Add a multi-file upload control to the entity Documents panel.
- [ ] Accept the customer-document formats supported by the Forge intake API
  and show the permitted formats and size limit beside the control.
- [ ] Show upload progress, accepted files, duplicates, and per-file errors.
- [ ] Refresh the document list and processing state after a successful upload.
- [ ] Display queued, classifying, digitizing, completed, duplicate, and failed
  states using status data returned by Forge.
- [ ] Preserve uploader and upload-time metadata in the document detail view so
  customer-provided evidence is clear in the entity data lineage.
- [ ] Keep document digitization agents unavailable as independent UI actions.
- [ ] Invoke only Forge's existing customer-document intake endpoint. Forge's
  separate engine remains responsible for classification, deduplication,
  digitization-agent selection, execution, and lineage persistence.

Acceptance criteria:

- An analyst can select and upload one or more customer documents from the
  entity review screen.
- Duplicate and unsupported files produce clear, file-specific feedback.
- Processing status updates without navigating away from the entity.
- The UI introduces no direct agent trigger or orchestration calls.

Reference implementation:

- `src/components/kyc/EntityFiles.tsx`
- `src/components/kyc/FileCard.tsx`
- `src/pages/ExceptionReview.tsx`

## 5. Sourcing and due-diligence sequencing controls

- [ ] Consume the Forge engine's per-entity execution state in the agent trigger
  controls; do not derive authoritative state solely from browser memory.
- [ ] Disable Due Diligence while sourcing is running or awaiting analyst
  review for the same entity.
- [ ] Disable Sourcing while due diligence is running or awaiting analyst
  review for the same entity.
- [ ] Keep the controls available for unrelated entities.
- [ ] Explain the disabled state in a tooltip and display Forge's conflict
  response if another session starts a conflicting run first.
- [ ] Treat HTTP 409 sequencing responses as expected workflow feedback rather
  than a generic system failure.
- [ ] Keep screening behavior unchanged unless Forge's engine defines an
  additional dependency.

Forge integration note:

- Forge's separate execution engine must remain the authority that enforces the
  sequence. The UI may poll or subscribe to its state, but must not implement
  locks, reorder agents, or reproduce the No-Forge database trigger.

Acceptance criteria:

- Sourcing and DD never appear independently runnable at the same time for one
  entity, including across two browser sessions.
- A pending-review sourcing run continues to block DD until it is accepted,
  rejected, cancelled, or failed.
- The UI recovers automatically when the blocking run reaches a terminal state.

## 6. Defensive rendering for live API data

- [ ] Normalize nullable exception titles, reasoning, and recommended actions
  before rendering the Exception Review screen.
- [ ] Support both text actions and structured action objects returned by Forge.
- [ ] Use deliberate fallback labels instead of calling string methods on
  missing API fields.
- [ ] Add an error boundary or panel-level fallback so one malformed record
  cannot blank the entire review screen.

## 7. Work Queue top-level agent batches

- [ ] Add a `Run Agent` bulk action beside `Review Selected` for selected Work
  Queue cases.
- [ ] List only enabled, available, user-triggerable top-level agents supplied
  by the Forge registry/read model.
- [ ] Allow one top-level agent per submitted batch; do not allow mixed
  Sourcing and Due Diligence selections.
- [ ] Show Forge's per-case preflight result before submission, including
  sequence conflicts, pending attribute review, jurisdiction/CIP mismatch, and
  unavailable-agent reasons.
- [ ] Submit eligible cases to the Forge engine's durable batch endpoint. Do not
  loop over single-case agent endpoints from the browser.
- [ ] Show queued, running, complete, failed, skipped, and cancelled states on
  the corresponding Work Queue rows.
- [ ] Add batch summary counts and controls to retry failed cases or cancel
  cases that have not started.
- [ ] Preserve row selection across search/filter changes and cap a single
  submission at the Forge-supported batch size.

Forge integration note:

- Forge remains responsible for durable execution, concurrency, idempotency,
  revalidation immediately before execution, sequencing locks, cancellation,
  retries, and audit records. Only the Work Queue interaction and status
  presentation should be ported from the No-Forge implementation.

## 8. Verification and release

- [ ] Add unit tests for case-insensitive search and combined filters.
- [ ] Add component tests for opening, applying, clearing, and closing the
  filter panel.
- [ ] Test selection persistence when selected rows become hidden.
- [ ] Test each Dashboard empty state and populated state.
- [ ] Test customer-document selection, upload results, processing statuses,
  duplicates, and errors.
- [ ] Test sourcing/DD button states for running, pending-review, terminal, and
  cross-session conflict responses.
- [ ] Test nullable and legacy exception payloads, including missing titles and
  mixed recommended-action shapes.
- [ ] Verify screenshot cards and viewers surface the searched entity, source,
  capture time, outcome, and captured fields/no-match reason supplied by Forge.
- [ ] Verify blank or invalid screenshots render a deliberate evidence error
  instead of appearing as successful source evidence.
- [ ] Test batch preflight, zero-eligible handling, partial eligibility,
  idempotent submission, progress polling, cancellation, and failed-case retry.
- [ ] Validate keyboard navigation and accessible labels.
- [ ] Validate responsive behavior at the Forge application's supported
  breakpoints.
- [ ] Confirm no agent, prompt, registry, flow, or orchestration files are in the
  Forge UI update diff.
- [ ] Confirm no new agent-triggering network calls were introduced.
- [ ] Run the Forge frontend type check, test suite, and production build.

## Explicitly excluded recent No-Forge changes

The following recent work must not be ported as part of this UI update:

- Source-agent parity changes from commit `3041a78`.
- Post-sourcing document processing from commit `682ee87`.
- Registry-orchestrator creation or ordering changes.
- RIA seed/reset scripts and No-Forge backend dashboard aggregation routes.

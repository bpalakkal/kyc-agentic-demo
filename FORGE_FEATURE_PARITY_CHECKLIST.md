# Forge Feature Parity Checklist

Use this checklist to confirm whether the functional changes added to the no-Forge application also exist in the Forge version. This intentionally excludes colors, typography, spacing, cards, animations, and other look-and-feel changes.

For each item, check **Forge verified** when the behavior exists and works end to end. If it does not, use the implementation task as the Forge backlog item.

## 1. Agent Register and visibility

- [ ] **Forge verified — Agent Register is the golden source.** The UI obtains the agent inventory from the persistent Agent Register rather than a separate hardcoded frontend list.
  - Implementation task: remove any parallel UI catalog and make all agent lists, labels, availability, and dispatch decisions registry-driven.
  - Acceptance: an agent absent from the register is neither visible nor executable, including through a direct API request.

- [ ] **Forge verified — Enabled and runtime readiness are separate.** An enabled agent is shown as unavailable when its runner or required environment configuration is missing.
  - Implementation task: calculate readiness from `enabled`, runner registration, and required credentials.
  - Acceptance: the inventory identifies Disabled, Ready, and Unavailable agents and gives the reason for Unavailable.

- [ ] **Forge verified — Registry-only case triggers.** Sourcing, due-diligence, screening, re-verification, and resolution actions can invoke only registered, enabled, available, user-triggerable agents.
  - Implementation task: validate every trigger in both the browser and backend.
  - Acceptance: stale or manually constructed slugs cannot bypass registry rules.

- [ ] **Forge verified — Top-level trigger configuration.** `top_level_trigger` determines which agents appear in the global Trigger menu; `sort_order` determines their order.
  - Implementation task: derive the global trigger menu dynamically from registry rows.
  - Acceptance: changing the register changes the menu without a frontend code release.

- [ ] **Forge verified — Trigger menu closes on outside click.** The global Trigger menu closes when the analyst clicks anywhere outside it, while interactions inside remain active.

## 2. Parent orchestration and focused agents

- [ ] **Forge verified — Parent agents are virtual orchestrators.** UK Sourcing, US Sourcing, and DD All-in-One orchestrate children defined by the Agent Register instead of performing aggregate model work themselves.
  - Acceptance: the parent creates an orchestration audit run but does not invoke a legacy aggregate runner.

- [ ] **Forge verified — UK Sourcing membership.** The parent independently invokes FCA and Companies House in parallel.

- [ ] **Forge verified — US Sourcing membership.** The parent independently invokes GLEIF, SEC, IAPD, and NYSE in parallel.

- [ ] **Forge verified — DD All-in-One membership.** The parent independently invokes all 18 focused DD agents, keeping each agent/model context limited to its governed one or two attributes.
  - Acceptance: each DD child has its own run record, status, output, and error.

- [ ] **Forge verified — Screening remains a focused top-level leaf.** Screening is directly triggerable but is not treated as an aggregate DD or sourcing runner.

- [ ] **Forge verified — Registry-controlled execution behavior.** Parent rows support `child_agents`, `child_execution` (`parallel` or `sequential`), and `failure_policy` (`continue` or `fail_fast`).

- [ ] **Forge verified — Pre- and post-agents.** Registered `pre_agents` execute before the main stage and `post_agents` execute only after the preceding required stages succeed.

- [ ] **Forge verified — Dependency validation.** Missing, disabled, unavailable, duplicate, or cyclic dependencies are rejected before execution.

- [ ] **Forge verified — Parent/child audit linkage.** Child runs retain `parent_run_id` and a `run_phase` of `pre`, `main`, or `post`; parent rows use `orchestrator`.

- [ ] **Forge verified — Partial orchestration outcomes.** With `failure_policy = continue`, successful children remain successful and child failures are retained; the parent fails when all children fail.

## 3. Agent triggering and run lifecycle

- [ ] **Forge verified — Per-case concurrency protection.** A case already running agents cannot start a conflicting duplicate batch, while agents for other cases can continue independently.

- [ ] **Forge verified — Automatic commit after execution.** Generic agent output moves from running to the internal pending-review persistence boundary and is then committed automatically without requiring the obsolete diff modal.

- [ ] **Forge verified — Durable run history updates are awaited.** Database status/history writes complete correctly and are not handled using unsupported Promise `.catch()` chaining on Supabase query builders.

- [ ] **Forge verified — Orphaned run detection.** A persisted running record whose process-local output disappeared after a service restart becomes a visible failed run instead of polling forever.

- [ ] **Forge verified — Run cancellation is scoped.** Cancelling one active run or case does not incorrectly cancel unrelated cases.

## 4. Failure versus valid no-data behavior

- [ ] **Forge verified — No-data is not a technical failure.** A valid provider response with no matching record completes with `outcome = no_data` and a human-readable explanation.

- [ ] **Forge verified — Operational failures remain failures.** Authentication, network, timeout, provider HTTP, invalid-response, persistence, and server-restart problems use `status = failed` and retain the concrete error.

- [ ] **Forge verified — Agent Runs displays outcome clearly.** Analysts can distinguish Data found, No data found, and Failed without opening server logs.

- [ ] **Forge verified — Source-specific not-found handling.** FCA, Companies House, GLEIF, IAPD, JFSC, NYSE, and SEC return valid zero-result outcomes where appropriate instead of throwing simply because an entity was not found.

## 5. Additive agent activity dock

- [ ] **Forge verified — Dock is additive across cases.** The bottom agent activity window retains every agent triggered across cases during the session instead of replacing the previous batch.

- [ ] **Forge verified — Latest status remains visible.** Each dock entry shows the current/latest state for that agent run, including running, complete, no-data, failed, and cancelled behavior.

- [ ] **Forge verified — Per-run result link.** The agent name/status area provides a direct action to open that result in the Agent Runs tab for the correct case and agent.

- [ ] **Forge verified — Result deep-link behavior.** Opening a dock result expands and scrolls to the corresponding latest agent result where available.

## 6. Agent Runs tab

- [ ] **Forge verified — Latest meaningful run per agent.** The tab shows the latest completed, pending-review, or failed leaf run per agent when it has steps or output; virtual parent rows are not presented as duplicate result cards.

- [ ] **Forge verified — Thinking and attributes are inspectable.** Each run can expand its persisted step log and returned attributes grouped by lineage/source.

- [ ] **Forge verified — Manual refresh.** A Refresh control reloads run history without leaving the case and displays when the panel was last updated.

- [ ] **Forge verified — Persistent unread counter.** The tab badge counts terminal leaf runs newer than the current analyst's last review cursor.
  - Acceptance: counts are user-specific and case-specific, survive refresh/sign-in, and poll while the case is open.

- [ ] **Forge verified — Review semantics.** The Agent Runs counter clears only when that analyst opens the Agent Runs tab; a background data refresh does not clear it.

## 7. Documents tab

- [ ] **Forge verified — Persistent unread counter.** The Documents badge counts documents and screenshots created after the current analyst's last Documents review cursor.
  - Acceptance: counts are user-specific and case-specific, survive refresh/sign-in, and update while the case remains open.

- [ ] **Forge verified — Review semantics.** The Documents counter clears only when that analyst opens the Documents tab; collapsing the panel or refreshing data does not clear it.

- [ ] **Forge verified — Collapsed-panel badges.** Documents and Agent Runs counters remain visible when the right panel is collapsed.

- [ ] **Forge verified — Right panel auto-collapse.** Clicking Exception View, Attribute View, or Screening Results collapses the right panel without clearing either unread counter.

## 8. Agent Register administration UI

- [ ] **Forge verified — Agent Register search.** Analysts can filter the inventory by agent name, slug, description, category, jurisdiction, CIP classification, runner, or output type; search works with pagination and can be cleared in one click.

- [ ] **Forge verified — Existing Agents page is editable for administrators.** Authorized users have an Edit action; unauthorized users retain read-only inventory access.

- [ ] **Forge verified — Core configuration is editable.** Administrators can update display name, description, enabled state, user-triggerable state, top-level status, sort order, and execution mode.

- [ ] **Forge verified — Orchestration is editable.** Administrators can select pre-, child-, and post-agents and configure parallel/sequential execution and continue/fail-fast behavior.

- [ ] **Forge verified — Save-time validation.** The server rejects invalid references, disabled or unavailable dependencies, missing runners/credentials, invalid top-level settings, duplicate relationships, and dependency cycles.

- [ ] **Forge verified — Backend authorization.** Registry changes require either an administrator role or membership in the configured administrator email allowlist; hiding the Edit button alone is not considered authorization.

- [ ] **Forge verified — Immutable audit history.** Every successful registry edit records the agent slug, analyst, timestamp, previous configuration, and new configuration.

- [ ] **Forge verified — Registry changes take effect without UI deployment.** Refreshing the registry updates inventory, trigger visibility, ordering, and orchestration behavior.

## 9. Supporting data and API requirements

These are not primarily UI tasks, but the UI features above depend on them.

- [ ] Agent Register persistence and orchestration fields exist in the Forge database.
- [ ] Agent runs store `outcome`, `outcome_reason`, `parent_run_id`, and `run_phase`.
- [ ] Per-user/per-case tab review cursors are persisted for Documents and Agent Runs.
- [ ] Agent Register changes have a persistent audit table.
- [ ] Agent inventory, readiness, editing, unread-count, and mark-reviewed APIs require authenticated requests.
- [ ] The frontend sends the active authentication token for every protected agent and case request.

## Out of scope for this comparison

- Color palette and gradients
- Typography and caption styling
- Text-box, dropdown, card, border, and shadow styling
- Spacing, density, and responsive visual refinements
- Decorative icons and animation changes
- General visual redesign from commit `82b03e6`

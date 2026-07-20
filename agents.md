# KYC Sentinel — No-Forge Build — Agents Reference

## Governing Principle

This is the standalone **no-Forge implementation** of the KYC platform. It preserves the established analyst workflow while agents run through **direct REST APIs or the Claude API**. There is no Forge platform, AWS agent runtime, proposal/accept/reject system, `RegisterAgentDialog`, or `forge_slug` database column.

---

## Project Name & Architecture

**Purpose:** AI-powered KYC compliance platform for financial analysts. Surfaces KYC exceptions, supports analyst review/resolution, and dispatches AI agents for due diligence and sanctions screening.

### Tech Stack
- **Frontend:** React 18, TypeScript, Vite (dev port 8080), shadcn/ui (Radix + Tailwind), Lucide, Recharts, TanStack Query
- **Backend:** Express (`server.js`), Node.js ESM, Railway (port 3001)
- **Databases:** Supabase (PostgreSQL + Storage), Neo4j (ownership graph, optional)
- **AI:** Anthropic Claude `claude-sonnet-4-6` (chat, DD agents, Companies House PDF digitization); OpenSanctions REST (screening)
- **No AWS ELB. No Forge platform.**
- **Deployment:** Frontend → GitHub Pages (`/kyc-agentic/`); Backend → Railway

### Directory Map
```
kyc-agentic/
├── agents/                                # Server-side agent ecosystem (Node.js ESM)
│   ├── types.ts                           # AgentRunOutput, AttributeOutput, ExceptionOutput, FileOutput
│   ├── base/
│   │   └── ApiRunner.js                   # Base lifecycle: execute, stage, auto-commit
│   ├── dd/
│   │   ├── entityData.js                  # buildEntityDataJson — DB rows → entity_data.json
│   │   └── gate.js                        # agentsToRun() — which DD agents still have work
│   ├── policy/
│   │   ├── dd-guidance-reader.md          # System prompt for all DD agents
│   │   └── registered_investment_advisor/ # Per-attribute policy .md files
│   ├── publishers/                        # AttributePublisher, ExceptionPublisher, FilePublisher
│   └── runners/api/                       # Synchronous REST / Claude API runners
│       ├── CompaniesHouseRunner.js        # CH REST + Claude PDF digitization
│       ├── FCARunner.js                   # FCA Register REST (no LLM)
│       ├── GLEIFRunner.js                 # GLEIF REST (no LLM)
│       ├── IAPDRunner.js                  # IAPD REST (no LLM)
│       ├── JerseyFSCRunner.js             # JFSC REST (no LLM)
│       ├── NYSERunner.js                  # NYSE REST (no LLM)
│       ├── SECEDGARRunner.js              # SEC EDGAR REST (no LLM)
│       ├── UKSourcingFlowRunner.js        # FCA + Companies House in parallel
│       ├── USSourcingFlowRunner.js        # SEC + IAPD + NYSE in parallel
│       ├── ScreeningRunner.js             # OpenSanctions + Claude discounting
│       ├── DdRunner.js                    # Base DD orchestrator (Claude API)
│       └── dd/                            # 18 per-attribute DD runner classes + DdAllInOneRunner.js
│
├── schema/                                # Anti-drift contract (shared frontend + backend)
│   ├── kyc_master_attribute_schema.json  # Canonical master (RIA entity type, per-CIP applicability)
│   ├── dd-registry.json                  # 18 DD agents → attributes they govern
│   ├── schema-meta.json + schema-meta.js # GENERATED — never hand-edit
│   └── index.js + index.d.ts             # Typed accessor (@schema alias)
│
├── src/
│   ├── pages/                             # Dashboard, WorkQueue, ExceptionReview, Agents, Reports, Login
│   ├── components/
│   │   ├── AppLayout.tsx                  # Shell: header + nav (Dashboard/Work Queue/Agents/Reports)
│   │   ├── AgentSystem.tsx                # Agent registry + orchestration + compact dock UI
│   │   │                                  #   Auto-commits on pending_review (no diff modal shown)
│   │   ├── GraphView.tsx                  # Neo4j ownership graph via Cytoscape + DAGRE
│   │   └── kyc/
│   │       ├── SimpleFieldRow.tsx         # Attribute display + trace drawer (ID/V from DB only)
│   │       ├── AttributeDiffModal.tsx     # Exists but NOT used (auto-commit bypasses it)
│   │       ├── AgentTriggers.tsx          # Sourcing / DD / Screening tabs
│   │       ├── AgentRunsPanel.tsx         # Historical runs list
│   │       ├── PersonRoleTable.tsx        # Party tables (BOs, officers, signatories)
│   │       ├── DocumentViewer.tsx         # PDF/image viewer (Supabase signed URLs)
│   │       ├── FileCard.tsx + EntityFiles.tsx
│   │       └── CollabPanel, WgqTabContent, ForgeLineagePanel, ForgePersonCard, DatastoreDocuments
│   ├── contexts/AuthContext.tsx
│   ├── db/                                # supabase.js (server), neo4j.js
│   ├── lib/                               # apiFetch.ts, attrLabel.ts, schemaAttrs.ts, supabase.ts, utils.ts
│   └── data/kycMockData.ts               # Type definitions only — no mock data
│
├── scripts/
│   └── migrations/                        # Current SQL migrations through 014; run in order
│
├── server.js                              # All Express backend logic
├── vite.config.ts                         # @schema alias + base: /kyc-agentic/
└── .env.example
```

Some internal compatibility names still contain `Forge` or `snapshot` (for example `forgeTypes.ts`, `ForgeLineagePanel`, and database `snapshot_id`). These describe the inherited data shape and deployed schema; they do not indicate a Forge runtime dependency. Avoid broad renames without a dedicated migration/refactor plan.

---

## Environment & Commands

```bash
npm run start    # Vite (8080) + Express (3001) concurrently — standard dev
npm run dev      # Vite only
npm run server   # Express only
npm run build    # Regenerate entity fixtures + schema metadata, then build Vite
npm run generate # Regenerate entity fixtures and schema-meta.*
```

### One-time setup
```bash
node scripts/seed-supabase.js    # Seed DRGs
node scripts/setup-storage.js   # Create kyc-files Supabase Storage bucket
```

### Database migrations (Supabase SQL Editor, in order)
```
000_base_schema.sql
001_agent_runs_and_case_files.sql
002_agent_runs_status_constraint.sql
003_entity_attributes_confidence.sql
006_screening.sql
007_kyc_ref_from_ids.sql                   ← WARNING: wipes all case data (TRUNCATE entities CASCADE)
008_persons_and_dd_columns.sql
009_person_overrides_and_runs_columns.sql  ← person_overrides table + agent_runs.steps/raw_output
010_agent_registry.sql                     ← persistent golden-source agent registry
011_agent_run_outcomes.sql                 ← separates data_found/no_data from operational failures
012_agent_registry_orchestration.sql       ← registry-only visibility plus pre/main/post orchestration
013_case_tab_review_state.sql              ← per-analyst Documents and Agent Runs unread cursors
014_agent_registry_audit.sql               ← immutable Agent Register configuration history
```

### Agent run status vs outcome
`agent_runs.status` records execution lifecycle. `failed` is reserved for operational or technical failures such as credentials, HTTP errors, timeouts, invalid responses, persistence errors, or server restarts. A successful provider search that returns no matching record finishes with `status = 'complete'`, `outcome = 'no_data'`, and a human-readable `outcome_reason`. Successful searches with results use `outcome = 'data_found'`. Never throw solely because a valid search returned zero records; return a normal output with `metadata.outcome = 'no_data'`. Conversely, never swallow HTTP or network errors and turn them into no-data results.

### Registry-authoritative dispatch
Only enabled, available rows in `agent_registry` with `user_triggerable = true` may be invoked directly. `top_level_trigger` controls the global Trigger Agents strip; other user-triggerable rows appear in the case category controls. The frontend validates every invocation against `/api/agents`, including legacy resolution and re-verification actions, and never simulates an unknown slug. The backend repeats registry validation so direct API calls cannot bypass it.

`pre_agents` and `post_agents` are ordered arrays of registry slugs. Virtual parents use `execution_mode = 'orchestrator'` with registry-owned `child_agents`, `child_execution` (`parallel` or `sequential`), and `failure_policy` (`fail_fast` or `continue`). The backend resolves these relationships recursively, rejects missing/disabled/unimplemented dependencies and cycles, then executes pre → children → post. Dependency-only utilities use `user_triggerable = false`. Chains are audited through `agent_runs.parent_run_id` and `run_phase` (`orchestrator`, `pre`, `main`, or `post`).

`uk-sourcing-flow`, `us-sourcing-flow`, and `dd-all-in-one` are virtual orchestrators; they do not use their legacy aggregate runner classes. `dd-all-in-one` runs all 18 focused DD agents independently in parallel so each model call is limited to its governed attributes. `screening` remains a focused top-level leaf agent.

### Case tab unread state
The Documents and Agent Runs badges are analyst-specific and case-specific. `case_tab_reviews` persists the last time each analyst opened each tab. `/api/entity/:kycRef/tab-unread` counts newer artifacts and terminal leaf-agent runs; opening a tab calls `/api/entity/:kycRef/tab-reviewed/:tab`. The UI polls counts every 15 seconds and never clears a badge merely because its data was refreshed.

### Agent Register administration
The Agents page supports client-side registry search and edits registry configuration through `PATCH /api/agents/:slug`; the browser never writes registry rows directly. The server validates references, enabled dependencies, runner/environment readiness, top-level trigger rules, and cycles, then records old/new configurations in `agent_registry_audit`. Set `AGENT_REGISTRY_ADMIN_EMAILS` to a comma-separated Railway allowlist. Supabase users with admin role metadata are always allowed; when no allowlist exists, authenticated users retain edit access for backward compatibility.

If migration 009 hasn't run, the commit step fails with a column error. Verify with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'agent_runs' ORDER BY column_name;
-- Must include: error, steps, raw_output, sources_consulted
```

### Required environment variables
| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Supabase backend (service key) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase frontend (anon key) |
| `ANTHROPIC_API_KEY` | Claude API (DD agents + CH PDF digitization) |
| `COMPANIES_HOUSE_API_KEY` | Companies House REST API |
| `FCA_AUTH_EMAIL`, `FCA_API_KEY` | FCA Register API (set in Railway Variables, not .env) |
| `SEC_API_KEY` | sec-api.io access used by the IAPD runner |
| `OPENSANCTIONS_API_KEY` | OpenSanctions /match/default (screening) — set in Railway |
| `VITE_AGENT_API_BASE` | Express URL (Railway URL in production; set as GitHub Actions secret) |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Neo4j (optional — graph tab only) |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Zoom OAuth |
| `CORS_ORIGIN` | Optional comma-separated additional production origins |
| `HEALTH_SECRET` | Optional token for detailed `/api/health` output via `x-health-token` |

> `VITE_AGENT_API_BASE` must be a **GitHub Actions repository secret** (not a Railway env var) so it is injected at build time. The compiled frontend JS cannot read Railway runtime env vars.

---

## Coding Standards & Conventions

### API calls — non-negotiable
- **Always use `apiFetch()`** from `src/lib/apiFetch.ts` for all calls to `AGENT_API_BASE/api/*`. Direct `fetch()` returns 401.
- `AuthContext` may call `getSession()` once to restore the initial login. Runtime API authentication is tracked through `onAuthStateChange()` and injected by `apiFetch()`.

### Auto-commit flow (no diff modal)
This build skips the analyst diff review. The frontend auto-commits as soon as it sees `pending_review`:
1. `POST /api/agent-run/api/:slug` → runner executes, status → `pending_review`
2. Frontend polls steps + status
3. On `pending_review` → immediately calls `POST /api/agent-run-api/:runId/commit` (no body = accept all)
4. Attributes written to DB, status → `complete`
5. Dock shows `✓ Saved: N attrs · M exceptions`
6. `AttributeFormView` auto-refreshes via `overrideVersion` bump (`wasRunning` ref pattern)

`AttributeDiffModal.tsx` exists but is **not invoked**. Do not wire it in.

### Agent runner contract
- Every new runner extends `ApiRunner`, lives in `agents/runners/api/MyRunner.js`.
- `attributeGroup` must be `'core'` or `'wgq'` — no other values. Custom group names silently hide all attributes from that runner in the UI.
- Set `confidence: 100` for pure REST runners. Use the model-provided score for LLM runners (0–100).
- Call `this.step(msg)` at each phase for live progress in the dock.
- `AgentRunOutput` shape: `{ agentSlug, kycRef, outputType, attributes?, exceptions?, files[], metadata }`.
- Files must include inline `content`; the publisher does not fetch artifacts from a remote agent runtime.

### `cip_classification` string
Must be exactly `'Registered Investment Advisor or Commodity Trading Advisor'` — this is what the DB stores and what the UI filters on. Never use `'RIA'` or other short aliases.

### ID/V flags
- `id_flag` and `verification_flag` in `entity_attributes` are set **only** by DD agent runs.
- They are **never** auto-set when an analyst manually overrides a value.
- `SimpleFieldRow.tsx` reads them directly from DB — the `isOverridden ? true :` pattern was intentionally removed.

### Party data pattern
- Sourcing agents write party data to `entity_persons` (one row per person), not as flat `beneficial_owner_1_name` rows.
- `entity_persons.attributes` (jsonb): child attributes keyed by full name.
- `buildEntityDataJson(attrs, persons)` reconstructs the `entity_data.json` shape for DD agent input.
- DD party results update `entity_persons.attributes` in-place when `record_index` is present.

### Schema — single source of truth
- `schema/kyc_master_attribute_schema.json` is the canonical master. **Never hand-edit `schema-meta.*`** — run `npm run generate` after editing the master.
- `kyc_ref` = `entity_id + '_' + case_id` (DB-enforced via trigger since migration 007). Always create cases via `upsertEntity({ entityId, caseId })`.
- Import the schema accessor via the `@schema` alias (configured in `vite.config.ts`).

### Supabase / Node requirements
- Node 20+ required. Backend must configure `realtime: { transport: ws }` using the `ws` package.

### Tailwind / CSS
- Custom color tokens: `alert`, `warning`, `success`, `info`, `risk-rating` (each with `.soft` and `.soft-border`).
- If UI looks unstyled, check `dist/assets/index-*.css` is ~107 kB. A ~0.3 kB file means `index.css` was clobbered.

---

## Testing & PR Rules

### Adding a new API runner (checklist)
1. Create `agents/runners/api/MyRunner.js` extending `ApiRunner`.
2. Set `get slug()`, `get outputType()`, implement `async execute(ctx)` returning `AgentRunOutput`.
3. Call `this.step(msg)` at each phase for dock progress.
4. Export from `agents/runners/api/index.js`.
5. Add to `loadRunnerClass()` map in `server.js` — missing entry returns 404 and shows ⚠ in dock.
6. Add the registry row through a migration. The frontend derives generic versus screening dispatch from `execution_mode`; do not add a frontend agent catalog entry.

### Agent registry entries (`agent_registry` → `/api/agents`)
Migration 010 seeds 29 persisted agents across three groups. Supabase is the golden source for metadata, enablement, ordering, trigger behavior, execution mode, and required environment variables. The API enriches each row with runtime readiness:
- **Sourcing (9)**
- **Due Diligence (19):** `dd-all-in-one` + 18 per-attribute DD runners
- **Screening (1):** `screening` — routed to `POST /api/entity/:kycRef/screening/run`

An agent is runnable only when it is enabled, directly triggerable (or reached as a dependency), its runner/route exists, every `required_env` entry is configured, and its pre/post dependency graph is valid. Do not add agents to `AgentSystem.tsx`; add or update the registry through a migration and wire the backend implementation using the same slug.

Current groups:
- **Sourcing (9):** `uk-sourcing-flow`, `companies-house`, `fca`, `jersey-fsc`, `us-sourcing-flow`, `sec`, `iapd`, `nyse`, `gleif`
- **Due Diligence (19):** `dd-all-in-one` + 18 per-attribute DD runners
- **Screening (1):** `screening`

### Troubleshooting agent failures (check in order)
1. **Dock error message** — the step log shows the exact failure (e.g. `COMPANIES_HOUSE_API_KEY environment variable is not set`).
2. **Railway logs** — filter for `[api-runner]` and `[dd-run]` prefixes.
3. **Health endpoint** — `GET /api/health` returns `{ ok: true }` when Supabase is reachable; `ok: false` means all agents will fail at `_createRun()`.
4. **Server restart mid-run** — the next status poll detects the missing in-memory execution and marks the stale `running` run `failed` with `"Server restarted while run was in progress"`. Re-run the agent.
5. **CORS / network error** — verify `VITE_AGENT_API_BASE` GitHub secret matches current Railway URL (no trailing slash); rebuild + redeploy frontend after changing it.

| Agent group | Required env var | Typical error |
|---|---|---|
| Companies House, UK sourcing | `COMPANIES_HOUSE_API_KEY` | `COMPANIES_HOUSE_API_KEY environment variable is not set` |
| FCA, UK sourcing | `FCA_AUTH_EMAIL`, `FCA_API_KEY` | `FCA credentials missing` |
| IAPD, US sourcing | `SEC_API_KEY` | `SEC_API_KEY environment variable is required for the IAPD runner` |
| All DD agents, CH PDF phase | `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY is not set` |
| Screening | `OPENSANCTIONS_API_KEY` | `OPENSANCTIONS_API_KEY is not set` |
| Any agent | Supabase down | `agent_runs insert error` |

### Key UI behaviours (must not regress)
- **Agent triggers:** Sourcing "Run All" = `uk-sourcing-flow`; DD "Run All" = `dd-all-in-one`. Both available only when an entity is loaded.
- **Attribute grid:** All schema-applicable categories shown even when empty. No SourceStrip when sources agree; amber pills per source when they disagree. ID/V badges only from real DB flags (DD agents).
- **After agent run:** Attributes auto-refresh via the `wasRunning` ref pattern — no page reload.
- **Compact dock:** Groups runs by entity; each shows dot + name + elapsed time + attr count + status text.
- **Nav order:** Dashboard → Work Queue → Agents → Reports.

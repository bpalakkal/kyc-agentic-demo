# KYC Sentinel — Project Context

## What This App Does

AI-powered KYC (Know Your Customer) compliance platform for financial analysts. Surfaces KYC exceptions, lets analysts review and resolve them, and dispatches AI agents for investigative due diligence.

## Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite (dev port 8080)
- **Deployed to**: GitHub Pages at `/kyc-agentic2/` base path
- **UI**: shadcn/ui (Radix + Tailwind), Lucide icons, Recharts
- **State**: React Context (Auth, Agents, theme) + TanStack Query

### Backend
- **Framework**: Express (`server.js`), deployed to Railway on port 3001
- **Dev**: `npm run start` runs both Vite and Express concurrently
- Server runs as plain Node.js ESM (`node server.js`) — no TypeScript compilation step

### Databases
- **Supabase** (PostgreSQL) — entities, exceptions, KYC snapshots, agent runs, case files
- **Supabase Storage** — private `kyc-files` bucket for documents and screenshots
- **Neo4j** — ownership/relationship graph

### AI
- **Anthropic Claude** (claude-sonnet-4-6) — floating chat assistant + tool use
- **AWS ELB agents** — autonomous agents invoked via HTTP; async polling pattern

## Source Layout

```
my-app/
├── agents/                          # Server-side agent ecosystem (Node.js ESM)
│   ├── types.ts                     # AgentRunOutput, AttributeOutput, ExceptionOutput, FileOutput
│   ├── registry.ts                  # Agent slug → metadata map
│   ├── base/
│   │   ├── ApiRunner.js             # Abstract base for synchronous API runners
│   │   └── AutonomousRunner.js      # Abstract base for async AWS ELB agents
│   ├── publishers/
│   │   ├── AttributePublisher.js    # Writes AttributeOutput[] → entity_attributes
│   │   ├── ExceptionPublisher.js    # Writes ExceptionOutput[] → exceptions
│   │   ├── FilePublisher.js         # Uploads files → Supabase Storage + case_files
│   │   └── index.js
│   └── runners/
│       ├── api/                     # Synchronous REST API runners
│       │   ├── CompaniesHouseRunner.js
│       │   ├── FCARunner.js         # Pure-code FCA Register runner (no LLM)
│       │   └── index.js
│       └── autonomous/              # AWS ELB autonomous agent wrappers
│           ├── UKParentFlowRunner.js
│           └── index.js
│
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx            # Stats, priority cases, AI action recommendations
│   │   ├── WorkQueue.tsx            # Entity table grouped by DRG, filter by status/risk
│   │   ├── ExceptionReview.tsx      # Deep-dive: flag + evidence + attributes + resolve actions
│   │   │                            #   Right panel tabs: Document Locker / Collaboration / Files
│   │   ├── Reports.tsx              # Analytics (placeholder)
│   │   └── Login.tsx                # Supabase auth
│   ├── components/
│   │   ├── AppLayout.tsx            # Main shell: header, nav, floating AI chat dock
│   │   ├── AgentSystem.tsx          # Agent registry + orchestration + dock UI
│   │   ├── GraphView.tsx            # Neo4j ownership graph via Cytoscape + DAGRE layout
│   │   ├── kyc/
│   │   │   ├── SimpleFieldRow.tsx   # Attribute display with override + trace drawer
│   │   │   ├── AttributeDiffModal.tsx  # Preview/commit diff modal for API runner output
│   │   │   ├── ForgeLineagePanel.tsx   # Attribute lineage / audit trail view
│   │   │   ├── ForgePersonCard.tsx  # Person role card
│   │   │   ├── CollabPanel.tsx      # Comments, watchers, activity feed
│   │   │   ├── WgqTabContent.tsx    # WGQ questionnaire tab
│   │   │   ├── DocumentViewer.tsx   # PDF / image viewer dialog (signed URL from Supabase)
│   │   │   ├── FileCard.tsx         # Single file card (type icon, view/download buttons)
│   │   │   └── EntityFiles.tsx      # File grid for an entity (All / Documents / Screenshots)
│   │   └── ui/                      # shadcn/ui primitives
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── db/
│   │   ├── supabase.js              # Server-side Supabase helpers (imported by server.js)
│   │   └── neo4j.js                 # Neo4j driver + Cypher runner
│   ├── data/
│   │   └── entities-generated.ts    # Mock entity/exception/activity data
│   └── lib/
│       ├── apiFetch.ts              # Auth-aware fetch wrapper (injects Supabase JWT)
│       ├── supabase.ts              # Frontend Supabase client
│       └── utils.ts
│
├── scripts/
│   ├── migrations/
│   │   ├── 001_agent_runs_and_case_files.sql   # Creates agent_runs, case_files; patches entity_attributes
│   │   ├── 002_agent_runs_status_constraint.sql # Widens status CHECK to include pending_review, cancelled
│   │   └── 003_entity_attributes_confidence.sql # Adds confidence column (0–100) to entity_attributes
│   ├── seed-supabase.js             # Seed entities/DRGs/exceptions (includes Barclays Bank PLC KYC-30230)
│   └── setup-storage.js            # Create 'kyc-files' Supabase Storage bucket
│
├── server.js                        # Express server (all backend logic)
└── .env.example                     # All required environment variables
```

## Database Schema

### Core tables
| Table | Key columns |
|-------|-------------|
| `entities` | kyc_ref, entity_name, risk_rating, priority, drg_id, status, due_date |
| `drgs` | id, name |
| `entity_snapshots` | id, kyc_ref, data (JSON), agent_id, run_id, created_at |
| `entity_attributes` | kyc_ref, snapshot_id, **agent_run_id**, attribute_name, attribute_group, display_value, **confidence**, id_flag, verification_flag, exception_flag, lineage |
| `entity_persons` | kyc_ref, snapshot_id, role, person_index, full_name, ownership_pct, nationality, attributes |
| `exceptions` | kyc_ref, exception_number, **agent_run_id**, attribute_name, field_name, source_type, **severity**, status, title, reasoning, recommended_actions |
| `exception_audit_log` | kyc_ref, exception_number, action, actor, occurred_at |

### Agent + file tables (migration 001)
| Table | Purpose |
|-------|---------|
| `agent_runs` | Persists every agent invocation — id, kyc_ref, agent_slug, runner_type ('api'\|'autonomous'), external_run_id, output_type, status, sources_consulted, initiated_by, started_at, completed_at |
| `case_files` | Metadata for every document/screenshot — id, kyc_ref, agent_run_id, file_category ('document'\|'screenshot'), mime_type, filename, storage_path, source_url, title, caption |

**Bold columns** were added to existing tables by migrations.

### agent_runs status values
`running` → `pending_review` → `complete` | `failed` | `cancelled`

- `pending_review` — API runner finished execution; awaiting analyst accept/reject in the diff modal
- Widened by migration 002 (original migration only had running/complete/failed)

### entity_attributes.confidence
- `smallint` 0–100, nullable. Added by migration 003.
- API runners always write 100. Autonomous LLM agents write model-provided confidence.

### Supabase Storage
- Bucket: `kyc-files` (private — all access via signed URLs)
- Layout: `{kyc_ref}/documents/{timestamp}_{filename}` and `{kyc_ref}/screenshots/{...}`

### getAttributes() — two-layer merge
`src/db/supabase.js` `getAttributes(kycRef)` merges:
1. **Layer 1**: latest Forge snapshot attributes (`snapshot_id` set, `agent_run_id` null)
2. **Layer 2**: completed (`status='complete'`) agent-run attributes (`snapshot_id` null, `agent_run_id` set) — most recent run wins per attribute_name

Agent-run attributes override snapshot attributes for the same `attribute_name`.

## Backend API Routes (`server.js`)

### Core routes
| Route | Purpose |
|-------|---------|
| `POST /api/zoom/create-meeting` | Zoom Server-to-Server OAuth, create meeting |
| `POST /api/agent/:slug` | Invoke autonomous agent via AWS ELB (existing frontend polling flow) |
| `GET /api/agent-steps/:runId` | Poll agent thinking steps (AWS ELB) |
| `GET /api/agent-run/:runId` | Poll agent run status (AWS ELB) |
| `GET /api/agent-artifacts/:runId` | List agent output artifacts |
| `GET /api/artifact-download` | Stream artifact file |
| `GET /api/entities` | All entities for work queue |
| `GET /api/entity/:kycRef` | Single entity detail |
| `GET /api/entity/:kycRef/snapshot` | Latest KYC Forge JSON |
| `POST /api/entity/:kycRef/snapshot` | Save Forge JSON + extract attrs/persons/exceptions |
| `GET /api/entity/:kycRef/attributes` | Merged attributes (snapshot + completed agent runs) |
| `GET /api/entity/:kycRef/attributes/trace/:attrName` | Full lineage for one attribute |
| `GET /api/entity/:kycRef/persons` | Person records grouped by role |
| `GET /api/entity/:kycRef/exceptions` | All exceptions for entity |
| `PATCH /api/entity/:kycRef/exception/:num/resolve` | Mark exception resolved |
| `GET /api/neo4j/entity/:kycId/graph` | Cytoscape-ready ownership graph |
| `POST /api/neo4j/expand` | Expand a node by elementId |
| `POST /api/chat` | Claude SSE streaming chat with tool use (max_tokens: 4096) |

### API runner routes (preview/commit pattern)
| Route | Purpose |
|-------|---------|
| `POST /api/agent-run/api/:slug` | Start API runner; returns `{ runId, status: 'running' }` immediately |
| `GET /api/agent-run-api-steps/:runId` | Live step log (in-memory Map); returns `{ steps: [] }` if Map miss (server restart) |
| `GET /api/agent-run-api-status/:runId` | Run status from DB; detects orphaned `running` runs and marks them `failed` |
| `GET /api/agent-run-api/:runId/diff` | Proposed vs current attributes for diff modal |
| `POST /api/agent-run-api/:runId/commit` | Accept approved attributes, publish to DB, mark `complete` |
| `DELETE /api/agent-run-api/:runId` | Cancel a `pending_review` run |

### File + run history routes
| Route | Purpose |
|-------|---------|
| `POST /api/agent-run/async/:slug` | Start an autonomous AWS agent and persist the run |
| `GET /api/entity/:kycRef/runs` | List agent_runs for entity |
| `GET /api/entity/:kycRef/files` | List case_files; `?category=document\|screenshot` |
| `GET /api/file/:fileId/url` | Short-lived signed URL for a private file |
| `DELETE /api/file/:fileId` | Remove file from storage + DB |

### In-memory Maps (server.js)
Two Maps survive only for the lifetime of the Railway process:
- `apiRunnerSteps` — `runId → string[]` live progress steps
- `apiRunnerOutput` — `runId → { output, kycRef, initiatedBy }` pending preview

On Railway restart these are cleared. The status endpoint handles this gracefully: any run with `status='running'` and no Map entry is immediately marked `failed`.

## Agent Ecosystem (`agents/`)

### How a new runner is added
1. Create `agents/runners/api/MyRunner.js` extending `ApiRunner`
2. Set `get slug()` and `get outputType()`
3. Implement `async execute(ctx)` → return `AgentRunOutput`
4. Export from `agents/runners/api/index.js`
5. Add to the `RunnerMap` in `server.js` `/api/agent-run/api/:slug` route
6. Add `AgentApiConfig` entry in `AgentSystem.tsx` with `apiRunner: true`

### Runner output contract (`agents/types.ts`)
```
AgentRunOutput {
  agentSlug, kycRef, outputType
  attributes?: AttributeOutput[]   → entity_attributes (snapshot_id=null, agent_run_id set)
  exceptions?: ExceptionOutput[]   → exceptions (source_type='agent:<slug>')
  files: FileOutput[]              → Supabase Storage + case_files
  metadata: { completedAt, durationMs, sourcesConsulted }
}
```

### Attribute group convention — **mandatory for all runners**
Every `AttributeOutput` must set `attributeGroup` to exactly one of:
- `'core'` — any factual / regulatory / structural attribute shown in the Attributes tab
- `'wgq'`  — questionnaire fields shown in the Questionnaire tab

**Never invent new group names.** The frontend (`ExceptionReview` `AttributeFormView`) filters on
`attribute_group === 'core'` to build the attribute list for entities that have no curated profile.
A custom group name silently causes all attributes from that runner to be invisible in the UI.

### Confidence field
Every `AttributeOutput` should set `confidence: 100` for pure-code/API runners. LLM-driven runners should set whatever score the model provides. Stored in `entity_attributes.confidence` (0–100 smallint, nullable).

### API runner two-phase flow
1. `POST /api/agent-run/api/:slug` → runner executes, status becomes `pending_review`
2. Frontend polls steps + status; on `pending_review` → `AttributeDiffModal` opens
3. Analyst reviews diff (new vs current values); multi-value attrs compared by value-set (reordering not flagged)
4. Accept → `POST /api/agent-run-api/:runId/commit` → attributes published, status → `complete`
5. Cancel → `DELETE /api/agent-run-api/:runId` → status → `cancelled`, nothing written

### Publisher pipeline
`ApiRunner.run()` calls publishers automatically after `execute()`:
- `AttributePublisher` — bulk insert into entity_attributes
- `ExceptionPublisher` — deduplicates against open exceptions, uses `alloc_exception_numbers` RPC for sequential numbering
- `FilePublisher` — resolves file content (Buffer or artifact download from AWS), uploads to `kyc-files`, inserts case_files row

### Autonomous agent flow
- Frontend calls `POST /api/agent/:slug` (existing) OR the new `POST /api/agent-run/async/:slug`
- When the frontend calls `POST /api/entity/:kycRef/snapshot` at run completion, the server automatically creates an `agent_runs` row and harvests any artifact files from the AWS ELB

## Frontend Routing

Routes live in `src/App.tsx` (BrowserRouter basename `/kyc-agentic2`):
- `/` — Dashboard
- `/work-queue` — Work Queue
- `/work-queue/review/:kycRef` — Exception Review for a specific entity
- `/work-queue/review` — redirects to `/work-queue` (no entity in URL)

The `:kycRef` param is required so page refresh preserves the entity. `ExceptionReview` reads it via `useParams()` and re-fetches the entity from the API if `location.state` is absent.

## AI Chat Tools (`/api/chat`)
- `get_entity` — fetch single entity by KYC ref
- `list_entities` — list entities with optional risk/priority filters
- `get_exceptions` — get exceptions for an entity
- `search_entities` — search by name
- `query_graph` — run Cypher against Neo4j

## Key Workflows

1. **Dashboard** → open/overdue cases, AI-recommended actions
2. **Work Queue** → browse entities by DRG group, filter, select for review; click entity name → `/work-queue/review/:kycRef`
3. **Exception Review** → view flag + narrative + evidence; right panel: Document Locker / Collaboration / **Files**
4. **Agent Dispatch** → run API runners; dock shows live steps; `pending_review` triggers diff modal; accept/reject before DB write
5. **Attribute View** → merged grid of Forge snapshot + completed agent-run attributes; groups from all non-wgq sources
6. **Files Tab** → `EntityFiles` component fetches `GET /api/entity/:kycRef/files`; click a card → `DocumentViewer` fetches signed URL and renders PDF/image inline
7. **Ownership Graph** → explore entity relationships via Neo4j

## Environment Variables

See `.env.example`. All required:
```
SUPABASE_URL, SUPABASE_SERVICE_KEY        — Supabase backend (service key)
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — Supabase frontend (anon key)
ANTHROPIC_API_KEY                         — Claude API
AWS_AGENT_BASE                            — AWS ELB base URL (no trailing slash)
ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
COMPANIES_HOUSE_API_KEY                   — developer.company-information.service.gov.uk
FCA_AUTH_EMAIL, FCA_API_KEY               — FCA Register API (set in Railway Variables, not .env)
VITE_AGENT_API_BASE                       — Express server URL (default: http://localhost:3001)
DD_API_KEY                                — auth for GET /api/forge/entity-data/:ref (Forge → server)
DD_UPLOAD_SLUG                            — Forge flow that writes entity_data to the datastore (default: upload-entity-data)
DD_ALL_IN_ONE_SLUG                        — all-DD orchestrator flow (default: ria-idv-allinone)
SCREENING_SLUG                            — sanctions/PEP flow (default: sanctions-screening-pep); flow is SYNCHRONOUS (~3 min)
```

## Dev Commands

```bash
npm run start    # Vite (8080) + Express (3001) concurrently
npm run dev      # Vite only
npm run server   # Express only
npm run build    # Production build
npm run deploy   # Build + push to GitHub Pages
node scripts/seed-supabase.js    # Seed entities/DRGs/exceptions (run once)
node scripts/setup-storage.js    # Create kyc-files bucket (run once)
```

Migrations — paste each into Supabase SQL Editor and run once, in order:
```
scripts/migrations/001_agent_runs_and_case_files.sql
scripts/migrations/002_agent_runs_status_constraint.sql
scripts/migrations/003_entity_attributes_confidence.sql
scripts/migrations/006_screening.sql
scripts/migrations/007_kyc_ref_from_ids.sql    ← WIPES all case data (TRUNCATE entities CASCADE)
```

## API Authentication & Connectivity

### Critical: All API calls must use `apiFetch()`
Every call to `AGENT_API_BASE/api/*` routes **must** use the `apiFetch()` wrapper from `src/lib/apiFetch.ts`, not direct `fetch()`. This is non-negotiable:
- `apiFetch()` injects the Supabase session Bearer token automatically
- Direct `fetch()` will get 401 Unauthorized
- **Files affected**: Dashboard.tsx, WorkQueue.tsx, GraphView.tsx, ExceptionReview.tsx, and any new pages making API calls

### Supabase Configuration
**Frontend client** (`src/lib/supabase.ts`):
- Must point to the **current** Supabase project (currently `xnixtxpftxcehlbmgsga`)
- Uses anon key for auth flow
- Configured with `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

**Backend** (`server.js`, `src/db/supabase.js`):
- Uses service key (has full database access)
- **Node 20+ required**: Must configure WebSocket transport via `ws` package
- See `src/db/supabase.js` for example: `realtime: { transport: ws }`

**Session tracking** (do NOT use `getSession()`):
- Frontend uses `onAuthStateChange()` to track session in-memory (see `src/lib/apiFetch.ts`)
- `supabase.auth.getSession()` fails to persist/retrieve sessions reliably (was root cause of 401 errors in June 2026 deployment)
- Always read from the in-memory session updated by `onAuthStateChange()`

### External API Credentials
Set these in Railway dashboard variables (not `.env`):
- `FCA_AUTH_EMAIL` — FCA Register API auth header
- `FCA_API_KEY` — FCA Register API auth header
- `FCA_BASE` — hardcoded to `https://register.fca.org.uk/services/V0.1` in FCARunner

### Node Version
- **Local**: `.nvmrc` = 20 (required for Supabase WebSocket support)
- **Railway**: Automatically detected from `.nvmrc` or package.json `engines` field
- If you see "Node.js 18 detected without native WebSocket support" error, redeploy to pick up `.nvmrc` change

## CSS / Styling Note

Tailwind is compiled into `dist/assets/index-*.css`. If the UI looks unstyled, check that file is ~107 kB. A ~0.3 kB file means `index.css` was clobbered. Custom Tailwind colors: `alert`, `warning`, `success`, `info`, `risk-rating` variants (all with `.soft` and `.soft-border` sub-tokens).

## Schema

`schema/` is the anti-drift contract shared by frontend + backend.

| File | Purpose |
|------|---------|
| `schema/kyc_master_attribute_schema.json` | Canonical master (RIA entity type). Owns attribute definitions, per-attribute value-enums (`$defs`, e.g. `Country`), and `x-entity-type-applicability` (per-cip-classification: `required` / `optional` / `not_applicable`). |
| `schema/dd-registry.json` | 18 DD agents → attributes (party + verifiable flags). |
| `schema/schema-meta.json` + `schema/schema-meta.js` | **Generated** by `scripts/build-schema-meta.mjs`. Never hand-edit. |
| `schema/index.js` + `schema/index.d.ts` | Typed accessor: `getVisibleAttributes(entityType)`, `applicability`, `enumFor`, `isVerifiable`, `arrayAttributes`, `entityTypeByAlias('RIA')`. Import via the `@schema` alias. |

To regenerate `schema-meta.*` after editing the canonical master:
```bash
npm run generate
```

Import the schema accessor in Node or Vite:
```js
import { getVisibleAttributes, enumFor } from '@schema';
```

## Deployment

- **Frontend**: GitHub Pages (`npm run deploy`)
- **Backend**: Railway (`Procfile`: `web: npm run server`) — auto-deploys on `git push origin main`
- **Migrations**: paste all SQL files into Supabase SQL Editor in order (001 → 007) before first deploy. **Migration 007 wipes all case data (TRUNCATE entities CASCADE).**

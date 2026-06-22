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
│       ├── api/                     # Synchronous REST API runners (stub — impl provided separately)
│       │   ├── CompaniesHouseRunner.js
│       │   ├── FCARunner.js
│       │   └── index.js
│       └── autonomous/              # AWS ELB autonomous agent wrappers (stub)
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
│   │   │   ├── ForgeLineagePanel.tsx# Attribute lineage / audit trail view
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
│   │   └── 001_agent_runs_and_case_files.sql  # DB migration — run once in Supabase SQL Editor
│   ├── seed-supabase.js             # Seed entities/DRGs/exceptions
│   └── setup-storage.js            # Create 'kyc-files' Supabase Storage bucket
│
├── server.js                        # Express server (all backend logic)
└── .env.example                     # All required environment variables
```

## Database Schema

### Existing tables
| Table | Key columns |
|-------|-------------|
| `entities` | kyc_ref, entity_name, risk_rating, priority, drg_id, status, due_date |
| `drgs` | id, name |
| `entity_snapshots` | id, kyc_ref, data (JSON), agent_id, run_id, created_at |
| `entity_attributes` | kyc_ref, snapshot_id, **agent_run_id**, attribute_name, attribute_group, display_value, id_flag, verification_flag, exception_flag, lineage |
| `entity_persons` | kyc_ref, snapshot_id, role, person_index, full_name, ownership_pct, nationality, attributes |
| `exceptions` | kyc_ref, exception_number, **agent_run_id**, attribute_name, field_name, source_type, **severity**, status, title, reasoning, recommended_actions |
| `exception_audit_log` | kyc_ref, exception_number, action, actor, occurred_at |

### New tables (migration 001)
| Table | Purpose |
|-------|---------|
| `agent_runs` | Persists every agent invocation — id, kyc_ref, agent_slug, runner_type ('api'\|'autonomous'), external_run_id, output_type, status, sources_consulted, initiated_by, started_at, completed_at |
| `case_files` | Metadata for every document/screenshot — id, kyc_ref, agent_run_id, file_category ('document'\|'screenshot'), mime_type, filename, storage_path, source_url, title, caption |

**Bold columns** were added to existing tables by the migration.

### Supabase Storage
- Bucket: `kyc-files` (private — all access via signed URLs)
- Layout: `{kyc_ref}/documents/{timestamp}_{filename}` and `{kyc_ref}/screenshots/{...}`

## Backend API Routes (`server.js`)

### Existing routes
| Route | Purpose |
|-------|---------|
| `POST /api/zoom/create-meeting` | Zoom Server-to-Server OAuth, create meeting |
| `POST /api/agent/:slug` | Invoke autonomous agent via AWS ELB (existing frontend polling flow) |
| `GET /api/agent-steps/:runId` | Poll agent thinking steps |
| `GET /api/agent-run/:runId` | Poll agent run status |
| `GET /api/agent-artifacts/:runId` | List agent output artifacts |
| `GET /api/artifact-download` | Stream artifact file |
| `GET /api/entities` | All entities for work queue |
| `GET /api/entity/:kycRef` | Single entity detail |
| `GET /api/entity/:kycRef/snapshot` | Latest KYC Forge JSON |
| `POST /api/entity/:kycRef/snapshot` | Save Forge JSON + extract attrs/persons/exceptions. Also creates agent_runs row and processes artifact files when runId is provided |
| `GET /api/entity/:kycRef/attributes` | Extracted attributes from latest snapshot |
| `GET /api/entity/:kycRef/attributes/trace/:attrName` | Full lineage for one attribute |
| `GET /api/entity/:kycRef/persons` | Person records grouped by role |
| `GET /api/entity/:kycRef/exceptions` | All exceptions for entity |
| `PATCH /api/entity/:kycRef/exception/:num/resolve` | Mark exception resolved |
| `GET /api/neo4j/entity/:kycId/graph` | Cytoscape-ready ownership graph |
| `POST /api/neo4j/expand` | Expand a node by elementId |
| `POST /api/chat` | Claude SSE streaming chat with tool use |

### New agent + file routes
| Route | Purpose |
|-------|---------|
| `POST /api/agent-run/api/:slug` | Run a synchronous API runner end-to-end; returns `{ runId, outputType, stats }` |
| `POST /api/agent-run/async/:slug` | Start an autonomous AWS agent and persist the run; returns `{ agentRunId, externalRunId }` |
| `GET /api/entity/:kycRef/runs` | List agent_runs for entity |
| `GET /api/entity/:kycRef/files` | List case_files; `?category=document\|screenshot` |
| `GET /api/file/:fileId/url` | Short-lived signed URL for a private file |
| `DELETE /api/file/:fileId` | Remove file from storage + DB |

## Agent Ecosystem (`agents/`)

### How a new runner is added
1. Create `agents/runners/api/MyRunner.js` extending `ApiRunner`
2. Set `get slug()` and `get outputType()`
3. Implement `async execute(ctx)` → return `AgentRunOutput`
4. Export from `agents/runners/api/index.js`
5. Add to the `RunnerMap` in `server.js` `/api/agent-run/api/:slug` route

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

### Publisher pipeline
`ApiRunner.run()` calls publishers automatically after `execute()`:
- `AttributePublisher` — bulk insert into entity_attributes
- `ExceptionPublisher` — deduplicates against open exceptions, uses `alloc_exception_numbers` RPC for sequential numbering
- `FilePublisher` — resolves file content (Buffer or artifact download from AWS), uploads to `kyc-files`, inserts case_files row

### Autonomous agent flow
- Frontend still calls `POST /api/agent/:slug` (existing) OR the new `POST /api/agent-run/async/:slug`
- When the frontend calls `POST /api/entity/:kycRef/snapshot` at run completion, the server automatically creates an `agent_runs` row and harvests any artifact files from the AWS ELB

## AI Chat Tools (`/api/chat`)
- `get_entity` — fetch single entity by KYC ref
- `list_entities` — list entities with optional risk/priority filters
- `get_exceptions` — get exceptions for an entity
- `search_entities` — search by name
- `query_graph` — run Cypher against Neo4j

## Key Workflows

1. **Dashboard** → open/overdue cases, AI-recommended actions
2. **Work Queue** → browse entities by DRG group, filter, select for review
3. **Exception Review** → view flag + narrative + evidence; right panel: Document Locker / Collaboration / **Files**
4. **Agent Dispatch** → run async agents, poll thinking steps, view artifacts; dock shows `✓ Saved: N attrs · N files` for API runners
5. **Files Tab** → `EntityFiles` component fetches `GET /api/entity/:kycRef/files`; click a card → `DocumentViewer` fetches signed URL and renders PDF/image inline
6. **Ownership Graph** → explore entity relationships via Neo4j

## Environment Variables

See `.env.example`. All required:
```
SUPABASE_URL, SUPABASE_SERVICE_KEY       — Supabase backend (service key)
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — Supabase frontend (anon key)
ANTHROPIC_API_KEY                        — Claude API
AWS_AGENT_BASE                           — AWS ELB base URL (no trailing slash)
ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
COMPANIES_HOUSE_API_KEY                  — developer.company-information.service.gov.uk
VITE_AGENT_API_BASE                      — Express server URL (default: http://localhost:3001)
```

## Dev Commands

```bash
npm run start    # Vite (8080) + Express (3001) concurrently
npm run dev      # Vite only
npm run server   # Express only
npm run build    # Production build
npm run deploy   # Build + push to GitHub Pages
node scripts/migrations/001_agent_runs_and_case_files.sql  # Run in Supabase SQL Editor
node scripts/setup-storage.js   # Create kyc-files bucket (run once)
node scripts/seed-supabase.js   # Seed entities/DRGs/exceptions
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

Tailwind is compiled into `dist/assets/index-*.css`. If the UI looks unstyled, check that file is ~96 kB. A ~0.3 kB file means `index.css` was clobbered. Custom Tailwind colors: `alert`, `warning`, `success`, `info`, `risk-rating` variants (all with `.soft` and `.soft-border` sub-tokens).

## Deployment

- **Frontend**: GitHub Pages (`npm run deploy`)
- **Backend**: Railway (`Procfile`: `web: npm run server`)
- **Migration**: paste `scripts/migrations/001_agent_runs_and_case_files.sql` into Supabase SQL Editor and run once before deploying

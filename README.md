# KYC Sentinel

KYC Sentinel is a no-Forge KYC compliance platform for financial analysts. It combines entity and exception review, traceable KYC attributes, direct data-sourcing agents, Claude-based due diligence, sanctions and PEP screening, ownership graphs, and analyst resolution workflows.

## Architecture

```text
React/Vite SPA
  -> Express API on Railway
     -> Supabase PostgreSQL, Auth, and private Storage
     -> direct registry and market-data REST APIs
     -> Anthropic Claude
     -> OpenSanctions
     -> Neo4j (optional)
```

There is no Forge platform or AWS ELB agent-runtime dependency. The UI preserves the established KYC workflow while runners execute directly in the backend.

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| UI | shadcn/ui, Radix, Tailwind, Lucide, Recharts |
| Backend | Express 5, Node.js ESM, Railway |
| Data and auth | Supabase PostgreSQL, Auth, private Storage |
| Graph | Neo4j with Cytoscape visualization |
| AI | Anthropic Claude `claude-sonnet-4-6` |
| Screening | OpenSanctions REST API |

## Features

- Authenticated dashboard and work queue backed by Supabase
- Entity exception review and persisted resolutions
- Schema-driven core and WGQ attribute views, including empty applicable fields
- Attribute lineage, confidence, source conflicts, and analyst overrides
- Beneficial-owner, officer, director, and signatory party tables
- Direct UK, US, and global sourcing agents
- Attribute-specific and all-in-one due-diligence agents
- Sanctions and PEP screening with analyst dispositions
- Private evidence-file storage and signed document URLs
- Optional Neo4j ownership graph
- Claude-powered KYC assistant chat
- Compact live agent dock with progress and automatic result persistence

## Quick start

Prerequisites:

- Node.js 20 or newer
- A Supabase project
- Credentials for the external integrations you intend to run

```bash
npm install
cp .env.example .env
npm run start
```

`npm run start` launches Vite on port 8080 and Express on port 3001.

Before first use, run the SQL files in `scripts/migrations/` in numeric order through migration 010, then initialize storage and seed data if needed:

```bash
node scripts/setup-storage.js
node scripts/seed-supabase.js
```

Migration `007_kyc_ref_from_ids.sql` truncates existing entity case data. Review it before applying it to any populated environment. Migration `009_person_overrides_and_runs_columns.sql` is required by the current agent commit flow.

## Commands

| Command | Purpose |
|---|---|
| `npm run start` | Run Vite and Express together |
| `npm run dev` | Run the Vite frontend only |
| `npm run server` | Run the Express backend only |
| `npm run generate` | Regenerate entity fixtures and schema metadata |
| `npm run build` | Generate metadata and build the production frontend |
| `npm test` | Run Vitest |
| `npm run lint` | Run ESLint |

## Agent model

The Supabase `agent_registry` golden source exposes three groups:

- Sourcing: Companies House, FCA, JFSC, SEC EDGAR, IAPD, NYSE, GLEIF, and UK/US aggregate flows
- Due diligence: `dd-all-in-one` plus 18 policy-driven attribute runners
- Screening: OpenSanctions matching with Claude-assisted discounting

`GET /api/agents` reads the persisted registry and adds runtime readiness based on runner wiring and required environment variables. Unavailable agents remain visible in inventory but cannot be triggered.

Sourcing and DD runners extend `ApiRunner`. The frontend starts a run, polls its steps and status, and automatically commits all output when the backend reaches `pending_review`:

```text
running -> pending_review -> complete
```

The active application does not present an analyst diff modal. `AttributeDiffModal.tsx` is retained but unused.

### Adding a runner

1. Add a class under `agents/runners/api/` that extends `ApiRunner`.
2. Implement `slug`, `outputType`, and `execute(ctx)`.
3. Emit progress through `this.step(message)`.
4. Return the `AgentRunOutput` contract.
5. Export the runner from `agents/runners/api/index.js`.
6. Add it to `loadRunnerClass()` in `server.js`.
7. Add the corresponding frontend configuration or registry behavior.

Attribute output must use `attributeGroup: "core"` or `attributeGroup: "wgq"`. Pure REST runners use confidence `100`; LLM runners use the model-provided 0–100 score.

## Data model

- `entities` identifies a case by database-derived `kyc_ref`.
- `entity_attributes` stores scalar values, confidence, flags, and lineage.
- `entity_persons` stores party records and per-person JSON attributes.
- `exceptions` stores review exceptions and their resolutions.
- `agent_runs` stores runner status, steps, output, errors, and sources.
- `case_files` points to private objects in the `kyc-files` Storage bucket.
- Screening tables store party matches and analyst dispositions.

Legacy snapshot tables and columns remain for backward-compatible data ingestion. Current no-Forge runners write through `agent_run_id` and do not require Forge snapshots.

## Schema rules

`schema/kyc_master_attribute_schema.json` is the single source of truth. Never edit generated `schema/schema-meta.json` or `schema/schema-meta.js` directly.

The stored CIP classification must be exactly:

```text
Registered Investment Advisor or Commodity Trading Advisor
```

`id_flag` and `verification_flag` are set only by DD agent output, not by manual analyst overrides.

## Authentication and API calls

Application routes require Supabase authentication. `src/lib/apiFetch.ts` injects the current session token, and the backend validates it with Supabase.

Always use `apiFetch()` for frontend calls to the Express `/api/*` routes. Direct `fetch()` calls will omit the bearer token and normally return `401`.

## Environment

Copy `.env.example` for the complete template. Important variables include:

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_AGENT_API_BASE
ANTHROPIC_API_KEY
COMPANIES_HOUSE_API_KEY
FCA_AUTH_EMAIL
FCA_API_KEY
OPENSANCTIONS_API_KEY
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
ZOOM_ACCOUNT_ID
ZOOM_CLIENT_ID
ZOOM_CLIENT_SECRET
```

Frontend `VITE_*` values are injected at build time. In production, configure them as GitHub Actions secrets. Backend secrets belong in Railway Variables.

## Repository map

```text
agents/                    direct REST and Claude agent ecosystem
  base/                    runner lifecycle
  dd/                      DD planning and entity-data preparation
  policy/                  shared and per-attribute DD policies
  publishers/              attribute, exception, and file persistence
  runners/api/             sourcing, DD, and screening implementations
schema/                    canonical schema and generated accessors
scripts/migrations/        Supabase migrations
src/
  components/              shell, agent system, graph, and shared UI
  components/kyc/          review, attribute, party, file, and trigger UI
  contexts/                Supabase authentication state
  db/                      server-side Supabase and Neo4j helpers
  pages/                   dashboard, queue, review, agents, reports, login
server.js                  Express API and runner dispatch
```

## Deployment

- Frontend: GitHub Pages under `/kyc-agentic/`, deployed by `.github/workflows/deploy.yml`
- Backend: Railway, started through `Procfile`
- Database: Supabase migrations are applied in numeric order
- `VITE_AGENT_API_BASE`: GitHub Actions secret pointing to the Railway service

See `PRODUCTION_NOTES.md` for the production handoff, operational checks, and troubleshooting guide. See `agents.md` for the detailed implementation contract.

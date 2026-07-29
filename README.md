# KYC Sentinel

KYC Sentinel is a no-Forge KYC compliance platform for financial analysts. It combines entity and exception review, traceable KYC attributes, direct data-sourcing agents, Claude-based due diligence, sanctions and PEP screening, ownership graphs, and analyst resolution workflows.

> Documentation status: updated July 29, 2026 for migrations through `032`, the
> selectable Bedrock/Anthropic model provider, full KYC refresh, concurrent
> exception allocation, and the latest Work Queue and dashboard UI.

## Architecture

```text
React/Vite SPA
  -> Express API on Railway
     -> Supabase PostgreSQL, Auth, and private Storage
     -> direct registry and market-data REST APIs
     -> Amazon Bedrock or Anthropic API (registered agents)
     -> Anthropic Claude API (assistant chat)
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
| Agent AI | Admin-selectable Amazon Bedrock or Anthropic API with controlled Claude Haiku, Sonnet, or Opus profiles |
| Assistant AI | Anthropic Claude API |
| Screening | OpenSanctions REST API |

## Features

- Authenticated dashboard and work queue backed by Supabase
- Entity exception review and persisted resolutions
- Schema-driven core and WGQ attribute views, including empty applicable fields
- Attribute lineage, confidence, source conflicts, and analyst overrides
- Beneficial-owner, officer, director, and signatory party tables
- Direct UK, US, and global sourcing agents
- Attribute-specific and all-in-one due-diligence agents
- Registry-driven pre/main/post orchestration with parallel or sequential children
- Customer-document upload, classification, and document-specific digitization
- Durable multi-case Work Queue batches with cancellation and retry
- Policy-aware exception assessment and routing to Compliance, Analyst, Client, or CRM
- Sanctions and PEP screening with analyst dispositions
- Private evidence-file storage and signed document URLs
- Optional Neo4j ownership graph
- Claude-powered KYC assistant chat
- Compact live agent dock with progress and automatic result persistence
- Clean Work Queue agent triggers, real sortable columns, DRG select-all, and
  database-backed onboarding/periodic-refresh views
- Collapsed historical agent runs and direct exception-to-attribute navigation
- Route and ownership-graph code splitting for a substantially smaller initial load

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

For the shared-project demo environment, add `SUPABASE_DB_URL`, `SUPABASE_URL`,
and `SUPABASE_SERVICE_KEY` to `.env`. Set `SUPABASE_DB_SCHEMA=kyc_demo` and
`SUPABASE_STORAGE_BUCKET=kyc-demo-files`, then bootstrap the isolated schema
and private Storage with one command:

```bash
npm run supabase:setup -- --confirm-demo
```

The bootstrapper records applied files in `kyc_demo.app_schema_migrations`, so reruns
apply only new migrations. Migration `007_kyc_ref_from_ids.sql` truncates case
data; the command permits it automatically only when the target has no entities.
For an intentionally destructive rebuild of a populated demo, add
`--allow-destructive`.

The older `scripts/setup-storage.js` remains available for Storage-only setup.
Run a demo-data seeder separately after the schema is ready.

In Supabase Dashboard, add `kyc_demo` to **API Settings → Exposed schemas**
before starting the demo Railway service. The existing application continues
to use `public` because `SUPABASE_DB_SCHEMA` defaults to `public`.

Migration `009_person_overrides_and_runs_columns.sql` is required by the current agent commit flow.
Migration `027_agent_model_profiles.sql` is required for model-backed agents, and
`028_exception_routing_agent.sql` adds the post-DD exception-routing agent.
Migration `031_concurrent_exception_allocation.sql` prevents duplicate exception
numbers during concurrent or repeated agent runs. Migration
`032_entities_review_type.sql` enables the Work Queue's real Onboarding view.

## Commands

| Command | Purpose |
|---|---|
| `npm run start` | Run Vite and Express together |
| `npm run dev` | Run the Vite frontend only |
| `npm run server` | Run the Express backend only |
| `npm run schema:update` | Validate canonical schemas and regenerate runtime metadata/types |
| `npm run supabase:setup -- --confirm-demo` | Apply pending migrations and create private Storage |
| `npm run generate` | Regenerate entity fixtures and schema metadata |
| `npm run build` | Run the prebuild generators and build the production frontend |
| `npm test` | Run Vitest |
| `npm run lint` | Run ESLint |

## Agent model

The Supabase `agent_registry` is the execution authority for sourcing, due
diligence, screening, document processing, digitization, exception routing,
and virtual orchestrators:

- Sourcing: Companies House, FCA, JFSC, SEC EDGAR, IAPD, NYSE, NFA, Delaware, Puerto Rico, GLEIF, and UK/US aggregate flows
- Due diligence: `dd-all-in-one` plus 18 policy-driven attribute runners
- Screening: OpenSanctions matching with Claude-assisted discounting
- Documents: a processing wrapper plus document-specific digitizers
- Exception routing: the dependency-only `exception-routing` post-DD agent

`GET /api/agents` reads the persisted registry and adds runtime readiness based on runner wiring and required environment variables. Unavailable agents remain visible in inventory but cannot be triggered.
Virtual orchestrators resolve registry-owned pre-agents, child agents, and
post-agents recursively, reject invalid dependencies or cycles, and honor
their configured execution and failure policies.

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
7. Add or migrate the corresponding `agent_registry` row and readiness metadata.

Attribute output must use `attributeGroup: "core"` or `attributeGroup: "wgq"`. Pure REST runners use confidence `100`; LLM runners use the model-provided 0–100 score.

## Data model

- `entities` identifies a case by database-derived `kyc_ref`.
- `entities.review_type` distinguishes onboarding from periodic refresh; existing
  cases default to `periodic_refresh`.
- `entity_attributes` stores scalar values, confidence, flags, and lineage.
- `entity_persons` stores party records and per-person JSON attributes.
- `exceptions` stores review exceptions and their resolutions.
- `agent_runs` stores runner status, business outcome (`data_found`, `no_data`, or `manual_review`), steps, output, errors, and sources. `failed` means execution failed; a valid zero-result search is `complete` with `no_data`; an authoritative interactive-only registry is `complete` with `manual_review` and its official link.
- `agent_run_batches` and `agent_run_batch_items` store durable Work Queue multi-case runs.
- `customer_documents` supports uploaded-document classification and digitization state.
- The Delaware runner uses a disposable Firecrawl browser session and requires `FIRECRAWL_API_KEY`; valid empty registry results are `no_data`, while browser/API failures are `failed`.
- `agent_registry` is the authority for every visible and executable agent. It defines pre/post dependencies and virtual orchestrator membership, parallel/sequential execution, and failure policy. UK/US sourcing and DD All-in-One are registry-defined orchestrators; DD All-in-One runs the 18 focused DD agents independently.
- The Agents page provides audited registry administration. Configure `AGENT_REGISTRY_ADMIN_EMAILS` in Railway as a comma-separated allowlist; Supabase users with `app_metadata.role = admin` are also authorized.
- Administrators can add virtual orchestrators from the Agent Register using existing registered agents as pre, child, and post dependencies. Leaf-agent creation remains code-backed.
- Orchestrator pre/child/post lists include explicit move-up/move-down ordering; sequential execution follows the saved child order.
- Agent Register CIP scope uses the canonical master-schema `CIPClassification` enum in both the UI and backend validation.
- `case_files` points to private objects in the `kyc-files` Storage bucket.
- `case_tab_reviews` stores each analyst's per-case Documents and Agent Runs review cursors. Unread badges persist across sessions and clear when the corresponding tab is opened.
- Screening tables store party matches and analyst dispositions.
- Exception assessments pair each canonical exception type with its reasoning;
  workflow exceptions also retain routing, evidence, guidance, confidence, and
  resolution history.

Legacy snapshot tables and columns remain for backward-compatible data ingestion. Current no-Forge runners write through `agent_run_id` and do not require Forge snapshots.

## Schema rules

`schema/kyc_master_attribute_schema.json` and
`schema/screening_results_schema.json` are the schema sources of truth. Run
`npm run schema:update` after replacing either file; never edit the generated
runtime metadata or TypeScript declarations directly.

The stored CIP classification must be exactly:

```text
Registered Investment Advisor or Commodity Trading Advisor
```

`id_flag` and `verification_flag` are set only by DD agent output, not by manual analyst overrides.
The publisher enforces this boundary: sourcing agents persist candidate values and lineage with both flags false until an authorized DD runner makes the decision.

## Authentication and API calls

Application routes require Supabase authentication. `src/lib/apiFetch.ts` injects the current session token, and the backend validates it with Supabase.

Always use `apiFetch()` for frontend calls to the Express `/api/*` routes. Direct `fetch()` calls will omit the bearer token and normally return `401`.

## Environment

Copy `.env.example` for the complete template. Important variables include:

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_DB_URL
SUPABASE_DB_SCHEMA
SUPABASE_STORAGE_BUCKET
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_AGENT_API_BASE
ANTHROPIC_API_KEY
ANTHROPIC_CLAUDE_HAIKU_MODEL_ID
ANTHROPIC_CLAUDE_SONNET_MODEL_ID
ANTHROPIC_CLAUDE_OPUS_MODEL_ID
AWS_BEARER_TOKEN_BEDROCK
AWS_REGION
BEDROCK_CLAUDE_HAIKU_MODEL_ID
BEDROCK_CLAUDE_SONNET_MODEL_ID
BEDROCK_CLAUDE_OPUS_MODEL_ID
COMPANIES_HOUSE_API_KEY
FCA_AUTH_EMAIL
FCA_API_KEY
SEC_API_KEY
FIRECRAWL_API_KEY
OPENSANCTIONS_API_KEY
NEO4J_URI
NEO4J_USER
NEO4J_PASSWORD
ZOOM_ACCOUNT_ID
ZOOM_CLIENT_ID
ZOOM_CLIENT_SECRET
AGENT_REGISTRY_ADMIN_EMAILS
```

Frontend `VITE_*` values are injected at build time. In production, configure them as GitHub Actions secrets. Backend secrets belong in Railway Variables.
The Agent Inventory admin control can atomically switch every model-backed leaf
agent between equivalent Amazon Bedrock and Anthropic API profiles. The target
provider must be configured in Railway first; every change is written to the
Agent Register audit log. Orchestrators do not select a model—their leaf agents
do. Apply migration `029_anthropic_model_profiles.sql` before using the switch.
Migration `030_full_kyc_refresh.sql` adds jurisdiction-aware full-refresh
orchestrators that run sourcing, DD, document and exception post-processing,
and screening in sequence.
Migration `031_concurrent_exception_allocation.sql` replaces race-prone
exception numbering with an atomic per-entity allocator. Migration
`032_entities_review_type.sql` adds the review workflow used by Work Queue tabs.

## Repository map

```text
agents/                    direct REST and Claude agent ecosystem
  base/                    runner lifecycle
  dd/                      DD planning and entity-data preparation
  policy/                  shared and per-attribute DD policies
  publishers/              attribute, exception, and file persistence
  models/                  controlled Bedrock and Anthropic profile resolution
  runners/api/             sourcing, DD, documents, routing, and screening
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

- Frontend: GitHub Pages under `/kyc-agentic-demo/`, deployed by `.github/workflows/deploy.yml`
- Backend: Railway, started through `Procfile`
- Database: Supabase migrations are applied in numeric order
- `VITE_AGENT_API_BASE`: GitHub Actions secret pointing to the Railway service

## Verification

Release verification includes:

- `node --check server.js`
- `node ./node_modules/typescript/bin/tsc --noEmit`
- `npm run build`, including confirmation that initial HTML does not preload
  Recharts or Cytoscape
- `npm test`

See `PRODUCTION_NOTES.md` for the production handoff, operational checks, and
troubleshooting guide. See `agents.md` for the detailed implementation
contract.

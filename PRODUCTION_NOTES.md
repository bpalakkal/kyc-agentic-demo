# KYC Sentinel — Production Handoff Notes

> Updated July 29, 2026. Current database sequence ends at migration `032`.

## Current production architecture

KYC Sentinel is a no-Forge KYC compliance application. Financial-crime analysts use it to review entities and exceptions, inspect KYC attributes and evidence, run sourcing and due-diligence agents, screen parties, and record resolutions.

The application does not call Forge or an AWS ELB agent runtime. Agents execute
in the Express service through direct third-party REST APIs or through the
administrator-selected Amazon Bedrock or direct Anthropic Claude profiles.

```text
Browser (GitHub Pages, /kyc-agentic-demo/)
  |
  | HTTPS + Supabase bearer token
  v
Express API (Railway)
  |-- Supabase PostgreSQL and private Storage
  |-- Neo4j ownership graph (optional)
  |-- Amazon Bedrock or Anthropic API (registered Claude agent calls)
  |-- Anthropic Claude API (assistant chat)
  |-- Companies House, FCA, JFSC, IAPD, SEC, NYSE, NFA, Delaware, Puerto Rico, GLEIF
  |-- OpenSanctions screening
  `-- Zoom meeting creation
```

### Production services

| Layer | Service | Responsibility |
|---|---|---|
| Frontend | GitHub Pages | React/Vite SPA at `/kyc-agentic/` |
| Backend | Railway | Express API and agent execution |
| Primary data | Supabase | Authentication, PostgreSQL, private file storage |
| Graph | Neo4j | Optional ownership and relationship graph |
| Agent AI | Amazon Bedrock or Anthropic | Admin-selected controlled Claude Haiku, Sonnet, or Opus profiles |
| Assistant AI | Anthropic | Assistant chat |
| Screening | OpenSanctions | Sanctions and PEP matching |

## Application behavior

### Authentication

Supabase email/password authentication protects application routes. The browser sends the active Supabase access token through `apiFetch()`; the Express `requireAuth` middleware validates it before serving data or agent endpoints. `/api/health` and the Zoom route are the intentional public exceptions.

Every frontend request to `${VITE_AGENT_API_BASE}/api/*` must use `src/lib/apiFetch.ts`.

### Agent execution and auto-commit

The backend reads the complete inventory from the Supabase `agent_registry`
table. It includes sourcing, due diligence, screening, a document-processing
wrapper, and dependency-only document digitizers. Runtime readiness combines
registry enablement, runner wiring, dependency validity, and required
environment variables.

Generic sourcing and DD runs follow this lifecycle:

```text
POST /api/agent-run/api/:slug
  -> running
  -> pending_review
  -> frontend automatically calls POST /api/agent-run-api/:runId/commit
  -> complete
```

`pending_review` is an internal persistence boundary. There is no analyst proposal, accept/reject, or diff-modal step in the active UI. `AttributeDiffModal.tsx` remains unused compatibility code.

The registry also contains a dependency-only document-processing wrapper and
document-specific digitizers. Document processing persists the wrapper plus one
child run per classified document. Child runs use concrete slugs such as
`digitize-passport` and `digitize-sec-form-adv`. The wrapper remains available
for audit, while dashboard frequency and recent activity exclude
`agent_kind = document_flow` and report concrete digitizers.

Run steps and uncommitted output are held in process memory. A Railway restart during a run can orphan that run; the next status poll detects a persisted `running` row with no in-memory execution and marks it failed so the analyst can rerun the agent.

### Attribute and party persistence

- `entity_attributes` stores scalar KYC attributes and agent lineage.
- `entity_persons` stores beneficial owners, officers, directors, and signatories.
- Sourcing runners write persons as rows rather than numbered flat attributes.
- DD results are the only source of `id_flag` and `verification_flag`.
- Sourcing values and lineage are persisted with ID/V flags cleared at the publisher boundary; migration `018` repairs historical sourcing rows.
- Analyst overrides do not automatically set identification or verification flags.
- `kyc_ref` is database-derived as `entity_id + '_' + case_id`.

Legacy `entity_snapshots` and nullable `snapshot_id` columns remain in the schema for data compatibility. They do not indicate a live Forge dependency; current agents write rows through `agent_run_id`.

Exception data has two deliberate layers:

- Current assessment on `entity_attributes`: `exception_flag`, grouped
  `exception_assessments` entries that pair one enum type with its reasoning,
  and one overall recommendation. Legacy parallel arrays remain for backward
  compatibility during the transition.
- Durable workflow in `exceptions`: lifecycle status, severity,
  grouped assessments, routing queue, guidance references, evidence sources,
  routing confidence, recommendation, resolution data, and links to
  `entity_attribute_id` or `entity_person_id`.

Publishers synchronize agent exceptions into the current assessment while
preserving workflow and audit history.

### Schema contract

`schema/kyc_master_attribute_schema.json` and
`schema/screening_results_schema.json` are canonical. The schema metadata,
runtime module, and generated TypeScript declarations must not be edited
manually.

After changing the canonical schema, run the metadata generator directly:

```bash
npm run schema:update
```

This validates both schemas and generates versioned UI controls, enum options,
defaults, required fields, repeatable collections, screening metadata, and
TypeScript attribute unions. No database schema registry is used.

The generated model is consumed by the existing Attribute View and the reusable
`src/components/kyc/SchemaDrivenForm.tsx` renderer. It supports required
indicators, defaults, enum selects, typed inputs, and add/remove controls for
repeatable groups.

Current schema handoff as of 2026-07-23:

- Generated schema version: `a0c73bc14b619b34`
- 131 attributes, 11 collections, and 19 enums
- Required case fields: `entity_name`, `case_id`, `entity_id`, `policy`,
  `risk_rating`
- `regulator` is a repeatable group with regulator, registration number, and
  regulatory status
- Master and screening schemas in Git matched the authoritative external copies
- Validation passed: TypeScript, 9 test files / 25 tests, and production build

From the `No Forge` directory, refresh both repository schemas with:

```powershell
node .\kyc-agentic\scripts\update-schema.mjs `
  --master "..\Master Schema\kyc_master_attribute_schema.json" `
  --screening "..\Master Schema\screening_results_schema.json"
```

`npm run generate` also regenerates the legacy entity fixture file from `entities.md`. Production data is read from Supabase, but that generated fixture is still part of the current build pipeline.

## Deployment

### Frontend

`.github/workflows/deploy.yml` builds and publishes `dist` to GitHub Pages on pushes to `main`.

`dist/` is generated in CI and intentionally not committed. Runtime logs are
also excluded from source control.

The workflow requires these GitHub Actions secrets:

- `VITE_AGENT_API_BASE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`VITE_AGENT_API_BASE` is a build-time frontend value. Set it in GitHub Actions, not only in Railway.

The current Vite and router base is `/kyc-agentic-demo/`.

### Backend

Railway starts `npm run server` through `Procfile`. Production variables belong in Railway Variables. Do not commit production credentials.

### Database setup

Run migrations in `scripts/migrations` in numeric order:

```text
000_base_schema.sql
001_agent_runs_and_case_files.sql
002_agent_runs_status_constraint.sql
003_entity_attributes_confidence.sql
006_screening.sql
007_kyc_ref_from_ids.sql
008_persons_and_dd_columns.sql
009_person_overrides_and_runs_columns.sql
010_agent_registry.sql
011_agent_run_outcomes.sql
012_agent_registry_orchestration.sql
013_case_tab_review_state.sql
014_agent_registry_audit.sql
015_us_sourcing_agents.sql
016_agent_run_manual_review_outcome.sql
017_delaware_firecrawl.sql
018_source_agents_do_not_set_idv.sql
019_source_person_lineage.sql
020_sourcing_behavior_contract.sql
021_document_processing_flow.sql
022_customer_documents_and_digitizers.sql
023_atomic_exception_number_allocation.sql
024_source_dd_sequence_guard.sql
025_work_queue_agent_batches.sql
026_normalized_exception_assessments.sql
027_agent_model_profiles.sql
028_exception_routing_agent.sql
029_anthropic_model_profiles.sql
030_full_kyc_refresh.sql
031_concurrent_exception_allocation.sql
032_entities_review_type.sql
```

Migration `007` truncates entity case data and must be scheduled deliberately. Migration `009` is required for current agent commits and adds persisted run details. Migration `010` creates and seeds the registry golden source; deploy it before the backend version that reads `/api/agents` from Supabase. Migration `013` adds the persistent per-analyst review cursors used by the Documents and Agent Runs unread badges.

Set `AGENT_REGISTRY_ADMIN_EMAILS` in Railway to the comma-separated emails allowed to edit the Agent Register. Users with Supabase `app_metadata.role = admin` are also allowed. Migration `014` creates the immutable configuration audit table.

Authorized administrators can create registry-only virtual orchestrators from the Agents page. The server permits creation only through the restricted `POST /api/agents` orchestrator contract; new leaf agents still require a backend runner and deployment.

Orchestrator relationship arrays can be reordered explicitly in the Create and Edit dialogs. Sequential children, pre-agents, and post-agents respect the saved order; parallel children do not wait on the preceding child.

Agent Register CIP classifications are selected and server-validated against the canonical schema's `CIPClassification` enum. Update the master schema and regenerate metadata before introducing a new classification.

Migrations `021` and `022` add document processing and concrete digitizers.
Migration `024` enforces sourcing/DD sequencing, migration `025` adds durable
Work Queue batches, and migration `026` introduces normalized multi-value
exception assessments. Migration `027` adds registry-selected Bedrock model
profiles and immutable provider/model attribution on `agent_runs`.

Migration `028` has been applied in production. It registers the Sonnet-backed
`exception-routing` dependency agent and attaches it after `dd-all-in-one`.
The agent combines deterministic schema and ID/V checks with binding RIA policy
analysis. It routes genuine findings to Compliance, Analyst, Client, or CRM;
No decisions are retained in the raw run output for audit but do not create
review-queue records.

Apply migration `027` before deploying the model-enabled backend. It assigns
Haiku to LLM-assisted sourcing, document-processing, and screening agents;
assigns Sonnet to DD leaf agents; and leaves REST-only agents without a model.
Virtual orchestrators do not select a model because their children own that
configuration.

Migration `029` adds matching direct Anthropic API profiles and the audited,
atomic provider-switch function used by the Agent Inventory admin control.
Migration `030` adds jurisdiction-aware full KYC refresh orchestrators.
Migration `031` provides atomic per-entity exception-number allocation.
Migration `032` adds `entities.review_type` for real onboarding and
periodic-refresh Work Queue views.

One-time environment setup:

```bash
node scripts/setup-storage.js
node scripts/seed-supabase.js
```

Clean synthetic RIA reset:

```bash
node scripts/seed-ria-test-cases.mjs
node scripts/seed-ria-test-cases.mjs --execute
```

The reset removes matching Storage objects and dependent case data, recreates
49 unique synthetic cases, and verifies that no prior case workflow data
remains. One duplicate source entity is intentionally skipped.

Disposable showcase data may be created with the local-only
`scripts/seed-demo-showcase.mjs`. It is intentionally untracked. Remove the
showcase entity after use with
`node scripts/seed-demo-showcase.mjs --delete`.

## Environment variables

| Variable | Location | Purpose |
|---|---|---|
| `SUPABASE_URL` | Railway/local | Backend Supabase URL |
| `SUPABASE_SERVICE_KEY` | Railway/local | Backend service-role access |
| `SUPABASE_DB_SCHEMA` | Railway/local | PostgreSQL schema; defaults to `public` |
| `SUPABASE_STORAGE_BUCKET` | Railway/local | Private evidence bucket; defaults to `kyc-files` |
| `VITE_SUPABASE_URL` | GitHub Actions/local | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | GitHub Actions/local | Frontend authentication |
| `VITE_AGENT_API_BASE` | GitHub Actions/local | Express API base URL |
| `ANTHROPIC_API_KEY` | Railway/local | Assistant chat and direct Anthropic agent authentication |
| `ANTHROPIC_CLAUDE_HAIKU_MODEL_ID` | Railway/local | Direct Anthropic Haiku model ID |
| `ANTHROPIC_CLAUDE_SONNET_MODEL_ID` | Railway/local | Direct Anthropic Sonnet model ID |
| `ANTHROPIC_CLAUDE_OPUS_MODEL_ID` | Railway/local | Direct Anthropic Opus model ID |
| `AWS_BEARER_TOKEN_BEDROCK` | Railway/local | Amazon Bedrock agent authentication |
| `AWS_REGION` | Railway/local | Bedrock execution region |
| `BEDROCK_CLAUDE_HAIKU_MODEL_ID` | Railway/local | Haiku model or inference-profile ID |
| `BEDROCK_CLAUDE_SONNET_MODEL_ID` | Railway/local | Sonnet model or inference-profile ID |
| `BEDROCK_CLAUDE_OPUS_MODEL_ID` | Railway/local | Opus model or inference-profile ID |
| `COMPANIES_HOUSE_API_KEY` | Railway/local | Companies House API |
| `FCA_AUTH_EMAIL`, `FCA_API_KEY` | Railway/local | FCA Register API |
| `SEC_API_KEY` | Railway/local | sec-api.io access for IAPD |
| `FIRECRAWL_API_KEY` | Railway/local | Firecrawl Browser API for Delaware registry searches |
| `OPENSANCTIONS_API_KEY` | Railway/local | Screening API |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Railway/local | Optional graph database |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Railway/local | Zoom server-to-server OAuth |
| `CORS_ORIGIN` | Railway | Additional allowed browser origins |
| `HEALTH_SECRET` | Railway | Optional token enabling detailed health output |
| `PORT` | Railway/local | Express port; defaults to 3001 |

There is no `AWS_AGENT_BASE` or Forge credential in the current architecture.
Bedrock and Anthropic are called directly from the Express service using
credentials and controlled model IDs stored in Railway. Configure both sets to
keep both choices available in the Agent Inventory.

## Operations and troubleshooting

Check failures in this order:

1. Read the compact dock step log; it displays the runner's concrete error.
2. Check Railway logs for `[api-runner]` and `[dd-run]` messages.
3. Call `GET /api/health`. `ok: false` means Supabase is unavailable.
4. Confirm migration `009` has run if commit reports missing `agent_runs` columns.
5. Confirm migrations `021`, `022`, `026`, and `027` have run for document-processing, exception-array, model-profile, or run-attribution column errors.
6. Confirm the relevant third-party credential is present in Railway.
7. For browser 401 responses, confirm the request uses `apiFetch()` and the session is active.
8. For CORS or network failures, confirm the deployed frontend origin is allowed and `VITE_AGENT_API_BASE` points to the current Railway URL without a trailing slash.

### Credential-to-agent mapping

| Agent | Required credential |
|---|---|
| Companies House and UK aggregate sourcing | `COMPANIES_HOUSE_API_KEY` |
| FCA and UK aggregate sourcing | `FCA_AUTH_EMAIL`, `FCA_API_KEY` |
| IAPD and US aggregate sourcing | `SEC_API_KEY` |
| Delaware and US aggregate sourcing | `FIRECRAWL_API_KEY` |
| LLM-assisted sourcing and document agents | Active provider credential and Haiku model ID |
| DD and exception routing | Active provider credential and Sonnet model ID |
| Screening | `OPENSANCTIONS_API_KEY` plus the active provider's Haiku configuration |
| Assistant chat | `ANTHROPIC_API_KEY` |
| All persisted runs | Supabase backend variables |

## Production considerations

- Uncommitted run output is process-local; durable storage would improve restart resilience and horizontal scaling.
- Agent availability is computed from the persisted registry, backend runner wiring, and `required_env`. An enabled row can still be reported as unavailable when production credentials are missing.
- The Agent Register selects a controlled logical model profile rather than accepting arbitrary model IDs. Concrete model IDs and credentials remain in Railway, and each model-backed `agent_run` snapshots `llm_provider`, `llm_profile_key`, and `llm_model_id`.
- The Work Queue uses `entities.review_type`, real sorting and status views.
- Reports are explicitly labeled as illustrative and unsuitable for decisions.
- Heavy routes and the Cytoscape ownership graph are lazy-loaded.
- Detailed health checks require `HEALTH_SECRET` and an `x-health-token` request header; otherwise the endpoint returns only `{ ok }`.
- Zoom creation is public at the API layer and should receive authentication or a narrowly scoped authorization policy before wider deployment.
- CORS currently permits the GitHub Pages origin prefix plus configured origins; keep `CORS_ORIGIN` narrowly scoped.
- Neo4j is optional. The graph tab degrades independently when it is unavailable.
- Database migrations are applied manually through Supabase and require an operational release checklist.

## Key files

| File | Responsibility |
|---|---|
| `server.js` | Express routes, authentication, runner dispatch, chat, screening, Zoom |
| `src/components/AgentSystem.tsx` | Frontend agent orchestration, polling, auto-commit, compact dock |
| `src/pages/ExceptionReview.tsx` | Main entity review and attribute workspace |
| `src/components/kyc/AgentTriggers.tsx` | Sourcing, DD, and screening controls |
| `src/db/supabase.js` | Backend persistence helpers |
| `agents/runners/api/` | Direct REST and Claude runner implementations |
| `schema/kyc_master_attribute_schema.json` | Canonical attribute schema |
| `scripts/migrations/` | Current Supabase migration sequence |
| `scripts/seed-ria-test-cases.mjs` | Verified clean synthetic-case reset |
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment |

## Local development

Use Node 20 or newer (Node 20 is the production baseline):

```bash
npm install
cp .env.example .env
npm run start
```

Vite listens on port 8080 and Express on port 3001.

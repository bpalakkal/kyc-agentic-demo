# KYC Sentinel — Production Handoff Notes

## Current production architecture

KYC Sentinel is a no-Forge KYC compliance application. Financial-crime analysts use it to review entities and exceptions, inspect KYC attributes and evidence, run sourcing and due-diligence agents, screen parties, and record resolutions.

The application does not call Forge or an AWS ELB agent runtime. Agents execute in the Express service through direct third-party REST APIs or Anthropic Claude.

```text
Browser (GitHub Pages, /kyc-agentic/)
  |
  | HTTPS + Supabase bearer token
  v
Express API (Railway)
  |-- Supabase PostgreSQL and private Storage
  |-- Neo4j ownership graph (optional)
  |-- Anthropic Claude (chat, DD, document digitization)
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
| AI | Anthropic | Assistant chat, DD agents, Companies House PDF digitization |
| Screening | OpenSanctions | Sanctions and PEP matching |

## Application behavior

### Authentication

Supabase email/password authentication protects application routes. The browser sends the active Supabase access token through `apiFetch()`; the Express `requireAuth` middleware validates it before serving data or agent endpoints. `/api/health` and the Zoom route are the intentional public exceptions.

Every frontend request to `${VITE_AGENT_API_BASE}/api/*` must use `src/lib/apiFetch.ts`.

### Agent execution and auto-commit

The backend exposes 29 agents from the Supabase `agent_registry` table:

- 9 sourcing agents, including UK and US aggregate flows
- 19 due-diligence agents: one all-in-one runner and 18 attribute-focused runners
- 1 sanctions and PEP screening agent

Generic sourcing and DD runs follow this lifecycle:

```text
POST /api/agent-run/api/:slug
  -> running
  -> pending_review
  -> frontend automatically calls POST /api/agent-run-api/:runId/commit
  -> complete
```

`pending_review` is an internal persistence boundary. There is no analyst proposal, accept/reject, or diff-modal step in the active UI. `AttributeDiffModal.tsx` remains unused compatibility code.

Run steps and uncommitted output are held in process memory. A Railway restart during a run can orphan that run; the next status poll detects a persisted `running` row with no in-memory execution and marks it failed so the analyst can rerun the agent.

### Attribute and party persistence

- `entity_attributes` stores scalar KYC attributes and agent lineage.
- `entity_persons` stores beneficial owners, officers, directors, and signatories.
- Sourcing runners write persons as rows rather than numbered flat attributes.
- DD results are the only source of `id_flag` and `verification_flag`.
- Analyst overrides do not automatically set identification or verification flags.
- `kyc_ref` is database-derived as `entity_id + '_' + case_id`.

Legacy `entity_snapshots` and nullable `snapshot_id` columns remain in the schema for data compatibility. They do not indicate a live Forge dependency; current agents write rows through `agent_run_id`.

### Schema contract

`schema/kyc_master_attribute_schema.json` is the canonical schema. `schema/schema-meta.json` and `schema/schema-meta.js` are generated artifacts and must not be edited manually.

After changing the canonical schema, run the metadata generator directly:

```bash
node scripts/build-schema-meta.mjs
```

`npm run generate` also regenerates the legacy entity fixture file from `entities.md`. Production data is read from Supabase, but that generated fixture is still part of the current build pipeline.

## Deployment

### Frontend

`.github/workflows/deploy.yml` builds and publishes `dist` to GitHub Pages on pushes to `main`.

The workflow requires these GitHub Actions secrets:

- `VITE_AGENT_API_BASE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`VITE_AGENT_API_BASE` is a build-time frontend value. Set it in GitHub Actions, not only in Railway.

The current Vite and router base is `/kyc-agentic/`.

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
```

Migration `007` truncates entity case data and must be scheduled deliberately. Migration `009` is required for current agent commits and adds persisted run details. Migration `010` creates and seeds the registry golden source; deploy it before the backend version that reads `/api/agents` from Supabase. Migration `013` adds the persistent per-analyst review cursors used by the Documents and Agent Runs unread badges.

Set `AGENT_REGISTRY_ADMIN_EMAILS` in Railway to the comma-separated emails allowed to edit the Agent Register. Users with Supabase `app_metadata.role = admin` are also allowed. Migration `014` creates the immutable configuration audit table.

One-time environment setup:

```bash
node scripts/setup-storage.js
node scripts/seed-supabase.js
```

## Environment variables

| Variable | Location | Purpose |
|---|---|---|
| `SUPABASE_URL` | Railway/local | Backend Supabase URL |
| `SUPABASE_SERVICE_KEY` | Railway/local | Backend service-role access |
| `VITE_SUPABASE_URL` | GitHub Actions/local | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | GitHub Actions/local | Frontend authentication |
| `VITE_AGENT_API_BASE` | GitHub Actions/local | Express API base URL |
| `ANTHROPIC_API_KEY` | Railway/local | Chat, DD agents, PDF digitization |
| `COMPANIES_HOUSE_API_KEY` | Railway/local | Companies House API |
| `FCA_AUTH_EMAIL`, `FCA_API_KEY` | Railway/local | FCA Register API |
| `SEC_API_KEY` | Railway/local | sec-api.io access for IAPD |
| `OPENSANCTIONS_API_KEY` | Railway/local | Screening API |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Railway/local | Optional graph database |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Railway/local | Zoom server-to-server OAuth |
| `CORS_ORIGIN` | Railway | Additional allowed browser origins |
| `HEALTH_SECRET` | Railway | Optional token enabling detailed health output |
| `PORT` | Railway/local | Express port; defaults to 3001 |

There is no `AWS_AGENT_BASE` or Forge credential in the current architecture.

## Operations and troubleshooting

Check failures in this order:

1. Read the compact dock step log; it displays the runner's concrete error.
2. Check Railway logs for `[api-runner]` and `[dd-run]` messages.
3. Call `GET /api/health`. `ok: false` means Supabase is unavailable.
4. Confirm migration `009` has run if commit reports missing `agent_runs` columns.
5. Confirm the relevant third-party credential is present in Railway.
6. For browser 401 responses, confirm the request uses `apiFetch()` and the session is active.
7. For CORS or network failures, confirm the deployed frontend origin is allowed and `VITE_AGENT_API_BASE` points to the current Railway URL without a trailing slash.

### Credential-to-agent mapping

| Agent | Required credential |
|---|---|
| Companies House and UK aggregate sourcing | `COMPANIES_HOUSE_API_KEY` |
| FCA and UK aggregate sourcing | `FCA_AUTH_EMAIL`, `FCA_API_KEY` |
| IAPD and US aggregate sourcing | `SEC_API_KEY` |
| DD agents and Companies House PDF processing | `ANTHROPIC_API_KEY` |
| Screening | `OPENSANCTIONS_API_KEY` |
| All persisted runs | Supabase backend variables |

## Production considerations

- Uncommitted run output is process-local; durable storage would improve restart resilience and horizontal scaling.
- Agent availability is computed from the persisted registry, backend runner wiring, and `required_env`. An enabled row can still be reported as unavailable when production credentials are missing.
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
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment |

## Local development

Use Node 20 or newer (Node 20 is the production baseline):

```bash
npm install
cp .env.example .env
npm run start
```

Vite listens on port 8080 and Express on port 3001.

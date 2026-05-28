# KYC Platform — Production Handoff Notes

## What this is

A React + TypeScript SPA that orchestrates AI agents for KYC (Know Your Customer)
exception review. It wraps a real AWS agent runtime with a reviewer-facing UI:
work queue, exception detail, live agent console, and Zoom outreach.

Deployed at: <https://bpalakkal.github.io/kyc-agentic2>  
Proxy server: Railway (Node.js / Express)  
Agent runtime: AWS ELB (`gs-forge-agentic-runtime-lb-*.us-east-1.elb.amazonaws.com`)

---

## Architecture

```
Browser (GitHub Pages)
  │  HTTPS
  ▼
Railway proxy  (server.js)
  │  HTTP
  ▼
AWS ELB → Agent runtime
  POST /api/invoke/<slug>           ← invoke agent
  GET  /api/runs/<runId>            ← poll run status
  GET  /api/execution-logs/<runId>/agent-steps  ← live thinking steps
```

The proxy exists solely to bridge HTTPS→HTTP (mixed-content) and add CORS headers.
Once the ELB is placed behind HTTPS, the proxy can be removed entirely.

---

## Current limitations (demo → production gaps)

### 1. All case data is hard-coded
| File | What to replace with |
|---|---|
| `src/pages/WorkQueue.tsx` `groups` | `GET /api/work-queue?analyst=<id>` |
| `src/pages/ExceptionReview.tsx` `exceptions` | `GET /api/cases/:kycId/exceptions` |
| `src/data/entities-generated.ts` | `GET /api/cases/:kycId/attributes` |
| `src/pages/Dashboard.tsx` KPI cards, activity | `GET /api/dashboard` |

All generated data flows from `entities.md` → `scripts/parse-entities.cjs` →
`src/data/entities-generated.ts`. This works for a demo with a small fixed
entity set. In production, replace this pipeline with API calls using
React Query (`useQuery`).

### 2. No authentication
The app has no login flow. Every route is public.  
**Add:** Auth0, Clerk, or NextAuth with role-based access (analyst / supervisor / read-only).  
The proxy (`server.js`) should validate a JWT on every request.

### 3. Proxy security
`server.js` sets `cors({ origin: "*" })`. Anyone who discovers the Railway URL
can call the AWS agent runtime through it.  
**Add:**
- Restrict CORS to the GitHub Pages origin
- Require a shared API key header (or JWT) on every proxy request
- Rate limiting via `express-rate-limit`

### 4. Resolution submission is local state only
`ExceptionReview.tsx` tracks resolved exceptions in `useState`. Refreshing the
page loses all decisions.  
**Add:** `POST /api/cases/:kycId/exceptions/:excId/resolve` with resolution ID,
rationale, and reviewer ID. Store in the case management backend.

### 5. Escalation and Outreach are UI stubs
The Escalate panel and Email outreach dialogs update local state but send nothing.  
**Wire to:** a notification service (email via SendGrid, internal case routing via
the case management API).  
Zoom meeting creation **is** wired to a real API (`server.js /api/zoom/create-meeting`).

### 6. Search / filter / sort are non-functional
The work queue search box and filter button render correctly but do nothing.  
**Replace with:** server-side search against the case management backend.

### 7. Simulated agents
10 of 14 agents in `AGENT_API_CONFIGS` have no entry and run in simulation mode
(defaultThoughts strings cycled on a timer). These are: Identity, Document,
Regulatory, Sanctions, PEP, Adverse Media, Beneficial Ownership, Risk Scoring,
Outreach, Audit.  
**Wire each one:** add an `AgentApiConfig` entry in `AgentSystem.tsx` when the
corresponding AWS agent is deployed. No other code changes required.

### 8. Entity data pipeline
Adding a new entity today requires:
1. Editing `entities.md`
2. Committing → GitHub Actions rebuilds and redeploys

In production, entities should come from a database. The `parse-entities.cjs`
script and `entities-generated.ts` can be deleted once the API layer is in place.

---

## Recommended next steps (priority order)

1. **Add authentication** — blocks everything else; analysts must have identity
2. **Create a case management API** — replace all hard-coded data with real reads/writes
3. **Wire resolution submission** — makes the review workflow actually persist decisions
4. **Lock down the proxy** — add auth before exposing to a wider team
5. **Wire remaining agents** — Identity, Sanctions, PEP, Adverse Media as they go live
6. **Replace entities.md pipeline** — move to API + database

---

## Key files

| File | Purpose |
|---|---|
| `src/components/AgentSystem.tsx` | Entire agent layer: registry, API wiring, polling, step parsing, dock UI |
| `src/pages/ExceptionReview.tsx` | Main workspace (~4 300 lines — candidate for splitting into sub-components) |
| `src/pages/Dashboard.tsx` | Dashboard KPIs and AI assistant chat |
| `src/pages/WorkQueue.tsx` | Entity selection table |
| `server.js` | Express proxy (Zoom + AWS agent runtime) |
| `scripts/parse-entities.cjs` | Markdown → TypeScript data generator |
| `entities.md` | Source of truth for demo entity/exception data |
| `.github/workflows/deploy.yml` | GitHub Actions: build + deploy to gh-pages |
| `Procfile` | Railway entry point (`web: npm run server`) |

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_AGENT_API_BASE` | GitHub Secret (build-time) | Railway proxy URL baked into the JS bundle |
| `ZOOM_ACCOUNT_ID` | Railway + local `.env` | Zoom Server-to-Server OAuth |
| `ZOOM_CLIENT_ID` | Railway + local `.env` | Zoom OAuth client ID |
| `ZOOM_CLIENT_SECRET` | Railway + local `.env` | Zoom OAuth client secret |
| `AWS_AGENT_BASE` | Railway env | Override the ELB base URL without redeploying |
| `PORT` | Railway (auto-set) | Proxy listen port (default 3001) |

## Local development

```bash
cp .env.example .env          # fill in Zoom credentials
npm install
npm start                     # starts Vite (port 8080) + proxy (port 3001) concurrently
```

The Vite dev server proxies `/api/*` requests to `localhost:3001` automatically
(via `VITE_AGENT_API_BASE` defaulting to `http://localhost:3001` in dev).

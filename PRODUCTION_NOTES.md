# KYC Platform — Production Handoff Notes

## What this is

A React + TypeScript SPA that orchestrates AI agents for KYC (Know Your Customer)
exception review. It wraps a real AWS agent runtime with a reviewer-facing UI:
work queue, exception detail, live agent console, and Zoom outreach.

Current demo:  <https://bpalakkal.github.io/kyc-agentic2>  
Proxy server:  Railway (Node.js / Express — temporary, see AWS migration below)  
Agent runtime: AWS ELB (`gs-forge-agentic-runtime-lb-*.us-east-1.elb.amazonaws.com`)

---

## Current architecture (demo)

```
Browser (GitHub Pages — HTTPS)
  │  HTTPS
  ▼
Railway proxy  (server.js — Express)
  │  HTTP
  ▼
AWS ELB → Agent runtime
  POST /api/invoke/<slug>                        ← invoke agent
  GET  /api/runs/<runId>                         ← poll run status
  GET  /api/execution-logs/<runId>/agent-steps   ← live thinking steps
```

The Railway proxy exists solely to solve two browser security constraints:

1. **Mixed-content** — GitHub Pages is HTTPS but the ELB is plain HTTP.
   Browsers block HTTP fetches from HTTPS pages.
2. **CORS** — the ELB returns no `Access-Control-Allow-Origin` headers, so
   direct browser requests are rejected.

---

## Target architecture (AWS production)

```
Browser (CloudFront — HTTPS)
  │  HTTPS
  ▼
API Gateway or ALB  (HTTPS termination + CORS headers)
  │  HTTP / internal VPC
  ▼
AWS ELB → Agent runtime
```

With HTTPS + CORS handled at the API Gateway / ALB layer, **the Railway proxy
is no longer needed**. The browser calls the API Gateway directly and
`server.js` shrinks to only the Zoom credential proxy.

---

## Migration: Railway → AWS

### Step 1 — Frontend: GitHub Pages → S3 + CloudFront

**Code changes required (3 lines):**

| File | Current | Change to |
|---|---|---|
| `vite.config.ts` line 8 | `base: "/kyc-agentic2/"` | `base: "/"` |
| `src/App.tsx` | `<BrowserRouter basename="/kyc-agentic2">` | `<BrowserRouter>` (no basename) |
| `.github/workflows/deploy.yml` | `peaceiris/actions-gh-pages` deploy step | S3 sync + CloudFront invalidation |

Example GitHub Actions deploy step replacement:

```yaml
- name: Deploy to S3
  run: aws s3 sync dist/ s3://your-bucket-name --delete

- name: Invalidate CloudFront
  run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"
```

Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `CF_DIST_ID` to GitHub
Secrets. Remove the `VITE_AGENT_API_BASE` secret once the proxy is eliminated
(see Step 2).

**No React component or logic changes are required.**

---

### Step 2 — Eliminate the Railway proxy

Put HTTPS + CORS on the ELB / place it behind API Gateway, then the browser
can call the agent runtime directly.

**Option A — API Gateway in front of the ELB (recommended)**

1. Create an HTTP API in API Gateway.
2. Add routes: `POST /api/invoke/{slug}`, `GET /api/runs/{runId}`,
   `GET /api/execution-logs/{runId}/agent-steps`.
3. Set each route's integration to forward to the ELB.
4. Enable CORS on the API Gateway with `Access-Control-Allow-Origin: https://your-cloudfront-domain`.
5. Set `VITE_AGENT_API_BASE` (build-time GitHub Secret) to the API Gateway URL.

The frontend's `AgentSystem.tsx` calls `AGENT_API_BASE/api/agent/:slug` etc. —
these route names already match `server.js` which already matches the ELB paths.
No frontend code changes are needed beyond updating the env var.

**Option B — ACM certificate directly on the ELB**

1. Attach an ACM certificate to the ELB's HTTPS listener.
2. Add CORS response headers to the ELB listener rules.
3. Set `VITE_AGENT_API_BASE` to `https://your-elb-domain`.

Same result as Option A with less infrastructure.

---

### Step 3 — Zoom proxy: Railway → Lambda

`server.js` still handles Zoom meeting creation (browser cannot call Zoom
directly — credentials must stay server-side). Move this to Lambda:

1. Extract the Zoom routes from `server.js` into a Lambda handler
   (or keep the full Express app and use `aws-serverless-express`).
2. Store `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` in
   **AWS Secrets Manager** and inject them as Lambda environment variables.
3. Expose via API Gateway: `POST /api/zoom/create-meeting`.
4. Set the frontend's `VITE_AGENT_API_BASE` to this API Gateway URL
   (or use a separate `VITE_ZOOM_API_BASE` if the agent runtime has its own URL).

`server.js` code requires **no changes** — it runs identically on Lambda,
ECS Fargate, or EC2. Only the secrets injection method changes.

---

### Migration checklist

- [ ] S3 bucket + CloudFront distribution created
- [ ] `vite.config.ts` `base` changed to `"/"`
- [ ] `App.tsx` `basename` removed
- [ ] GitHub Actions deploy step updated (S3 sync + CF invalidation)
- [ ] API Gateway or ACM cert on ELB for HTTPS + CORS
- [ ] `VITE_AGENT_API_BASE` GitHub Secret updated to API Gateway / ELB URL
- [ ] Zoom proxy deployed to Lambda (or ECS), credentials in Secrets Manager
- [ ] CORS restricted to CloudFront domain (in proxy + API Gateway)
- [ ] Railway project decommissioned

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
**Add:** Cognito (native AWS) or Auth0 / Clerk with role-based access
(analyst / supervisor / read-only). The proxy should validate a JWT on every
request. API Gateway can handle JWT authorisation natively.

### 3. Proxy security
`server.js` sets `cors({ origin: "*" })`. Anyone who discovers the Railway URL
can call the AWS agent runtime through it.  
**Add:**
- Restrict CORS to the CloudFront / application domain
- Require a JWT or API key header on every proxy request
- Rate limiting via `express-rate-limit` (or API Gateway throttling)

### 4. Resolution submission is local state only
`ExceptionReview.tsx` tracks resolved exceptions in `useState`. Refreshing the
page loses all decisions.  
**Add:** `POST /api/cases/:kycId/exceptions/:excId/resolve` with resolution ID,
rationale, and reviewer ID. Store in the case management backend.

### 5. Escalation and Outreach are UI stubs
The Escalate panel and Email outreach dialogs update local state but send nothing.  
**Wire to:** SES (email) or an internal notification service.  
Zoom meeting creation **is** wired to a real API (`server.js /api/zoom/create-meeting`).

### 6. Search / filter / sort are non-functional
The work queue search box and filter button render correctly but do nothing.  
**Replace with:** server-side search against the case management backend.

### 7. Simulated agents
10 of 14 agents have no live API config and run in simulation mode (animated
thought strings). These are: Identity, Document, Regulatory, Sanctions, PEP,
Adverse Media, Beneficial Ownership, Risk Scoring, Outreach, Audit.  
**Wire each one:** add an `AgentApiConfig` entry in `AgentSystem.tsx` when the
corresponding agent is deployed. No other code changes required.

### 8. Entity data pipeline
Adding a new entity today requires editing `entities.md` and redeploying.
In production, entities come from a database — delete `parse-entities.cjs`
and `entities-generated.ts` once the API layer is in place.

---

## Recommended next steps (priority order)

1. **AWS infrastructure** — S3 + CloudFront, API Gateway, migrate proxy to Lambda
2. **Add authentication** — Cognito or Auth0; blocks everything else
3. **Create a case management API** — replace all hard-coded data
4. **Wire resolution submission** — persist decisions to the backend
5. **Lock down the proxy** — CORS restriction + JWT validation
6. **Wire remaining agents** — as each AWS agent goes live
7. **Replace entities.md pipeline** — move to API + database

---

## Key files

| File | Purpose |
|---|---|
| `src/components/AgentSystem.tsx` | Entire agent layer: registry, API wiring, polling, step parsing, dock UI |
| `src/pages/ExceptionReview.tsx` | Main workspace (~4 300 lines — candidate for splitting into sub-components) |
| `src/pages/Dashboard.tsx` | Dashboard KPIs and AI assistant chat |
| `src/pages/WorkQueue.tsx` | Entity selection table |
| `server.js` | Express proxy (Zoom + AWS agent runtime — moves to Lambda on AWS) |
| `scripts/parse-entities.cjs` | Markdown → TypeScript data generator (remove when API layer is ready) |
| `entities.md` | Source of truth for demo entity/exception data |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy (update for S3 + CloudFront) |
| `Procfile` | Railway entry point — not needed on AWS |

---

## Environment variables

| Variable | Demo (current) | AWS production |
|---|---|---|
| `VITE_AGENT_API_BASE` | GitHub Secret → Railway URL | GitHub Secret → API Gateway URL |
| `ZOOM_ACCOUNT_ID` | Railway env + local `.env` | Secrets Manager → Lambda env |
| `ZOOM_CLIENT_ID` | Railway env + local `.env` | Secrets Manager → Lambda env |
| `ZOOM_CLIENT_SECRET` | Railway env + local `.env` | Secrets Manager → Lambda env |
| `AWS_AGENT_BASE` | Railway env (overrides ELB URL) | Not needed once proxy is removed |
| `PORT` | Railway auto-set (3001 default) | Not needed on Lambda |

---

## Local development

```bash
cp .env.example .env          # fill in Zoom credentials
npm install
npm start                     # starts Vite (port 8080) + proxy (port 3001) concurrently
```

`VITE_AGENT_API_BASE` defaults to `http://localhost:3001` in dev, so the
Vite dev server and the Express proxy work together out of the box.

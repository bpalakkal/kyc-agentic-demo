# KYC Sentinel

AI-powered KYC compliance platform for financial analysts. Surfaces compliance exceptions, lets analysts review and resolve them, and dispatches AI agents to pull due diligence data from external sources.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Run DB migrations in order (paste each into Supabase SQL Editor)
#    scripts/migrations/001_agent_runs_and_case_files.sql
#    scripts/migrations/002_agent_runs_status_constraint.sql
#    scripts/migrations/003_entity_attributes_confidence.sql

# 4. Create the file storage bucket
node scripts/setup-storage.js

# 5. Seed initial entities and exceptions
node scripts/seed-supabase.js

# 6. Start dev server (Vite on :8080 + Express on :3001)
npm run start
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui (Radix + Tailwind), Lucide icons |
| Backend | Express (Node.js ESM, Railway) |
| Primary DB | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (`kyc-files` bucket, private) |
| Graph DB | Neo4j |
| AI Assistant | Anthropic Claude (claude-sonnet-4-6) |
| Agent Runtime | AWS ELB (async HTTP) + synchronous API runners |

---

## Features

### Exception Review
Browse open KYC exceptions per entity. Each exception shows a confidence score, AI-generated narrative, reasoning steps, and supporting evidence. Resolve via QA sign-off, escalation, client outreach, or submission.

### Attribute View
Full attribute grid built from two merged layers: the latest KYC Forge snapshot and any accepted API runner results. Attributes carry lineage (source, confidence, agent actions) and support analyst overrides. Entities with no Forge snapshot show API runner attributes directly.

### Agent Dispatch — Preview / Commit Flow
Run API agents (e.g. FCA Register) directly from the review screen. A live dock shows progress steps as they arrive. When the agent finishes, a **diff modal** appears showing proposed attribute values vs what is currently stored. The analyst can accept all, accept a subset, or reject entirely — nothing is written to the database until accepted.

Multi-value attributes (e.g. `corporate_officer_1`, `corporate_officer_2`) are compared by value-set membership, not position, so reordering does not appear as a change.

### Attribute Confidence
Every attribute carries a confidence score (0–100%). API runners always write 100%. Autonomous LLM-driven agents write whatever score the model provides.

### Files Tab
Every document and screenshot produced by an agent run is stored in Supabase Storage and listed in the Files tab on the Exception Review screen. Click to open an inline viewer (PDF iframe, image, or download fallback). Files are served via short-lived signed URLs — never public.

### Ownership Graph
Interactive Neo4j graph showing entity relationships, beneficial owners, and key controllers. Click any node to expand its connections.

### AI Chat
Floating chat assistant powered by Claude with tool use — can query entity data, list exceptions, search by name, and run Cypher against the graph.

---

## Project Structure

```
my-app/
├── agents/                  # Server-side agent ecosystem
│   ├── types.ts             # Shared output types (AgentRunOutput, AttributeOutput, …)
│   ├── registry.ts          # Agent slug → metadata
│   ├── base/
│   │   ├── ApiRunner.js     # Base class for synchronous API runners (preview/commit)
│   │   └── AutonomousRunner.js  # Base class for async AWS agents
│   ├── publishers/          # Write agent output to Supabase
│   │   ├── AttributePublisher.js
│   │   ├── ExceptionPublisher.js
│   │   └── FilePublisher.js
│   └── runners/
│       ├── api/             # Direct REST API runners
│       │   ├── FCARunner.js         # FCA Register (pure code, no LLM)
│       │   └── CompaniesHouseRunner.js
│       └── autonomous/      # AWS ELB agent wrappers
│           └── UKParentFlowRunner.js
├── src/
│   ├── pages/               # Dashboard, WorkQueue, ExceptionReview, Login
│   ├── components/
│   │   ├── AgentSystem.tsx          # Agent orchestration + dock UI
│   │   ├── GraphView.tsx            # Neo4j graph
│   │   └── kyc/
│   │       ├── AttributeDiffModal.tsx   # Preview/commit diff modal
│   │       ├── DocumentViewer.tsx       # PDF / image viewer dialog
│   │       ├── FileCard.tsx             # Single file card
│   │       └── EntityFiles.tsx          # File grid with category tabs
│   └── db/
│       ├── supabase.js      # Server-side DB helpers (getAttributes merges snapshot + agent runs)
│       └── neo4j.js         # Graph queries
├── scripts/
│   ├── migrations/
│   │   ├── 001_agent_runs_and_case_files.sql
│   │   ├── 002_agent_runs_status_constraint.sql
│   │   └── 003_entity_attributes_confidence.sql
│   ├── seed-supabase.js     # Seeds entities including Barclays Bank PLC (KYC-30230)
│   └── setup-storage.js     # Create Supabase Storage bucket
└── server.js                # All Express routes
```

---

## Adding a New API Runner

1. Create `agents/runners/api/MySourceRunner.js`:

```js
import { ApiRunner } from '../../base/ApiRunner.js';

export class MySourceRunner extends ApiRunner {
  get slug()       { return 'my-source'; }
  get outputType() { return 'attributes'; }

  async execute({ kycRef, entityName }) {
    this.step('Fetching data…');
    // Call external API …
    this.step('Processing results…');

    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: this.outputType,
      attributes: [
        {
          attributeName:  'entity_name',
          attributeGroup: 'core',    // MUST be 'core' or 'wgq' — no other values
          displayValue:   'Acme Ltd',
          source:         'My Source',
          confidence:     100,       // 0–100; always 100 for pure-code runners
          idFlag:         false,
          verificationFlag: false,
          exceptionFlag:  false,
          lineage: [{ source: 'My Source', sourceUrl: 'https://example.com', fetchedAt: new Date().toISOString(), confidence: 1.0 }],
        },
      ],
      exceptions: [],
      files:      [],
      metadata:   { completedAt: new Date().toISOString(), durationMs: 0, sourcesConsulted: ['example.com'] },
    };
  }
}
```

2. Export from `agents/runners/api/index.js`
3. Add to the `RunnerMap` in `server.js` at `POST /api/agent-run/api/:slug`
4. Add an `AgentApiConfig` entry in `src/components/AgentSystem.tsx`:

```ts
"my-source": {
  slug: "my-source",
  endpoint: "/api/agent-run/api/my-source",
  buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
  fetchSteps: true,
  asyncMode: true,
  apiRunner: true,
  skipSnapshot: true,
},
```

### Attribute group rule
`attributeGroup` must be **`'core'`** (attributes tab) or **`'wgq'`** (questionnaire tab). Any other value silently makes those attributes invisible in the UI.

---

## Database Migrations

Run all three in order in the Supabase SQL Editor:

| File | What it does |
|------|-------------|
| `001_agent_runs_and_case_files.sql` | Creates `agent_runs` and `case_files`; patches `entity_attributes` and `exceptions` |
| `002_agent_runs_status_constraint.sql` | Widens `agent_runs.status` CHECK to include `pending_review` and `cancelled` |
| `003_entity_attributes_confidence.sql` | Adds `confidence smallint` (0–100) to `entity_attributes` |

### agent_runs status lifecycle
```
running → pending_review → complete
                        ↘ failed | cancelled
```

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```
SUPABASE_URL / SUPABASE_SERVICE_KEY       — backend DB access
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — frontend auth
ANTHROPIC_API_KEY                         — Claude chat assistant
AWS_AGENT_BASE                            — AWS ELB for autonomous agents
COMPANIES_HOUSE_API_KEY                   — Companies House API runner
VITE_AGENT_API_BASE                       — Express server URL (http://localhost:3001 in dev)
FCA_AUTH_EMAIL / FCA_API_KEY              — FCA Register API (Railway Variables only, not .env)
```

---

## API Connectivity & Authentication

### All API calls must use `apiFetch()`
Every frontend call to `AGENT_API_BASE/api/*` must go through the `apiFetch()` wrapper:
```js
// Correct
import { apiFetch } from '@/lib/apiFetch';
const res = await apiFetch(`${AGENT_API_BASE}/api/entities`);

// Wrong — will get 401
const res = await fetch(`${AGENT_API_BASE}/api/entities`);
```

`apiFetch()` automatically injects the Supabase session Bearer token.

### Session Management
- **Frontend**: Uses `supabase.auth.onAuthStateChange()` to track session in-memory (not `getSession()`)
- See `src/lib/apiFetch.ts` for implementation
- Never rely on localStorage/IndexedDB for session state

### Supabase Backend
- **Node version**: Must be 20+ (required for WebSocket transport with `ws` package)
- **Configuration**: `src/db/supabase.js` imports `ws` and passes `transport: ws` to Supabase client

### External API Credentials (Railway only)
Set these in Railway Variables dashboard, not `.env`:
- `FCA_AUTH_EMAIL` — FCA Register API header `x-auth-email`
- `FCA_API_KEY` — FCA Register API header `x-auth-key`

---

## Dev Commands

```bash
npm run start    # Vite (:8080) + Express (:3001)
npm run dev      # Vite only
npm run server   # Express only
npm run build    # Production build
npm run deploy   # Build + deploy to GitHub Pages
```

---

## Deployment

- **Frontend**: GitHub Pages via `npm run deploy`
- **Backend**: Railway — `Procfile` runs `npm run server`; auto-deploys on `git push origin main`
- **Migrations**: run all three SQL migrations in Supabase dashboard before first deploy

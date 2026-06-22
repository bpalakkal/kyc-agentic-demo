# KYC Sentinel

AI-powered KYC compliance platform for financial analysts. Surfaces compliance exceptions, lets analysts review and resolve them, and dispatches AI agents to pull due diligence data from external sources.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Run DB migration (paste into Supabase SQL Editor)
#    scripts/migrations/001_agent_runs_and_case_files.sql

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
| Agent Runtime | AWS ELB (async HTTP, custom agent framework) |

---

## Features

### Exception Review
Browse open KYC exceptions per entity. Each exception shows a confidence score, AI-generated narrative, reasoning steps, and supporting evidence. Resolve via QA sign-off, escalation, client outreach, or submission.

### Attribute View
Full attribute grid from the latest KYC Forge snapshot. Toggle between exception-flagged view and full attribute form. Attributes carry lineage (source, confidence, agent actions) and support analyst overrides.

### Agent Dispatch
Run AI agents directly from the review screen. A live dock shows thinking steps as they stream in. On completion, any saved attributes, exceptions, and files are shown inline.

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
│   ├── types.ts             # Shared output types
│   ├── registry.ts          # Agent slug → metadata
│   ├── base/
│   │   ├── ApiRunner.js     # Base class for synchronous API runners
│   │   └── AutonomousRunner.js  # Base class for async AWS agents
│   ├── publishers/          # Write agent output to Supabase
│   │   ├── AttributePublisher.js
│   │   ├── ExceptionPublisher.js
│   │   └── FilePublisher.js
│   └── runners/
│       ├── api/             # Direct REST API runners (stubs — impl provided separately)
│       └── autonomous/      # AWS ELB agent wrappers (stubs)
├── src/
│   ├── pages/               # Dashboard, WorkQueue, ExceptionReview, Login
│   ├── components/
│   │   ├── AgentSystem.tsx  # Agent orchestration + dock UI
│   │   ├── GraphView.tsx    # Neo4j graph
│   │   └── kyc/             # KYC-specific components
│   │       ├── DocumentViewer.tsx   # PDF / image viewer dialog
│   │       ├── FileCard.tsx         # Single file card
│   │       └── EntityFiles.tsx      # File grid with category tabs
│   └── db/
│       ├── supabase.js      # Server-side DB helpers
│       └── neo4j.js         # Graph queries
├── scripts/
│   ├── migrations/          # SQL migrations for Supabase
│   ├── seed-supabase.js     # Seed script
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
  get outputType() { return 'attributes'; }   // or 'exceptions' | 'both'

  async execute({ kycRef, entityName }) {
    // Call external API, build AttributeOutput[] / ExceptionOutput[] / FileOutput[]
    return {
      agentSlug:  this.slug,
      kycRef,
      outputType: this.outputType,
      attributes: [...],
      exceptions: [...],
      files:      [...],
      metadata:   { completedAt: new Date().toISOString(), durationMs: 0, sourcesConsulted: ['example.com'] },
    };
  }
}
```

2. Export from `agents/runners/api/index.js`
3. Add to the `RunnerMap` in `server.js` at `POST /api/agent-run/api/:slug`

Invoke it:
```
POST /api/agent-run/api/my-source
{ "kycRef": "KYC-30215", "entityName": "Acme Ltd" }
→ { "runId": "uuid", "stats": { "attrCount": 8, "excCount": 1, "fileStored": 2 } }
```

---

## Database Migration

Run `scripts/migrations/001_agent_runs_and_case_files.sql` in the Supabase SQL Editor once before first use. It:
- Creates `agent_runs` table (tracks every agent invocation)
- Creates `case_files` table (metadata for stored documents/screenshots)
- Makes `entity_attributes.snapshot_id` nullable (agent-run attributes don't need a Forge snapshot)
- Adds `severity` column to `exceptions`
- Adds `agent_run_id` FK to `entity_attributes` and `exceptions`
- Enables RLS on the new tables

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```
SUPABASE_URL / SUPABASE_SERVICE_KEY    — backend DB access
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — frontend auth
ANTHROPIC_API_KEY                      — Claude chat assistant
AWS_AGENT_BASE                         — AWS ELB for autonomous agents
COMPANIES_HOUSE_API_KEY               — Companies House API runner
VITE_AGENT_API_BASE                    — Express server URL (http://localhost:3001 in dev)
```

---

## API Connectivity & Authentication

### All API calls must use `apiFetch()`
Every frontend call to `AGENT_API_BASE/api/*` must go through the `apiFetch()` wrapper:
```js
// ✅ Correct
import { apiFetch } from '@/lib/apiFetch';
const res = await apiFetch(`${AGENT_API_BASE}/api/entities`);

// ❌ Wrong — will get 401
const res = await fetch(`${AGENT_API_BASE}/api/entities`);
```

`apiFetch()` automatically injects the Supabase session Bearer token. Direct `fetch()` calls will fail with 401 Unauthorized.

### Session Management
- **Frontend**: Uses `supabase.auth.onAuthStateChange()` to track session in-memory (not `getSession()`)
- See `src/lib/apiFetch.ts` for implementation
- Never rely on localStorage/IndexedDB for session — use the in-memory state from `onAuthStateChange()`

### Supabase Backend
- **Node version**: Must be 20+ (required for WebSocket transport with `ws` package)
- **Configuration**: `src/db/supabase.js` imports `ws` and passes `transport: ws` to Supabase client
- If you see "Node.js 18 detected without native WebSocket support", redeploy after updating `.nvmrc` to `20`

### External API Credentials (Railway only)
Set these in Railway Variables dashboard, not `.env`:
- `FCA_AUTH_EMAIL` — FCA Register API header `x-auth-email`
- `FCA_API_KEY` — FCA Register API header `x-auth-key`
- After adding variables, manually trigger a redeploy for them to take effect

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
- **Backend**: Railway — `Procfile` runs `npm run server`
- **Migration**: run SQL migration in Supabase dashboard before first deploy

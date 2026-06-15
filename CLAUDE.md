# KYC Sentinel — Project Context

## What This App Does

AI-powered KYC (Know Your Customer) compliance platform for financial analysts. Surfaces KYC exceptions, lets analysts review and resolve them, and dispatches AI agents for investigative work.

## Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite (dev port 8080)
- **Deployed to**: GitHub Pages at `/kyc-agentic2/` base path
- **UI**: shadcn/ui (Radix + Tailwind), Lucide icons, Recharts
- **State**: React Context (Auth, Agents, theme) + TanStack Query

### Backend
- **Framework**: Express (`server.js`), deployed to Railway on port 3001
- **Dev**: `npm run start` runs both Vite and Express concurrently

### Databases
- **Supabase** (PostgreSQL) — entities, exceptions, KYC snapshots
- **Neo4j** — ownership/relationship graph

### AI
- **Anthropic Claude** (claude-sonnet-4-6) — floating chat assistant + tool use
- **14 specialized agents** — invoked via AWS ELB proxy; async polling pattern

## Source Layout

```
src/
├── pages/
│   ├── Dashboard.tsx       # Stats, priority cases, AI action recommendations
│   ├── WorkQueue.tsx       # Entity table grouped by DRG, filter by status/risk
│   ├── ExceptionReview.tsx # Deep-dive: flag + evidence + attributes + resolve actions
│   ├── Reports.tsx         # Analytics (placeholder)
│   └── Login.tsx           # Supabase auth
├── components/
│   ├── AppLayout.tsx       # Main shell: header, nav, floating AI chat dock
│   ├── AgentSystem.tsx     # Agent registry + orchestration (14 agents, ~450 lines)
│   ├── GraphView.tsx       # Neo4j ownership graph via Cytoscape + DAGRE layout
│   └── ui/                 # shadcn/ui primitives
├── contexts/
│   └── AuthContext.tsx     # Supabase auth provider
├── db/
│   ├── supabase.js         # Server-side Supabase helper functions
│   └── neo4j.js            # Neo4j driver + Cypher runner + Cytoscape converter
├── data/
│   └── entities-generated.ts  # ~3000 lines of mock entity/exception/activity data
└── lib/
    └── supabase.ts         # Frontend Supabase client
```

## Backend API Routes (`server.js`)

| Route | Purpose |
|-------|---------|
| `POST /api/zoom/create-meeting` | Zoom Server-to-Server OAuth, create meeting |
| `POST /api/agent/:slug` | Invoke agent async via AWS ELB |
| `GET /api/agent-steps/:runId` | Poll agent thinking steps |
| `GET /api/agent-run/:runId` | Poll agent run status |
| `GET /api/agent-artifacts/:runId` | List agent output artifacts |
| `GET /api/artifact-download` | Stream artifact file |
| `GET /api/entities` | All entities for work queue |
| `GET /api/entity/:kycRef` | Single entity detail |
| `GET /api/entity/:kycRef/snapshot` | Latest KYC Forge JSON |
| `POST /api/entity/:kycRef/snapshot` | Save new KYC snapshot |
| `GET /api/entity/:kycRef/exceptions` | All exceptions for entity |
| `PATCH /api/entity/:kycRef/exception/:num/resolve` | Mark exception resolved |
| `GET /api/neo4j/entity/:kycId/graph` | Entity + neighbors graph |
| `POST /api/neo4j/expand` | Expand node by elementId |
| `POST /api/chat` | Claude SSE streaming chat with tool use |

## AI Chat Tools (server.js `/api/chat`)

Five tools available to the Claude assistant:
- `get_entity` — fetch single entity by KYC ref
- `list_entities` — list all entities (status/risk filters)
- `get_exceptions` — get exceptions for an entity
- `search_entities` — search by name
- `query_graph` — run Cypher against Neo4j

## Key Workflows

1. **Dashboard** → open/overdue cases, AI-recommended actions
2. **Work Queue** → browse entities by DRG group, filter, select for review
3. **Exception Review** → view flag + narrative + evidence; resolve via QA / escalation / outreach / submit
4. **Agent Dispatch** → run async agents, poll steps, view artifacts
5. **Ownership Graph** → explore entity relationships via Neo4j visualization

## Environment Variables

See `.env.example`. Key vars:
- `ANTHROPIC_API_KEY` — Claude API
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — Supabase backend
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase frontend
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` — Neo4j
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` — Zoom
- `AWS_AGENT_BASE_URL` — AWS ELB for agent invocations

## Dev Commands

```bash
npm run start   # Vite (8080) + Express (3001) concurrently
npm run dev     # Vite only
npm run server  # Express only
npm run build   # Production build
npm run deploy  # Deploy to GitHub Pages
```

## CSS / Styling Note

Tailwind is compiled into `dist/assets/index-*.css`. If the UI looks unstyled, check that file is ~96 kB. A ~0.3 kB file means `index.css` was clobbered. The Tailwind config (`tailwind.config.ts`) defines custom colors: `alert`, `warning`, `success`, and `risk-rating` variants.

## Deployment

- **Frontend**: GitHub Pages (`npm run deploy`)
- **Backend**: Railway (`Procfile`: `web: npm run server`)

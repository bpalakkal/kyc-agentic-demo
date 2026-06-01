/**
 * KYC Platform — Express proxy server
 *
 * Responsibilities
 * ────────────────
 * 1. Zoom meeting creation  (server-to-server OAuth — credentials stay secret)
 * 2. AWS agent runtime proxy (HTTP ELB behind HTTPS Railway → avoids mixed-
 *    content errors and CORS issues when the browser is on HTTPS GitHub Pages)
 *
 * Environment variables (set in .env locally, Railway dashboard in production)
 * ─────────────────────────────────────────────────────────────────────────────
 * ZOOM_ACCOUNT_ID      Zoom Server-to-Server OAuth account ID
 * ZOOM_CLIENT_ID       Zoom OAuth client ID
 * ZOOM_CLIENT_SECRET   Zoom OAuth client secret
 * AWS_AGENT_BASE       Base URL of the AWS agent ELB (defaults to the current ELB)
 * PORT                 HTTP port (defaults to 3001)
 *
 * Production deployment
 * ──────────────────────
 * Hosted on Railway via `Procfile` (web: npm run server).
 * The frontend reads VITE_AGENT_API_BASE (injected at GitHub Actions build time)
 * to know where to send requests.  That variable must equal this Railway URL.
 *
 * TODO (production hardening)
 * ─────────────────────────────
 * - Restrict CORS origin to the GitHub Pages domain instead of "*"
 * - Add request authentication (API key header or JWT) so the proxy cannot be
 *   called by arbitrary clients
 * - Add rate limiting (express-rate-limit) to prevent abuse
 * - Stream agent-step responses rather than buffering (EventSource / SSE)
 */

import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

// Lazy Anthropic client — created on first use so the server starts even when
// ANTHROPIC_API_KEY is absent, and so Railway env vars are guaranteed loaded.
let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Add it in the Railway Variables dashboard.");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// Load .env manually so the server has zero extra dependencies in production.
// Railway and other platforms inject env vars directly, so this is a no-op there.
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(resolve(__dir, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {
  // .env not present — rely on shell / platform environment variables
}

const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;

// ─── Supabase ─────────────────────────────────────────────────────────────────
// Import lazily so the server starts even when Supabase creds are absent.
let sbModule = null;
async function getSb() {
  if (!sbModule) sbModule = await import('./src/db/supabase.js');
  return sbModule;
}

// ─── Neo4j ────────────────────────────────────────────────────────────────────
// Import lazily so the server starts even when Neo4j creds are absent.
let neo4jModule = null;
async function getNeo4j() {
  if (!neo4jModule) neo4jModule = await import('./src/db/neo4j.js');
  return neo4jModule;
}

const app = express();

const ALLOWED_ORIGINS = [
  "https://bpalakkal.github.io",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3002",
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server requests (no Origin header) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json());

// ─── Zoom ─────────────────────────────────────────────────────────────────────

async function getZoomToken() {
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("Zoom credentials missing. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.");
  }
  const creds = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    { method: "POST", headers: { Authorization: `Basic ${creds}` } }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(data.reason ?? "Token fetch failed");
  return data.access_token;
}

app.post("/api/zoom/create-meeting", async (req, res) => {
  try {
    const { topic, agenda, start_time, duration } = req.body ?? {};
    if (typeof topic !== "string" || !topic.trim()) return res.status(400).json({ error: "topic is required" });
    if (typeof start_time !== "string" || !start_time.trim()) return res.status(400).json({ error: "start_time is required" });
    const durationInt = parseInt(duration, 10);
    if (!Number.isFinite(durationInt) || durationInt < 15 || durationInt > 480) return res.status(400).json({ error: "duration must be 15–480 minutes" });

    const token = await getZoomToken();

    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time,
        duration: durationInt,
        agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true,
          auto_recording: "none",
        },
      }),
    });

    const meeting = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: meeting.message ?? "Zoom API error" });
    }

    res.json({
      id: meeting.id,
      join_url: meeting.join_url,
      start_url: meeting.start_url,
      password: meeting.password,
      topic: meeting.topic,
      start_time: meeting.start_time,
      duration: meeting.duration,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AWS agent runtime proxy ──────────────────────────────────────────────────
// The ELB runs on plain HTTP.  This proxy lets the HTTPS browser reach it
// without mixed-content blocks or CORS rejections.
//
// TODO: if the ELB is ever put behind HTTPS + a domain, this proxy can be
// removed and the frontend can call the ELB directly.

const AWS_AGENT_BASE =
  process.env.AWS_AGENT_BASE ??
  "http://gs-forge-agentic-runtime-lb-1873180191.us-east-1.elb.amazonaws.com";

// Fetches a URL and always returns { ok, status, data } — never throws and
// never forwards raw HTML error pages to the browser.
// timeoutMs defaults to 25 s so we always respond before Railway's 30 s stream
// idle timeout, avoiding "Stream idle timeout - partial response received".
async function proxyFetch(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let status = 502;
  try {
    const upstream = await fetch(url, { ...options, signal: controller.signal });
    status = upstream.status;
    const text = await upstream.text();
    clearTimeout(timer);
    console.log(`[agent-proxy] ${options.method ?? "GET"} ${url} → ${status} (${text.length} chars)`);
    try {
      return { ok: upstream.ok, status, data: JSON.parse(text) };
    } catch {
      // Upstream returned non-JSON (e.g. HTML 404/502 from the load balancer)
      const preview = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      console.error(`[agent-proxy] Non-JSON body from ${url}: ${preview}`);
      return { ok: false, status, data: { error: `Upstream returned non-JSON (HTTP ${status})`, preview } };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      console.error(`[agent-proxy] Timeout (${timeoutMs}ms) fetching ${url}`);
      return { ok: false, status: 504, data: { error: `Upstream timed out after ${timeoutMs / 1000}s — the agent is still running, keep polling` } };
    }
    console.error(`[agent-proxy] Network error fetching ${url}: ${err.message}`);
    return { ok: false, status, data: { error: `Network error: ${err.message}` } };
  }
}

// Invoke an agent.  Body is forwarded as-is from the frontend, including
// { async: true } when the frontend uses asyncMode.
app.post("/api/agent/:slug", async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/invoke/${req.params.slug}`;
  console.log(`[agent-proxy] Invoking agent: ${url}`, req.body);
  const { status, data } = await proxyFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body ?? {}),
  });
  res.status(status).json(data);
});

// Agent thinking steps — polled every 2 s by the frontend while a run is live.
app.get("/api/agent-steps/:runId", async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/execution-logs/${req.params.runId}/agent-steps`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

// Run status — polled alongside agent-steps to detect completion / failure.
app.get("/api/agent-run/:runId", async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/runs/${req.params.runId}`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

// ─── Supabase API endpoints ───────────────────────────────────────────────────

// GET /api/entities — work queue list
app.get('/api/entities', async (_req, res) => {
  try {
    const { getEntities } = await getSb();
    res.json(await getEntities());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef — single entity row
app.get('/api/entity/:kycRef', async (req, res) => {
  try {
    const { getEntity } = await getSb();
    res.json(await getEntity(req.params.kycRef));
  } catch (err) {
    const status = err.message?.includes('No rows') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/snapshot — latest Forge JSON snapshot
app.get('/api/entity/:kycRef/snapshot', async (req, res) => {
  try {
    const { getLatestSnapshot } = await getSb();
    const snap = await getLatestSnapshot(req.params.kycRef);
    if (!snap) return res.status(404).json({ error: 'No snapshot found' });
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entity/:kycRef/snapshot — save a new Forge JSON snapshot
// Body: { data: <Forge JSON object>, agentId?: string, runId?: string }
app.post('/api/entity/:kycRef/snapshot', async (req, res) => {
  const { data, agentId, runId } = req.body ?? {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'body.data (object) is required' });
  }
  try {
    const { saveSnapshot } = await getSb();
    const row = await saveSnapshot(req.params.kycRef, data, { agentId, runId });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/exceptions — all exceptions for an entity
app.get('/api/entity/:kycRef/exceptions', async (req, res) => {
  try {
    const { getExceptions } = await getSb();
    res.json(await getExceptions(req.params.kycRef));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/entity/:kycRef/exception/:num/resolve — mark exception resolved
// Body: { resolutionOption?: number, resolution?: string, resolvedBy?: string }
app.patch('/api/entity/:kycRef/exception/:num/resolve', async (req, res) => {
  const num = parseInt(req.params.num, 10);
  if (!Number.isFinite(num)) return res.status(400).json({ error: 'num must be an integer' });
  try {
    const { resolveException } = await getSb();
    const row = await resolveException(req.params.kycRef, num, req.body ?? {});
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Neo4j API endpoints ──────────────────────────────────────────────────────

// GET /api/neo4j/entity/:kycId/graph — Cytoscape-ready graph for a single entity
// Only returns Entity and Person neighbours (filters out Exception/Attribute/Action noise).
app.get('/api/neo4j/entity/:kycId/graph', async (req, res) => {
  try {
    const { runGraphQuery } = await getNeo4j();
    const graph = await runGraphQuery(
      `MATCH (center:Entity { caseId: $kycId })
       OPTIONAL MATCH (center)-[r]-(neighbor)
       WHERE neighbor:Entity OR neighbor:Person
       RETURN center, r, neighbor`,
      { kycId: req.params.kycId }
    );
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/neo4j/expand — expand a node by its internal elementId
// Body: { elementId: string }
app.post('/api/neo4j/expand', async (req, res) => {
  const { elementId } = req.body ?? {};
  if (!elementId) return res.status(400).json({ error: 'elementId is required' });
  try {
    const { runGraphQuery } = await getNeo4j();
    const graph = await runGraphQuery(
      `MATCH (center) WHERE elementId(center) = $elementId
       OPTIONAL MATCH (center)-[r]-(neighbor)
       WHERE neighbor:Entity OR neighbor:Person
       RETURN center, r, neighbor`,
      { elementId }
    );
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Chat (Claude + Tool Use + SSE streaming) ──────────────────────────────

const KYC_TOOLS = [
  {
    name: "get_entity",
    description: "Get full details for a single entity by KYC reference (e.g. KYC-30214). Returns entity row including risk rating, status, jurisdiction, DRG, and due date.",
    input_schema: {
      type: "object",
      properties: { kyc_ref: { type: "string", description: "KYC reference, e.g. KYC-30214" } },
      required: ["kyc_ref"],
    },
  },
  {
    name: "list_entities",
    description: "List entities in the work queue. Can filter by risk_rating or priority. Returns up to `limit` rows (default 15).",
    input_schema: {
      type: "object",
      properties: {
        risk_rating: { type: "string", enum: ["High", "Medium", "Low"] },
        priority:    { type: "string", enum: ["High", "Medium", "Low"] },
        limit:       { type: "number" },
      },
    },
  },
  {
    name: "get_exceptions",
    description: "Get all open compliance exceptions for an entity, including exception type, status, and resolution details.",
    input_schema: {
      type: "object",
      properties: { kyc_ref: { type: "string" } },
      required: ["kyc_ref"],
    },
  },
  {
    name: "search_entities",
    description: "Search for entities by partial name match.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Partial or full entity name" } },
      required: ["name"],
    },
  },
  {
    name: "query_graph",
    description: "Query the Neo4j ownership / relationship graph for an entity. Returns nodes (Entity, Person) and their relationships (beneficial ownership, directorships, etc.).",
    input_schema: {
      type: "object",
      properties: { kyc_id: { type: "string", description: "Entity caseId in Neo4j — same format as KYC ref, e.g. KYC-30214" } },
      required: ["kyc_id"],
    },
  },
];

async function executeTool(name, input) {
  try {
    if (name === "get_entity") {
      const { getEntities } = await getSb();
      const all = await getEntities();
      const entity = all.find(e => e.kyc_ref === input.kyc_ref);
      return entity ?? { error: `No entity found with kyc_ref: ${input.kyc_ref}` };
    }
    if (name === "list_entities") {
      const { getEntities } = await getSb();
      let rows = await getEntities();
      if (input.risk_rating) rows = rows.filter(e => e.risk_rating === input.risk_rating);
      if (input.priority)    rows = rows.filter(e => e.priority    === input.priority);
      return rows.slice(0, input.limit ?? 15);
    }
    if (name === "get_exceptions") {
      const { getExceptions } = await getSb();
      return await getExceptions(input.kyc_ref);
    }
    if (name === "search_entities") {
      const { getEntities } = await getSb();
      const q = input.name.toLowerCase();
      const rows = await getEntities();
      return rows.filter(e => (e.entity_name ?? "").toLowerCase().includes(q)).slice(0, 10);
    }
    if (name === "query_graph") {
      const { runGraphQuery } = await getNeo4j();
      return await runGraphQuery(
        `MATCH (center:Entity { caseId: $kycId })
         OPTIONAL MATCH (center)-[r]-(neighbor)
         WHERE neighbor:Entity OR neighbor:Person
         RETURN center, r, neighbor`,
        { kycId: input.kyc_id }
      );
    }
    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    return { error: err.message };
  }
}

// POST /api/chat — streaming KYC assistant backed by Claude + live DB tools.
// Streams SSE events: { type:"text"|"tool_call"|"done"|"error", ... }
app.post("/api/chat", async (req, res) => {
  const { messages = [], entityContext } = req.body ?? {};

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Railway/Nginx response buffering

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const systemPrompt = `You are an AI analyst embedded in a KYC compliance platform with real-time access to entity data, exceptions, and an ownership graph.

${entityContext?.name ? `The analyst currently has **${entityContext.name}${entityContext.kyc ? ` (${entityContext.kyc})` : ""}** open.` : ""}

Always use tools to retrieve live data before answering. Then respond with analysis — never dump raw fields or lists.

**Response format rules:**
- Entity summaries: exactly 2 short paragraphs. First: status snapshot — bold the **risk rating**, **jurisdiction**, **status**, and **due date**. Second: compliance posture — open exceptions, what they mean, and the single most important next action.
- Graph summaries: exactly 2 short paragraphs. First: ownership structure in plain English — who owns what, key percentages if available. Second: risk signals — circular ownership, multiple directorships, offshore entities, or anything that warrants scrutiny. If the graph is clean, say so in one sentence.
- Work queue / list answers: a 2–3 sentence summary of patterns (e.g. "7 of 15 high-risk cases are overdue, concentrated in Jersey and BVI jurisdictions"), then a short bulleted list of the top items with **name** and one key fact each.
- Always bold the most critical fact in every response.
- Never output raw JSON, field dumps, or exhaustive lists.`;

  // Convert chat history to Anthropic message format
  const anthropicMessages = messages.map(m => ({ role: m.role, content: m.text }));

  try {
    let continueLoop = true;
    let currentMessages = [...anthropicMessages];

    while (continueLoop) {
      const stream = await getAnthropic().messages.stream({
        model:      "claude-sonnet-4-6",
        max_tokens: 1024,
        system:     systemPrompt,
        tools:      KYC_TOOLS,
        messages:   currentMessages,
      });

      const assistantContent = [];
      let currentTool = null;
      let inputBuffer  = "";

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "text") {
            assistantContent.push({ type: "text", text: "" });
          } else if (event.content_block.type === "tool_use") {
            currentTool = { type: "tool_use", id: event.content_block.id, name: event.content_block.name, input: {} };
            inputBuffer = "";
            assistantContent.push(currentTool);
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const last = assistantContent[assistantContent.length - 1];
            if (last?.type === "text") last.text += event.delta.text;
            send({ type: "text", content: event.delta.text });
          } else if (event.delta.type === "input_json_delta") {
            inputBuffer += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop" && currentTool) {
          try { currentTool.input = JSON.parse(inputBuffer); } catch { /* partial */ }
          currentTool = null;
          inputBuffer = "";
        }
      }

      const finalMsg = await stream.finalMessage();

      if (finalMsg.stop_reason === "tool_use") {
        currentMessages.push({ role: "assistant", content: assistantContent });

        const toolResults = [];
        for (const block of assistantContent.filter(b => b.type === "tool_use")) {
          send({ type: "tool_call", name: block.name });
          const result = await executeTool(block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
        currentMessages.push({ role: "user", content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    send({ type: "done" });
    res.end();
  } catch (err) {
    console.error("[chat]", err.message);
    send({ type: "error", message: err.message });
    res.end();
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () =>
  console.log(`\n✓ KYC proxy server running → http://localhost:${PORT}\n`)
);

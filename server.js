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
  "http://localhost:3001",
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

// GET /api/neo4j/entities — fetch all KYC entities from Neo4j
// TODO: replace GENERATED_WORK_ROWS with this in production
app.get("/api/neo4j/entities", async (_req, res) => {
  try {
    const { runQuery } = await getNeo4j();
    const rows = await runQuery(
      `MATCH (e:Entity)
       RETURN e.kycId        AS kycId,
              e.name         AS name,
              e.riskRating   AS riskRating,
              e.jurisdiction AS jurisdiction,
              e.drgName      AS drgName,
              e.entityType   AS entityType,
              e.dueDate      AS dueDate,
              e.openExceptions AS openExceptions
       ORDER BY e.kycId`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/neo4j/entity/:kycId — fetch a single entity with its exceptions
app.get("/api/neo4j/entity/:kycId", async (req, res) => {
  try {
    const { runQuery } = await getNeo4j();
    const [entity] = await runQuery(
      `MATCH (e:Entity { kycId: $kycId })
       OPTIONAL MATCH (e)-[:HAS_EXCEPTION]->(exc:Exception)
       RETURN e, collect(exc) AS exceptions`,
      { kycId: req.params.kycId }
    );
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/neo4j/drg/:drgName — fetch all entities belonging to a DRG
app.get("/api/neo4j/drg/:drgName", async (req, res) => {
  try {
    const { runQuery } = await getNeo4j();
    const rows = await runQuery(
      `MATCH (e:Entity { drgName: $drgName })
       RETURN e.kycId AS kycId, e.name AS name, e.riskRating AS riskRating
       ORDER BY e.kycId`,
      { drgName: req.params.drgName }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/neo4j/entity/:kycId/graph — Cytoscape-ready graph for a single entity
app.get('/api/neo4j/entity/:kycId/graph', async (req, res) => {
  try {
    const { runGraphQuery } = await getNeo4j();
    const graph = await runGraphQuery(
      `MATCH (center:Entity { caseId: $kycId })
       OPTIONAL MATCH (center)-[r]-(neighbor)
       RETURN center, r, neighbor`,
      { kycId: req.params.kycId }
    );
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/neo4j/query — run an arbitrary read-only Cypher query (dev/admin use)
app.post("/api/neo4j/query", async (req, res) => {
  const { cypher, params } = req.body ?? {};
  if (!cypher) return res.status(400).json({ error: "cypher is required" });
  try {
    const { runQuery } = await getNeo4j();
    const rows = await runQuery(cypher, params ?? {});
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () =>
  console.log(`\n✓ KYC proxy server running → http://localhost:${PORT}\n`)
);

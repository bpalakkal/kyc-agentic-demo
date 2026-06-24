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

// ISO timestamp for structured startup logs.
const ts = () => new Date().toISOString();

// Races a promise against a timeout so DB operations never hang indefinitely.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// Load .env manually so the server has zero extra dependencies in production.
// Railway and other platforms inject env vars directly, so this is a no-op there.
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(resolve(__dir, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {
  // .env not present — rely on shell / platform environment variables
}

// C2: Never disable TLS in production — prevents an accidental NODE_TLS_REJECT_UNAUTHORIZED=0
// in .env from reaching Railway. Local dev keeps it via the .env file.
if (process.env.NODE_ENV === 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.warn(`[${new Date().toISOString()}] ⚠ NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production — unsetting`);
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
}

const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;

// ─── Auth middleware (C3) ─────────────────────────────────────────────────────
// Validates the Supabase JWT sent by the browser.  Applied to all data routes.
// The /api/health and /api/zoom/* routes are the only public exceptions.
async function requireAuth(req, res, next) {
  if (!sbAvailable) return res.status(503).json({ error: 'Auth service unavailable' });
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = header.slice(7);
  try {
    const { data: { user }, error } = await sbModule.sb.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth verification failed' });
  }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────
let sbModule = null;
let sbAvailable = false;

function getSb() {
  if (!sbAvailable) throw new Error("Supabase unavailable — check SUPABASE_URL and SUPABASE_SERVICE_KEY in Railway Variables");
  return sbModule;
}

// ─── Neo4j ────────────────────────────────────────────────────────────────────
let neo4jModule = null;
let neo4jAvailable = false;

function getNeo4j() {
  if (!neo4jAvailable) throw new Error("Neo4j unavailable — check NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in Railway Variables");
  return neo4jModule;
}

const app = express();

// CORS_ORIGIN env var allows adding extra allowed origins at deploy time (comma-separated).
const ALLOWED_ORIGINS = [
  "https://bpalakkal.github.io",
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server requests (no Origin header) and whitelisted origins.
    if (!origin) return cb(null, true);
    // Localhost only allowed in development — never in production to prevent request forgery.
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) return cb(null, true);
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

// ── File MIME helpers (used by snapshot route) ────────────────────────────────
function isImage(filename) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filename ?? '');
}
function guessMime(filename) {
  if (/\.pdf$/i.test(filename))   return 'application/pdf';
  if (/\.docx$/i.test(filename))  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.xlsx$/i.test(filename))  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (isImage(filename))          return 'image/png';
  return 'application/octet-stream';
}

// Invoke an agent.  Body is forwarded as-is from the frontend, including
// { async: true } when the frontend uses asyncMode.
app.post("/api/agent/:slug", requireAuth, async (req, res) => {
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
app.get("/api/agent-steps/:runId", requireAuth, async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/execution-logs/${req.params.runId}/agent-steps`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

// Run status — polled alongside agent-steps to detect completion / failure.
app.get("/api/agent-run/:runId", requireAuth, async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/runs/${req.params.runId}`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

// Artifacts list for a completed run.
app.get("/api/agent-artifacts/:runId", requireAuth, async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/runs/${req.params.runId}/artifacts`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

// Binary artifact download — streams file content back to the browser.
// ?path= must be the relative downloadUrl returned by the artifacts endpoint.
app.get("/api/artifact-download", requireAuth, async (req, res) => {
  const artifactPath = req.query.path;
  if (!artifactPath || typeof artifactPath !== "string") {
    return res.status(400).json({ error: "path query param is required" });
  }
  // C4: Validate path to prevent SSRF — must look like /artifacts/<safe-segments>
  if (!/^\/artifacts\/[A-Za-z0-9_\-\/\.]+$/.test(artifactPath)) {
    return res.status(400).json({ error: "Invalid artifact path" });
  }
  const url = `${AWS_AGENT_BASE}${artifactPath}`;
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(30000) });
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    const cd = upstream.headers.get("content-disposition");
    if (cd) res.setHeader("content-disposition", cd);
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─── Supabase API endpoints ───────────────────────────────────────────────────

// GET /api/entities — work queue list
app.get('/api/entities', requireAuth, async (_req, res) => {
  try {
    const { getEntities } = getSb();
    res.json(await getEntities());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef — single entity row
app.get('/api/entity/:kycRef', requireAuth, async (req, res) => {
  try {
    const { getEntity } = getSb();
    res.json(await getEntity(req.params.kycRef));
  } catch (err) {
    const status = err.message?.includes('No rows') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/snapshot — latest Forge JSON snapshot
app.get('/api/entity/:kycRef/snapshot', requireAuth, async (req, res) => {
  try {
    const { getLatestSnapshot } = getSb();
    const snap = await getLatestSnapshot(req.params.kycRef);
    if (!snap) return res.status(404).json({ error: 'No snapshot found' });
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entity/:kycRef/snapshot — save a new Forge JSON snapshot
// Body: { data: <Forge JSON object>, agentId?: string, runId?: string }
// When runId is provided (autonomous agent run), also creates/updates the agent_runs
// record and processes any artifact files from the AWS ELB.
app.post('/api/entity/:kycRef/snapshot', requireAuth, async (req, res) => {
  const { data, agentId, runId } = req.body ?? {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'body.data (object) is required' });
  }
  try {
    const sbMod = getSb();
    const row   = await sbMod.saveSnapshot(req.params.kycRef, data, { agentId, runId });

    // When the frontend signals completion of an autonomous run (runId = AWS runId),
    // create/update agent_runs and harvest any artifact files. Non-fatal on failure.
    if (runId) {
      setImmediate(async () => {
        try {
          // Upsert agent_runs so re-saves are idempotent.
          let agentRunId;
          const { data: existing } = await sbMod.sb
            .from('agent_runs')
            .select('id')
            .eq('external_run_id', runId)
            .maybeSingle();

          if (existing) {
            agentRunId = existing.id;
            await sbMod.updateAgentRun(agentRunId, { status: 'complete' });
          } else {
            const ar = await sbMod.createAgentRun({
              kycRef:      req.params.kycRef,
              agentSlug:   agentId ?? 'autonomous',
              runnerType:  'autonomous',
              initiatedBy: req.user.id,
            });
            agentRunId = ar.id;
            await sbMod.updateAgentRun(agentRunId, { status: 'complete', externalRunId: runId });
          }

          // Fetch artifact list from AWS and store files.
          const artifactsResp = await proxyFetch(`${AWS_AGENT_BASE}/api/runs/${runId}/artifacts`, {}, 20000);
          if (artifactsResp.ok) {
            const artifacts = artifactsResp.data?.artifacts ?? artifactsResp.data ?? [];
            const fileList  = Array.isArray(artifacts) ? artifacts : [];
            const fileMeta  = fileList
              .filter(a => a.downloadUrl && a.filename)
              .map(a => ({
                filename:     a.filename,
                mimeType:     a.mimeType ?? guessMime(a.filename),
                fileCategory: isImage(a.filename) ? 'screenshot' : 'document',
                title:        a.name ?? a.filename,
                artifactPath: a.downloadUrl,
                sourceUrl:    a.sourceUrl ?? null,
              }));

            if (fileMeta.length > 0) {
              const { FilePublisher } = await import('./agents/publishers/FilePublisher.js');
              const pub = new FilePublisher(sbMod.sb);
              await pub.publish(req.params.kycRef, agentRunId, fileMeta, req.user.id);
              console.log(`[snapshot] Stored ${fileMeta.length} artifact(s) for ${req.params.kycRef}`);
            }
          }
        } catch (err) {
          console.error(`[snapshot] agent_runs / file pipeline failed: ${err.message}`);
        }
      });
    }

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/attributes — extracted attribute rows from latest snapshot
// Query: ?group=core|wgq  (optional filter)
app.get('/api/entity/:kycRef/attributes', requireAuth, async (req, res) => {
  try {
    const { getAttributes } = getSb();
    const group = ['core', 'wgq'].includes(req.query.group) ? req.query.group : undefined;
    res.json(await getAttributes(req.params.kycRef, { group }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/attributes/trace/:attrName — full lineage for one attribute
app.get('/api/entity/:kycRef/attributes/trace/:attrName', requireAuth, async (req, res) => {
  try {
    const { getAttributeTrace } = getSb();
    const result = await getAttributeTrace(req.params.kycRef, req.params.attrName);
    if (!result) return res.status(404).json({ error: 'Attribute not found in latest snapshot' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/persons — person records from latest snapshot grouped by role
app.get('/api/entity/:kycRef/persons', requireAuth, async (req, res) => {
  try {
    const { getPersons } = getSb();
    res.json(await getPersons(req.params.kycRef));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entity/:kycRef/exceptions — all exceptions for an entity
app.get('/api/entity/:kycRef/exceptions', requireAuth, async (req, res) => {
  try {
    const { getExceptions } = getSb();
    res.json(await getExceptions(req.params.kycRef));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/entity/:kycRef/exception/:num/resolve — mark exception resolved
// Body: { resolutionOption?: number, resolution?: string }
app.patch('/api/entity/:kycRef/exception/:num/resolve', requireAuth, async (req, res) => {
  const num = parseInt(req.params.num, 10);
  if (!Number.isFinite(num)) return res.status(400).json({ error: 'num must be an integer' });
  try {
    const { resolveException } = getSb();
    // C5: resolvedBy always comes from the verified JWT identity, never from the request body
    const resolvedBy = req.user.email ?? req.user.id;
    const row = await resolveException(req.params.kycRef, num, { ...req.body, resolvedBy });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent runs ───────────────────────────────────────────────────────────────

// GET /api/entity/:kycRef/runs — list persisted agent runs for an entity
app.get('/api/entity/:kycRef/runs', requireAuth, async (req, res) => {
  try {
    const { getAgentRuns } = getSb();
    res.json(await getAgentRuns(req.params.kycRef));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API runner async preview/commit infrastructure ──────────────────────────
// In-memory stores for the two-phase preview → commit flow.
// NOTE: These Maps are process-local. A Railway restart clears them; any run
// whose output was stored here will be stuck in 'pending_review' in the DB.
// The 30-minute expiry timer (started on execution completion) handles the DB
// cleanup for the normal expiry case.
const apiRunnerSteps  = new Map(); // runId → string[]
const apiRunnerOutput = new Map(); // runId → { output, kycRef, initiatedBy }

async function loadRunnerClass(slug) {
  const runners = await import('./agents/runners/api/index.js');
  const map = {
    'companies-house':  runners.CompaniesHouseRunner,
    'fca':              runners.FCARunner,
    'uk-sourcing-flow': runners.UKSourcingFlowRunner,
  };
  return map[slug] ?? null;
}

// POST /api/agent-run/api/:slug — start an API runner in the background.
// Returns { runId, status: 'running' } immediately; frontend polls for progress.
app.post('/api/agent-run/api/:slug', requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { kycRef, entityName } = req.body ?? {};
  if (!kycRef)     return res.status(400).json({ error: 'kycRef is required' });
  if (!entityName) return res.status(400).json({ error: 'entityName is required' });

  let RunnerClass;
  try {
    RunnerClass = await loadRunnerClass(slug);
  } catch (e) {
    return res.status(503).json({ error: `Runner modules unavailable: ${e.message}` });
  }
  if (!RunnerClass) return res.status(404).json({ error: `No API runner registered for slug "${slug}"` });

  // Capture user id before responding (req may not be safe to read after res.json)
  const initiatedBy = req.user.id;

  try {
    const runner = new RunnerClass(getSb().sb);
    const steps  = [];

    // startPreview awaits only the DB row creation, then returns immediately.
    const { runId, executionPromise } = await runner.startPreview(
      { kycRef, entityName, initiatedBy },
      { onStep: (msg) => steps.push(msg) },
    );

    apiRunnerSteps.set(runId, steps);
    res.json({ runId, status: 'running' });

    // Background completion: store output for the commit step.
    // Start the 30-minute expiry timer from COMPLETION (not from run start),
    // so the user has the full window for review after the agent finishes.
    executionPromise
      .then(({ output }) => {
        apiRunnerOutput.set(runId, { output, kycRef, initiatedBy });
        steps.push('✓ Ready for review');
        // Expire the pending output 30 minutes after it becomes available
        setTimeout(async () => {
          if (apiRunnerOutput.has(runId)) {
            apiRunnerOutput.delete(runId);
            apiRunnerSteps.delete(runId);
            await getSb().sb.from('agent_runs')
              .update({ status: 'cancelled', completed_at: new Date().toISOString() })
              .eq('id', runId)
              .catch(() => {});
          }
        }, 30 * 60 * 1000);
      })
      .catch((err) => {
        console.error(`[api-runner] ${slug} preview failed: ${err.message}`);
        steps.push(`⚠ ${err.message}`);
      });
  } catch (err) {
    console.error(`[api-runner] ${slug} failed to start: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent-run-api-steps/:runId — live step log for a running API runner.
// Returns [] when the run isn't in the in-memory Map (e.g. after a server restart);
// the status endpoint (DB-backed) is the authoritative completion signal.
app.get('/api/agent-run-api-steps/:runId', requireAuth, (req, res) => {
  const steps = apiRunnerSteps.get(req.params.runId) ?? [];
  res.json({ steps });
});

// GET /api/agent-run-api-status/:runId — status from agent_runs table (not AWS ELB).
// If a run is still 'running' but has no in-memory Map entry (server restart mid-run),
// mark it failed so the frontend doesn't wait forever.
app.get('/api/agent-run-api-status/:runId', requireAuth, async (req, res) => {
  try {
    const { sb } = getSb();
    const { data, error } = await sb
      .from('agent_runs')
      .select('id, status, kyc_ref, agent_slug, error, completed_at')
      .eq('id', req.params.runId)
      .single();
    if (error) return res.status(404).json({ error: error.message });

    // Detect orphaned run: status is 'running' but the process that started it is gone.
    if (data.status === 'running' && !apiRunnerSteps.has(req.params.runId)) {
      await sb.from('agent_runs')
        .update({ status: 'failed', error: 'Server restarted while run was in progress' })
        .eq('id', req.params.runId)
        .catch(() => {});
      return res.json({ ...data, status: 'failed', error: 'Server restarted while run was in progress' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent-run-api/:runId/diff — new vs current attributes for review modal
app.get('/api/agent-run-api/:runId/diff', requireAuth, async (req, res) => {
  const pending = apiRunnerOutput.get(req.params.runId);
  if (!pending) return res.status(404).json({ error: 'No pending preview for this run — it may have expired' });

  try {
    const { getAttributes } = getSb();
    const currentAttributes = await getAttributes(pending.kycRef);
    res.json({
      kycRef:            pending.kycRef,
      agentSlug:         pending.output.agentSlug,
      newAttributes:     pending.output.attributes ?? [],
      currentAttributes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent-run-api/:runId/commit — publish approved attributes, mark complete
// Body: { approvedNames?: string[] }  — omit/null to accept all; empty array commits nothing
app.post('/api/agent-run-api/:runId/commit', requireAuth, async (req, res) => {
  // Delete from Map before committing to prevent concurrent double-commits.
  // A racing second request will see null and get 404.
  const pending = apiRunnerOutput.get(req.params.runId);
  if (!pending) return res.status(404).json({ error: 'No pending preview for this run — it may have expired' });
  apiRunnerOutput.delete(req.params.runId);

  const { approvedNames } = req.body ?? {};

  try {
    const RunnerClass = await loadRunnerClass(pending.output.agentSlug).catch(() => null);
    if (!RunnerClass) return res.status(404).json({ error: `Runner not found for slug "${pending.output.agentSlug}"` });

    // null/undefined → commit all; array (even empty) → filter to exactly those names
    const output = (approvedNames == null)
      ? pending.output
      : { ...pending.output, attributes: pending.output.attributes?.filter(a => approvedNames.includes(a.attributeName)) ?? [] };

    const runner = new RunnerClass(getSb().sb);
    const result = await runner.commit(req.params.runId, pending.kycRef, output, pending.initiatedBy);

    apiRunnerSteps.delete(req.params.runId);
    res.json(result);
  } catch (err) {
    // Re-store on failure so the user can retry
    apiRunnerOutput.set(req.params.runId, pending);
    console.error(`[api-runner] commit failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agent-run-api/:runId — cancel a pending review
app.delete('/api/agent-run-api/:runId', requireAuth, async (req, res) => {
  try {
    const { sb } = getSb();
    await sb.from('agent_runs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', req.params.runId);
    apiRunnerOutput.delete(req.params.runId);
    apiRunnerSteps.delete(req.params.runId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent-run/async/:slug — start an autonomous AWS agent and persist the run
// Body: { kycRef: string, entityName: string }
// Returns: { agentRunId, externalRunId } — frontend continues to poll externalRunId as before
app.post('/api/agent-run/async/:slug', requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { kycRef, entityName } = req.body ?? {};
  if (!kycRef)     return res.status(400).json({ error: 'kycRef is required' });
  if (!entityName) return res.status(400).json({ error: 'entityName is required' });

  let autonomousRunners;
  try {
    autonomousRunners = await import('./agents/runners/autonomous/index.js');
  } catch (e) {
    return res.status(503).json({ error: `Autonomous runner modules unavailable: ${e.message}` });
  }

  const RunnerMap = {
    'uk-parent-flow':                        autonomousRunners.UKParentFlowRunner,
    'uk-companies-house':                    autonomousRunners.CHRunner,
    'uk-jersey-financial-services-commission': autonomousRunners.JerseyRunner,
  };

  const RunnerClass = RunnerMap[slug];
  if (!RunnerClass) {
    return res.status(404).json({ error: `No autonomous runner registered for slug "${slug}"` });
  }

  try {
    const runner = new RunnerClass(getSb().sb);
    const result = await runner.invoke({ kycRef, entityName, initiatedBy: req.user.id });
    // Include runId so the frontend polling code (which reads d.runId) picks up externalRunId
    res.json({ ...result, runId: result.externalRunId });
  } catch (err) {
    console.error(`[async-runner] ${slug} failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── Case files ───────────────────────────────────────────────────────────────

// GET /api/entity/:kycRef/files — list all case files for an entity
// Query: ?category=document|screenshot  (optional)
app.get('/api/entity/:kycRef/files', requireAuth, async (req, res) => {
  try {
    const { getEntityFiles } = getSb();
    const category = ['document', 'screenshot'].includes(req.query.category)
      ? req.query.category : undefined;
    res.json(await getEntityFiles(req.params.kycRef, { category }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file/:fileId/url — get a short-lived signed URL for a private file
// Query: ?expiresIn=3600  (optional, seconds)
app.get('/api/file/:fileId/url', requireAuth, async (req, res) => {
  const sbMod = getSb();
  try {
    const { data: file, error: fetchErr } = await sbMod.sb
      .from('case_files')
      .select('storage_path, filename, mime_type')
      .eq('id', req.params.fileId)
      .single();
    if (fetchErr || !file) return res.status(404).json({ error: 'File not found' });

    const expiresIn = Math.min(parseInt(req.query.expiresIn, 10) || 3600, 86400);
    const { getSignedFileUrl } = sbMod;
    const url = await getSignedFileUrl(file.storage_path, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    res.json({ url, expiresAt, filename: file.filename, mimeType: file.mime_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/file/:fileId — delete a file from storage and DB
app.delete('/api/file/:fileId', requireAuth, async (req, res) => {
  try {
    const { deleteFile } = getSb();
    await deleteFile(req.params.fileId);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Neo4j API endpoints ──────────────────────────────────────────────────────

// GET /api/neo4j/entity/:kycId/graph — Cytoscape-ready graph for a single entity
// Only returns Entity and Person neighbours (filters out Exception/Attribute/Action noise).
app.get('/api/neo4j/entity/:kycId/graph', requireAuth, async (req, res) => {
  try {
    const { runGraphQuery } = getNeo4j();
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
app.post('/api/neo4j/expand', requireAuth, async (req, res) => {
  const { elementId } = req.body ?? {};
  if (!elementId) return res.status(400).json({ error: 'elementId is required' });
  try {
    const { runGraphQuery } = getNeo4j();
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
      const { getEntity } = getSb();
      try {
        return await getEntity(input.kyc_ref);
      } catch {
        return { error: `No entity found with kyc_ref: ${input.kyc_ref}` };
      }
    }
    if (name === "list_entities") {
      const { getEntities } = getSb();
      return await getEntities({
        riskRating: input.risk_rating,
        priority:   input.priority,
        limit:      input.limit ?? 15,
      });
    }
    if (name === "get_exceptions") {
      const { getExceptions } = getSb();
      return await getExceptions(input.kyc_ref);
    }
    if (name === "search_entities") {
      const { searchEntities } = getSb();
      return await searchEntities(input.name);
    }
    if (name === "query_graph") {
      const { runGraphQuery } = getNeo4j();
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
app.post("/api/chat", requireAuth, async (req, res) => {
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
    let toolCallIterations = 0;
    let currentMessages = [...anthropicMessages];

    while (continueLoop) {
      if (++toolCallIterations > 10) {
        send({ type: "error", message: "Tool call loop limit reached" });
        break;
      }
      const stream = await getAnthropic().messages.stream({
        model:      "claude-sonnet-4-6",
        max_tokens: 4096,
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
app.get("/api/health", async (_req, res) => {
  const checks = {};

  if (!sbAvailable) {
    checks.supabase = "unavailable";
  } else {
    try {
      await withTimeout(sbModule.sb.from("entities").select("kyc_ref").limit(1), 5000, "Supabase health");
      checks.supabase = "ok";
    } catch (err) {
      checks.supabase = `error: ${err.message}`;
    }
  }

  if (!neo4jAvailable) {
    checks.neo4j = "unavailable";
  } else {
    try {
      await withTimeout(neo4jModule.runQuery("RETURN 1 AS ok", {}), 5000, "Neo4j health");
      checks.neo4j = "ok";
    } catch (err) {
      checks.neo4j = `error: ${err.message}`;
    }
  }

  // Supabase is required; Neo4j is optional (graph feature only)
  const ok = checks.supabase === "ok";
  // Only expose details when HEALTH_SECRET is configured AND the caller provides it.
  // If HEALTH_SECRET is unset, all callers get the minimal { ok } response.
  const secret = process.env.HEALTH_SECRET;
  const detailed = !!secret && req.headers['x-health-token'] === secret;
  res.status(ok ? 200 : 503).json(detailed ? { ok, ...checks } : { ok });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;

(async () => {
  console.log(`[${ts()}] Starting KYC proxy server...`);

  // Log which credential groups are present so Railway deployment logs are informative
  const envCheck = {
    ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL:       process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    NEO4J_URI:          process.env.NEO4J_URI,
    ZOOM_ACCOUNT_ID:    process.env.ZOOM_ACCOUNT_ID,
    AWS_AGENT_BASE:     process.env.AWS_AGENT_BASE,
  };
  for (const [k, v] of Object.entries(envCheck)) {
    console.log(`[${ts()}] ${v ? "✓" : "✗"} ${k}${v ? "" : " — MISSING"}`);
  }

  // ── Supabase ──────────────────────────────────────────────────────────────
  try {
    // supabase.js throws at module level when creds are missing — caught here
    sbModule = await withTimeout(import("./src/db/supabase.js"), 10000, "Supabase import");
    // Verify we can actually reach the database before marking available
    await withTimeout(sbModule.sb.from("entities").select("kyc_ref").limit(1), 10000, "Supabase probe");
    sbAvailable = true;
    console.log(`[${ts()}] ✓ Supabase connected`);
  } catch (err) {
    console.error(`[${ts()}] ✗ Supabase unavailable: ${err.message}`);
    console.error(`[${ts()}]   Supabase routes will return 503 until credentials are fixed`);
  }

  // ── Neo4j (optional) ──────────────────────────────────────────────────────
  const neo4jUri = process.env.NEO4J_URI;
  if (!neo4jUri || neo4jUri.includes("localhost")) {
    console.warn(`[${ts()}] ✗ NEO4J_URI not configured — graph queries disabled`);
  } else {
    try {
      neo4jModule = await withTimeout(import("./src/db/neo4j.js"), 10000, "Neo4j import");
      await withTimeout(neo4jModule.runQuery("RETURN 1 AS ok", {}), 10000, "Neo4j probe");
      neo4jAvailable = true;
      console.log(`[${ts()}] ✓ Neo4j connected`);
    } catch (err) {
      console.error(`[${ts()}] ✗ Neo4j unavailable: ${err.message}`);
      console.error(`[${ts()}]   Graph routes will return 503 until credentials are fixed`);
    }
  }

  app.listen(PORT, () =>
    console.log(`[${ts()}] ✓ KYC proxy server listening → http://localhost:${PORT}`)
  );
})();

import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manually (no dotenv dependency needed)
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(resolve(__dir, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {
  // .env not present — rely on shell environment variables
}

const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

async function getZoomToken() {
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("Zoom credentials missing. Check your .env file.");
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
    const token = await getZoomToken();
    const { topic, agenda, start_time, duration } = req.body;

    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time,
        duration: parseInt(duration, 10),
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

// ── AWS Agent Runtime proxy ─────────────────────────────────────────────────
// The AWS ELB runs on plain HTTP; this proxy lets the browser (HTTPS in prod,
// HTTP in dev) call it without mixed-content or CORS issues.
const AWS_AGENT_BASE =
  process.env.AWS_AGENT_BASE ??
  "http://gs-forge-agentic-runtime-lb-1873180191.us-east-1.elb.amazonaws.com";

// Helper: fetch a URL and always return { ok, status, data } — never throws,
// never returns raw HTML to the browser.
async function proxyFetch(url, options = {}) {
  let status = 502;
  try {
    const upstream = await fetch(url, options);
    status = upstream.status;
    const text = await upstream.text();
    console.log(`[agent-proxy] ${options.method ?? "GET"} ${url} → ${status} (${text.length} chars)`);
    try {
      return { ok: upstream.ok, status, data: JSON.parse(text) };
    } catch {
      // Upstream returned non-JSON (e.g. HTML 404/502 page from load balancer)
      const preview = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      console.error(`[agent-proxy] Non-JSON body from ${url}: ${preview}`);
      return { ok: false, status, data: { error: `Upstream returned non-JSON (HTTP ${status})`, preview } };
    }
  } catch (err) {
    console.error(`[agent-proxy] Network error fetching ${url}: ${err.message}`);
    return { ok: false, status, data: { error: `Network error: ${err.message}` } };
  }
}

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

app.get("/api/agent-steps/:runId", async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/execution-logs/${req.params.runId}/agent-steps`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

app.get("/api/agent-run/:runId", async (req, res) => {
  const url = `${AWS_AGENT_BASE}/api/runs/${req.params.runId}`;
  const { status, data } = await proxyFetch(url);
  res.status(status).json(data);
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () =>
  console.log(`\n✓ Zoom proxy server running → http://localhost:${PORT}\n`)
);

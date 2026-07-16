/**
 * AgentSystem — KYC Agent Orchestration Layer
 *
 * Architecture overview
 * ─────────────────────
 * This file owns every agent-related concern: registry, API wiring, state
 * management, polling, step parsing, and UI (recommendation strip + dock).
 *
 * Key concepts
 * ────────────
 * AGENTS            Catalogue of all known agents (simulated + live).
 *                   Each entry provides the display name, icon, and default
 *                   "thought" strings used while the real API warms up.
 *
 * AGENT_API_CONFIGS Per-agent real API config (slug, request body builder,
 *                   async mode flag).  Only agents with an entry here hit a
 *                   live endpoint; all others run in simulation mode.
 *                   → To wire a new agent: add an AgentId value and an entry
 *                     in AGENT_API_CONFIGS.  No other changes required.
 *
 * AgentProvider     React context that holds all run state and exposes
 *                   runAgents() to any child component.
 *
 * runAgents()       Core orchestration function.
 *                   1. Creates AgentRun records (pending/running/done).
 *                   2. For each live agent: POSTs to /api/agent-run/api/:slug.
 *                   3. Receives { runId, status: "running" } immediately.
 *                   4. Starts startApiRunnerPolling(runId) — polls every 2 s:
 *                        a. GET /api/agent-run-api-steps/:runId → live step strings
 *                        b. GET /api/agent-run-api-status/:runId → DB status
 *                   5. On pending_review, opens AttributeDiffModal for analyst review.
 *                   6. On accept, publishes to DB and marks done.
 *
 * All live agents use the apiRunner two-phase preview/commit flow.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  Bot, Sparkles, ChevronDown, ChevronUp, X, Loader2, CheckCircle2, Play, Search,
  ShieldCheck, FileCheck2, Database, Mail, Scale, UserCheck, Globe, Brain, Zap, Minus, Building2,
  Network, Landmark, FileText, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { AttributeDiffModal, type PendingDiff } from "@/components/kyc/AttributeDiffModal";

// ─── Agent registry ──────────────────────────────────────────────────────────
// Add a new AgentId value and a corresponding entry in AGENTS[] to introduce
// any new agent.  If the agent has a live API, also add it to AGENT_API_CONFIGS.

export type AgentId =
  | "identity" | "document" | "regulatory" | "audit" | "outreach"
  | "sanctions" | "pep" | "adverse-media" | "beneficial-owner" | "risk-scoring"
  | "companies-house" | "jersey-fsc" | "fca" | "uk-sourcing-flow"
  | "gleif" | "sec" | "iapd" | "nyse" | "us-sourcing-flow"
  | "dd-all-in-one"
  | "ria-authorized-signatory-idv" | "ria-beneficial-owner-idv"
  | "ria-cip-classification-id" | "ria-commodities-indicator-id"
  | "ria-corporate-officer-idv" | "ria-entity-name-idv"
  | "ria-evidence-of-existence-idv" | "ria-government-identification-idv"
  | "ria-legal-structure-idv" | "ria-parent-publicly-listed-id"
  | "ria-principal-business-address-idv" | "ria-proxy-bo-idv"
  | "ria-registered-address-idv" | "ria-regulator-idv"
  | "ria-securities-exchange-act-id" | "ria-sole-proprietorship-id"
  | "ria-source-of-wealth-idv" | "ria-transacting-funds-id";

export type Agent = {
  id: AgentId;
  name: string;
  short: string;
  description: string;
  icon: typeof Bot;
  defaultThoughts: string[];
};

export const AGENTS: Agent[] = [
  { id: "identity", name: "Identity Verification Agent", short: "Identity", icon: UserCheck,
    description: "Cross-references identifiers (TIN, LEI, contact data) across entity records.",
    defaultThoughts: ["Loading entity identifier set…", "Matching TIN 13-3439889 across 4 records", "Confidence threshold met — passing to downstream agents"] },
  { id: "document", name: "Document Intelligence Agent", short: "Documents", icon: FileCheck2,
    description: "Parses charters, ADV filings, and signatory blocks to extract attributes.",
    defaultThoughts: ["Fetching Fund Charter (Pg. 3) and Form ADV (Pg. 12)", "Running OCR + layout parser on signatory block", "Extracted: title, date, signature presence"] },
  { id: "regulatory", name: "Regulatory Compliance Agent", short: "Regulatory", icon: Scale,
    description: "Maps findings to FATF, FinCEN, FCA and local AML guidance.",
    defaultThoughts: ["Loading FATF Recommendation 10 §6.2", "Evaluating title-variation exemption", "No regulatory breach detected"] },
  { id: "sanctions", name: "Sanctions Screening Agent", short: "Sanctions", icon: ShieldCheck,
    description: "Screens parties against OFAC, EU, UN, HMT consolidated lists.",
    defaultThoughts: ["Querying OFAC SDN, EU CFSP, UN 1267", "0 hits across 4 parties", "Last list refresh: 2h ago"] },
  { id: "pep", name: "PEP Screening Agent", short: "PEP", icon: UserCheck,
    description: "Identifies Politically Exposed Persons via Dow Jones / WorldCheck.",
    defaultThoughts: ["Screening 4 principals against WorldCheck", "1 match: L. Fink — declared", "No undisclosed PEP exposure"] },
  { id: "adverse-media", name: "Adverse Media Agent", short: "Adverse Media", icon: Globe,
    description: "Scans global news sources for negative coverage of entities/principals.",
    defaultThoughts: ["Crawling 14k news sources (12mo window)", "Filtering: financial crime, fraud, sanctions", "3 articles flagged for review"] },
  { id: "beneficial-owner", name: "Beneficial Ownership Agent", short: "UBO", icon: Database,
    description: "Builds the 25%+ ownership tree and identifies ultimate beneficial owners.",
    defaultThoughts: ["Resolving ownership graph at 25% threshold", "Traversed 3 layers — 2 UBOs identified", "All UBOs have valid ID documents on file"] },
  { id: "risk-scoring", name: "Risk Scoring Agent", short: "Risk Score", icon: Brain,
    description: "Aggregates signals into a composite KYC risk score.",
    defaultThoughts: ["Aggregating 12 signals from upstream agents", "Composite score: 62 (Elevated)", "No tier escalation triggered"] },
  { id: "outreach", name: "Client Outreach Agent", short: "Outreach", icon: Mail,
    description: "Drafts and routes clarification requests to the relationship manager.",
    defaultThoughts: ["Loading template TITLE_CLARIFICATION_v3", "Routing to RM: J. Mendes", "Pending client response — SLA 5d"] },
  { id: "audit", name: "Audit Trail Agent", short: "Audit", icon: ShieldCheck,
    description: "Writes decisions, sources, and evidence pointers to the immutable log.",
    defaultThoughts: ["Hashing decision payload (SHA-256)", "Committing to evidence locker", "Audit entry #A-29104 written"] },
  { id: "companies-house", name: "UK Companies House", short: "Co. House", icon: Building2,
    description: "Queries the CH REST API directly — incorporation, filing status, officers, PSCs, and document download.",
    defaultThoughts: ["Searching Companies House…", "Fetching company details, officers, PSCs…", "Downloading incorporation documents…", "Digitizing documents with Claude…"] },
  { id: "jersey-fsc", name: "Jersey FSC", short: "JFSC", icon: Landmark,
    description: "Sources data from the Jersey Financial Services Commission registry via the Claude SDK.",
    defaultThoughts: ["Connecting to JFSC registry…", "Searching entity name…", "Awaiting API response…"] },
  { id: "fca", name: "FCA Register", short: "FCA", icon: Scale,
    description: "Sources regulatory data from the UK Financial Conduct Authority register.",
    defaultThoughts: ["Connecting to FCA register…", "Searching entity name…", "Awaiting API response…"] },
  { id: "uk-sourcing-flow", name: "UK Data Sourcing — All Sources", short: "UK All", icon: Database,
    description: "Triggers FCA Register and Companies House in parallel — merges both sources with full multi-lineage tracking.",
    defaultThoughts: ["Querying FCA Register…", "Querying Companies House directly…", "Merging attributes across 2 sources…"] },
  { id: "gleif", name: "GLEIF — Global LEI", short: "GLEIF", icon: Globe,
    description: "Looks up the Legal Entity Identifier (LEI) via the GLEIF open API — legal name, jurisdiction, addresses, and LEI status.",
    defaultThoughts: ["Searching GLEIF by legal name…", "Fetching LEI record…", "Extracting LEI attributes…"] },
  { id: "sec", name: "SEC EDGAR", short: "SEC", icon: FileText,
    description: "Searches SEC EDGAR for CIK, entity type, SIC code, EIN, tickers, and incorporation state via the EDGAR submissions API.",
    defaultThoughts: ["Searching EDGAR for entity name…", "Fetching submissions record…", "Extracting SEC attributes…"] },
  { id: "iapd", name: "IAPD — Investment Adviser", short: "IAPD", icon: Scale,
    description: "Queries IAPD/Form ADV for registered investment advisers — CRD number, registration status, AUM, and principal office.",
    defaultThoughts: ["Searching IAPD for firm name…", "Fetching Form ADV data…", "Extracting adviser attributes…"] },
  { id: "nyse", name: "NYSE Listing", short: "NYSE", icon: BarChart2,
    description: "Checks NYSE/NASDAQ listing status via the NYSE quotes filter API — ticker symbol, exchange, and listing status.",
    defaultThoughts: ["Searching NYSE/NASDAQ listings…", "Checking listing status…", "Extracting ticker attributes…"] },
  { id: "us-sourcing-flow", name: "US Data Sourcing — All Sources", short: "US All", icon: Database,
    description: "Triggers GLEIF, SEC EDGAR, IAPD, and NYSE in parallel — merges all four sources with priority ordering.",
    defaultThoughts: ["Querying GLEIF, SEC EDGAR, IAPD, and NYSE in parallel…", "Merging attributes across 4 sources…", "Ready for review"] },
  // ── DD agents (Claude-based, all via /api/agent-run/api/:slug) ──────────────
  { id: "dd-all-in-one", name: "Full DD Review (All-in-One)", short: "DD All", icon: Brain,
    description: "Runs all 18 DD checks in a single Claude call — entity name, legal structure, addresses, BO, officers, signatories, CIP, indicators, and more.",
    defaultThoughts: ["Building entity context from database…", "Running full DD analysis with Claude…", "Reviewing all 18 attribute groups…", "Ready for review"] },
  { id: "ria-entity-name-idv", name: "Entity Name IDV", short: "Name IDV", icon: FileCheck2,
    description: "Verifies the legal entity name against sourced records and flags discrepancies.",
    defaultThoughts: ["Loading entity name lineage…", "Comparing across sources…", "Generating name verification result…"] },
  { id: "ria-legal-structure-idv", name: "Legal Structure IDV", short: "Legal Structure", icon: Scale,
    description: "Identifies and verifies the legal structure (LLC, LP, Corp, etc.) and CIP classification.",
    defaultThoughts: ["Reviewing legal structure lineage…", "Applying CIP classification rules…", "Writing result…"] },
  { id: "ria-evidence-of-existence-idv", name: "Evidence of Existence IDV", short: "Existence", icon: FileCheck2,
    description: "Confirms documentary evidence of formation — certificates, registrations, SEC filings.",
    defaultThoughts: ["Checking evidence of existence documents…", "Validating against registration data…", "Writing verification result…"] },
  { id: "ria-registered-address-idv", name: "Registered Address IDV", short: "Reg. Address", icon: Landmark,
    description: "Verifies the registered address against official filings and registry records.",
    defaultThoughts: ["Comparing registered address across sources…", "Checking for address conflicts…", "Writing result…"] },
  { id: "ria-principal-business-address-idv", name: "Principal Business Address IDV", short: "Principal Address", icon: Landmark,
    description: "Verifies the principal place of business address.",
    defaultThoughts: ["Checking principal address lineage…", "Cross-referencing regulatory filings…", "Writing result…"] },
  { id: "ria-regulator-idv", name: "Regulator IDV", short: "Regulator", icon: Scale,
    description: "Confirms the primary regulator (SEC, FCA, CFTC, etc.) from regulatory registry data.",
    defaultThoughts: ["Identifying regulatory body from filings…", "Validating regulator against registry…", "Writing result…"] },
  { id: "ria-government-identification-idv", name: "Government Identification IDV", short: "Govt ID", icon: ShieldCheck,
    description: "Verifies government-issued identifiers (EIN, CRD, CIK, FRN) for the entity.",
    defaultThoughts: ["Checking government identifiers…", "Validating EIN / CRD / CIK / FRN…", "Writing result…"] },
  { id: "ria-cip-classification-id", name: "CIP Classification", short: "CIP", icon: UserCheck,
    description: "Applies FinCEN CIP rules to classify the entity type and confirm the correct KYC program applies.",
    defaultThoughts: ["Loading CIP classification rules…", "Applying entity type classification…", "Writing CIP determination…"] },
  { id: "ria-beneficial-owner-idv", name: "Beneficial Owner IDV", short: "BO IDV", icon: Database,
    description: "Identifies and verifies 25%+ beneficial owners per FinCEN CDD Rule.",
    defaultThoughts: ["Loading beneficial owner records…", "Verifying ownership ≥ 25% threshold…", "Writing BO verification result…"] },
  { id: "ria-proxy-bo-idv", name: "Proxy BO IDV", short: "Proxy BO", icon: Database,
    description: "Identifies and verifies control persons (proxy BOs) where direct ownership is below threshold.",
    defaultThoughts: ["Loading proxy BO records…", "Verifying control person status…", "Writing result…"] },
  { id: "ria-authorized-signatory-idv", name: "Authorized Signatory IDV", short: "Auth. Signatory", icon: UserCheck,
    description: "Verifies identity documents and authority of all authorized signatories.",
    defaultThoughts: ["Loading authorized signatory records…", "Verifying signatory identity data…", "Writing result…"] },
  { id: "ria-corporate-officer-idv", name: "Corporate Officer IDV", short: "Officers", icon: UserCheck,
    description: "Verifies the identity and role of corporate officers (CEO, CFO, Directors).",
    defaultThoughts: ["Loading corporate officer records…", "Verifying officer identity data…", "Writing result…"] },
  { id: "ria-source-of-wealth-idv", name: "Source of Wealth IDV", short: "SOW", icon: BarChart2,
    description: "Evaluates and verifies the declared source of wealth for the entity.",
    defaultThoughts: ["Reviewing source of wealth declaration…", "Cross-checking with regulatory filings…", "Writing SOW verification…"] },
  { id: "ria-transacting-funds-id", name: "Transacting Funds", short: "Trans. Funds", icon: BarChart2,
    description: "Identifies and verifies the source of transacting funds.",
    defaultThoughts: ["Reviewing transacting funds information…", "Assessing fund source evidence…", "Writing result…"] },
  { id: "ria-parent-publicly-listed-id", name: "Parent Publicly Listed", short: "Parent Listed", icon: Network,
    description: "Determines whether the entity has a publicly listed parent and confirms exchange listing.",
    defaultThoughts: ["Checking parent company status…", "Verifying exchange listing…", "Writing result…"] },
  { id: "ria-sole-proprietorship-id", name: "Sole Proprietorship", short: "Sole Prop.", icon: UserCheck,
    description: "Determines and verifies sole proprietorship status where applicable.",
    defaultThoughts: ["Checking entity structure for sole proprietorship…", "Applying CIP rules…", "Writing result…"] },
  { id: "ria-commodities-indicator-id", name: "Commodities Indicator", short: "Commodities", icon: BarChart2,
    description: "Determines whether the entity is registered with the CFTC or trades commodities.",
    defaultThoughts: ["Checking CFTC registration status…", "Reviewing commodities trading indicators…", "Writing result…"] },
  { id: "ria-securities-exchange-act-id", name: "Securities Exchange Act", short: "SEA §13/15d", icon: Scale,
    description: "Determines whether the entity is subject to SEC reporting obligations under Exchange Act §13 or §15d.",
    defaultThoughts: ["Checking SEC reporting obligations…", "Reviewing Exchange Act indicators…", "Writing result…"] },
];

const AGENTS_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, Agent>;

// ─── Recommended bundles ─────────────────────────────────────────────────────
// One bundle per route.  The strip picks the matching route; falls back to
// the last entry.  TODO: drive this from a backend config (per-user, per-case).
export const RECOMMENDED_BUNDLES: { route: string; label: string; reason: string; agents: AgentId[] }[] = [
  { route: "/work-queue/review", label: "Full UK Data Sourcing", reason: "Recommended · FCA + Companies House in one run",
    agents: ["uk-sourcing-flow"] },
  { route: "/work-queue", label: "Bulk Triage Selected Cases", reason: "Best for UK-registered entities in queue",
    agents: ["uk-sourcing-flow"] },
  { route: "/", label: "Daily KYC Refresh", reason: "Recommended each morning · full UK entity sourcing",
    agents: ["uk-sourcing-flow"] },
];

// ─── Agent categories (structured dropdown sections) ─────────────────────────
type AgentCategoryDef = {
  id: string;
  label: string;
  triggerAllId?: AgentId;   // agent invoked by "Trigger All" button for this section
  agentIds: AgentId[];      // individual agents shown inside the section
};

const AGENT_CATEGORIES: AgentCategoryDef[] = [
  {
    id: "uk-sourcing",
    label: "UK Data Sourcing",
    triggerAllId: "uk-sourcing-flow",
    agentIds: ["fca", "companies-house", "jersey-fsc"],
  },
  {
    id: "us-sourcing",
    label: "US Data Sourcing",
    triggerAllId: "us-sourcing-flow",
    agentIds: ["gleif", "sec", "iapd", "nyse"],
  },
  {
    id: "screening",
    label: "Screening",
    agentIds: ["sanctions", "pep", "adverse-media"],
  },
  {
    id: "due-diligence",
    label: "Due Diligence",
    triggerAllId: "dd-all-in-one",
    agentIds: [
      "ria-entity-name-idv", "ria-legal-structure-idv", "ria-evidence-of-existence-idv",
      "ria-registered-address-idv", "ria-principal-business-address-idv", "ria-regulator-idv",
      "ria-government-identification-idv", "ria-cip-classification-id",
      "ria-beneficial-owner-idv", "ria-proxy-bo-idv", "ria-authorized-signatory-idv",
      "ria-corporate-officer-idv", "ria-source-of-wealth-idv", "ria-transacting-funds-id",
      "ria-parent-publicly-listed-id", "ria-sole-proprietorship-id",
      "ria-commodities-indicator-id", "ria-securities-exchange-act-id",
    ],
  },
];

// VITE_AGENT_API_BASE is injected at build time from GitHub Secrets / Railway env.
// Locally it falls back to the Express server default port.
export const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE ?? "http://localhost:3001";

// EntityCtx is set by ExceptionReview when an entity is open, giving
// Live Data Source agents the entity name to search for.
type EntityCtx = { name: string; kyc?: string };

// ─── Live agent API configs ───────────────────────────────────────────────────
// Add an entry here to wire an agent to a real endpoint.
// slug        → matches POST /api/invoke/<slug> on the AWS runtime
// buildBody   → builds the request body from the current entity context
// asyncMode   → true: POST returns {runId} immediately; poll for completion
//               false: POST blocks until done (avoid for long-running flows)
// fetchSteps  → whether to poll for live step updates
// apiRunner   → true: uses /api/agent-run-api-* polling endpoints (not AWS ELB)
//               These runners return steps as plain strings and reach
//               'pending_review' status before prompting the user to commit.
type AgentApiConfig = {
  slug: string;
  buildBody: (ctx: EntityCtx | null) => Record<string, unknown>;
  fetchSteps: boolean;
  asyncMode?: boolean;
  apiRunner?: boolean;
  endpoint?: string;    // overrides /api/agent/:slug when set
  skipSnapshot?: boolean; // skip saveSnapshot (API runners publish directly)
};
const AGENT_API_CONFIGS: Partial<Record<AgentId, AgentApiConfig>> = {
  "companies-house": {
    slug: "companies-house",
    endpoint: "/api/agent-run/api/companies-house",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "jersey-fsc": {
    slug: "jersey-fsc",
    endpoint: "/api/agent-run/api/jersey-fsc",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "fca": {
    slug: "fca",
    endpoint: "/api/agent-run/api/fca",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "uk-sourcing-flow": {
    slug: "uk-sourcing-flow",
    endpoint: "/api/agent-run/api/uk-sourcing-flow",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "gleif": {
    slug: "gleif",
    endpoint: "/api/agent-run/api/gleif",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "sec": {
    slug: "sec",
    endpoint: "/api/agent-run/api/sec",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "iapd": {
    slug: "iapd",
    endpoint: "/api/agent-run/api/iapd",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "nyse": {
    slug: "nyse",
    endpoint: "/api/agent-run/api/nyse",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  "us-sourcing-flow": {
    slug: "us-sourcing-flow",
    endpoint: "/api/agent-run/api/us-sourcing-flow",
    buildBody: (ctx) => ({ entityName: ctx?.name ?? "", kycRef: ctx?.kyc ?? "" }),
    fetchSteps: true,
    asyncMode: true,
    apiRunner: true,
    skipSnapshot: true,
  },
  // ── DD agents ────────────────────────────────────────────────────────────────
  ...Object.fromEntries(
    [
      "dd-all-in-one",
      "ria-authorized-signatory-idv", "ria-beneficial-owner-idv",
      "ria-cip-classification-id", "ria-commodities-indicator-id",
      "ria-corporate-officer-idv", "ria-entity-name-idv",
      "ria-evidence-of-existence-idv", "ria-government-identification-idv",
      "ria-legal-structure-idv", "ria-parent-publicly-listed-id",
      "ria-principal-business-address-idv", "ria-proxy-bo-idv",
      "ria-registered-address-idv", "ria-regulator-idv",
      "ria-securities-exchange-act-id", "ria-sole-proprietorship-id",
      "ria-source-of-wealth-idv", "ria-transacting-funds-id",
    ].map((slug) => [slug, {
      slug,
      endpoint: `/api/agent-run/api/${slug}`,
      buildBody: (ctx: EntityCtx | null) => ({ kycRef: ctx?.kyc ?? "", entityName: ctx?.name ?? "" }),
      fetchSteps: true,
      asyncMode: true,
      apiRunner: true,
      skipSnapshot: true,
    }])
  ),
};

// ─── Step parsing ─────────────────────────────────────────────────────────────

// Detects whether an array is a list of agent-node objects (each containing
// agent_steps) rather than a flat list of step primitives.
function isNodeObjectArray(arr: unknown[]): boolean {
  if (arr.length === 0) return false;
  const first = arr[0];
  if (!first || typeof first !== "object") return false;
  return "node_alias" in (first as object) || ("agent_steps" in (first as object) && !("type" in (first as object)));
}

function flattenNodeObjects(nodes: unknown[]): unknown[] {
  return nodes.flatMap((node) => {
    if (!node || typeof node !== "object") return [];
    const n = node as Record<string, unknown>;
    const steps = Array.isArray(n.agent_steps) ? n.agent_steps : [];
    if (steps.length === 0) return [];
    return [
      { type: "node_header", label: String(n.node_alias ?? "agent"), execution_time_ms: n.execution_time_ms },
      ...steps,
    ];
  });
}

function extractRawSteps(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];

  // Plain array — could be node objects (with node_alias/agent_steps) or already-flat step objects
  if (Array.isArray(raw)) {
    return isNodeObjectArray(raw) ? flattenNodeObjects(raw) : (raw as unknown[]);
  }

  const d = raw as Record<string, unknown>;

  // {"value": [...], "Count": N} — AWS execution-logs format (wrapped or unwrapped node arrays)
  if (Array.isArray(d.value)) {
    return isNodeObjectArray(d.value) ? flattenNodeObjects(d.value) : (d.value as unknown[]);
  }

  // Fallback: keyed step arrays
  const flattenSteps = (nodes: unknown[]) =>
    nodes.flatMap((node) => {
      if (!node || typeof node !== "object") return [node];
      const n = node as Record<string, unknown>;
      if (Array.isArray(n.agent_steps)) return n.agent_steps;
      if (Array.isArray(n.steps)) return n.steps;
      if (Array.isArray(n.messages)) return n.messages;
      if (Array.isArray(n.content)) return n.content;
      return [node];
    });

  if (Array.isArray(d.steps)) return flattenSteps(d.steps);
  if (Array.isArray(d.agentSteps)) return flattenSteps(d.agentSteps);
  if (Array.isArray(d.agent_steps)) return flattenSteps(d.agent_steps);
  if (Array.isArray(d.events)) return flattenSteps(d.events);
  if (Array.isArray(d.messages)) return d.messages as unknown[];
  return [];
}

function extractText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v.map((c) => (typeof c === "object" && c !== null
      ? String((c as Record<string, unknown>).text ?? (c as Record<string, unknown>).content ?? JSON.stringify(c))
      : String(c))).join("\n");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.text ?? o.content ?? o.message ?? JSON.stringify(v));
  }
  return String(v ?? "");
}

function cleanReasoning(raw: string): string {
  const text = raw
    .replace(/#{1,6}\s*/g, "")              // ## headings
    .replace(/\*\*(.*?)\*\*/gs, "$1")       // **bold**
    .replace(/\*(.*?)\*/gs, "$1")           // *italic*
    .replace(/^---+$/gm, "")               // horizontal rules
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (text.length <= 280) return text;
  const cut = text.slice(0, 280);
  const dot = cut.lastIndexOf(".");
  return (dot > 100 ? cut.slice(0, dot + 1) : cut) + "…";
}

function buildThoughtsFromAgentSteps(steps: unknown[], apiData?: unknown): string[] {
  const thoughts: string[] = [];

  const processStep = (s: Record<string, unknown>) => {
    const type = String(s.type ?? s.role ?? "");

    if (type === "node_header") {
      const ms = s.execution_time_ms != null ? ` (${(Number(s.execution_time_ms) / 1000).toFixed(1)}s)` : "";
      thoughts.push(`📍 Node: ${String(s.label ?? "agent")}${ms}`);
      return;
    }

    // Nested content array (e.g. assistant message with multiple blocks)
    if (Array.isArray(s.content) && !["tool_result", "tool_use", "tool_call"].includes(type)) {
      for (const item of s.content) {
        if (item && typeof item === "object") processStep(item as Record<string, unknown>);
      }
      return;
    }

    if (type === "thinking" || type === "reasoning") {
      const raw = extractText(s.thinking ?? s.content ?? s.text).trim();
      if (raw) thoughts.push(`💭 ${cleanReasoning(raw)}`);
    } else if (type === "tool_use" || type === "tool_call") {
      const name = String(s.name ?? s.tool ?? "tool");
      const args = (s.input ?? s.args ?? {}) as Record<string, unknown>;

      // Internal plumbing — suppress entirely
      const SUPPRESSED = new Set([
        "get_current_project", "get_current_data_flow", "get_data_flow",
        "get_data_flow_description", "search_data_flows", "list_data_flows",
        "get_execution_results", "get_current_project_context",
        "get_filing_history_item", "get_document_metadata", "get_document_content",
      ]);
      if (SUPPRESSED.has(name)) return;
      if (name === "search_companies" && args.query) {
        thoughts.push(`🔍 Searching Companies House: ${String(args.query)}`);
        return;
      }
      if (name === "get_filing_history" && args.company_number) {
        const cat = args.category ? ` (${String(args.category)})` : "";
        thoughts.push(`📋 Retrieving filing history${cat} for ${String(args.company_number)}`);
        return;
      }
      if (name === "download_url" && (args.store_description ?? args.url)) {
        const label = String(args.store_description ?? args.url);
        thoughts.push(`💾 ${label.length > 100 ? label.slice(0, 100) + "…" : label}`);
        return;
      }
      if (name === "firecrawl_scrape" && args.url) {
        thoughts.push(`🌐 Scraping ${String(args.url)}`);
        return;
      }
      if ((name === "firecrawl_interact" || name === "firecrawl_click") && args.prompt) {
        const p = String(args.prompt);
        thoughts.push(`🖱 ${p.length > 120 ? p.slice(0, 120) + "…" : p}`);
        return;
      }
      if (name === "capture_screenshot" && args.context) {
        thoughts.push(`📸 ${String(args.context)}`);
        return;
      }
      if (name === "firecrawl_interact_stop") {
        thoughts.push(`✓ Browser session closed`);
        return;
      }

      // Remaining tools: show name + key args compactly
      const argStr = Object.keys(args).length ? JSON.stringify(args) : "";
      thoughts.push(`🔧 ${name}${argStr ? `  ${argStr}` : ""}`);
    } else if (type === "tool_result") {
      // Suppress raw tool results — they're verbose API dumps; reasoning steps already summarise them
    } else if (type === "text") {
      const text = extractText(s.text ?? s.content).trim();
      if (text) thoughts.push(`✓ ${text}`);
    } else if (type === "assistant" || type === "user") {
      const text = extractText(s.content ?? s.message).trim();
      if (text) thoughts.push(text);
    } else {
      // Unknown type — surface any readable content field
      const text = extractText(s.content ?? s.message ?? s.output ?? s.text).trim();
      if (text) thoughts.push(text);
    }
  };

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    processStep(step as Record<string, unknown>);
  }

  // Append result summary
  if (apiData && typeof apiData === "object") {
    const d = apiData as Record<string, unknown>;
    if (d.executionTime != null) thoughts.push(`⏱ Completed in ${d.executionTime}ms`);
    const results = d.results ?? d.output ?? d.data;
    if (results && typeof results === "object") {
      const entries = Object.entries(results as Record<string, unknown>)
        .filter(([, v]) => v != null && (typeof v === "string" || typeof v === "number"))
        .slice(0, 8);
      for (const [k, v] of entries) {
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        thoughts.push(`${label}: ${String(v)}`);
      }
    }
  }

  // If nothing was parsed, show a raw preview to help diagnose the format
  if (thoughts.length === 0 && steps.length > 0) {
    thoughts.push(`📦 Received ${steps.length} step(s) — raw preview:`);
    for (const step of steps.slice(0, 5)) {
      if (step && typeof step === "object") {
        thoughts.push(JSON.stringify(step).slice(0, 400));
      }
    }
  }

  return thoughts.length > 0 ? thoughts : ["✓ Agent completed — no structured steps returned"];
}

function buildThoughtsFromResult(data: unknown, agentId: AgentId): string[] {
  const agent = AGENTS_BY_ID[agentId];
  if (!data || typeof data !== "object") return [...agent.defaultThoughts, "✓ Run completed"];
  const d = data as Record<string, unknown>;
  const thoughts: string[] = [];
  if (d.executionTime != null) thoughts.push(`Completed in ${d.executionTime}ms`);
  if (d.status) thoughts.push(`Agent status: ${String(d.status)}`);

  const results = d.results ?? d.output ?? d.data;
  if (results && typeof results === "object") {
    const entries = Object.entries(results as Record<string, unknown>)
      .filter(([, v]) => v != null && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
      .slice(0, 6);
    for (const [k, v] of entries) {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      thoughts.push(`${label}: ${String(v)}`);
    }
  }
  if (d.runId) thoughts.push(`Run ID: ${String(d.runId)}`);
  if (thoughts.length < 2) thoughts.push("✓ Agent completed — no structured results returned");
  return thoughts;
}

// ─── State types ──────────────────────────────────────────────────────────────

type StepState = "pending" | "running" | "done";
type AgentRun = {
  id: string;
  agentId: AgentId;
  state: StepState;
  thoughts: string[];
  currentThought: number;
  startedAt: number;
  isReal?: boolean;
  result?: unknown;
};

// PendingDiff is defined in AttributeDiffModal to avoid a circular import.

type AgentContextValue = {
  runs: AgentRun[];
  isRunning: boolean;
  dockOpen: boolean;
  dockMinimized: boolean;
  setDockOpen: (v: boolean) => void;
  setDockMinimized: (v: boolean) => void;
  runAgents: (agentIds: AgentId[], label?: string) => void;
  clearRuns: () => void;
  currentLabel: string | null;
  entityContext: EntityCtx | null;
  setEntityContext: (ctx: EntityCtx | null) => void;
  qaReviewCallback: (() => void) | null;
  setQaReviewCallback: (fn: (() => void) | null) => void;
  pendingDiff: PendingDiff | null;
  setPendingDiff: (d: PendingDiff | null) => void;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export const useAgents = () => {
  const v = useContext(AgentContext);
  if (!v) throw new Error("useAgents must be used within AgentProvider");
  return v;
};

// ─── AgentProvider ────────────────────────────────────────────────────────────
// Wrap the application once (in AppLayout) to give all pages access to agent
// state.  Components consume it via useAgents().

export const AgentProvider = ({ children }: { children: ReactNode }) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockMinimized, setDockMinimized] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [entityContext, setEntityContext] = useState<EntityCtx | null>(null);
  const [qaReviewCallback, setQaReviewCallback] = useState<(() => void) | null>(null);
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  // Ref so runAgents (stable useCallback) always reads the latest entity context
  const entityContextRef = useRef<EntityCtx | null>(null);
  entityContextRef.current = entityContext;

  const isRunning = runs.some((r) => r.state !== "done");

  const runAgents = useCallback((agentIds: AgentId[], label?: string) => {
    const newRuns: AgentRun[] = agentIds.map((id, i) => {
      const hasReal = !!AGENT_API_CONFIGS[id];
      return {
        id: `${Date.now()}-${i}`,
        agentId: id,
        state: (hasReal || i === 0 ? "running" : "pending") as StepState,
        thoughts: hasReal
          ? ["Connecting to live API…"]
          : AGENTS_BY_ID[id].defaultThoughts,
        currentThought: 0,
        startedAt: Date.now(),
        isReal: hasReal,
      };
    });
    setRuns(newRuns);
    setCurrentLabel(label ?? "Custom Agent Run");
    setDockOpen(true);
    setDockMinimized(false);

    // Snapshot entity context at call time (ref is always current)
    const ctx = entityContextRef.current;

    newRuns.forEach(async (run) => {
      const cfg = AGENT_API_CONFIGS[run.agentId];
      if (!cfg) return;

      const kycRef = ctx?.kyc;

      // Fetch latest Forge snapshot to pass as current_data to the agent
      let currentData: unknown = null;
      if (kycRef) {
        try {
          const sr = await apiFetch(`${AGENT_API_BASE}/api/entity/${kycRef}/snapshot`);
          if (sr.ok) {
            const snap = await sr.json() as { data?: unknown };
            currentData = snap?.data ?? null;
          }
        } catch { /* non-fatal — agent runs without prior snapshot */ }
      }

      // M8: Save snapshot after agent completes; surface failures in the dock
      const saveSnapshot = async (data: unknown, runId?: string) => {
        if (!kycRef || data === null) return;
        try {
          const r = await apiFetch(`${AGENT_API_BASE}/api/entity/${kycRef}/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data, agentId: cfg.slug, runId: runId ?? null }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setRuns(prev => {
            const idx = prev.findIndex(r => r.id === run.id);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], thoughts: [...(next[idx].thoughts ?? []), `⚠ Snapshot save failed: ${msg}`] };
            return next;
          });
        }
      };

      const markDone = (thoughts: string[], result?: unknown) => {
        setRuns((prev) => {
          const idx = prev.findIndex((r) => r.id === run.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], state: "done", thoughts, currentThought: thoughts.length - 1, result };
          if (idx + 1 < next.length && next[idx + 1].state === "pending") {
            next[idx + 1] = { ...next[idx + 1], state: "running" };
          }
          return next;
        });
      };

      // Poll for API runner steps (plain string array) and status (from agent_runs table).
      // When status reaches 'pending_review', open the diff modal instead of marking done.
      const startApiRunnerPolling = (runId: string, kycRef: string, cancelled: { current: boolean }) => {
        let latestSteps: string[] = [];
        let polls = 0;
        const poll = async () => {
          if (cancelled.current) return;
          polls++;
          if (polls > 900) { markDone(["⚠ Agent run timed out after 30 minutes"]); return; }

          // Fetch plain-string steps and update dock thoughts live
          try {
            const sr = await apiFetch(`${AGENT_API_BASE}/api/agent-run-api-steps/${runId}`);
            const sd = await sr.json() as { steps: string[] };
            const steps = sd.steps ?? [];
            if (steps.length > latestSteps.length) {
              latestSteps = steps;
              if (!cancelled.current) {
                setRuns(prev => {
                  const idx = prev.findIndex(r => r.id === run.id);
                  if (idx === -1 || prev[idx].state !== "running") return prev;
                  const next = [...prev];
                  next[idx] = { ...next[idx], thoughts: steps, currentThought: steps.length - 1 };
                  return next;
                });
              }
            }
          } catch { /* non-fatal */ }

          // Check status from agent_runs table
          try {
            const rr = await apiFetch(`${AGENT_API_BASE}/api/agent-run-api-status/${runId}`);
            const rd = await rr.json() as Record<string, unknown>;
            const status = String(rd.status ?? "");

            if (status === "pending_review") {
              cancelled.current = true; // stop polling — modal takes over
              setPendingDiff({
                runId,
                kycRef,
                agentId: run.agentId,
                onCommit: (result) => {
                  const stats = (result as Record<string, unknown>)?.stats as Record<string, unknown> | undefined;
                  const parts: string[] = [];
                  if (Number(stats?.attrCount)  > 0) parts.push(`${stats!.attrCount} attrs`);
                  if (Number(stats?.excCount)   > 0) parts.push(`${stats!.excCount} exceptions`);
                  if (Number(stats?.fileStored) > 0) parts.push(`${stats!.fileStored} files`);
                  markDone(
                    [...latestSteps, `✓ Accepted — saved: ${parts.join(" · ") || "no data"}`],
                    result,
                  );
                  setPendingDiff(null);
                },
                onCancel: () => {
                  markDone([...latestSteps, "✗ Review cancelled — no changes saved"], null);
                  setPendingDiff(null);
                },
              });
              return;
            }

            if (["complete", "completed", "done"].includes(status)) {
              markDone([...latestSteps, "✓ Complete"], rd);
              return;
            }
            if (["failed", "error", "cancelled"].includes(status)) {
              markDone([...latestSteps, `⚠ Run ${status}: ${String(rd.error ?? "unknown error")}`], rd);
              return;
            }
          } catch { /* non-fatal */ }

          setTimeout(poll, 2000);
        };
        setTimeout(poll, 1500);
      };

      // H5: Track cancellation so polling stops if the component unmounts
      const cancelled = { current: false };

      apiFetch(`${AGENT_API_BASE}${cfg.endpoint ?? `/api/agent/${cfg.slug}`}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cfg.buildBody(ctx),
          ...(currentData ? { current_data: currentData } : {}),
          ...(cfg.asyncMode ? { async: true } : {}),
        }),
      })
        .then(async (r) => {
          const text = await r.text();
          try { return JSON.parse(text); }
          catch { throw new Error(`Server returned non-JSON (HTTP ${r.status}). Is the proxy running? (npm start)`); }
        })
        .then(async (data: unknown) => {
          if (cancelled.current) return;
          const d = data as Record<string, unknown>;
          const runId = d.runId ?? d.run_id ?? d.id;
          const status = String(d.status ?? "");

          // Proxy returned an error (e.g. upstream timeout or network error)
          if (!runId && (d.error || d.message)) {
            markDone([`⚠ ${String(d.error ?? d.message)}`]);
            return;
          }

          // Already complete (sync response or instant agent)
          if (!runId || !cfg.asyncMode || ["complete", "completed", "done"].includes(status)) {
            markDone(buildThoughtsFromResult(data, run.agentId), data);
            if (!cfg.skipSnapshot) await saveSnapshot(data, String(runId ?? ""));
            return;
          }

          // Async: start API runner polling
          const kycRef = ctx?.kyc ?? "";
          startApiRunnerPolling(String(runId), kycRef, cancelled);
        })
        .catch((err: Error) => {
          if (!cancelled.current) markDone([`⚠ API error: ${err.message}`]);
        });
    });
  }, []);

  const clearRuns = useCallback(() => setRuns([]), []);

  // Simulation ticker: advances currentThought every 900 ms for agents without a
  // live API config.  Real agents pause at the last thought and wait for the
  // fetch callback to call markDone() with the final thought list.
  useEffect(() => {
    if (runs.length === 0) return;
    const runningIdx = runs.findIndex((r) => r.state === "running");
    if (runningIdx === -1) return;
    const run = runs[runningIdx];
    // Real agents stop animation at last thought — fetch callback will mark them done
    if (run.isReal && run.currentThought >= run.thoughts.length - 1) return;
    const t = setTimeout(() => {
      setRuns((prev) => {
        const next = [...prev];
        const cur = { ...next[runningIdx] };
        if (cur.currentThought < cur.thoughts.length - 1) {
          cur.currentThought += 1;
          next[runningIdx] = cur;
        } else if (!cur.isReal) {
          cur.state = "done";
          next[runningIdx] = cur;
          if (runningIdx + 1 < next.length) {
            next[runningIdx + 1] = { ...next[runningIdx + 1], state: "running" };
          }
        }
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [runs]);

  const value = useMemo(() => ({
    runs, isRunning, dockOpen, dockMinimized, setDockOpen, setDockMinimized,
    runAgents, clearRuns, currentLabel, entityContext, setEntityContext,
    qaReviewCallback, setQaReviewCallback,
    pendingDiff, setPendingDiff,
  }), [runs, isRunning, dockOpen, dockMinimized, runAgents, clearRuns, currentLabel, entityContext, setEntityContext, qaReviewCallback, pendingDiff]);

  return (
    <AgentContext.Provider value={value}>
      {children}
      <AgentDock />
      <AgentDiffPortal />
    </AgentContext.Provider>
  );
};

// =========== Top recommendation strip ===========

export const AgentRecommendationStrip = ({ route }: { route: string }) => {
  const { runAgents, entityContext, qaReviewCallback } = useAgents();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<AgentId>>(new Set());

  const bundle = RECOMMENDED_BUNDLES.find((b) => b.route === route) ?? RECOMMENDED_BUNDLES[2];

  // Reset selection whenever the bundle changes (e.g. route navigation)
  useEffect(() => {
    setSelected(new Set());
  }, [bundle]);

  const toggle = (id: AgentId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runRecommended = () => runAgents(bundle.agents, bundle.label);
  const runCustom = () => {
    if (selected.size === 0) return;
    runAgents(Array.from(selected), `Custom Run (${selected.size} agents)`);
    setOpen(false);
  };

  return (
    <div className="border-b border-border bg-gradient-to-r from-info-soft/60 via-card to-card">
      <div className="px-6 py-2.5 flex items-center gap-3 max-w-[1480px] mx-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="size-6 rounded-md bg-primary/10 text-primary grid place-items-center">
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recommended Agents
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[13px] font-medium truncate">{bundle.label}</span>
          <span className="text-[11px] text-muted-foreground truncate hidden md:inline">· {bundle.reason}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runRecommended}
            className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-95"
          >
            <Zap className="size-3.5" /> Run Recommended
          </button>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card flex items-center gap-1.5 hover:bg-secondary"
            >
              Trigger <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-2 w-[360px] rounded-xl border border-border bg-card shadow-xl z-40 animate-fade-in">
                <div className="p-3 border-b border-border">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Trigger Agents</p>
                  <p className="text-[11px] text-muted-foreground">Select agents or trigger an entire section</p>
                </div>
                <div className="max-h-[480px] overflow-y-auto py-1">
                  {AGENT_CATEGORIES.map((cat, catIdx) => (
                    <div key={cat.id}>
                      {catIdx > 0 && <div className="h-px bg-border mx-3 my-1" />}
                      {/* Section header */}
                      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-primary inline-block" />
                          {cat.label}
                        </p>
                        {cat.triggerAllId && AGENT_API_CONFIGS[cat.triggerAllId] && (
                          <button
                            onClick={() => { runAgents([cat.triggerAllId!], `${cat.label} — All`); setOpen(false); }}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 transition-colors"
                          >
                            <Zap className="size-2.5" /> Trigger All
                          </button>
                        )}
                      </div>
                      {/* Empty section placeholder */}
                      {cat.agentIds.length === 0 && (
                        <p className="px-3 py-1.5 pb-2 text-[11px] text-muted-foreground/50 italic">Coming soon</p>
                      )}
                      {/* Individual agents */}
                      {cat.agentIds.map((id) => {
                        const a = AGENTS_BY_ID[id];
                        const Icon = a.icon;
                        const isSel = selected.has(id);
                        const isLive = !!AGENT_API_CONFIGS[id];
                        const isRec = bundle.agents.includes(id);
                        return (
                          <button
                            key={id}
                            onClick={() => isLive && toggle(id)}
                            className={cn(
                              "w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors",
                              isLive ? "hover:bg-secondary/60" : "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <span className={cn(
                              "size-4 rounded border flex items-center justify-center mt-0.5 shrink-0",
                              isSel ? "bg-primary border-primary" : "border-border"
                            )}>
                              {isSel && <CheckCircle2 className="size-3 text-primary-foreground" />}
                            </span>
                            <span className={cn(
                              "size-7 rounded-md grid place-items-center shrink-0",
                              isLive ? "bg-success-soft text-success border border-success-soft-border" : "bg-secondary text-muted-foreground"
                            )}>
                              <Icon className="size-3.5" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[12px] font-medium truncate">{a.short}</p>
                                {isRec && <span className="text-[9px] px-1 rounded bg-success-soft text-success border border-success-soft-border uppercase tracking-wide">Rec</span>}
                                {isLive && <span className="text-[9px] px-1 rounded bg-success-soft text-success border border-success-soft-border uppercase tracking-wide flex items-center gap-0.5"><span className="size-1 rounded-full bg-success inline-block" />Live</span>}
                                {!isLive && <span className="text-[9px] text-muted-foreground/50">Soon</span>}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug">{a.description}</p>
                              {isLive && !entityContext?.name && (
                                <p className="text-[10px] text-amber-500/80 mt-0.5">Open an entity to run live</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{selected.size} selected</span>
                  <button
                    onClick={runCustom}
                    disabled={selected.size === 0}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-95 disabled:opacity-40"
                  >
                    <Play className="size-3" /> Trigger Selected
                  </button>
                </div>
                {/* ── Quality Assurance ─────────────────────────── */}
                {qaReviewCallback && (
                  <div className="border-t border-border bg-secondary/30">
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary inline-block" />
                      Quality Assurance
                    </p>
                    <button
                      onClick={() => { qaReviewCallback(); setOpen(false); }}
                      className="w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors hover:bg-secondary/60"
                    >
                      <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium">QA Review</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">Review AI-suggested corrections and confirm analyst decisions</p>
                      </div>
                      <span className="text-[11px] text-primary font-medium shrink-0 mt-1">Open →</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========== Attribute Diff Modal Portal ===========
// Renders the diff review modal whenever an API runner reaches 'pending_review'.

const AgentDiffPortal = () => {
  const { pendingDiff } = useAgents();
  if (!pendingDiff) return null;
  return <AttributeDiffModal pending={pendingDiff} />;
};

// =========== Bottom-right Agent Console Dock ===========

const AgentDock = () => {
  const { runs, dockOpen, dockMinimized, setDockOpen, setDockMinimized, isRunning, currentLabel } = useAgents();

  if (!dockOpen || runs.length === 0) return null;

  const completed = runs.filter((r) => r.state === "done").length;
  const total = runs.length;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 w-[420px] rounded-xl border border-border bg-card shadow-2xl animate-fade-in overflow-hidden",
      dockMinimized && "w-[300px]"
    )}>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-info-soft/60 to-card">
        <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center relative shrink-0">
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {isRunning && <span className="absolute inset-0 rounded-md ring-2 ring-primary/30 animate-ping" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate">
            {isRunning ? "Agents Running" : "Agents Completed"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentLabel} · {completed}/{total} done
          </p>
        </div>
        <button onClick={() => setDockMinimized(!dockMinimized)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Minimize">
          {dockMinimized ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
        </button>
        <button onClick={() => setDockOpen(false)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      {!dockMinimized && (
        <>
          <div className="h-1 w-full bg-secondary">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
          <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
            {runs.map((r) => {
              const agent = AGENTS_BY_ID[r.agentId];
              const Icon = agent.icon;
              const visibleThoughts = r.thoughts.slice(0, r.state === "done" ? r.thoughts.length : r.currentThought + 1);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "rounded-lg border p-2.5 transition-all",
                    r.state === "running" && "border-primary bg-info-soft/40",
                    r.state === "done" && "border-success-soft-border bg-success-soft/20",
                    r.state === "pending" && "border-border bg-card opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "size-6 rounded-md grid place-items-center shrink-0",
                      r.state === "running" && "bg-primary/15 text-primary",
                      r.state === "done" && "bg-success-soft text-success",
                      r.state === "pending" && "bg-secondary text-muted-foreground",
                    )}>
                      {r.state === "running" ? <Loader2 className="size-3.5 animate-spin" /> :
                        r.state === "done" ? <CheckCircle2 className="size-3.5" /> :
                        <Icon className="size-3.5" />}
                    </span>
                    <p className="text-[12px] font-medium flex-1 truncate">{agent.name}</p>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium tracking-wide",
                      r.state === "running" && "bg-primary text-primary-foreground",
                      r.state === "done" && "bg-success-soft text-success border border-success-soft-border",
                      r.state === "pending" && "bg-secondary text-muted-foreground",
                    )}>{r.state}</span>
                  </div>
                  {r.state !== "pending" && (
                    <div className="mt-1.5 pl-8 space-y-0.5">
                      {visibleThoughts.map((t, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground font-mono leading-snug animate-fade-in">
                          <span className="text-primary/60">›</span> {t}
                        </p>
                      ))}
                      {r.state === "done" && (() => {
                        const res = r.result as Record<string, unknown> | undefined;
                        const stats = res?.stats as Record<string, unknown> | undefined;
                        if (!stats) return null;
                        const parts: string[] = [];
                        if (Number(stats.attrCount)  > 0) parts.push(`${stats.attrCount} attrs`);
                        if (Number(stats.excCount)   > 0) parts.push(`${stats.excCount} exceptions`);
                        if (Number(stats.fileStored) > 0) parts.push(`${stats.fileStored} files`);
                        if (!parts.length) return null;
                        return (
                          <p className="text-[11px] text-success font-mono leading-snug mt-0.5">
                            <span className="text-success/60">✓</span> Saved: {parts.join(" · ")}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-secondary/30">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bot className="size-3" /> KYC Agent Orchestrator v2.1
            </p>
            {!isRunning && (
              <button onClick={() => setDockOpen(false)} className="text-[11px] text-primary hover:underline">Dismiss</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

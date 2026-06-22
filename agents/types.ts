/**
 * Shared types for the agent ecosystem.
 *
 * Every runner (API-based or autonomous) produces an AgentRunOutput.
 * Publishers consume that output and write to Supabase.
 */

// ─── Agent run output (contract between runners and publishers) ───────────────

export interface AgentRunOutput {
  /** Matches agent_runs.id once the row is created by the server. */
  runId?: string;
  agentSlug: string;
  kycRef: string;
  outputType: 'attributes' | 'exceptions' | 'both' | 'files-only';
  attributes?: AttributeOutput[];
  exceptions?: ExceptionOutput[];
  files: FileOutput[];
  metadata: RunMetadata;
}

export interface RunMetadata {
  completedAt: string;          // ISO 8601
  durationMs: number;
  sourcesConsulted: string[];   // e.g. ["companies-house.gov.uk"]
}

// ─── Attribute output ─────────────────────────────────────────────────────────

export interface AttributeOutput {
  attributeName: string;        // snake_case, matches entity_attributes.attribute_name
  attributeGroup: string;       // "core" | "wgq" | "ownership" | …
  displayValue: string;
  source: string;               // human-readable source label, e.g. "Companies House API"
  confidence: number;           // 0–100
  idFlag: boolean;
  verificationFlag: boolean;
  exceptionFlag: boolean;
  exceptionType?: string;
  lineage: LineageEntry[];
}

export interface LineageEntry {
  source: string;
  value: unknown;
  timestamp?: string;
  agentSlug?: string;
  confidence?: number;
  note?: string;
}

// ─── Exception output ─────────────────────────────────────────────────────────

export interface ExceptionOutput {
  exceptionType: string;        // e.g. "Missing Value", "Inconsistent Data"
  title: string;                // human-readable title shown in the UI
  fieldName: string;            // snake_case field that triggered the exception
  attributeName: string;        // matches entity_attributes.attribute_name
  reasoning: string[];          // ordered list of reasoning steps
  recommendedActions: string[]; // e.g. ["Request updated document", "Escalate to compliance"]
  confidence: number;           // 0–100
  severity: 'low' | 'medium' | 'high';
}

// ─── File output ──────────────────────────────────────────────────────────────

export interface FileOutput {
  filename: string;
  mimeType: string;
  fileCategory: 'document' | 'screenshot';
  title: string;
  sourceUrl?: string;           // URL the file was downloaded/scraped from
  caption?: string;             // screenshot annotation or document description
  /**
   * For autonomous agents: relative path within the agent's artifact store,
   * used to download the file via /api/artifact-download.
   * Null for API runners that return file content directly as a Buffer.
   */
  artifactPath?: string;
  /** Raw file content — provided by API runners that fetch files directly. */
  content?: Buffer;
}

// ─── Runner base interface ────────────────────────────────────────────────────

export interface RunnerContext {
  kycRef: string;
  entityName: string;
  initiatedBy?: string;         // user UUID
}

export interface ApiRunnerResult {
  output: AgentRunOutput;
}

export interface AutonomousRunnerResult {
  /** The AWS runId — used for polling. */
  externalRunId: string;
  /**
   * Resolves when the run completes (either polled to completion or timed out).
   * The promise rejects on failure.
   */
  completion: Promise<AgentRunOutput>;
}

// ─── Agent registry entry ─────────────────────────────────────────────────────

export type RunnerType = 'api' | 'autonomous';

export interface AgentRegistryEntry {
  slug: string;
  displayName: string;
  description: string;
  runnerType: RunnerType;
  outputType: AgentRunOutput['outputType'];
}

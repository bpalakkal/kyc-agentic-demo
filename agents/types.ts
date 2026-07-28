/**
 * Shared types for the agent ecosystem.
 *
 * Every direct REST or Claude runner produces an AgentRunOutput.
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
  persons?: PersonOutput[];
  personSource?: string;
  exceptions?: ExceptionOutput[];
  files: FileOutput[];
  metadata: RunMetadata;
}

export interface PersonOutput {
  source?: string;
  role: string;
  personIndex: number;
  fullName?: string | null;
  ownershipPct?: number | null;
  nationality?: string | null;
  attributes: Record<string, unknown>;
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
  exceptionType?: string | string[];
  exceptionReason?: string | string[];
  exceptionRecommendation?: string | string[];
  exceptionAssessments?: ExceptionAssessment[];
  lineage: LineageEntry[];
  // DD-result fields (populated by DdRunner; null for sourcing agents)
  idReasoning?: string | null;
  verificationSources?: string[] | null;
  verificationReasoning?: string | null;
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
  exceptionType: string | string[]; // e.g. ["Missing Value", "Inconsistent Data"]
  title: string;                // human-readable title shown in the UI
  fieldName: string;            // snake_case field that triggered the exception
  attributeName: string;        // matches entity_attributes.attribute_name
  reasoning: string[];          // ordered list of reasoning steps
  recommendedActions: string[]; // e.g. ["Request updated document", "Escalate to compliance"]
  confidence: number;           // 0–100
  severity: 'low' | 'medium' | 'high';
  assessments?: ExceptionAssessment[];
  recommendation?: string;
  exceptionQueue?: 'Compliance' | 'Analyst' | 'Client' | 'CRM' | 'Auto-Resolve';
  guidanceReferences?: string[];
  evidenceSources?: string[];
  entityAttributeId?: string | null;
  entityPersonId?: string | null;
}

export interface ExceptionAssessment {
  exceptionType: 'Missing Value' | 'Invalid Format' | 'Validation Failed' | 'Source Conflict' | 'Requires Manual Review' | 'Other';
  exceptionReasoning: string;
}

// ─── File output ──────────────────────────────────────────────────────────────

export interface FileOutput {
  filename: string;
  mimeType: string;
  fileCategory: 'document' | 'screenshot';
  title: string;
  sourceUrl?: string;           // URL the file was downloaded/scraped from
  caption?: string;             // screenshot annotation or document description
  /** Raw file content provided by the runner. */
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

// ─── Agent registry entry ─────────────────────────────────────────────────────

export type RunnerType = 'api';

export interface AgentRegistryEntry {
  slug: string;
  displayName: string;
  description: string;
  runnerType: RunnerType;
  outputType: AgentRunOutput['outputType'];
  modelProfile?:
    | 'bedrock-claude-haiku' | 'bedrock-claude-sonnet' | 'bedrock-claude-opus'
    | 'anthropic-claude-haiku' | 'anthropic-claude-sonnet' | 'anthropic-claude-opus'
    | null;
}

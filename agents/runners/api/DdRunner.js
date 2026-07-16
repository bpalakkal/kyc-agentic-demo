/**
 * DdRunner — Due-Diligence orchestrator for the no-Forge deployment.
 *
 * Replaces the Forge/ELB invocation with direct Claude API calls.
 *
 * Modes
 * ─────
 *  • All-in-one (default):  DdAllInOneRunner — sends full entity_data to Claude
 *    in one call and maps the response → AttributeOutput[].
 *  • Individual agent:  look up the runner class by slug and call it directly.
 *
 * The two-phase preview/commit flow is handled by the ApiRunner base class and
 * the existing /api/agent-run/api/:slug → commit routes in server.js.
 *
 * Usage in server.js loadRunnerClass():
 *   'dd-all-in-one': makeAllInOneRunner()
 *   'ria-authorized-signatory-idv': makeDdRunner('ria-authorized-signatory-idv')
 *   … etc.
 *
 * Export DD_SLUGS so server.js can enumerate them without importing the registry.
 */

import { ApiRunner }             from '../../base/ApiRunner.js';
import { buildEntityDataJson, entityDataToAttributes } from '../../dd/entityData.js';
import { getAttributes, getPersons } from '../../../src/db/supabase.js';
import Anthropic                 from '@anthropic-ai/sdk';
import ddRegistry                from '../../../schema/dd-registry.json' with { type: 'json' };

const MODEL = 'claude-sonnet-4-6';

// Derive entity_id + case_id from kyc_ref (format: <entity_id>_<case_id>)
function splitRef(kycRef) {
  const parts = String(kycRef ?? '').split('_');
  // Last part = case_id, everything before = entity_id
  const caseId   = parts.pop() ?? '';
  const entityId = parts.join('_') || kycRef;
  return { entityId, caseId };
}

/** Convert registry snake_case key → hyphenated slug. */
const keyToSlug = (key) => key.replace(/_/g, '-');
/** Convert hyphenated slug → registry snake_case key. */
const slugToKey  = (slug) => slug.replace(/-/g, '_');

/**
 * Base class shared by individual and all-in-one DD runners.
 * Subclasses set _slug and implement _runClaude(entityData, anthropic).
 */
class BaseDdRunner extends ApiRunner {
  get slug()       { return this._slug; }
  get outputType() { return 'both'; }

  async execute(ctx) {
    const { kycRef } = ctx;
    const { entityId, caseId } = splitRef(kycRef);
    const startedAt = Date.now();

    // 1. Load current entity state from DB.
    this.step('Loading entity data from database…');
    const [attrs, persons] = await Promise.all([
      getAttributes(kycRef),
      getPersons(kycRef),
    ]);

    // 2. Build entity_data.json (the DD context payload).
    const entityData = buildEntityDataJson(attrs, persons, { entityId, caseId });

    // 3. Call Claude.
    this.step('Sending to Claude for due-diligence analysis…');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { attributes, exceptions } = await this._runClaude(entityData, anthropic, kycRef, ctx.entityName);
    this.step(`Received ${attributes.length} attribute(s), ${exceptions.length} exception(s) — ready for review`);

    return {
      agentSlug:  this._slug,
      kycRef,
      outputType: 'both',
      attributes,
      exceptions,
      files: [],
      metadata: {
        completedAt:      new Date().toISOString(),
        durationMs:       Date.now() - startedAt,
        sourcesConsulted: [`Claude ${MODEL} — ${this._slug}`],
      },
    };
  }

  /** Override in subclasses. Returns { attributes, exceptions }. */
  async _runClaude(_entityData, _anthropic, _kycRef, _entityName) {
    throw new Error(`${this.constructor.name}._runClaude() not implemented`);
  }
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

/**
 * Extract JSON from a Claude response that may have markdown fences.
 * @param {string} text
 * @returns {any}
 */
function parseClaudeJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw    = fenced ? fenced[1] : text.trim();
  return JSON.parse(raw);
}

/**
 * Map Claude's attribute array → AttributeOutput[].
 * Expected item shape: { attribute_name, display_value, confidence, lineage: { source, rationale } }
 */
function mapClaudeAttributes(items, ddLabel) {
  const out = [];
  for (const item of items ?? []) {
    const name = item.attribute_name ?? item.attributeName;
    const val  = item.display_value  ?? item.displayValue ?? item.value;
    if (!name) continue;

    const confidence = typeof item.confidence === 'number' ? Math.round(item.confidence) : 85;
    const lineageSrc = item.lineage?.source ?? ddLabel;
    const lineageNote = item.lineage?.rationale ?? item.lineage?.reasoning ?? null;

    out.push({
      attributeName:    name,
      attributeGroup:   'core',
      displayValue:     val == null ? '' : String(val),
      source:           lineageSrc,
      confidence,
      idFlag:           true,
      verificationFlag: true,
      exceptionFlag:    false,
      lineage: [{
        value:            val == null ? '' : String(val),
        source:           lineageSrc,
        note:             lineageNote,
        timestamp:        new Date().toISOString(),
        confidence_score: confidence / 100,
      }],
    });
  }
  return out;
}

/**
 * Map Claude's exception array → ExceptionOutput[].
 * Expected item shape: { attribute_name, exception_type, reasoning, recommended_actions }
 */
function mapClaudeExceptions(items) {
  const out = [];
  for (const item of items ?? []) {
    const name = item.attribute_name ?? item.attributeName ?? item.field_name;
    if (!name) continue;
    out.push({
      exceptionType:       item.exception_type ?? 'Requires Manual Review',
      title:               item.title ?? `${item.exception_type ?? 'Exception'} — ${name}`,
      fieldName:           name,
      attributeName:       name,
      reasoning:           Array.isArray(item.reasoning) ? item.reasoning : [item.reasoning ?? 'DD flagged an exception.'],
      recommendedActions:  Array.isArray(item.recommended_actions) ? item.recommended_actions : ['Review and resolve.'],
      confidence:          100,
      severity:            item.severity ?? 'medium',
    });
  }
  return out;
}

// ── Individual DD runner ───────────────────────────────────────────────────────

class IndividualDdRunner extends BaseDdRunner {
  constructor(sb, slug) {
    super(sb);
    this._slug   = slug;
    this._regKey = slugToKey(slug);
  }

  get _agentMeta() {
    return ddRegistry.agents[this._regKey] ?? null;
  }

  async _runClaude(entityData, anthropic, kycRef, entityName) {
    const meta       = this._agentMeta;
    const label      = meta?.persona ?? this._slug;
    const attributes = meta?.attributes ?? [];
    const party      = meta?.party ?? null;

    const attributeList = attributes
      .map(a => `  - ${a}`)
      .join('\n');

    const systemPrompt = `You are a KYC due-diligence specialist performing identity verification and attribute analysis for regulated financial entities. You are conducting the "${label}" due-diligence check.

Your task: Review the entity_data context and determine verified values for each attribute you are responsible for. For each attribute, assess the available lineage data, apply DD judgment (CIP rules, regulatory requirements, source credibility), and return your conclusions.

Return ONLY valid JSON — no prose, no markdown except for the single JSON block.`;

    const userPrompt = `Entity: ${entityName ?? 'Unknown'} (KYC Ref: ${kycRef})
Party context: ${party ? `This agent covers "${party}" party attributes.` : 'Entity-level attributes (no specific party).'}

Due-diligence agent: ${label}
Attributes this agent is responsible for:
${attributeList}

Current entity_data (DB snapshot with lineage):
\`\`\`json
${JSON.stringify(entityData, null, 2).slice(0, 40000)}
\`\`\`

For each attribute listed above, review the available lineage data and determine whether the value can be identified/verified. Return a JSON object with this exact structure:

{
  "attributes": [
    {
      "attribute_name": "<exact attribute name from the list above>",
      "display_value": "<verified value, or empty string if not determinable>",
      "confidence": <integer 0-100>,
      "lineage": {
        "source": "<source or authority consulted>",
        "rationale": "<brief DD reasoning>"
      }
    }
  ],
  "exceptions": [
    {
      "attribute_name": "<attribute name>",
      "exception_type": "<Missing Value|Invalid Format|Validation Failed|Source Conflict|Requires Manual Review>",
      "title": "<short exception title>",
      "reasoning": ["<reason 1>", "<reason 2>"],
      "recommended_actions": ["<action>"],
      "severity": "<low|medium|high>"
    }
  ]
}

Rules:
- Include an attribute entry for every attribute in the list, even if the display_value is empty.
- Only raise exceptions for genuine DD issues (missing required values, conflicting sources, validation failures).
- For party attributes, use the party data from entity_data — omit entries for parties not present.
- Do not invent values. Use only what is present in the lineage data or can be conclusively inferred.`;

    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

    let parsed;
    try {
      parsed = parseClaudeJson(text);
    } catch (err) {
      console.error(`[${this._slug}] Claude response parse failed: ${err.message}\n${text.slice(0, 500)}`);
      return { attributes: [], exceptions: [] };
    }

    return {
      attributes: mapClaudeAttributes(parsed.attributes, label),
      exceptions: mapClaudeExceptions(parsed.exceptions),
    };
  }
}

// ── All-in-one DD runner ───────────────────────────────────────────────────────

class AllInOneRunner extends BaseDdRunner {
  constructor(sb) {
    super(sb);
    this._slug = 'dd-all-in-one';
  }

  async _runClaude(entityData, anthropic, kycRef, entityName) {
    // Build the full attribute list across all DD agents.
    const allAttributes = Object.values(ddRegistry.agents)
      .flatMap(a => a.attributes ?? []);

    const attrList = [...new Set(allAttributes)].map(a => `  - ${a}`).join('\n');

    const systemPrompt = `You are a KYC due-diligence specialist performing a comprehensive identity verification and due-diligence review for a regulated financial entity. You are conducting ALL due-diligence checks in one pass.

Review the entity_data context and determine verified values for each attribute across all DD dimensions (entity identity, legal structure, evidence of existence, beneficial ownership, authorized signatories, corporate officers, proxy BOs, CIP classification, government identification, regulator, addresses, source of wealth, and all indicator fields).

Return ONLY valid JSON — no prose, no markdown except for the single JSON block.`;

    const userPrompt = `Entity: ${entityName ?? 'Unknown'} (KYC Ref: ${kycRef})

All attributes requiring due-diligence:
${attrList}

Current entity_data (DB snapshot with lineage):
\`\`\`json
${JSON.stringify(entityData, null, 2).slice(0, 50000)}
\`\`\`

For EACH attribute listed above, review the available lineage data and apply DD judgment. Return a JSON object with this exact structure:

{
  "attributes": [
    {
      "attribute_name": "<exact attribute name>",
      "display_value": "<verified value, or empty string if not determinable>",
      "confidence": <integer 0-100>,
      "lineage": {
        "source": "<source or authority consulted>",
        "rationale": "<brief DD reasoning>"
      }
    }
  ],
  "exceptions": [
    {
      "attribute_name": "<attribute name>",
      "exception_type": "<Missing Value|Invalid Format|Validation Failed|Source Conflict|Requires Manual Review>",
      "title": "<short exception title>",
      "reasoning": ["<reason 1>"],
      "recommended_actions": ["<action>"],
      "severity": "<low|medium|high>"
    }
  ]
}

Rules:
- Include an attribute entry for every attribute in the list.
- Only raise exceptions for genuine DD issues.
- For party attributes, skip entries where no corresponding party records exist in entity_data.
- Do not invent values. Use only what is present in the lineage data or can be conclusively inferred.`;

    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 8192,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

    let parsed;
    try {
      parsed = parseClaudeJson(text);
    } catch (err) {
      console.error(`[dd-all-in-one] Claude response parse failed: ${err.message}\n${text.slice(0, 500)}`);
      return { attributes: [], exceptions: [] };
    }

    return {
      attributes: mapClaudeAttributes(parsed.attributes, 'RIA IDV (all-in-one)'),
      exceptions: mapClaudeExceptions(parsed.exceptions),
    };
  }
}

// ── Factory functions ─────────────────────────────────────────────────────────

/** Build a newable runner class bound to a specific DD registry slug. */
export function makeDdRunner(slug) {
  return class extends IndividualDdRunner {
    constructor(sb) { super(sb, slug); }
  };
}

/** Runner for the all-in-one flow. */
export function makeAllInOneRunner() {
  return class extends AllInOneRunner {
    constructor(sb) { super(sb); }
  };
}

export const ALL_IN_ONE_DD_SLUG = 'dd-all-in-one';

/** All individual DD slugs derived from the registry. */
export const DD_SLUGS = Object.keys(ddRegistry.agents).map(keyToSlug);

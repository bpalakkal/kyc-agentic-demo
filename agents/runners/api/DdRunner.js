/**
 * DdRunner — Due-Diligence orchestrator for the no-Forge deployment.
 *
 * Implements the dd-guidance-reader protocol:
 *   1. Load the firm's policy note for this attribute from agents/policy/
 *   2. Validate the note is well-formed (all 4 sections present, no gaps)
 *   3. Inject note + entity_data into Claude using the reader skill as system prompt
 *   4. Parse the structured output (results[], exceptions[], escalation)
 *   5. Map to AttributeOutput[] / ExceptionOutput[] for the publish pipeline
 */

import { readFileSync }          from 'fs';
import { fileURLToPath }         from 'url';
import { dirname, join }         from 'path';
import { ApiRunner }             from '../../base/ApiRunner.js';
import { buildEntityDataJson }   from '../../dd/entityData.js';
import { getAttributes, getPersons } from '../../../src/db/supabase.js';
import Anthropic                 from '@anthropic-ai/sdk';
import ddRegistry                from '../../../schema/dd-registry.json' with { type: 'json' };

const MODEL      = 'claude-sonnet-4-6';
const __dirname  = dirname(fileURLToPath(import.meta.url));
const POLICY_DIR = join(__dirname, '../../policy/registered_investment_advisor');
const READER_MD  = join(__dirname, '../../policy/dd-guidance-reader.md');

// ── Slug → policy file map ────────────────────────────────────────────────────

const POLICY_FILE = {
  'ria-entity-name-idv':                'entity_name.md',
  'ria-legal-structure-idv':            'legal_structure.md',
  'ria-evidence-of-existence-idv':      'evidence_of_existence.md',
  'ria-registered-address-idv':         'address_registered.md',
  'ria-principal-business-address-idv': 'address_principal_business.md',
  'ria-regulator-idv':                  'regulator.md',
  'ria-government-identification-idv':  'government_identification.md',
  'ria-cip-classification-id':          'cip_classification.md',
  'ria-beneficial-owner-idv':           'beneficial_owner.md',
  'ria-proxy-bo-idv':                   'proxy_beneficial_owner.md',
  'ria-authorized-signatory-idv':       'authorized_signatory.md',
  'ria-corporate-officer-idv':          'corporate_officer.md',
  'ria-source-of-wealth-idv':           'source_of_wealth.md',
  'ria-transacting-funds-id':           'transacting_own_or_third_party_funds.md',
  'ria-parent-publicly-listed-id':      'parent_publicly_listed_us_exchange_indicator.md',
  'ria-sole-proprietorship-id':         'sole_proprietorship_indicator.md',
  'ria-commodities-indicator-id':       'commodities_future_trading_commission_registered_indicator.md',
  'ria-securities-exchange-act-id':     'securities_exchange_act_1934_section_12_15d_indicator.md',
};

// ── Policy helpers ────────────────────────────────────────────────────────────

let _readerSkillCache = null;
function loadReaderSkill() {
  if (!_readerSkillCache) _readerSkillCache = readFileSync(READER_MD, 'utf8');
  return _readerSkillCache;
}

function loadPolicy(filename) {
  return readFileSync(join(POLICY_DIR, filename), 'utf8');
}

function loadAllPolicies() {
  return Object.values(POLICY_FILE)
    .map(f => { try { return loadPolicy(f); } catch { return null; } })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Validate a policy note has all required sections and none are marked incomplete.
 * Returns { ok, reason }.
 */
function validatePolicy(text) {
  const required = ['## Sources', '## Decision Logic', '## Validation Rules', '## Outputs'];
  const missing  = required.filter(h => !text.includes(h));
  if (missing.length) return { ok: false, reason: `Missing sections: ${missing.join(', ')}` };

  const incomplete = required.filter(h => {
    const idx  = text.indexOf(h);
    const next = text.indexOf('\n##', idx + 1);
    const body = text.slice(idx + h.length, next === -1 ? undefined : next).trim();
    return body.includes('_Not specified in source guidance');
  });
  if (incomplete.length) return { ok: false, reason: `Incomplete sections: ${incomplete.join(', ')}` };

  return { ok: true };
}

// ── Output mappers ────────────────────────────────────────────────────────────

/**
 * Map dd-guidance-reader results[] → AttributeOutput[].
 * result shape: { attribute, value, id_flag, verification_flag, evidence_source, rules_fired }
 */
function mapGuidanceResults(results, label) {
  const out = [];
  for (const r of results ?? []) {
    const name = r.attribute ?? r.attribute_name;
    const val  = r.value ?? r.display_value ?? '';
    if (!name) continue;
    const confidence = r.verification_flag ? 90 : (r.id_flag ? 70 : 50);
    out.push({
      attributeName:    name,
      attributeGroup:   'core',
      displayValue:     val == null ? '' : String(val),
      source:           r.evidence_source ?? label,
      confidence,
      idFlag:           r.id_flag === true,
      verificationFlag: r.verification_flag === true,
      exceptionFlag:    false,
      lineage: [{
        value:            val == null ? '' : String(val),
        source:           r.evidence_source ?? label,
        note:             r.rules_fired?.length ? `Rules fired: ${r.rules_fired.join(', ')}` : null,
        timestamp:        new Date().toISOString(),
        confidence_score: confidence / 100,
      }],
    });
  }
  return out;
}

/**
 * Map dd-guidance-reader exceptions[] → ExceptionOutput[].
 * exception shape: { attribute, rule_id, check, reason, fail_action }
 */
function mapGuidanceExceptions(exceptions) {
  const out = [];
  for (const e of exceptions ?? []) {
    const name = e.attribute ?? e.attribute_name;
    if (!name) continue;
    out.push({
      exceptionType:      e.rule_id ? `Rule ${e.rule_id} Failed` : 'Validation Failed',
      title:              e.check ?? `${e.rule_id ?? 'Exception'} — ${name}`,
      fieldName:          name,
      attributeName:      name,
      reasoning:          [e.reason ?? 'DD guidance check failed.'],
      recommendedActions: [e.fail_action ?? 'Review and resolve per DD guidance note.'],
      confidence:         100,
      severity:           'medium',
    });
  }
  return out;
}

// ── Shared utilities ──────────────────────────────────────────────────────────

const keyToSlug = (key)  => key.replace(/_/g, '-');
const slugToKey = (slug) => slug.replace(/-/g, '_');

function splitRef(kycRef) {
  const parts    = String(kycRef ?? '').split('_');
  const caseId   = parts.pop() ?? '';
  const entityId = parts.join('_') || kycRef;
  return { entityId, caseId };
}

function parseClaudeJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw    = fenced ? fenced[1] : text.trim();
  return JSON.parse(raw);
}

// ── Base runner ───────────────────────────────────────────────────────────────

class BaseDdRunner extends ApiRunner {
  get slug()       { return this._slug; }
  get outputType() { return 'both'; }

  async execute(ctx) {
    const { kycRef } = ctx;
    const { entityId, caseId } = splitRef(kycRef);
    const startedAt = Date.now();

    this.step('Loading entity data from database…');
    const [attrs, persons] = await Promise.all([
      getAttributes(kycRef),
      getPersons(kycRef),
    ]);
    const entityData = buildEntityDataJson(attrs, persons, { entityId, caseId });

    this.step('Applying DD guidance policy…');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { attributes, exceptions } = await this._runClaude(entityData, anthropic, kycRef, ctx.entityName);

    this.step(`${attributes.length} attribute(s), ${exceptions.length} exception(s) — ready for review`);

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

  async _runClaude() { throw new Error(`${this.constructor.name}._runClaude() not implemented`); }
}

// ── Individual DD runner ───────────────────────────────────────────────────────

class IndividualDdRunner extends BaseDdRunner {
  constructor(sb, slug) {
    super(sb);
    this._slug   = slug;
    this._regKey = slugToKey(slug);
  }

  get _agentMeta() { return ddRegistry.agents[this._regKey] ?? null; }

  async _runClaude(entityData, anthropic, kycRef, entityName) {
    const policyFile = POLICY_FILE[this._slug];
    if (!policyFile) {
      console.warn(`[${this._slug}] No policy file mapped — running with generic prompt`);
      return this._runGeneric(entityData, anthropic, kycRef, entityName);
    }

    let policyText;
    try {
      policyText = loadPolicy(policyFile);
    } catch (err) {
      console.error(`[${this._slug}] Failed to load policy ${policyFile}: ${err.message}`);
      return this._runGeneric(entityData, anthropic, kycRef, entityName);
    }

    const validation = validatePolicy(policyText);
    if (!validation.ok) {
      this.step(`Policy note validation failed: ${validation.reason} — halting per dd-guidance-reader`);
      return {
        attributes: [],
        exceptions: [{
          exceptionType:      'Note Load Failed',
          title:              `DD policy note incomplete — ${this._slug}`,
          fieldName:          this._slug,
          attributeName:      this._slug,
          reasoning:          [validation.reason],
          recommendedActions: ['Complete the DD policy note before re-running.'],
          confidence:         100,
          severity:           'high',
        }],
      };
    }

    const meta        = this._agentMeta;
    const label       = meta?.persona ?? this._slug;
    const readerSkill = loadReaderSkill();

    const systemPrompt = `${readerSkill}

You are operating as the "${label}" DD agent. Apply the dd-guidance-reader skill above to the policy note and entity evidence supplied by the user.`;

    const userPrompt = `Entity: ${entityName ?? 'Unknown'} (KYC Ref: ${kycRef})

## Policy Note
${policyText}

## Entity Evidence (DB snapshot with lineage)
\`\`\`json
${JSON.stringify(entityData, null, 2).slice(0, 40000)}
\`\`\`

Apply Steps 1–6 of the dd-guidance-reader skill. Return ONLY the output contract JSON:
\`\`\`json
{
  "entity_type": "...",
  "attribute": "...",
  "status": "complete | escalated | note_load_failed",
  "results": [
    { "attribute": "<master-schema name>", "value": "<verified value or empty string>",
      "id_flag": true, "verification_flag": true,
      "evidence_source": "<source name + date accessed>", "rules_fired": ["RULE_ID"] }
  ],
  "exceptions": [
    { "attribute": "...", "rule_id": "...", "check": "...", "reason": "...", "fail_action": "..." }
  ],
  "escalation": null
}
\`\`\``;

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
      console.error(`[${this._slug}] Claude parse failed: ${err.message}\n${text.slice(0, 500)}`);
      return { attributes: [], exceptions: [] };
    }

    if (parsed.status === 'note_load_failed') {
      this.step(`Agent halted — note_load_failed: ${JSON.stringify(parsed.escalation ?? '')}`);
      return { attributes: [], exceptions: [] };
    }

    return {
      attributes: mapGuidanceResults(parsed.results, label),
      exceptions: mapGuidanceExceptions(parsed.exceptions),
    };
  }

  /** Fallback for slugs without a mapped policy file. */
  async _runGeneric(entityData, anthropic, kycRef, entityName) {
    const meta     = this._agentMeta;
    const label    = meta?.persona ?? this._slug;
    const attrList = (meta?.attributes ?? []).map(a => `  - ${a}`).join('\n');

    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      system:     `You are a KYC due-diligence specialist performing the "${label}" check. Return ONLY valid JSON.`,
      messages: [{
        role: 'user',
        content: `Entity: ${entityName ?? 'Unknown'} (KYC Ref: ${kycRef})
Attributes to review:
${attrList}

Entity data:
\`\`\`json
${JSON.stringify(entityData, null, 2).slice(0, 40000)}
\`\`\`

Return JSON: { "attributes": [{ "attribute_name": "...", "display_value": "...", "confidence": 70, "lineage": { "source": "...", "rationale": "..." } }], "exceptions": [] }`,
      }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let parsed;
    try { parsed = parseClaudeJson(text); } catch { return { attributes: [], exceptions: [] }; }

    return {
      attributes: (parsed.attributes ?? []).map(item => ({
        attributeName:    item.attribute_name,
        attributeGroup:   'core',
        displayValue:     item.display_value == null ? '' : String(item.display_value),
        source:           item.lineage?.source ?? label,
        confidence:       typeof item.confidence === 'number' ? Math.round(item.confidence) : 70,
        idFlag:           true,
        verificationFlag: false,
        exceptionFlag:    false,
        lineage: [{
          value:            item.display_value == null ? '' : String(item.display_value),
          source:           item.lineage?.source ?? label,
          note:             item.lineage?.rationale ?? null,
          timestamp:        new Date().toISOString(),
          confidence_score: (typeof item.confidence === 'number' ? item.confidence : 70) / 100,
        }],
      })),
      exceptions: [],
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
    const readerSkill = loadReaderSkill();
    const allPolicies = loadAllPolicies();
    const allAttrs    = [...new Set(Object.values(ddRegistry.agents).flatMap(a => a.attributes ?? []))];
    const attrList    = allAttrs.map(a => `  - ${a}`).join('\n');

    const systemPrompt = `${readerSkill}

You are the all-in-one DD agent. You will receive ALL policy notes for this entity type. Apply the dd-guidance-reader skill to each policy note in turn and return a single consolidated output. For attributes governed by multiple notes, the most specific note governs.`;

    const userPrompt = `Entity: ${entityName ?? 'Unknown'} (KYC Ref: ${kycRef})

All attributes requiring due-diligence:
${attrList}

## All Policy Notes
${allPolicies}

## Entity Evidence (DB snapshot with lineage)
\`\`\`json
${JSON.stringify(entityData, null, 2).slice(0, 50000)}
\`\`\`

Apply the dd-guidance-reader skill across all policy notes. Return a single consolidated JSON:
\`\`\`json
{
  "entity_type": "...",
  "status": "complete | escalated | note_load_failed",
  "results": [
    { "attribute": "<master-schema name>", "value": "<verified value or empty string>",
      "id_flag": true, "verification_flag": true,
      "evidence_source": "<source name + date accessed>", "rules_fired": ["RULE_ID"] }
  ],
  "exceptions": [
    { "attribute": "...", "rule_id": "...", "check": "...", "reason": "...", "fail_action": "..." }
  ],
  "escalation": null
}
\`\`\``;

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
      console.error(`[dd-all-in-one] Claude parse failed: ${err.message}\n${text.slice(0, 500)}`);
      return { attributes: [], exceptions: [] };
    }

    return {
      attributes: mapGuidanceResults(parsed.results, 'RIA IDV (all-in-one)'),
      exceptions: mapGuidanceExceptions(parsed.exceptions),
    };
  }
}

// ── Factory functions ─────────────────────────────────────────────────────────

export function makeDdRunner(slug) {
  return class extends IndividualDdRunner {
    constructor(sb) { super(sb, slug); }
  };
}

export function makeAllInOneRunner() {
  return class extends AllInOneRunner {
    constructor(sb) { super(sb); }
  };
}

export const ALL_IN_ONE_DD_SLUG = 'dd-all-in-one';
export const DD_SLUGS = Object.keys(ddRegistry.agents).map(keyToSlug);

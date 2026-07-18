/**
 * DD completion gate — decide which DD agents still have work.
 *
 * Never re-trigger ID/verify-complete or analyst-confirmed attributes. For each
 * DD agent, an attribute is "remaining" iff, for the entity type:
 *   - it is not `not_applicable`, AND
 *   - it is not already done: id_flag && (!verifiable || verification_flag), AND
 *   - it is not confirmed (getAttributes bakes confirmations into id/verify flags).
 * Party agents check each existing person record (numbered attributes). An agent
 * with ≥1 remaining attribute is scheduled; otherwise it is skipped entirely.
 *
 * Uses the effective attribute view (getAttributes) — snapshot + completed DD/
 * sourcing runs + confirmations already merged.
 *
 * Adapted for direct no-Forge execution with no remote-runtime dependencies.
 */
import { createRequire } from 'module';
import schemaMetaMod from '../../schema/schema-meta.js';
import { applicability, entityTypeByAlias } from '../../schema/index.js';

const require = createRequire(import.meta.url);
const ddRegistry = require('../../schema/dd-registry.json');

const schemaMeta = schemaMetaMod;

/** Effective entity type for a case (default RIA). */
export function entityTypeForCase(ent) {
  // cip_classification value drives applicability; fall back to RIA.
  const cip = ent?.cip_classification ?? ent?.entity_type ?? null;
  if (cip && schemaMeta.entityTypes[cip]) return cip;
  return entityTypeByAlias('RIA') ?? Object.keys(schemaMeta.entityTypes)[0];
}

const isYes = (v) => v === 'Yes' || v === true;

/** Is this attribute row "done" for gating purposes? */
function isDone(row, verifiable) {
  if (!row) return false;
  const id = isYes(row.id_flag);
  const ver = isYes(row.verification_flag);
  return id && (!verifiable || ver);
}

/**
 * Compute the DD agents that still have work.
 * @param {object[]} attrRows   effective attributes (from getAttributes)
 * @param {Record<string, object[]>} persons  role → person records (getPersons)
 * @param {string} entityType
 * @returns {Array<{ slug: string, agentKey: string, persona: string, remaining: string[] }>}
 */
export function agentsToRun(attrRows, persons, entityType) {
  const attrMap = {};
  for (const a of attrRows ?? []) attrMap[a.attribute_name] = a;
  const regAttrs = ddRegistry.attributes ?? {};
  const out = [];

  for (const [agentKey, agent] of Object.entries(ddRegistry.agents ?? {})) {
    const slug = agentKey.replace(/_/g, '-');
    const party = agent.party;
    const remaining = [];

    for (const attr of agent.attributes ?? []) {
      const spec = regAttrs[attr] ?? {};
      const verifiable = !!spec.verifiable;
      // applicability keyed by schema path (party child paths are dotted).
      const schemaPath = party ? `${party}.${attr}` : attr;
      if (applicability(entityType, schemaPath) === 'not_applicable') continue;

      if (party) {
        const records = persons?.[party] ?? persons?.[party.toLowerCase()] ?? [];
        if (!records.length) continue; // no party records → nothing to run yet
        const short = attr.startsWith(`${party}_`) ? attr.slice(party.length + 1) : attr;
        for (const p of records) {
          const idx = (p.person_index ?? 0) + 1;
          const name = `${party}_${idx}_${short}`;
          if (!isDone(attrMap[name], verifiable)) { remaining.push(name); }
        }
      } else if (!isDone(attrMap[attr], verifiable)) {
        remaining.push(attr);
      }
    }

    if (remaining.length) out.push({ slug, agentKey, persona: agent.persona, remaining });
  }
  return out;
}

/**
 * ddDelta — map a DD agent's delta (decisions only) → AttributeOutput[].
 *
 * A DD delta carries DECISIONS (id_flag/id_source/reasoning, verification_*,
 * exception_*) but NOT the value/lineage — those come from sourcing. So we CARRY
 * the current value + lineage FORWARD from the DB attribute map and overlay the
 * DD flags. Enum-backed values are normalized (Country, …); unmapped values raise
 * an exception. Party results are keyed to numbered attribute names
 * (beneficial_owner_1_nationality), matching how sourcing flattens persons — so
 * they flow through the same publisher + getAttributes path.
 *
 * Pure: takes the delta + a DB attribute map, returns { attributes, exceptions }.
 *
 * Adapted for direct no-Forge execution with no remote-runtime dependencies.
 */
import { normalizeForAttribute } from './enumNormalizer.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ddRegistry = require('../../schema/dd-registry.json');

const isYes = (v) => v === 'Yes' || v === true;

/** Pull the delta array out of a run result envelope. */
export function extractResults(runData) {
  // DD flows return [{ results: [...] }], possibly wrapped in a node envelope.
  // Find the results array.
  const seen = [];
  const visit = (v, depth) => {
    if (!v || depth > 6) return;
    if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
    if (typeof v === 'object') {
      if (Array.isArray(v.results)) seen.push(v.results);
      for (const val of Object.values(v)) visit(val, depth + 1);
    }
  };
  visit(runData?.results ?? runData, 0);
  return seen.length ? seen[0] : [];
}

/**
 * @param {object[]} results   DD delta entries { attribute, id_flag, id_source, id_reasoning, verification_flag, verification_source, verification_reasoning, exception_flag, exception_type, record_index? }
 * @param {Record<string, {display_value?: any, lineage?: any[]}>} attrMap  current DB attributes keyed by attribute_name (from getAttributes)
 * @param {string} sourceLabel  human label for the DD agent (e.g. "RIA_IDV Legal Structure")
 * @returns {{ attributes: object[], exceptions: object[] }}
 */
export function deltaToAttributes(results, attrMap, sourceLabel) {
  const attrs = [];
  const exceptions = [];
  const reg = ddRegistry.attributes ?? {};

  for (const r of results ?? []) {
    const attribute = r?.attribute;
    const spec = reg[attribute];
    if (!attribute || !spec) continue; // unknown attribute — ignore

    const party = spec.party;
    // Target attribute_name: numbered for party fields, plain for entity fields.
    let targetName = attribute;
    let enumPath = attribute;
    if (party) {
      const idx = Number.isInteger(r.record_index) ? r.record_index : 0;
      const short = attribute.startsWith(`${party}_`) ? attribute.slice(party.length + 1) : attribute;
      targetName = `${party}_${idx + 1}_${short}`;
      enumPath = `${party}.${attribute}`;
    }

    const current = attrMap[targetName] ?? {};
    // Carry the sourced value + lineage forward; normalize enum-backed values.
    let displayValue = current.display_value ?? null;
    const norm = normalizeForAttribute(displayValue, enumPath);
    if (norm.enumName && displayValue != null) {
      displayValue = Array.isArray(norm.value) ? norm.value.join(', ') : norm.value;
      if (!norm.matched && norm.unmapped?.length) {
        exceptions.push({
          exceptionType: 'Unmapped Value',
          title: `Unmapped ${norm.enumName} value for ${targetName}`,
          fieldName: targetName,
          attributeName: targetName,
          reasoning: [`Value "${norm.unmapped.join(', ')}" is not a recognized ${norm.enumName}.`],
          recommendedActions: ['Confirm the value and map it to a canonical enum member.'],
          confidence: 100,
          severity: 'low',
        });
      }
    }

    const verifiable = !!spec.verifiable;
    const idFlag = isYes(r.id_flag);
    const verificationFlag = verifiable && isYes(r.verification_flag);
    const exceptionFlag = isYes(r.exception_flag);

    // Preserve existing lineage; append a DD decision entry for auditability.
    const lineage = Array.isArray(current.lineage) ? current.lineage.slice() : [];
    if (r.id_source || r.id_reasoning) {
      lineage.push({
        value: displayValue,
        source: `DD${r.id_source ? ` · ${r.id_source}` : ''}`,
        note: r.id_reasoning ?? r.verification_reasoning ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    attrs.push({
      attributeName: targetName,
      attributeGroup: 'core',
      displayValue: displayValue == null ? '' : String(displayValue),
      source: r.id_source ?? sourceLabel,
      confidence: 100,
      idFlag,
      verificationFlag,
      exceptionFlag,
      exceptionType: exceptionFlag ? (r.exception_type ?? null) : null,
      lineage,
    });

    if (exceptionFlag && r.exception_type) {
      exceptions.push({
        exceptionType: r.exception_type,
        title: `${r.exception_type} — ${targetName}`,
        fieldName: targetName,
        attributeName: targetName,
        reasoning: [r.exception_reasoning ?? r.verification_reasoning ?? r.id_reasoning ?? 'DD flagged an exception.'].filter(Boolean),
        recommendedActions: ['Review the DD reasoning and resolve or waive.'],
        confidence: 100,
        severity: 'medium',
      });
    }
  }

  return { attributes: attrs, exceptions };
}

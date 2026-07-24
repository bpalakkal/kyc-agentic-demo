/**
 * entityData — reconstruct the entity_data.json master (the RIA schema shape with
 * per-attribute lineage) from the app's flattened DB rows (entity_attributes +
 * entity_persons). Used by DD agent runners to build the context payload sent to Claude.
 *
 * Pure functions (take DB rows as input) so they're testable without a DB.
 *
 * Adapted for the no-Forge deployment where schema/
 * lives at the repo root rather than a build alias.
 */
import schemaMetaMod from '../../schema/schema-meta.js';

const schemaMeta = schemaMetaMod;
const METADATA = new Set(['entity_id', 'case_id']); // top-level scalars, not attribute blocks
const yn = (b) => (b ? 'Yes' : 'No');
const asArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

/** Map a DB lineage entry (AttributeOutput shape) → entity_data lineage entry. */
function mapLineage(l) {
  return {
    value: l?.value ?? null,
    source: l?.source ?? null,
    confidence_score: l?.confidence_score ?? (typeof l?.confidence === 'number' ? l.confidence : null),
    timestamp: l?.timestamp ?? null,
    context: l?.context ?? l?.note ?? '',
    document_id: l?.document_id ?? null,
  };
}

/** Build one attribute block from a DB attribute row (or null → empty block). */
function block(row, { verifiable }) {
  const base = {
    id_flag: yn(row?.id_flag),
    ...(verifiable ? { verification_flag: yn(row?.verification_flag) } : {}),
    exception_flag: yn(row?.exception_flag),
    id_source: row?.id_source ?? null,
    ...(verifiable ? { verification_source: asArray(row?.verification_source) } : {}),
    id_reasoning: row?.id_reasoning ?? null,
    ...(verifiable ? { verification_reasoning: row?.verification_reasoning ?? null } : {}),
    exception_assessments: Array.isArray(row?.exception_assessments) ? row.exception_assessments : [],
    exception_recommendation: Array.isArray(row?.exception_recommendation)
      ? (row.exception_recommendation[0] ?? null)
      : (row?.exception_recommendation ?? null),
    lineage: Array.isArray(row?.lineage) ? row.lineage.map(mapLineage) : [],
  };
  return base;
}

/**
 * Reconstruct entity_data.json from flattened DB rows.
 * @param {object[]} attrs   entity_attributes rows (attribute_name, id_flag, verification_flag, id_source, lineage, …)
 * @param {Record<string, object[]>} persons  role → entity_persons rows ({ person_index, full_name, attributes })
 * @param {{ entityId?: string, caseId?: string }} ids
 * @returns {object} entity_data.json
 */
export function buildEntityDataJson(attrs, persons, { entityId, caseId } = {}) {
  const byName = {};
  for (const a of attrs ?? []) byName[a.attribute_name] = a;

  const out = { entity_id: entityId ?? null, case_id: caseId ?? null };

  for (const [path, m] of Object.entries(schemaMeta.attributes)) {
    if (m.kind === 'array') {
      // party array — build one object per person record
      const rows = persons?.[path] ?? persons?.[path.toLowerCase()] ?? [];
      out[path] = (rows ?? [])
        .slice()
        .sort((x, y) => (x.person_index ?? 0) - (y.person_index ?? 0))
        .map((p) => {
          const rec = {};
          for (const childFull of m.children ?? []) {
            const cm = schemaMeta.attributes[`${path}.${childFull}`];
            const short = childFull.startsWith(`${path}_`) ? childFull.slice(path.length + 1) : childFull;
            const cellRow = (p.attributes ?? {})[childFull] ?? (p.attributes ?? {})[short] ?? null;
            rec[childFull] = block(cellRow, { verifiable: !!cm?.verifiable });
          }
          return rec;
        });
    } else if (m.kind === 'scalar' && !m.party && !METADATA.has(path)) {
      out[path] = block(byName[path] ?? null, { verifiable: !!m.verifiable });
    }
  }
  return out;
}

// ── Inverse: entity_data.json → AttributeOutput[] ────────────────────────────
const isYes = (v) => v === 'Yes' || v === true;
const firstLineageValue = (blk) => {
  const l = Array.isArray(blk?.lineage) ? blk.lineage : [];
  const e = l.find((x) => x && x.value != null);
  const v = e?.value;
  return Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v));
};

function blockToAttribute(attributeName, blk) {
  if (!blk || typeof blk !== 'object') return null;
  const hasData = Array.isArray(blk.lineage) && blk.lineage.length > 0;
  const decided = isYes(blk.id_flag) || isYes(blk.exception_flag);
  if (!hasData && !decided) return null; // nothing to publish
  return {
    attributeName,
    attributeGroup: 'core',
    displayValue: firstLineageValue(blk),
    source: blk.id_source ?? null,
    confidence: 100,
    idFlag: isYes(blk.id_flag),
    verificationFlag: isYes(blk.verification_flag),
    exceptionFlag: isYes(blk.exception_flag),
    exceptionType: isYes(blk.exception_flag)
      ? (blk.exception_assessments ?? []).map(item => item.exception_type)
      : null,
    exceptionAssessments: isYes(blk.exception_flag)
      ? (blk.exception_assessments ?? []).map(item => ({
          exceptionType: item.exception_type,
          exceptionReasoning: item.exception_reasoning,
        }))
      : [],
    exceptionRecommendation: blk.exception_recommendation ?? null,
    lineage: Array.isArray(blk.lineage)
      ? blk.lineage.map((l) => ({
          value: Array.isArray(l.value) ? l.value.join(', ') : (l.value == null ? '' : String(l.value)),
          source: l.source ?? null, confidence_score: l.confidence_score ?? null,
          timestamp: l.timestamp ?? null, note: l.context ?? l.note ?? null,
        }))
      : null,
  };
}

/**
 * Map a full entity_data.json (e.g. the Claude all-in-one output) → AttributeOutput[].
 * Entity-level scalars keep their name; party fields become numbered names
 * (beneficial_owner_1_nationality) so they flow through the same publisher path.
 */
export function entityDataToAttributes(entityData) {
  const attrs = [];
  if (!entityData || typeof entityData !== 'object') return attrs;

  for (const [path, m] of Object.entries(schemaMeta.attributes)) {
    if (m.kind === 'array') {
      const rows = Array.isArray(entityData[path]) ? entityData[path] : [];
      rows.forEach((rec, idx) => {
        for (const childFull of m.children ?? []) {
          const short = childFull.startsWith(`${path}_`) ? childFull.slice(path.length + 1) : childFull;
          const a = blockToAttribute(`${path}_${idx + 1}_${short}`, rec?.[childFull]);
          if (a) attrs.push(a);
        }
      });
    } else if (m.kind === 'scalar' && !m.party && !METADATA.has(path)) {
      const a = blockToAttribute(path, entityData[path]);
      if (a) attrs.push(a);
    }
  }
  return attrs;
}

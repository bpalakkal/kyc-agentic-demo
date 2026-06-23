/**
 * Map a completed Companies House Forge run response → AttributeOutput[]
 *
 * The Forge run response may wrap the persona output under .output / .data /
 * .result, or expose it at the top level. We try each in order.
 */

const SOURCE     = 'Companies House';
const CONFIDENCE = 85; // LLM-extracted via Forge

/** @param {unknown} raw */
function extractOutput(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw;
  return r.output ?? r.data ?? r.result ?? r;
}

/** @param {unknown} val  @returns {string|null} */
function norm(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'object') return JSON.stringify(val);
  const s = String(val).trim();
  return !s || s.toLowerCase() === 'n/a' ? null : s;
}

/**
 * @param {unknown} runData   — raw Forge run response
 * @param {string}  _runId    — unused but kept for API symmetry with jerseyToAttributes
 * @returns {import('../../../types.js').AttributeOutput[]}
 */
export function chToAttributes(runData, _runId) {
  const d = extractOutput(runData);
  const attrs = [];
  const fetchedAt  = new Date().toISOString();
  const source_url = norm(d.source_url) ?? '';

  function push(attributeName, displayValue, extra = {}) {
    const val = norm(displayValue);
    if (!val) return;
    attrs.push({
      attributeName,
      attributeGroup:   'core',
      displayValue:     val,
      source:           SOURCE,
      confidence:       CONFIDENCE,
      idFlag:           extra.idFlag           ?? false,
      verificationFlag: extra.verificationFlag ?? false,
      exceptionFlag:    false,
      lineage: [{
        value:            val,
        source:           SOURCE,
        source_url,
        timestamp:        fetchedAt,
        confidence_score: CONFIDENCE / 100,
      }],
    });
  }

  push('entity_name',              d.entity_name);
  push('uk_registration_number',   d.registration_number, { idFlag: true, verificationFlag: true });
  push('entity_status',            d.entity_status);
  push('date_of_incorporation',    d.date_of_incorporation);
  push('legal_registered_address', d.legal_registered_address);
  push('legal_structure',          d.legal_structure);
  push('entity_source_url',        d.source_url);
  push('verification_of_existence', d.verification_of_existence != null ? String(d.verification_of_existence) : null);

  if (Array.isArray(d.previous_names) && d.previous_names.length) {
    push('previous_names', d.previous_names.filter(Boolean).join('; '));
  }

  if (Array.isArray(d.corporate_officer)) {
    d.corporate_officer.forEach((o, i) => {
      const name = norm(o.corporate_officer_name);
      const type = norm(o.corporate_officer_type);
      if (name) push(`corporate_officer_${i + 1}`, type ? `${name} (${type})` : name);
    });
  }

  if (Array.isArray(d.key_controller)) {
    d.key_controller.forEach((c, i) => {
      push(`key_controller_${i + 1}`, c.key_controller_name);
    });
  }

  if (Array.isArray(d.beneficial_owner)) {
    d.beneficial_owner.forEach((b, i) => {
      const name = norm(b.beneficial_owner_name);
      const type = norm(b.beneficial_owner_type);
      if (name) push(`beneficial_owner_${i + 1}`, type ? `${name} — ${type}` : name);
    });
  }

  return attrs;
}

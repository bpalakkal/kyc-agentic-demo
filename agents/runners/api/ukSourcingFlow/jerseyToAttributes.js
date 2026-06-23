/**
 * Map a completed Jersey FSC Forge run response → AttributeOutput[]
 */

const SOURCE     = 'Jersey FSC';
const CONFIDENCE = 85;

function extractOutput(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw;
  return r.output ?? r.data ?? r.result ?? r;
}

function norm(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'object') return JSON.stringify(val);
  const s = String(val).trim();
  return !s || s.toLowerCase() === 'n/a' ? null : s;
}

/**
 * @param {unknown} runData
 * @param {string}  _runId
 * @returns {import('../../../types.js').AttributeOutput[]}
 */
export function jerseyToAttributes(runData, _runId) {
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
  push('country_of_incorporation', d.country_of_incorporation);
  push('legal_structure',          d.legal_structure);
  push('entity_source_url',        d.source_url);

  // regulator may be an array or a string
  if (Array.isArray(d.regulator)) {
    push('regulator', d.regulator.filter(Boolean).join('; '), { verificationFlag: true });
  } else {
    push('regulator', d.regulator, { verificationFlag: true });
  }

  return attrs;
}

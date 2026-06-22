/**
 * toAttributes.js — Map merged FCA entity object → AttributeOutput[]
 *
 * Converts the output of merge.js into the AttributeOutput[] format
 * consumed by AttributePublisher → entity_attributes table.
 */

const SOURCE = 'FCA Register';

function lineage(frn) {
  return [
    {
      source: SOURCE,
      sourceUrl: `https://register.fca.org.uk/s/firm?id=${frn}`,
      fetchedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
}

/**
 * @param {object} merged  — output of mergeFcaData()
 * @param {string} frn     — resolved FRN (for lineage URL)
 * @returns {import('../../../types.js').AttributeOutput[]}
 */
export function fcaToAttributes(merged, frn) {
  const attrs = [];
  const lg    = lineage(frn || merged.entity_registration_number || '');

  function push(attributeName, attributeGroup, displayValue, extra = {}) {
    if (displayValue === null || displayValue === undefined) return;
    const val = typeof displayValue === 'object' ? JSON.stringify(displayValue) : String(displayValue);
    if (!val.trim()) return;
    attrs.push({
      attributeName,
      attributeGroup,
      displayValue: val,
      idFlag:           extra.idFlag           ?? false,
      verificationFlag: extra.verificationFlag ?? false,
      exceptionFlag:    extra.exceptionFlag    ?? false,
      lineage: lg,
    });
  }

  // ── Entity Information ────────────────────────────────────────────────────
  push('entity_name',                        'Entity Information', merged.entity_name);
  push('entity_status',                      'Entity Information', merged.entity_status);
  push('entity_principal_place_of_business', 'Entity Information', merged.entity_principal_place_of_business);
  push('entity_website_address',             'Entity Information', merged.entity_website_address);
  push('entity_source_url',                  'Entity Information', merged.entity_source_url);
  push('entity_activity_type',               'Entity Information', merged.entity_activity_type);

  // FCA registration number — marks as identification AND verification attribute
  push('entity_registration_number', 'Entity Information', merged.entity_registration_number, {
    idFlag: true,
    verificationFlag: true,
  });

  // ── Regulatory ────────────────────────────────────────────────────────────
  if (Array.isArray(merged.entity_regulator) && merged.entity_regulator.length > 0) {
    const regulatorStr = merged.entity_regulator.map(r => r.regulator_name).join('; ');
    push('entity_regulator', 'Regulatory', regulatorStr, { verificationFlag: true });
  }

  // ── Corporate Structure ───────────────────────────────────────────────────
  if (Array.isArray(merged.corporate_officer) && merged.corporate_officer.length > 0) {
    for (let i = 0; i < merged.corporate_officer.length; i++) {
      const o    = merged.corporate_officer[i];
      const disp = o.officer_type ? `${o.officer_name} (${o.officer_type})` : o.officer_name;
      push(`corporate_officer_${i + 1}`, 'Corporate Structure', disp);
    }
  }

  if (Array.isArray(merged.key_controller) && merged.key_controller.length > 0) {
    for (let i = 0; i < merged.key_controller.length; i++) {
      const c = merged.key_controller[i];
      push(`key_controller_${i + 1}`, 'Corporate Structure', c.key_controller_name);
    }
  }

  return attrs;
}

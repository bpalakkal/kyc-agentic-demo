/**
 * merge.js — FCA Registry Merge Code Node (v17.1, ported to ESM)
 *
 * Ported from the `merge_API_to_JSON` code node in fca_data_sourcing.json.
 * Accepts pre-parsed API responses (objects, not confidence-envelope strings).
 *
 * @param {object} row
 * @param {string}  row.frn
 * @param {object|null} row.firm_core        — raw response from GET /Firm/{FRN}
 * @param {object|null} row.firm_address     — raw response from GET /Firm/{FRN}/Address
 * @param {object|null} row.firm_permissions — raw response from GET /Firm/{FRN}/Permissions
 * @param {object|null} row.firm_regulators  — raw response from GET /Firm/{FRN}/Regulators
 * @param {object|null} row.firm_individuals — raw response from GET /Firm/{FRN}/Individuals
 * @param {Array|null}  row.firm_cf_pages    — array of raw CF page responses
 * @returns {object} merged entity object
 */
export function mergeFcaData(row) {
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  function safeParse(val) {
    if (val !== null && typeof val === 'object') return val; // already parsed
    if (typeof val === 'string' && val !== '') {
      try { return JSON.parse(val); } catch (e) { return null; }
    }
    return null;
  }

  const frn          = String(row.frn || '').trim();
  const coreResp     = safeParse(row.firm_core);
  const addrResp     = safeParse(row.firm_address);
  const permResp     = safeParse(row.firm_permissions);
  const regResp      = safeParse(row.firm_regulators);
  const indivsResp   = safeParse(row.firm_individuals);
  let   cfPages      = row.firm_cf_pages;
  if (typeof cfPages === 'string') cfPages = safeParse(cfPages);

  // ─────────────────────────────────────────────────────────────────────────────
  // ENUM SETS
  // ─────────────────────────────────────────────────────────────────────────────
  const VALID_STATUSES = { active: 1, inactive: 1 };

  const VALID_OFFICER_TYPES = {
    'Chief Executive Officer': 1, 'President': 1, 'Chief Financial Officer': 1,
    'Treasurer': 1, 'Chief Operating Officer': 1, 'General Partner': 1,
    'Board Director': 1, 'Board Chairman': 1, 'Chief Compliance Officer': 1,
    'Chief Investment Officer': 1, 'Chief Risk Officer': 1, 'Executive Director': 1,
    'Director': 1, 'Manager': 1, 'Managing Director': 1, 'Managing General Partner': 1,
    'Managing Member': 1, 'Designated Member': 1, 'Secretary': 1,
    'Senior Vice President': 1, 'Vice President': 1,
  };

  const VALID_REGULATORS = {
    'Financial Conduct Authority': 1,
    'Prudential Regulation Authority': 1,
    'Australian Securities and Investment Commission (ASIC)': 1,
    'Australian Prudential Regulatory Authority (APRA)': 1,
    'Financial Market Authority': 1,
    'Guernsey Financial Services Commission': 1,
    'Hong Kong Monetary Authority': 1,
    'Securities and Futures Commission': 1,
    'Jersey Financial Services Corp. (JFSC)': 1,
    'Monetary Authority of Singapore': 1,
    'Financial Services Authority (FSA)': 1,
    'Federal Reserve Board': 1,
    'Office of the Comptroller of the Currency (OCC)': 1,
    'Federal Deposit Insurance Corp. (FDIC)': 1,
    'U.S. Securities and Exchange Commission (SEC)': 1,
    'Consumer Financial Protection Bureau (CFPB)': 1,
    'Commodity Futures Trading Commission (CFTC)': 1,
    'Autorité des Marchés Financiers (AMF)': 1,
    'Bundesanstalt fur Finanzdienstleistungs-aufsicht (BaFin)': 1,
    'Banca d\'Italia Eurosistema': 1,
    'De Nederlandsche Bank Eurosysteem': 1,
    'Banco de España Eurosistema': 1,
    'Commission de Surveillance du Secteur Financier (CSSF)': 1,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TOLERANT ENUM MATCHING
  // ─────────────────────────────────────────────────────────────────────────────
  function normalizeForMatch(str) {
    if (!str) return '';
    return String(str)
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[^\w\s]+/gu, ' ')
      .trim()
      .toLowerCase();
  }

  function buildNormalizedLookup(enumSet) {
    const lookup = {};
    for (const key of Object.keys(enumSet)) lookup[normalizeForMatch(key)] = key;
    return lookup;
  }

  const NORM_STATUSES      = buildNormalizedLookup(VALID_STATUSES);
  const NORM_OFFICER_TYPES = buildNormalizedLookup(VALID_OFFICER_TYPES);
  const NORM_REGULATORS    = buildNormalizedLookup(VALID_REGULATORS);

  const NORM_LOOKUPS = [
    { enumSet: VALID_STATUSES,      normalized: NORM_STATUSES },
    { enumSet: VALID_OFFICER_TYPES, normalized: NORM_OFFICER_TYPES },
    { enumSet: VALID_REGULATORS,    normalized: NORM_REGULATORS },
  ];

  function validateEnum(value, enumSet) {
    if (value === null || value === undefined) return null;
    if (enumSet[value]) return value;
    const nv = normalizeForMatch(value);
    if (!nv) return null;
    for (const entry of NORM_LOOKUPS) {
      if (entry.enumSet === enumSet) return entry.normalized[nv] || null;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAPPING TABLES
  // ─────────────────────────────────────────────────────────────────────────────
  const STATUS_MAP = {
    'Authorised':   'active',
    'Registered':   'active',
    'Unauthorised': 'inactive',
    'Cancelled':    'inactive',
    'See full details': 'active',
    'No longer authorised': 'inactive',
    'Lapsed': 'inactive',
  };

  const OFFICER_ROLE_MAP = {
    'SMF1':  'Chief Executive Officer',
    'SMF9':  'Board Chairman',
    'SMF2':  'Chief Financial Officer',
    'SMF3':  'Executive Director',
    'SMF4':  'Chief Risk Officer',
    'SMF24': 'Chief Operating Officer',
    'SMF16': 'Chief Compliance Officer',
    'SMF10': 'Board Director',
    'SMF11': 'Board Director',
    'SMF12': 'Board Director',
    'SMF14': 'Board Director',
    'CF3':   'Director',
    'CF1':   'Director',
    'CF2':   'Board Director',
  };

  const ROLE_SENIORITY = [
    'SMF1','SMF9','SMF2','SMF3','SMF4','SMF24','SMF16',
    'SMF10','SMF11','SMF12','SMF14','CF3','CF1','CF2',
  ];

  const CONTROLLER_CODE = 'SMF9';

  const REGULATOR_NAME_MAP = {
    'FCA': 'Financial Conduct Authority',
    'PRA': 'Prudential Regulation Authority',
    'Financial Services Authority': 'Financial Services Authority (FSA)',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE FIRM CORE
  // ─────────────────────────────────────────────────────────────────────────────
  let firm;
  if (coreResp && Array.isArray(coreResp.Data) && coreResp.Data.length > 0) {
    firm = coreResp.Data[0];
  } else if (coreResp && typeof coreResp === 'object' && (coreResp['Organisation Name'] || coreResp['FRN'])) {
    firm = coreResp;
  } else {
    firm = {};
  }

  const entityName  = firm['Organisation Name'] || null;
  const rawStatus   = firm['Status']            || null;
  const rawBizType  = firm['Business Type']     || null;
  const entityStatus = validateEnum(STATUS_MAP[rawStatus] || null, VALID_STATUSES);
  const firmFound   = entityName !== null;

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE REGULATORS
  // ─────────────────────────────────────────────────────────────────────────────
  const regulatorSet  = {};
  const regulatorList = [];

  function addRegulator(rawName) {
    if (!rawName) return;
    const mapped    = REGULATOR_NAME_MAP[rawName] || rawName;
    const validated = validateEnum(mapped, VALID_REGULATORS);
    if (validated && !regulatorSet[validated]) {
      regulatorSet[validated] = 1;
      regulatorList.push(validated);
    }
  }

  let regulatorRecordsFound = false;

  function extractRegulatorEntries(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed.Data)) return parsed.Data;
    if (Array.isArray(parsed.regulators)) return parsed.regulators;
    if (Array.isArray(parsed.Regulators)) return parsed.Regulators;
    if (Array.isArray(parsed['Current Regulators'])) return parsed['Current Regulators'];
    if (Array.isArray(parsed)) return parsed;
    if (parsed['Regulator Name'] || parsed['Name']) return [parsed];
    return [];
  }

  const regulatorEntries = extractRegulatorEntries(regResp);
  if (regulatorEntries.length > 0) {
    regulatorRecordsFound = true;
    for (const regEntry of regulatorEntries) {
      const hasEnded = regEntry['Termination Date'] || regEntry['End Date'] || regEntry['EndDate'];
      if (hasEnded) continue;
      addRegulator(regEntry['Regulator Name'] || regEntry['Name']);
    }
  } else if (firmFound && entityStatus === 'active') {
    addRegulator('Financial Conduct Authority');
  }

  const regulatorObjects = regulatorList.map(r => ({ regulator_name: r }));
  const entityRegulatorLog = regulatorList.length > 0 ? regulatorList.join('; ') : null;

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE ADDRESS
  // ─────────────────────────────────────────────────────────────────────────────
  let addrRecords = [];
  if (addrResp && Array.isArray(addrResp.Data)) {
    addrRecords = addrResp.Data;
  } else if (addrResp && typeof addrResp === 'object') {
    for (const [addrTypeKey, addrVal] of Object.entries(addrResp)) {
      if (addrVal && typeof addrVal === 'object' && !Array.isArray(addrVal)) {
        addrRecords.push({ ...addrVal, 'Address Type': addrTypeKey });
      }
    }
  }

  let ppob = addrRecords.find(r => r['Address Type'] === 'Principal Place of Business');
  if (!ppob && addrRecords.length > 0) ppob = addrRecords[0];
  ppob = ppob || {};

  function toTitleCase(str) {
    if (!str) return null;
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
  }

  const countryRaw    = ppob['Country'] || null;
  const countryTitled = toTitleCase(countryRaw);

  const principalPlaceOfBusiness = [
    ppob['Address Line 1'],
    ppob['Address Line 2'],
    ppob['Address Line 3'] || ppob['Address LIne 3'],
    ppob['Address Line 4'],
    ppob['Town'],
    ppob['County'],
    ppob['Postcode'],
    countryTitled,
  ].filter(p => p && String(p).trim() !== '').join(', ') || null;

  const rawSite = ppob['Website Address'] || ppob['Website'] || null;
  const website = rawSite ? rawSite.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null;

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE PERMISSIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const PERM_EXCLUDE = {
    'CBTL Status': 1, 'CBTL Effective Date': 1, 'PSD Status': 1,
    'PSD Effective Date': 1, 'EMD Status': 1, 'EMD Effective Date': 1,
    'MLR Status': 1, 'MLR Effective Date': 1, 'CBTL arranger Status': 1,
    'CBTL advisor Status': 1, 'Acting as a CBTL arranger': 1, 'Acting as a CBTL advisor': 1,
  };

  let activityType = null;
  let activityKeys = [];

  if (permResp && permResp.Data && typeof permResp.Data === 'object' && !Array.isArray(permResp.Data)) {
    activityKeys = Object.keys(permResp.Data).filter(k => !PERM_EXCLUDE[k]);
  } else if (permResp && typeof permResp === 'object' && !Array.isArray(permResp)) {
    const looksLikeEnvelope = permResp.Status !== undefined || permResp.ResultInfo !== undefined;
    if (!looksLikeEnvelope) {
      const topKeys = Object.keys(permResp);
      const arrayKey = topKeys.find(k => Array.isArray(permResp[k]) && permResp[k].length > 0 && typeof permResp[k][0] === 'string');
      if (arrayKey) {
        activityKeys = permResp[arrayKey].slice();
      } else {
        activityKeys = topKeys.filter(k => !PERM_EXCLUDE[k]);
      }
    }
  }

  if (activityKeys.length > 0) activityType = activityKeys.join('; ');

  // ─────────────────────────────────────────────────────────────────────────────
  // PARSE CF INDIVIDUALS
  // ─────────────────────────────────────────────────────────────────────────────
  function extractRoleCode(key) {
    const m = key.match(/\)\s*((?:SMF|CF)\d+)/i);
    return m ? m[1].toUpperCase() : null;
  }

  function extractRoleCodeFlat(roleStr) {
    if (!roleStr) return null;
    const m = String(roleStr).match(/^\s*((?:SMF|CF)\d+)/i);
    return m ? m[1].toUpperCase() : null;
  }

  function extractCurrentRecords(page) {
    if (!page || typeof page !== 'object') return null;
    let merged = null;
    function merge(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (!merged) merged = {};
      Object.assign(merged, obj);
    }
    if (page.current_records && typeof page.current_records === 'object') merge(page.current_records);
    if (Array.isArray(page.Data)) {
      for (const entry of page.Data) {
        if (entry?.Current && typeof entry.Current === 'object') merge(entry.Current);
      }
    } else if (page.Data?.Current && typeof page.Data.Current === 'object') {
      merge(page.Data.Current);
    }
    if (page.Current && typeof page.Current === 'object') merge(page.Current);
    return merged;
  }

  const byIRN   = {};
  let cfShape   = 'none';

  // Try flat sample format first (some agent outputs use this)
  let flatSample = null;
  if (cfPages && !Array.isArray(cfPages) && typeof cfPages === 'object') {
    for (const sk of ['current_roles_sample', 'roles_sample', 'current_roles', 'sample']) {
      if (Array.isArray(cfPages[sk])) { flatSample = cfPages[sk]; break; }
    }
  }

  if (flatSample) {
    cfShape = `sample(${flatSample.length})`;
    for (const entry of flatSample) {
      if (!entry || typeof entry !== 'object') continue;
      const roleStr  = entry.role || entry.Role || entry['Role Name'] || null;
      const roleCode = extractRoleCodeFlat(roleStr);
      const indName  = entry.individual || entry.Individual || entry['Individual Name'] || null;
      const irn      = entry.id || entry.IRN || entry.irn || indName;
      if (!indName || !roleCode) continue;
      if (!byIRN[irn]) byIRN[irn] = { name: indName, codes: [] };
      if (!byIRN[irn].codes.includes(roleCode)) byIRN[irn].codes.push(roleCode);
    }
  } else if (Array.isArray(cfPages)) {
    cfShape = `pages(${cfPages.length})`;
    for (const rawPage of cfPages) {
      const page    = safeParse(rawPage);
      const current = extractCurrentRecords(page);
      if (!current) continue;
      for (const [roleKey, roleEntry] of Object.entries(current)) {
        const roleCode = extractRoleCode(roleKey);
        const indName  = roleEntry?.['Individual Name'] || null;
        const urlParts = (roleEntry?.['URL'] || '').split('/');
        const irn      = urlParts[urlParts.length - 1] || indName;
        if (!indName || !roleCode) continue;
        if (!byIRN[irn]) byIRN[irn] = { name: indName, codes: [] };
        if (!byIRN[irn].codes.includes(roleCode)) byIRN[irn].codes.push(roleCode);
      }
    }
  }

  const officers    = [];
  const controllers = [];

  for (const person of Object.values(byIRN)) {
    const { name, codes } = person;

    if (codes.includes(CONTROLLER_CODE)) {
      controllers.push({ key_controller_name: name, key_controller_address: null });
    }

    const topCode = ROLE_SENIORITY.find(c => codes.includes(c));
    if (topCode) {
      const mappedType    = OFFICER_ROLE_MAP[topCode] || null;
      const validatedType = validateEnum(mappedType, VALID_OFFICER_TYPES);
      if (validatedType) {
        officers.push({ officer_name: name, officer_address: null, officer_type: validatedType });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTPUT
  // ─────────────────────────────────────────────────────────────────────────────
  const reasoning = [
    `frn=${frn}`,
    `firm_found=${firmFound}`,
    `status_raw=${rawStatus} status_mapped=${entityStatus}`,
    `biztype_raw=${rawBizType}`,
    `country_raw=${countryRaw} country_titled=${countryTitled}`,
    `ppob_address=${principalPlaceOfBusiness || 'null'}`,
    `regulators=${entityRegulatorLog || 'null'} (source=${regulatorRecordsFound ? 'live' : 'fallback'})`,
    `activities=${activityType || 'null'}`,
    `indivs_endpoint=${indivsResp ? 'ok' : 'null'} cf_shape=${cfShape}`,
    `individuals=${Object.keys(byIRN).length}`,
    `officers=${officers.length} controllers=${controllers.length}`,
  ].join(' | ');

  return {
    entity_name:                        entityName,
    entity_status:                      firmFound ? entityStatus : null,
    entity_principal_place_of_business: firmFound ? principalPlaceOfBusiness : null,
    entity_registration_number:         frn,
    entity_regulator:                   firmFound ? regulatorObjects : [],
    entity_source_url:                  firmFound ? `https://register.fca.org.uk/s/firm?id=${frn}` : null,
    entity_activity_type:               firmFound ? activityType : null,
    entity_website_address:             firmFound ? website : null,
    corporate_officer:                  officers,
    key_controller:                     controllers,
    _reasoning:                         reasoning,
  };
}

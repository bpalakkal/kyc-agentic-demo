/**
 * enumNormalizer — standardize free-text agent values back to canonical enums.
 *
 * The DD agents had their enum lists stripped (for prompt size), so they now emit
 * free-text for enum-backed attributes (Country, LegalStructure, Regulator, …).
 * This maps a raw value to the canonical enum value from the master schema, or
 * flags it unmapped so the runner can raise an exception (never silent-pass).
 *
 * Canonical value lists come from schema/index.js (derived from the master).
 * Per-enum ALIASES cover common variants that aren't literal enum members.
 * Country is fully aliased; other enums start with light aliases and extend.
 *
 * Plain ESM (JS) so the JS backend / runners import it directly.
 *
 * Adapted for direct no-Forge execution.
 */
import { enumValues, enumFor, schemaMeta } from '../../schema/index.js';

/** Values that mean "not applicable" — legitimate (e.g. an individual's
 * country_of_incorporation) and must NOT be flagged as a bad enum value. */
const NA_TOKENS = new Set([
  'na', 'n/a', 'not applicable', 'notapplicable', 'none', 'nil', 'not incorporated',
  'not-incorporated', 'individual', 'unknown', 'not available', 'not provided',
]);

/** Collapse a value to a comparison key: lowercase, strip non-alphanumerics. */
function key(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

const TRUE_TOKENS = new Set(['true', 'yes', 'y', '1']);
const FALSE_TOKENS = new Set(['false', 'no', 'n', '0']);

/** Canonicalize boolean-shaped values to the schema's display convention. */
export function normalizeBoolean(value) {
  if (value === true) return { matched: true, value: 'Yes', original: value };
  if (value === false) return { matched: true, value: 'No', original: value };
  const token = String(value ?? '').trim().toLowerCase();
  if (TRUE_TOKENS.has(token)) return { matched: true, value: 'Yes', original: value };
  if (FALSE_TOKENS.has(token)) return { matched: true, value: 'No', original: value };
  return { matched: false, value, original: value };
}

/**
 * Per-enum alias maps: raw variant → canonical enum value (as spelled in the master).
 * Keys are matched after key() normalization, so "U.K.", "u k", "UK" all collapse to "uk".
 */
const ALIASES = {
  Country: {
    uk: 'United Kingdom', gb: 'United Kingdom', gbr: 'United Kingdom',
    greatbritain: 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom',
    scotland: 'United Kingdom', wales: 'United Kingdom',
    unitedkingdomofgreatbritainandnorthernireland: 'United Kingdom',
    us: 'United States', usa: 'United States', unitedstatesofamerica: 'United States',
    america: 'United States', unitedstatesofamericausa: 'United States',
    uae: 'United Arab Emirates',
    korea: 'South Korea', republicofkorea: 'South Korea', koreasouth: 'South Korea',
    koreanorth: 'North Korea', democraticpeoplesrepublicofkorea: 'North Korea',
    russianfederation: 'Russia',
    holland: 'Netherlands', thenetherlands: 'Netherlands',
    czechia: 'Czech Republic',
    ivorycoast: "Cote D'Ivoire", cotedivoire: "Cote D'Ivoire",
    burma: 'Myanmar',
    swaziland: 'Swaziland', eswatini: 'Swaziland',
    capeverde: 'Cape Verde', caboverde: 'Cape Verde',
    vietnam: 'Vietnam', socialistrepublicofvietnam: 'Vietnam',
    laos: "Laos (Lao People's Democratic Republic)",
    syria: 'Syria', syrianarabrepublic: 'Syria',
    drc: 'Congo, The Democratic Republic of The',
    democraticrepublicofthecongo: 'Congo, The Democratic Republic of The',
  },
  LegalStructure: {},
  EntityStatus: { active: 'Active', authorised: 'Active', authorized: 'Active', live: 'Active' },
  Regulator: {},
  CIPClassification: {},
};

/** Build canonical lookup for an enum once, lazily. */
const _canon = new Map();
function canonicalMap(enumName) {
  if (_canon.has(enumName)) return _canon.get(enumName);
  const map = new Map();
  for (const v of enumValues(enumName)) map.set(key(v), v);         // members map to themselves
  for (const [alias, target] of Object.entries(ALIASES[enumName] || {})) {
    map.set(key(alias), target);                                     // aliases → canonical
  }
  _canon.set(enumName, map);
  return map;
}

/**
 * Normalize a single value against a named enum.
 * @param {unknown} value
 * @param {string} enumName  e.g. "Country"
 * @returns {{ matched: boolean, value: string|null, original: string, enumName: string, na?: boolean, reason?: string }}
 */
export function normalizeEnum(value, enumName) {
  const original = value == null ? '' : String(value).trim();
  if (!original) return { matched: false, value: null, original, enumName, reason: 'empty' };

  if (NA_TOKENS.has(original.toLowerCase())) {
    return { matched: true, value: 'N/A', original, enumName, na: true };
  }
  const map = canonicalMap(enumName);
  const hit = map.get(key(original));
  if (hit) return { matched: true, value: hit, original, enumName };

  return { matched: false, value: original, enumName, reason: 'unmapped' };
}

/**
 * Resolve an attribute NAME (entity-level canonical, or a flattened numbered
 * party name like "beneficial_owner_1_nationality") to its schema attr path for
 * enum lookup. Returns null if the attribute isn't enum-backed.
 */
export function resolveEnumPath(name) {
  if (!name) return null;
  if (enumFor(name)) return name;                 // entity-level canonical
  const m = String(name).match(/^(.+?)_(\d+)_(.+)$/); // <role>_<idx>_<child>
  if (m) {
    const role = m[1];
    const child = m[3];
    const path = `${role}.${role}_${child}`;      // e.g. beneficial_owner.beneficial_owner_nationality
    if (enumFor(path)) return path;
  }
  return null;
}

/**
 * Normalize a value for a specific attribute path OR name. Looks up the value-
 * enum from the schema (resolving numbered party names); if not enum-backed,
 * passes through. Handles array-valued attributes element-wise.
 * @returns {{ matched: boolean, value: any, original: any, enumName: string|null, unmapped?: string[] }}
 */
export function normalizeForAttribute(value, attrPath) {
  const resolvedPath = schemaMeta.attributes[attrPath]
    ? attrPath
    : (resolveEnumPath(attrPath) ?? attrPath);
  if (schemaMeta.attributes[resolvedPath]?.dataType === 'boolean') {
    if (Array.isArray(value)) {
      const results = value.map(normalizeBoolean);
      const unmapped = results.filter(result => !result.matched).map(result => String(result.original));
      return {
        matched: unmapped.length === 0,
        value: results.map(result => result.value),
        original: value,
        enumName: null,
        dataType: 'boolean',
        ...(unmapped.length ? { unmapped } : {}),
      };
    }
    const result = normalizeBoolean(value);
    return {
      matched: result.matched,
      value: result.value,
      original: value,
      enumName: null,
      dataType: 'boolean',
      ...(result.matched ? {} : { unmapped: [String(value)] }),
    };
  }

  const enumName = enumFor(attrPath) ? enumFor(attrPath) : (enumFor(resolveEnumPath(attrPath) ?? '') || null);
  if (!enumName) return { matched: true, value, original: value, enumName: null };

  if (Array.isArray(value)) {
    const out = [];
    const unmapped = [];
    for (const el of value) {
      const r = normalizeEnum(el, enumName);
      out.push(r.value);
      if (!r.matched) unmapped.push(String(el));
    }
    return { matched: unmapped.length === 0, value: out, original: value, enumName, unmapped };
  }

  const r = normalizeEnum(value, enumName);
  return {
    matched: r.matched, value: r.value, original: value, enumName,
    ...(r.matched ? {} : { unmapped: [String(value)] }),
    ...(r.na ? { na: true } : {}),
  };
}

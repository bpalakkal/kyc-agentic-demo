/**
 * schemaAttrs — app-facing helpers over the canonical schema-meta (schema/).
 *
 * Single source of truth for which attributes the UI shows, per entity type,
 * with applicability (not_applicable hidden, optional badged). Replaces the
 * former hardcoded MASTER_CORE_ATTRS list so the UI never drifts from the master.
 */
import { getVisibleAttributes, schemaMeta, entityTypeByAlias, applicability, arrayAttributes } from '@schema';

/** Only entity type defined today (RIA); falls back to the first in the master. */
export const DEFAULT_ENTITY_TYPE: string =
  entityTypeByAlias('RIA') ?? Object.keys(schemaMeta.entityTypes)[0];

/** Structural/metadata keys that live in the schema but aren't display attributes. */
const METADATA_ATTRS = new Set(['case_id', 'entity_id']);

// Approved RIA Attribute View contract from PORT_ATTRIBUTE_VIEW.md and its
// supporting master schema. Keeping the view allowlisted prevents legacy and
// WGQ paths in the broader repository schema from leaking into the core grid.
const RIA_CORE_ATTRS = [
  'entity_name', 'entity_status', 'country_of_incorporation', 'registration_country',
  'date_of_incorporation', 'registration_number', 'verification_of_existence',
  'entity_giin', 'lei_code', 'previous_names', 'trading_names',
  'transacting_with_own_or_third_party_funds_indicator', 'cip_classification',
  'legal_structure', 'entity_risk_rating', 'wbq_flag', 'legal_registered_address',
  'principal_place_of_business', 'entity_nature_of_business', 'other_business_activity',
  'sole_proprietorship_indicator', 'parent_publicly_listed_on_united_states_exchange_indicator',
  'source_of_wealth', 'website_address', 'regulator', 'activity_type', 'listed_exchange',
  'listing_status', 'commodities_future_trading_commission_registered_indicator',
  'securities_exchange_act_of_1934_section_13_or_15d_indicator',
  'tax_identification_number', 'fca_firm_reference_number',
] as const;

const RIA_OPTIONAL = new Set(['activity_type', 'entity_giin', 'lei_code', 'other_business_activity', 'website_address']);
const RIA_ID_AND_V = new Set([
  'entity_name', 'entity_status', 'country_of_incorporation', 'registration_country',
  'date_of_incorporation', 'registration_number', 'verification_of_existence',
  'entity_giin', 'lei_code', 'legal_structure', 'entity_risk_rating',
  'legal_registered_address', 'principal_place_of_business', 'other_business_activity',
  'source_of_wealth', 'website_address', 'regulator', 'activity_type',
  'tax_identification_number', 'wbq_flag', 'fca_firm_reference_number',
]);
const RIA_ID_ONLY = new Set([
  'cip_classification', 'commodities_future_trading_commission_registered_indicator',
  'entity_nature_of_business', 'listed_exchange', 'listing_status',
  'parent_publicly_listed_on_united_states_exchange_indicator', 'previous_names',
  'securities_exchange_act_of_1934_section_13_or_15d_indicator',
  'sole_proprietorship_indicator', 'trading_names',
  'transacting_with_own_or_third_party_funds_indicator',
]);

/**
 * Visible entity-level (non-party) scalar attribute names for an entity type,
 * excluding not_applicable. Party objects (beneficial_owner, …) render as tables,
 * so their dotted child paths are filtered out here.
 */
export function entityLevelCoreAttrs(entityType: string = DEFAULT_ENTITY_TYPE): string[] {
  if (!entityType || entityType === DEFAULT_ENTITY_TYPE) return [...RIA_CORE_ATTRS];
  const { required, optional } = getVisibleAttributes(entityType);
  return [...required, ...optional].filter((p) => {
    const m = schemaMeta.attributes[p];
    return !!m && m.kind === 'scalar' && !m.party && !p.includes('.') && !METADATA_ATTRS.has(p);
  });
}

/** Entity-level attribute names that are 'optional' (collect if provided, no IDV). */
export function optionalCoreAttrs(entityType: string = DEFAULT_ENTITY_TYPE): Set<string> {
  if (!entityType || entityType === DEFAULT_ENTITY_TYPE) return new Set(RIA_OPTIONAL);
  return new Set(getVisibleAttributes(entityType).optional.filter((p) => !p.includes('.')));
}

export function attributeChecks(attrName: string, entityType: string = DEFAULT_ENTITY_TYPE): { id: boolean; verification: boolean } {
  if (!entityType || entityType === DEFAULT_ENTITY_TYPE) {
    return { id: RIA_ID_AND_V.has(attrName) || RIA_ID_ONLY.has(attrName), verification: RIA_ID_AND_V.has(attrName) };
  }
  const verifiable = schemaMeta.attributes[attrName]?.verifiable;
  return { id: verifiable !== null && verifiable !== undefined, verification: verifiable === true };
}

/**
 * The DD agents (derived from schema-meta): unique agent keys with a Forge slug
 * (ria_x_idv → ria-x-idv) and a readable label. Powers the "Due Diligence"
 * trigger dropdown (each agent → POST /dd/run { slugs:[slug] }).
 */
export function ddAgentList(): Array<{ slug: string; label: string; agentKey: string }> {
  const keys = new Set<string>();
  for (const m of Object.values(schemaMeta.attributes)) {
    if (m.ddAgent) keys.add(m.ddAgent);
  }
  return Array.from(keys).sort().map((agentKey) => ({
    agentKey,
    slug: agentKey.replace(/_/g, '-'),
    label: agentKey
      .replace(/^ria_/, '').replace(/_(idv|id)$/, '').replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

/** Party array names that aren't people (rendered elsewhere). */
const NON_PERSON_ARRAYS = new Set(['documents']);

/** Human labels for party roles (fallback: title-case the role). */
const PARTY_LABELS: Record<string, string> = {
  beneficial_owner: 'Beneficial Owners',
  Proxy_BO: 'Proxy Beneficial Owners',
  corporate_officer: 'Corporate Officers',
  authorized_signatory: 'Authorized Signatories',
  board_director: 'Board Directors',
  key_controller: 'Key Controllers',
  trustee: 'Trustees',
  investment_advisor: 'Investment Advisors',
  power_of_attorney: 'Powers of Attorney',
  acting_person: 'Acting Persons',
  sub_advisor: 'Sub-Advisors',
};
const RIA_PARTY_COLUMNS: Record<string, string[]> = {
  authorized_signatory: ['address', 'country', 'legal_structure', 'signatory_date', 'signature', 'title'],
  beneficial_owner: ['address', 'cip_classification', 'country_of_incorporation', 'country_of_residence', 'date_of_birth', 'evidence_of_existence', 'legal_structure', 'nationality', 'nature_of_business', 'past_nationality', 'percentage_of_ownership'],
  Proxy_BO: ['address', 'cip_classification', 'country_of_incorporation', 'country_of_residence', 'date_of_birth', 'evidence_of_existence', 'legal_structure', 'nationality', 'nature_of_business', 'past_nationality', 'percentage_of_ownership'],
  corporate_officer: ['correspondence_address', 'country', 'country_of_incorporation', 'country_of_residence', 'date_of_birth', 'cip_classification', 'legal_structure', 'nationality', 'regulator', 'role'],
};
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Party (person-array) sections that are applicable for an entity type — the
 * ones NOT marked not_applicable. Each carries its label + applicable columns.
 * Used to ALWAYS render the party tables for the entity type (populated if
 * records exist, empty-state otherwise), mirroring the entity attribute grid.
 */
export function visibleParties(entityType: string = DEFAULT_ENTITY_TYPE): Array<{ role: string; label: string; columns: string[] }> {
  if (!entityType || entityType === DEFAULT_ENTITY_TYPE) {
    return Object.entries(RIA_PARTY_COLUMNS).map(([role, columns]) => ({ role, label: PARTY_LABELS[role] ?? titleCase(role), columns }));
  }
  return arrayAttributes()
    .filter((a) => !NON_PERSON_ARRAYS.has(a.name) && applicability(entityType, a.name) !== 'not_applicable')
    .map((a) => ({ role: a.name, label: PARTY_LABELS[a.name] ?? titleCase(a.name), columns: partyColumns(a.name, entityType) }));
}

/** Map an app person-role (lowercase) to the schema party key (may be cased, e.g. Proxy_BO). */
function schemaPartyKey(role: string): string | null {
  if (schemaMeta.attributes[role]?.kind === 'array') return role;
  const lower = role.toLowerCase();
  return (
    Object.keys(schemaMeta.attributes).find(
      (k) => schemaMeta.attributes[k].kind === 'array' && k.toLowerCase() === lower,
    ) ?? null
  );
}

/**
 * Applicable person-table columns (short field names) for a party role and
 * entity type. not_applicable child fields are excluded; the name field is the
 * row header, not a column. Returns [] for app-only roles not in the master
 * (e.g. board_director, key_controller) — those fall back to data-derived columns.
 */
export function partyColumns(role: string, entityType: string = DEFAULT_ENTITY_TYPE): string[] {
  if ((!entityType || entityType === DEFAULT_ENTITY_TYPE) && RIA_PARTY_COLUMNS[role]) return [...RIA_PARTY_COLUMNS[role]];
  const party = schemaPartyKey(role);
  if (!party) return [];
  const prefix = party + '.';
  const cols: string[] = [];
  for (const [p, m] of Object.entries(schemaMeta.attributes)) {
    if (!p.startsWith(prefix) || m.kind !== 'scalar') continue;
    if (applicability(entityType, p) === 'not_applicable') continue;
    const child = m.child ?? '';
    const short = child.startsWith(party + '_') ? child.slice(party.length + 1) : child;
    if (short && short !== 'name') cols.push(short);
  }
  return cols;
}

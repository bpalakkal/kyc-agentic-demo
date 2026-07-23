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

/**
 * Visible entity-level (non-party) scalar attribute names for an entity type,
 * excluding not_applicable. Party objects (beneficial_owner, …) render as tables,
 * so their dotted child paths are filtered out here.
 */
export function entityLevelCoreAttrs(entityType: string = DEFAULT_ENTITY_TYPE): string[] {
  const { required, optional } = getVisibleAttributes(entityType);
  return [...required, ...optional].filter((p) => {
    const m = schemaMeta.attributes[p];
    const parent = m?.party ? schemaMeta.attributes[m.party] : null;
    const isEntityField = !m?.party && !p.includes('.');
    const isEntityGroupField = parent?.kind === 'array' && parent.collectionType === 'group';
    return !!m && m.kind === 'scalar' && (isEntityField || isEntityGroupField) && !METADATA_ATTRS.has(p);
  });
}

/** Entity-level attribute names that are 'optional' (collect if provided, no IDV). */
export function optionalCoreAttrs(entityType: string = DEFAULT_ENTITY_TYPE): Set<string> {
  return new Set(getVisibleAttributes(entityType).optional.filter((p) => !p.includes('.')));
}

export function attributeChecks(attrName: string, entityType: string = DEFAULT_ENTITY_TYPE): { id: boolean; verification: boolean } {
  if (applicability(entityType, attrName) === 'not_applicable') return { id: false, verification: false };
  const meta = schemaMeta.attributes[attrName];
  return { id: meta?.identifiable === true, verification: meta?.verifiable === true };
}

/** Generated rendering contract for one field (control, enum, default, label). */
export function attributeUi(attrName: string) {
  return schemaMeta.attributes[attrName] ?? null;
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
const NON_PERSON_ARRAYS = new Set(['documents', 'regulator']);

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

/**
 * schema/index.js — typed accessor over the canonical schema-meta.
 *
 * Plain ESM (JSDoc-typed) so BOTH the TS frontend (Vite) and the JS backend
 * (server.js / agents) can import it. Types live in index.d.ts.
 *
 * schema-meta.json is generated from the canonical master by
 * scripts/build-schema-meta.mjs — never hand-edit it.
 */
import schemaMeta from './schema-meta.js';

export { schemaMeta };

/** All enum value-lists ($defs), keyed by enum name (e.g. "Country"). */
export const enums = schemaMeta.enums;

/** @returns {string[]} canonical values for an enum, or [] if unknown. */
export function enumValues(enumName) {
  return schemaMeta.enums[enumName] ?? [];
}

/** @returns {string|null} the value-enum name for an attribute path, or null. */
export function enumFor(attrPath) {
  return schemaMeta.attributes[attrPath]?.valueEnum ?? null;
}

/** @returns {boolean} whether the DD agent verifies (ID+V) this attribute. */
export function isVerifiable(attrPath) {
  return Boolean(schemaMeta.attributes[attrPath]?.verifiable);
}

/** @returns {string|null} the DD agent key that produces this attribute. */
export function ddAgentFor(attrPath) {
  return schemaMeta.attributes[attrPath]?.ddAgent ?? null;
}

/** Object/array attributes (parties + documents) rendered as tables in the UI. */
export function arrayAttributes() {
  return Object.entries(schemaMeta.attributes)
    .filter(([, m]) => m.kind === 'array')
    .map(([name, m]) => ({ name, children: m.children ?? [] }));
}

/** All entity-type keys (cip_classification values). */
export function entityTypes() {
  return Object.keys(schemaMeta.entityTypes);
}

/** Resolve an entity-type key from its alias (e.g. "RIA"). */
export function entityTypeByAlias(alias) {
  return entityTypes().find((k) => schemaMeta.entityTypes[k].alias === alias) ?? null;
}

/**
 * Applicability of an attribute for an entity type.
 * Object names cascade to their children (a party marked N/A hides all its fields).
 * Unlisted → 'required'.
 * @returns {'required'|'optional'|'not_applicable'}
 */
export function applicability(entityType, attrPath) {
  const cfg = schemaMeta.entityTypes[entityType];
  if (!cfg) return 'required';
  const na = cfg.not_applicable;
  const opt = cfg.optional;
  const parent = attrPath.includes('.') ? attrPath.split('.')[0] : null;

  if (na.includes(attrPath) || (parent && na.includes(parent))) return 'not_applicable';
  if (opt.includes(attrPath) || (parent && opt.includes(parent))) return 'optional';
  return 'required';
}

/** @returns {boolean} visible in the UI for this entity type (required or optional). */
export function isVisible(entityType, attrPath) {
  return applicability(entityType, attrPath) !== 'not_applicable';
}

/**
 * Visible attributes for an entity type, split by applicability.
 * Scalar entity-level + array/party attributes (children filtered by applicability).
 * @returns {{ required: string[], optional: string[] }}
 */
export function getVisibleAttributes(entityType) {
  const required = [];
  const optional = [];
  for (const [path, m] of Object.entries(schemaMeta.attributes)) {
    if (m.kind === 'object') continue;
    const app = applicability(entityType, path);
    if (app === 'not_applicable') continue;
    (app === 'optional' ? optional : required).push(path);
  }
  return { required, optional };
}

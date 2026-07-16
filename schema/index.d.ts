/**
 * Types for schema/index.js — the typed accessor over the canonical schema-meta.
 */

export type Applicability = 'required' | 'optional' | 'not_applicable';
export type AttributeKind = 'scalar' | 'array' | 'object';

export interface AttributeMeta {
  kind: AttributeKind;
  /** party/object name this attribute belongs to (null for entity-level scalars) */
  party?: string | null;
  /** child property name within a party object */
  child?: string | null;
  /** value-enum name (e.g. "Country") if the value is enum-constrained */
  valueEnum?: string | null;
  /** DD agent verifies (ID+V) this attribute */
  verifiable?: boolean | null;
  /** DD agent key that produces this attribute */
  ddAgent?: string | null;
  /** child attribute paths for kind === 'array' | 'object' */
  children?: string[];
  description?: string | null;
}

export interface EntityTypeMeta {
  alias: string | null;
  not_applicable: string[];
  optional: string[];
}

export interface SchemaMeta {
  generatedAt: string;
  entityTypes: Record<string, EntityTypeMeta>;
  attributes: Record<string, AttributeMeta>;
  enums: Record<string, string[]>;
}

export const schemaMeta: SchemaMeta;
export const enums: Record<string, string[]>;

export function enumValues(enumName: string): string[];
export function enumFor(attrPath: string): string | null;
export function isVerifiable(attrPath: string): boolean;
export function ddAgentFor(attrPath: string): string | null;
export function arrayAttributes(): Array<{ name: string; children: string[] }>;
export function entityTypes(): string[];
export function entityTypeByAlias(alias: string): string | null;
export function applicability(entityType: string, attrPath: string): Applicability;
export function isVisible(entityType: string, attrPath: string): boolean;
export function getVisibleAttributes(entityType: string): { required: string[]; optional: string[] };

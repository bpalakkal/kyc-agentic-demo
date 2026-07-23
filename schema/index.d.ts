/**
 * Types for schema/index.js — the typed accessor over the canonical schema-meta.
 */

export type Applicability = 'required' | 'optional' | 'not_applicable';
export type AttributeKind = 'scalar' | 'array' | 'object';
export type FieldControl =
  | 'text' | 'textarea' | 'select' | 'multiselect'
  | 'date' | 'datetime-local' | 'url' | 'number' | 'checkbox';
export type CollectionType = 'party' | 'documents' | 'group';

export interface AttributeMeta {
  kind: AttributeKind;
  /** party/object name this attribute belongs to (null for entity-level scalars) */
  party?: string | null;
  /** child property name within a party object */
  child?: string | null;
  label?: string;
  dataType?: string;
  format?: string | null;
  control?: FieldControl;
  /** value-enum name (e.g. "Country") if the value is enum-constrained */
  valueEnum?: string | null;
  options?: string[];
  defaultValue?: unknown;
  required?: boolean;
  multi?: boolean;
  exception?: boolean;
  collectionType?: CollectionType;
  /** Master schema requires identification for this attribute */
  identifiable?: boolean;
  /** Master schema requires verification for this attribute */
  verifiable?: boolean;
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
  schemaVersion: string;
  generatedAt: string;
  required: string[];
  entityTypes: Record<string, EntityTypeMeta>;
  attributes: Record<string, AttributeMeta>;
  enums: Record<string, string[]>;
  exceptionModel: Record<string, {
    dataType: string;
    control: FieldControl;
    valueEnum?: string;
    options?: string[];
    defaultValue?: unknown;
  }>;
  screening: {
    title: string;
    required: string[];
    schema: Record<string, unknown>;
  };
  ui: {
    entityFields: string[];
    collections: string[];
  };
}

export const schemaMeta: SchemaMeta;
export const enums: Record<string, string[]>;
export const schemaVersion: string;
export const requiredCaseFields: string[];
export const exceptionModel: SchemaMeta['exceptionModel'];
export const screeningSchema: SchemaMeta['screening'];

export function enumValues(enumName: string): string[];
export function enumFor(attrPath: string): string | null;
export function isVerifiable(attrPath: string): boolean;
export function ddAgentFor(attrPath: string): string | null;
export function arrayAttributes(): Array<{ name: string; children: string[] }>;
export function entityFormFields(): Array<AttributeMeta & { path: string }>;
export function schemaCollections(): Array<AttributeMeta & {
  name: string;
  fields: Array<AttributeMeta & { path: string }>;
}>;
export function entityTypes(): string[];
export function entityTypeByAlias(alias: string): string | null;
export function applicability(entityType: string, attrPath: string): Applicability;
export function isVisible(entityType: string, attrPath: string): boolean;
export function getVisibleAttributes(entityType: string): { required: string[]; optional: string[] };

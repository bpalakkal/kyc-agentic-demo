/**
 * Compile the canonical KYC and screening JSON schemas into the small runtime
 * model consumed by the UI and backend. Generated files must never be edited.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(scriptDir, '..', 'schema');
const masterText = readFileSync(join(schemaDir, 'kyc_master_attribute_schema.json'), 'utf8');
const screeningText = readFileSync(join(schemaDir, 'screening_results_schema.json'), 'utf8');
const master = JSON.parse(masterText);
const screening = JSON.parse(screeningText);
const registry = JSON.parse(readFileSync(join(schemaDir, 'dd-registry.json'), 'utf8'));

const defs = master.$defs || {};
const props = master.properties || {};
const ria = registry.attributes || {};
const rootRequired = new Set(master.required || []);
const version = createHash('sha256')
  .update(masterText)
  .update('\0')
  .update(screeningText)
  .digest('hex')
  .slice(0, 16);

const isScalar = (block) => block && typeof block === 'object' &&
  ('lineage' in block || 'id_flag' in block);
const valueNode = (block) => block?.lineage?.items?.properties?.value ?? null;
const valueRef = (value) => value?.$ref ?? value?.items?.$ref ?? null;
const enumName = (ref) => (ref ? ref.split('/').pop() : null);
const agentOf = (key) => ria[key]?.agent ?? null;
const humanize = (value) => value
  .replace(/\./g, ' ')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

function fieldType(value) {
  if (!value) return 'string';
  if (value.type === 'array') return 'array';
  if (value.type) return value.type;
  if (value.$ref) return 'string';
  return 'string';
}

function fieldControl(value, ref) {
  if (ref) return value?.type === 'array' ? 'multiselect' : 'select';
  if (value?.type === 'boolean') return 'checkbox';
  if (value?.type === 'number' || value?.type === 'integer') return 'number';
  if (value?.format === 'date') return 'date';
  if (value?.format === 'date-time') return 'datetime-local';
  if (value?.format === 'uri') return 'url';
  return 'text';
}

function collectionType(name) {
  if (name === 'documents') return 'documents';
  if (name === 'regulator') return 'group';
  return 'party';
}

const meta = {
  schemaVersion: version,
  generatedAt: new Date().toISOString(),
  source: {
    master: 'kyc_master_attribute_schema.json',
    screening: 'screening_results_schema.json',
  },
  required: [...rootRequired],
  entityTypes: {},
  attributes: {},
  enums: {},
  exceptionModel: {},
  screening: {
    title: screening.title ?? 'Screening Results',
    required: screening.required ?? [],
    schema: screening,
  },
  ui: {
    entityFields: [],
    collections: [],
  },
};

for (const [name, definition] of Object.entries(defs)) {
  if (definition && typeof definition === 'object' && Array.isArray(definition.enum)) {
    meta.enums[name] = definition.enum;
  }
}

function emitScalar(path, block, party = null, child = null, required = false) {
  const value = valueNode(block);
  const ref = valueRef(value);
  const resolvedEnum = enumName(ref);
  const item = value?.type === 'array' ? value.items : value;
  meta.attributes[path] = {
    kind: 'scalar',
    party,
    child,
    label: humanize(child ?? path),
    dataType: fieldType(value),
    format: item?.format ?? value?.format ?? null,
    control: fieldControl(value, ref),
    valueEnum: resolvedEnum,
    options: resolvedEnum ? (meta.enums[resolvedEnum] ?? []) : undefined,
    defaultValue: value?.default ?? defs[resolvedEnum]?.default ?? undefined,
    multi: value?.type === 'array' || undefined,
    required,
    identifiable: Object.hasOwn(block, 'id_flag'),
    verifiable: Object.hasOwn(block, 'verification_flag'),
    ddAgent: agentOf(party ? child : path),
    description: block?.description ?? null,
    exception: Object.hasOwn(block, 'exception_flag'),
  };
}

for (const [name, block] of Object.entries(props)) {
  if (isScalar(block)) {
    emitScalar(name, block, null, null, rootRequired.has(name));
    meta.ui.entityFields.push(name);
    continue;
  }

  if (block?.type === 'array' && block.items) {
    const children = block.items.properties || {};
    const requiredChildren = new Set(block.items.required || []);
    const childNames = Object.entries(children)
      .filter(([, childBlock]) => isScalar(childBlock))
      .map(([childName]) => childName);
    meta.attributes[name] = {
      kind: 'array',
      party: name,
      label: humanize(name),
      collectionType: collectionType(name),
      children: childNames,
      required: rootRequired.has(name),
      description: block.description ?? null,
    };
    meta.ui.collections.push(name);
    for (const [childName, childBlock] of Object.entries(children)) {
      if (isScalar(childBlock)) {
        emitScalar(
          `${name}.${childName}`,
          childBlock,
          name,
          childName,
          requiredChildren.has(childName),
        );
      }
    }
    continue;
  }

  if (block?.type === 'object' && block.properties) {
    meta.attributes[name] = {
      kind: 'object',
      label: humanize(name),
      children: Object.keys(block.properties),
      required: rootRequired.has(name),
      description: block.description ?? null,
    };
    continue;
  }

  meta.attributes[name] = {
    kind: 'scalar',
    party: null,
    label: humanize(name),
    dataType: block?.type ?? 'string',
    format: block?.format ?? null,
    control: fieldControl(block, block?.$ref),
    valueEnum: enumName(block?.$ref),
    required: rootRequired.has(name),
    description: block?.description ?? null,
  };
  meta.ui.entityFields.push(name);
}

const firstExceptionBlock = Object.values(meta.attributes)
  .find((attribute) => attribute.kind === 'scalar' && attribute.exception);
if (firstExceptionBlock) {
  meta.exceptionModel = {
    exception_flag: {
      dataType: 'string',
      control: 'select',
      options: ['Yes', 'No'],
      defaultValue: 'No',
    },
    exception_assessments: {
      dataType: 'array',
      control: 'exception-assessments',
      item: {
        exception_type: {
          dataType: 'string',
          control: 'select',
          valueEnum: 'ExceptionType',
          options: meta.enums.ExceptionType ?? [],
        },
        exception_reasoning: { dataType: 'string', control: 'textarea' },
      },
    },
    exception_recommendation: { dataType: 'string', control: 'textarea' },
  };
}

const applicability = master['x-entity-type-applicability'] || {};
for (const [entityType, config] of Object.entries(applicability)) {
  if (entityType === '_description' || !config || typeof config !== 'object') continue;
  meta.entityTypes[entityType] = {
    alias: config.alias ?? null,
    not_applicable: [...(config.not_applicable || [])].sort(),
    optional: [...(config.optional || [])].sort(),
  };
}

writeFileSync(join(schemaDir, 'schema-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
writeFileSync(
  join(schemaDir, 'schema-meta.js'),
  `// AUTO-GENERATED by scripts/build-schema-meta.mjs — do not edit.\nexport default ${JSON.stringify(meta)};\n`,
);

const attributePaths = Object.keys(meta.attributes);
const enumNames = Object.keys(meta.enums);
const quoteUnion = (values) => values.length
  ? values.map((value) => JSON.stringify(value)).join(' | ')
  : 'never';
const generatedTypes = `// AUTO-GENERATED by scripts/build-schema-meta.mjs — do not edit.
export type KycAttributePath = ${quoteUnion(attributePaths)};
export type KycEnumName = ${quoteUnion(enumNames)};
export type RequiredCaseField = ${quoteUnion(meta.required)};

export interface GeneratedKycCaseInput {
${meta.required.map((name) => `  ${JSON.stringify(name)}: unknown;`).join('\n')}
  [attribute: string]: unknown;
}
`;
writeFileSync(join(schemaDir, 'schema-types.generated.d.ts'), generatedTypes);

const allAttributes = Object.values(meta.attributes);
console.log('[schema-meta] version:', version);
console.log('[schema-meta] entity types:', Object.keys(meta.entityTypes).length);
console.log('[schema-meta] attributes:', allAttributes.length,
  '| scalar:', allAttributes.filter((attribute) => attribute.kind === 'scalar').length,
  '| collections:', allAttributes.filter((attribute) => attribute.kind === 'array').length);
console.log('[schema-meta] required case fields:', meta.required.join(', '));
console.log('[schema-meta] enums:', Object.keys(meta.enums).length);

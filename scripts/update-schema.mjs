/**
 * Validate and compile schema files after they are placed in schema/.
 *
 * Optional:
 *   node scripts/update-schema.mjs --master <path> --screening <path>
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const schemaDir = join(rootDir, 'schema');
const masterPath = join(schemaDir, 'kyc_master_attribute_schema.json');
const screeningPath = join(schemaDir, 'screening_results_schema.json');
const metaPath = join(schemaDir, 'schema-meta.json');
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function copyOption(name, destination) {
  const value = option(name);
  if (!value) return;
  const source = isAbsolute(value) ? value : resolve(process.cwd(), value);
  if (!existsSync(source)) throw new Error(`${name} file does not exist: ${source}`);
  copyFileSync(source, destination);
  console.log(`[schema:update] copied ${source}`);
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function resolveLocalRef(schema, ref) {
  if (!ref.startsWith('#/')) return true;
  let current = schema;
  for (const rawPart of ref.slice(2).split('/')) {
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~');
    current = current?.[part];
    if (current === undefined) return false;
  }
  return true;
}

function validateSchema(schema, label) {
  const errors = [];
  if (schema?.type !== 'object') errors.push('root type must be "object"');
  if (!schema?.properties || typeof schema.properties !== 'object') {
    errors.push('root properties object is required');
  }
  for (const required of schema?.required ?? []) {
    if (!Object.hasOwn(schema.properties ?? {}, required)) {
      errors.push(`required field "${required}" is not defined in root properties`);
    }
  }

  function walk(node, path = '$') {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'array' && !node.items) errors.push(`${path}: array is missing items`);
    if (typeof node.$ref === 'string' && !resolveLocalRef(schema, node.$ref)) {
      errors.push(`${path}: unresolved reference ${node.$ref}`);
    }
    if (Object.hasOwn(node, 'exception_flag')) {
      for (const field of [
        'exception_flag',
        'exception_assessments',
        'exception_recommendation',
      ]) {
        if (!Object.hasOwn(node, field)) errors.push(`${path}: missing ${field}`);
      }
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
  }
  walk(schema);

  if (errors.length) {
    throw new Error(`${label} validation failed:\n- ${errors.join('\n- ')}`);
  }
}

function summarize(before, after) {
  if (!before) return;
  const beforePaths = new Set(Object.keys(before.attributes ?? {}));
  const afterPaths = new Set(Object.keys(after.attributes ?? {}));
  const added = [...afterPaths].filter((path) => !beforePaths.has(path));
  const removed = [...beforePaths].filter((path) => !afterPaths.has(path));
  console.log(`[schema:update] added attributes: ${added.length}${added.length ? ` (${added.join(', ')})` : ''}`);
  console.log(`[schema:update] removed attributes: ${removed.length}${removed.length ? ` (${removed.join(', ')})` : ''}`);
}

try {
  copyOption('--master', masterPath);
  copyOption('--screening', screeningPath);

  const before = existsSync(metaPath) ? parseJson(metaPath, 'Existing schema metadata') : null;
  const master = parseJson(masterPath, 'Master schema');
  const screening = parseJson(screeningPath, 'Screening schema');
  validateSchema(master, 'Master schema');
  validateSchema(screening, 'Screening schema');

  await import(`./build-schema-meta.mjs?update=${Date.now()}`);

  const after = parseJson(metaPath, 'Generated schema metadata');
  summarize(before, after);
  console.log('[schema:update] schema validation and generation complete');
} catch (error) {
  console.error(`[schema:update] ${error.message}`);
  process.exit(1);
}

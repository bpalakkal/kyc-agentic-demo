/**
 * Reset and seed the RIA synthetic test cases as brand-new onboardings.
 *
 * Dry run (default): node scripts/seed-ria-test-cases.mjs
 * Execute:           node scripts/seed-ria-test-cases.mjs --execute
 * Custom source:     node scripts/seed-ria-test-cases.mjs --source "C:\\path\\to\\RIA Test Cases"
 *
 * Entity names are compared case-insensitively after whitespace normalization.
 * When the source contains the same name more than once, the lowest numbered
 * Test Case wins and the later case is skipped.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = dirname(fileURLToPath(import.meta.url));

for (const envPath of [resolve(scriptDir, '../.env'), resolve(scriptDir, '../../.env')]) {
  try {
    const env = readFileSync(envPath, 'utf8');
    for (const line of env.split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      if (!process.env[key]) process.env[key] = line.slice(separator + 1).trim();
    }
  } catch { /* environment may be injected */ }
}

const execute = process.argv.includes('--execute');
const sourceIndex = process.argv.indexOf('--source');
const sourceDir = resolve(sourceIndex >= 0
  ? process.argv[sourceIndex + 1]
  : resolve(scriptDir, '../../../RIA Test Cases'));
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (sourceIndex >= 0 && !process.argv[sourceIndex + 1]) {
  console.error('--source requires a directory path');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = 'kyc-files';
const normalizeName = value => value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US');
const caseNumber = label => Number(label.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);

function extractEntityName(json, file) {
  const value = json.entity_name;
  const name = typeof value === 'string' ? value : value?.lineage?.[0]?.value;
  if (!name?.trim()) throw new Error(`${file}: entity_name.lineage[0].value is missing`);
  return name.trim();
}

function loadCases() {
  const rows = [];
  for (const folder of readdirSync(sourceDir)) {
    const folderPath = join(sourceDir, folder);
    if (!statSync(folderPath).isDirectory()) continue;
    for (const filename of readdirSync(folderPath).filter(name => name.toLowerCase().endsWith('.json'))) {
      const file = join(folderPath, filename);
      const json = JSON.parse(readFileSync(file, 'utf8'));
      const entityId = String(json.entity_id ?? '').trim();
      const caseId = String(json.case_id ?? '').trim();
      if (!entityId || !caseId) throw new Error(`${file}: entity_id and case_id are required`);
      rows.push({
        folder,
        filename,
        entity_id: entityId,
        case_id: caseId,
        kyc_ref: `${entityId}_${caseId}`,
        entity_name: extractEntityName(json, file),
      });
    }
  }
  rows.sort((a, b) => caseNumber(a.folder) - caseNumber(b.folder)
    || a.folder.localeCompare(b.folder) || a.filename.localeCompare(b.filename));

  const selected = [];
  const skipped = [];
  const names = new Map();
  for (const row of rows) {
    const key = normalizeName(row.entity_name);
    if (names.has(key)) {
      skipped.push({ ...row, duplicateOf: names.get(key) });
    } else {
      names.set(key, row);
      selected.push(row);
    }
  }
  return { rows, selected, skipped, normalizedNames: new Set(names.keys()) };
}

async function checked(query, label) {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

async function listStorageFiles(prefix) {
  const files = [];
  async function walk(path) {
    let offset = 0;
    while (true) {
      const { data, error } = await sb.storage.from(BUCKET).list(path, {
        limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        if (/not found/i.test(error.message)) return;
        throw new Error(`Storage list ${path}: ${error.message}`);
      }
      for (const item of data ?? []) {
        const child = path ? `${path}/${item.name}` : item.name;
        if (item.id) files.push(child);
        else await walk(child);
      }
      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }
  await walk(prefix);
  return files;
}

async function main() {
  const { rows, selected, skipped, normalizedNames } = loadCases();
  const { data: existing } = await checked(
    sb.from('entities').select('kyc_ref,entity_id,case_id,entity_name'),
    'Load existing entities',
  );
  const incomingRefs = new Set(rows.map(row => row.kyc_ref));
  const targets = (existing ?? []).filter(row =>
    incomingRefs.has(row.kyc_ref) || normalizedNames.has(normalizeName(row.entity_name)),
  );
  const targetRefs = [...new Set([...targets.map(row => row.kyc_ref), ...rows.map(row => row.kyc_ref)])];

  console.log(`${execute ? 'EXECUTE' : 'DRY RUN'}: ${sourceDir}`);
  console.log(`Source JSON files: ${rows.length}`);
  console.log(`Unique entities to seed: ${selected.length}`);
  console.log(`Duplicate source cases skipped: ${skipped.length}`);
  for (const row of skipped) {
    console.log(`  SKIP ${row.folder}: ${row.entity_name} (${row.kyc_ref}); kept ${row.duplicateOf.folder} (${row.duplicateOf.kyc_ref})`);
  }
  console.log(`Existing matching entity rows to reset: ${targets.length}`);

  if (!execute) {
    console.log('\nNo changes made. Re-run with --execute to reset and seed.');
    return;
  }

  // Remove both indexed files and any orphaned objects beneath a case prefix.
  const { data: indexedFiles } = await checked(
    sb.from('case_files').select('storage_path').in('kyc_ref', targetRefs),
    'Load indexed Storage files',
  );
  const storagePaths = new Set((indexedFiles ?? []).map(row => row.storage_path));
  for (const ref of targetRefs) {
    for (const path of await listStorageFiles(ref)) storagePaths.add(path);
  }
  const paths = [...storagePaths];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Delete Storage objects: ${error.message}`);
  }

  // These two historical tables intentionally have no FK, so cascade cannot clear them.
  await checked(sb.from('exception_audit_log').delete().in('kyc_ref', targetRefs), 'Delete exception audit history');
  await checked(sb.from('person_overrides').delete().in('kyc_ref', targetRefs), 'Delete person overrides');

  // Deleting the entity cascades through snapshots, attributes, persons,
  // exceptions, runs, case files, screening, confirmations and tab review state.
  await checked(sb.from('entities').delete().in('kyc_ref', targetRefs), 'Delete matching cases');

  const inserts = selected.map(({ entity_id, case_id, entity_name }) => ({
    entity_id, case_id, entity_name,
  }));
  await checked(sb.from('entities').insert(inserts), 'Insert clean cases');

  const expectedRefs = selected.map(row => row.kyc_ref);
  const { data: seeded } = await checked(
    sb.from('entities').select('kyc_ref,entity_name').in('kyc_ref', expectedRefs),
    'Verify seeded cases',
  );
  const actual = new Map((seeded ?? []).map(row => [row.kyc_ref, row.entity_name]));
  const missing = selected.filter(row => actual.get(row.kyc_ref) !== row.entity_name);
  if (missing.length) throw new Error(`Verification failed for ${missing.map(row => row.kyc_ref).join(', ')}`);

  const dependentTables = [
    'entity_snapshots', 'entity_attributes', 'entity_persons', 'exceptions',
    'exception_number_counters', 'exception_audit_log', 'agent_runs', 'case_files', 'screening_runs',
    'screening_dispositions', 'person_overrides', 'case_tab_reviews',
  ];
  for (const table of dependentTables) {
    const { count } = await checked(
      sb.from(table).select('*', { count: 'exact', head: true }).in('kyc_ref', targetRefs),
      `Verify ${table} is empty`,
    );
    if (count !== 0) throw new Error(`Verification failed: ${table} still has ${count} matching row(s)`);
  }

  const skippedRefs = skipped.map(row => row.kyc_ref);
  if (skippedRefs.length) {
    const { count } = await checked(
      sb.from('entities').select('*', { count: 'exact', head: true }).in('kyc_ref', skippedRefs),
      'Verify duplicate cases were skipped',
    );
    if (count !== 0) throw new Error(`Verification failed: ${count} skipped duplicate case(s) still exist`);
  }

  console.log(`\nDeleted ${paths.length} Storage object(s).`);
  console.log(`Seeded and verified ${seeded.length} clean cases with no dependent data.`);
}

main().catch(error => {
  console.error(`SEED FAILED: ${error.message ?? error}`);
  process.exit(1);
});

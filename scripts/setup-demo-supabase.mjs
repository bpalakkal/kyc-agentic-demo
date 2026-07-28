/**
 * Bootstrap or update the demo Supabase environment in one command.
 *
 * Required in .env:
 *   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@...:5432/postgres
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY=<service-role key>
 *
 * Run:
 *   npm run supabase:setup -- --confirm-demo
 *
 * Migration 007 truncates case data. It runs automatically when entities is
 * empty (the expected new-project state), but requires --allow-destructive if
 * the target already contains cases.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const migrationsDir = resolve(scriptDir, 'migrations');
const args = new Set(process.argv.slice(2));

async function loadLocalEnv() {
  try {
    const text = await readFile(resolve(projectDir, '.env'), 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Add it to .env or the process environment.`);
  return value;
}

async function migrationFiles() {
  const files = (await readdir(migrationsDir))
    .filter(file => /^\d{3}_.+\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right));
  if (!files.length) throw new Error(`No migrations found in ${migrationsDir}`);
  return files;
}

function sqlIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(
      `Invalid SUPABASE_DB_SCHEMA "${value}". Use lowercase letters, numbers, and underscores.`
    );
  }
  return `"${value}"`;
}

async function ensureSchema(client, schema) {
  const identifier = sqlIdentifier(schema);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${identifier}`);
  await client.query(
    `GRANT USAGE ON SCHEMA ${identifier} TO anon, authenticated, service_role`
  );
}

async function ensureMigrationTable(client, schema) {
  const identifier = sqlIdentifier(schema);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${identifier}.app_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applyMigrations(client, files, schema) {
  const identifier = sqlIdentifier(schema);
  const { rows } = await client.query(
    `SELECT filename FROM ${identifier}.app_schema_migrations ORDER BY filename`
  );
  const applied = new Set(rows.map(row => row.filename));

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`[migration] skip  ${filename}`);
      continue;
    }

    if (filename.startsWith('007_')) {
      const result = await client.query(
        `SELECT CASE WHEN to_regclass($1) IS NULL
          THEN 0 ELSE (SELECT count(*)::integer FROM ${identifier}.entities) END AS count`,
        [`${schema}.entities`]
      );
      const entityCount = Number(result.rows[0].count);
      if (entityCount > 0 && !args.has('--allow-destructive')) {
        throw new Error(
          `${filename} truncates all case data, and the target contains ${entityCount} ` +
          'entities. Use a new demo project or rerun with --allow-destructive.'
        );
      }
    }

    const rawSql = await readFile(resolve(migrationsDir, filename), 'utf8');
    const sql = rawSql.replace(
      /\bSET\s+search_path\s*=\s*public\b/gi,
      `SET search_path = ${identifier}`
    );
    console.log(`[migration] apply ${filename}`);
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL search_path = ${identifier}, public, extensions`);
      await client.query(sql);
      await client.query(
        `INSERT INTO ${identifier}.app_schema_migrations (filename) VALUES ($1)`,
        [filename]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${filename} failed: ${error.message}`, { cause: error });
    }
  }
}

async function grantSchemaAccess(client, schema) {
  const identifier = sqlIdentifier(schema);
  await client.query(`GRANT USAGE ON SCHEMA ${identifier} TO anon, authenticated, service_role`);
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${identifier} TO authenticated`);
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA ${identifier} TO service_role`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${identifier} TO authenticated, service_role`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${identifier} TO service_role`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${identifier} GRANT SELECT ON TABLES TO authenticated`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${identifier} GRANT ALL ON TABLES TO service_role`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${identifier} GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role`);
}

async function ensureStorageBucket(supabaseUrl, serviceKey, schema, bucketName) {
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Unable to list Storage buckets: ${listError.message}`);
  if (buckets.some(bucket => bucket.name === bucketName)) {
    console.log(`[storage]   skip  ${bucketName} (already exists)`);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'text/plain',
      'text/csv',
    ],
  });
  if (error) throw new Error(`Unable to create Storage bucket: ${error.message}`);
  console.log(`[storage]   create ${bucketName} (private)`);
}

async function main() {
  await loadLocalEnv();
  if (!args.has('--confirm-demo')) {
    throw new Error(
      'Safety check: rerun with --confirm-demo after verifying .env points to the new demo project.'
    );
  }

  const connectionString = required('SUPABASE_DB_URL');
  const supabaseUrl = required('SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_KEY');
  const schema = process.env.SUPABASE_DB_SCHEMA?.trim() || 'kyc_demo';
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'kyc-demo-files';
  sqlIdentifier(schema);
  if (schema === 'public' && !args.has('--allow-public')) {
    throw new Error(
      'Refusing to bootstrap public. Set SUPABASE_DB_SCHEMA=kyc_demo, or explicitly add --allow-public.'
    );
  }
  const files = await migrationFiles();
  const databaseHost = new URL(connectionString).hostname;

  console.log(`[setup] Target API: ${supabaseUrl}`);
  console.log(`[setup] Database:   ${databaseHost}`);
  console.log(`[setup] Schema:     ${schema}`);
  console.log(`[setup] Storage:    ${bucketName}`);
  console.log(`[setup] Migrations: ${files.length}`);

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [1_942_025_072]);
    await ensureSchema(client, schema);
    await ensureMigrationTable(client, schema);
    await applyMigrations(client, files, schema);
    await grantSchemaAccess(client, schema);
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [1_942_025_072]);
    } catch {
      // The connection may already be unavailable; closing it is sufficient.
    }
    await client.end();
  }

  await ensureStorageBucket(supabaseUrl, serviceKey, schema, bucketName);
  console.log('');
  console.log('[setup] Demo Supabase environment is ready.');
}

main().catch(error => {
  console.error(`[setup] ERROR: ${error.message}`);
  process.exitCode = 1;
});

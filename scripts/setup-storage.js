/**
 * Supabase Storage setup — creates the "kyc-files" bucket.
 *
 * Run ONCE after deploying migration 001:
 *   node scripts/setup-storage.js
 *
 * Safe to re-run: bucket creation is idempotent (existing bucket is left intact).
 *
 * Bucket layout (enforced by FilePublisher, not by the bucket itself):
 *   kyc-files/
 *   └── {kyc_ref}/
 *       ├── documents/      PDFs, Word docs, filings, etc.
 *       └── screenshots/    PNG / JPEG screenshots from agent scraping
 *
 * Access model:
 *   - Bucket is PRIVATE (not public) — KYC documents are sensitive.
 *   - All reads go through the Express server, which generates short-lived
 *     signed URLs (via service key) and returns them to the browser.
 *   - Analysts never get a permanent public URL; links expire after 1 hour.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ─── Load .env ────────────────────────────────────────────────────────────────
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(resolve(__dir, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch { /* env injected by platform */ }

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET_NAME = 'kyc-files';

async function main() {
  console.log(`[setup-storage] Connecting to ${SUPABASE_URL}`);

  // ── Check if bucket already exists ────────────────────────────────────────
  const { data: buckets, error: listErr } = await sb.storage.listBuckets();
  if (listErr) {
    console.error('[setup-storage] Failed to list buckets:', listErr.message);
    process.exit(1);
  }

  const exists = buckets.some(b => b.name === BUCKET_NAME);

  if (exists) {
    console.log(`[setup-storage] Bucket "${BUCKET_NAME}" already exists — no changes made.`);
  } else {
    // ── Create private bucket ────────────────────────────────────────────────
    const { error: createErr } = await sb.storage.createBucket(BUCKET_NAME, {
      public: false,           // Private — all access via signed URLs
      fileSizeLimit: 52428800, // 50 MB per file (generous for PDFs + images)
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

    if (createErr) {
      console.error(`[setup-storage] Failed to create bucket "${BUCKET_NAME}":`, createErr.message);
      process.exit(1);
    }

    console.log(`[setup-storage] ✓ Created private bucket "${BUCKET_NAME}"`);
  }

  // ── Verify access with a test listing ─────────────────────────────────────
  const { error: verifyErr } = await sb.storage.from(BUCKET_NAME).list('', { limit: 1 });
  if (verifyErr) {
    console.error('[setup-storage] Bucket created but access check failed:', verifyErr.message);
    process.exit(1);
  }

  console.log(`[setup-storage] ✓ Access verified — bucket "${BUCKET_NAME}" is ready.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. In Supabase Dashboard → Storage → kyc-files → Policies:');
  console.log('     Add a policy: authenticated users can SELECT (for direct queries if needed)');
  console.log('     The Express server uses the service key and bypasses RLS for uploads.');
  console.log('  2. Run Phase 2: create agents/types.ts and the publisher classes.');
}

main().catch(err => {
  console.error('[setup-storage] Unexpected error:', err);
  process.exit(1);
});

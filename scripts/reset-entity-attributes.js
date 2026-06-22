/**
 * Reset entity attributes and snapshots for a given KYC ref.
 *
 * Deletes all entity_attributes and entity_snapshots rows for the entity,
 * and marks any completed agent_runs as 'cancelled' so they no longer
 * appear as "current" data in the diff modal.
 *
 * Use this to start fresh before the first real agent run on an entity,
 * so all attributes show up as "new" rather than "unchanged".
 *
 * Usage:
 *   node scripts/reset-entity-attributes.js KYC-30230
 *   node scripts/reset-entity-attributes.js KYC-30230 KYC-30225
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1);
}

const kycRefs = process.argv.slice(2);
if (kycRefs.length === 0) {
  console.error('Usage: node scripts/reset-entity-attributes.js <kyc_ref> [kyc_ref2 ...]');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetEntity(kycRef) {
  console.log(`\nResetting ${kycRef}…`);

  const { count: attrCount, error: attrErr } = await sb
    .from('entity_attributes')
    .delete({ count: 'exact' })
    .eq('kyc_ref', kycRef);
  if (attrErr) throw attrErr;
  console.log(`  ✓ Deleted ${attrCount ?? 0} entity_attributes rows`);

  const { count: snapCount, error: snapErr } = await sb
    .from('entity_snapshots')
    .delete({ count: 'exact' })
    .eq('kyc_ref', kycRef);
  if (snapErr) throw snapErr;
  console.log(`  ✓ Deleted ${snapCount ?? 0} entity_snapshots rows`);

  // Cancel any runs that aren't already terminal (running, pending_review, complete)
  const { data: runsToCancel, error: runFetchErr } = await sb
    .from('agent_runs')
    .select('id')
    .eq('kyc_ref', kycRef)
    .in('status', ['running', 'pending_review', 'complete']);
  if (runFetchErr) throw runFetchErr;

  let runCount = 0;
  if (runsToCancel?.length) {
    const { error: runErr } = await sb
      .from('agent_runs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .in('id', runsToCancel.map(r => r.id));
    if (runErr) throw runErr;
    runCount = runsToCancel.length;
  }
  console.log(`  ✓ Cancelled ${runCount} agent_runs (running/pending_review/complete)`);
}

for (const ref of kycRefs) {
  await resetEntity(ref).catch(err => {
    console.error(`  ✗ ${ref}: ${err.message}`);
  });
}

console.log('\nDone.');

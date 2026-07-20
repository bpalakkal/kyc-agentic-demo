/**
 * Seed entities into Supabase so they appear in the Work Queue.
 * Matches the Forge version exactly — same entity_id/case_id pairs.
 * kyc_ref is auto-derived by the DB trigger: entity_id || '_' || case_id
 *
 * Run: node scripts/seed-entities.mjs   (idempotent — safe to re-run)
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
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ENTITIES = [
  {
    entity_id:    'BHUSIM',
    case_id:      'CASE30231',
    entity_name:  'Brevan Howard US Investment Management LP',
    entity_type:  'Registered Investment Adviser (RIA)',
    jurisdiction: 'United States',
    risk_rating:  'Medium',
    priority:     'Medium',
    status:       'open',
  },
  {
    entity_id:    'VANGLOBAL',
    case_id:      'CASE30232',
    entity_name:  'Vanguard Global Advisers, LLC',
    entity_type:  'Registered Investment Adviser (RIA)',
    jurisdiction: 'United States',
    risk_rating:  'Low',
    priority:     'Low',
    status:       'open',
  },
];

async function seed() {
  for (const ent of ENTITIES) {
    const kyc_ref = `${ent.entity_id}_${ent.case_id}`;
    const { error } = await sb.from('entities').upsert(
      { ...ent, kyc_ref },
      { onConflict: 'kyc_ref' }
    );
    if (error) {
      console.error(`✗ ${ent.entity_name} (${kyc_ref}): ${error.message}`);
      process.exit(1);
    }
    console.log(`✓ ${ent.entity_name} (${kyc_ref})`);
  }
  console.log('\nDone — 2 entities seeded.');
}

seed().catch(e => { console.error('SEED FAILED:', e.message ?? e); process.exit(1); });

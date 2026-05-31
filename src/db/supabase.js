/**
 * Server-side Supabase client + helper functions.
 * Imported by server.js — not bundled into the frontend.
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

export const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: { transport: ws },
});

// ─── Work queue ───────────────────────────────────────────────────────────────

/** Build a drg_id → { name } lookup from the drgs table. */
async function drgLookup() {
  const { data, error } = await sb.from('drgs').select('id, name');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(d => [d.id, { name: d.name }]));
}

/** Fetch all entities with their DRG name for the work queue. */
export async function getEntities() {
  const [entRes, drgMap] = await Promise.all([
    sb.from('entities').select('*').order('kyc_ref'),
    drgLookup(),
  ]);
  if (entRes.error) throw entRes.error;
  return (entRes.data ?? []).map(e => ({ ...e, drgs: e.drg_id ? (drgMap[e.drg_id] ?? null) : null }));
}

/** Fetch a single entity row. */
export async function getEntity(kycRef) {
  const [entRes, drgMap] = await Promise.all([
    sb.from('entities').select('*').eq('kyc_ref', kycRef).single(),
    drgLookup(),
  ]);
  if (entRes.error) throw entRes.error;
  const e = entRes.data;
  return { ...e, drgs: e.drg_id ? (drgMap[e.drg_id] ?? null) : null };
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

/** Return the most recent Forge JSON snapshot for an entity, or null. */
export async function getLatestSnapshot(kycRef) {
  const { data, error } = await sb
    .from('entity_snapshots')
    .select('id, data, agent_id, run_id, created_at')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Insert a new snapshot row — always appends, never overwrites. */
export async function saveSnapshot(kycRef, data, { agentId, runId } = {}) {
  const { data: row, error } = await sb
    .from('entity_snapshots')
    .insert({ kyc_ref: kycRef, data, agent_id: agentId ?? null, run_id: runId ?? null })
    .select()
    .single();
  if (error) throw error;
  return row;
}

// ─── Exceptions ───────────────────────────────────────────────────────────────

/** Fetch all exceptions for an entity, ordered by exception_number. */
export async function getExceptions(kycRef) {
  const { data, error } = await sb
    .from('exceptions')
    .select('*')
    .eq('kyc_ref', kycRef)
    .order('exception_number');
  if (error) throw error;
  return data;
}

/**
 * Resolve an exception — sets status, resolution_option, resolution,
 * resolved_by, and resolved_at.
 */
export async function resolveException(kycRef, exceptionNumber, { resolutionOption, resolution, resolvedBy }) {
  const { data, error } = await sb
    .from('exceptions')
    .update({
      status: 'resolved',
      resolution_option: resolutionOption ?? null,
      resolution: resolution ?? null,
      resolved_by: resolvedBy ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('kyc_ref', kycRef)
    .eq('exception_number', exceptionNumber)
    .select()
    .single();
  if (error) throw error;
  return data;
}

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
  realtime: {
    transport: ws,
  },
});

// ─── Work queue ───────────────────────────────────────────────────────────────

/** Fetch entities for the work queue. Optional DB-level filters avoid full scans. */
export async function getEntities({ riskRating, priority, limit } = {}) {
  let q = sb.from('entities').select('*, drgs(id, name)').order('kyc_ref');
  if (riskRating) q = q.eq('risk_rating', riskRating);
  if (priority)   q = q.eq('priority', priority);
  if (limit)      q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Search entities by partial name match — uses DB ILIKE, not JS filter. */
export async function searchEntities(name, { limit = 10 } = {}) {
  const { data, error } = await sb
    .from('entities')
    .select('*, drgs(id, name)')
    .ilike('entity_name', `%${name}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Fetch a single entity row. */
export async function getEntity(kycRef) {
  const { data, error } = await sb
    .from('entities')
    .select('*, drgs(id, name)')
    .eq('kyc_ref', kycRef)
    .single();
  if (error) throw error;
  return data;
}

// ─── Forge JSON parsing helpers ───────────────────────────────────────────────

// Top-level keys that are person-role arrays in the Forge schema.
const PERSON_ROLES = new Set([
  'acting_person', 'authorized_signatory', 'beneficial_owner',
  'board_director', 'corporate_officer', 'investment_advisor',
  'key_controller', 'power_of_attorney', 'trustee',
]);

// Keys that are not attributes (identifiers or non-attribute special fields).
const NON_ATTRIBUTE_KEYS = new Set([
  'entity_id', 'case_id', '$schema', 'documents',
  ...PERSON_ROLES,
]);

/**
 * Cast a lineage value (any type) to a display string.
 * Objects/arrays → JSON, booleans → "Yes"/"No", nulls → "".
 */
function toDisplayValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * Given an attribute object from the Forge JSON, return a flat record
 * suitable for inserting into entity_attributes.
 */
function parseAttribute(attrName, attrObj, group) {
  if (!attrObj || typeof attrObj !== 'object') return null;
  const lineage = Array.isArray(attrObj.lineage) ? attrObj.lineage : [];
  const first = lineage[0];
  return {
    attribute_name:      attrName,
    attribute_group:     group,
    display_value:       first ? toDisplayValue(first.value) : null,
    id_flag:             attrObj.id_flag ?? false,
    id_source:           attrObj.id_source ?? null,
    verification_flag:   attrObj.verification_flag ?? false,
    verification_source: Array.isArray(attrObj.verification_source) ? attrObj.verification_source : null,
    exception_flag:      attrObj.exception_flag ?? false,
    exception_type:      attrObj.exception_type ?? null,
    lineage:             lineage.length > 0 ? lineage : null,
  };
}

/**
 * Extract a display value from a person sub-attribute by trying common
 * suffix patterns (e.g. "beneficial_owner_full_name" for role "beneficial_owner").
 */
function personFieldValue(personObj, role, suffix) {
  const key = `${role}_${suffix}`;
  const attr = personObj[key];
  if (!attr) return null;
  const lineage = Array.isArray(attr.lineage) ? attr.lineage : [];
  return lineage[0] ? toDisplayValue(lineage[0].value) : null;
}

// ─── Extraction: attributes ───────────────────────────────────────────────────

/**
 * Parse all non-person top-level attributes from a Forge JSON and bulk-insert
 * them into entity_attributes.
 */
async function extractAndSaveAttributes(kycRef, snapshotId, forgeData) {
  const rows = [];
  for (const [key, val] of Object.entries(forgeData)) {
    if (NON_ATTRIBUTE_KEYS.has(key)) continue;
    const group = key.startsWith('wgq_') ? 'wgq' : 'core';
    const row = parseAttribute(key, val, group);
    if (row) rows.push({ kyc_ref: kycRef, snapshot_id: snapshotId, ...row });
  }
  if (rows.length === 0) return 0;
  const { error } = await sb.from('entity_attributes').insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Extraction: persons ──────────────────────────────────────────────────────

/**
 * Parse all person-role arrays from a Forge JSON and bulk-insert them into
 * entity_persons.
 */
async function extractAndSavePersons(kycRef, snapshotId, forgeData) {
  const rows = [];
  for (const role of PERSON_ROLES) {
    const arr = forgeData[role];
    if (!Array.isArray(arr)) continue;
    arr.forEach((personObj, idx) => {
      if (!personObj || typeof personObj !== 'object') return;
      const fullName =
        personFieldValue(personObj, role, 'full_name') ??
        personFieldValue(personObj, role, 'name') ??
        null;
      const ownershipPct =
        role === 'beneficial_owner'
          ? parseFloat(personFieldValue(personObj, role, 'percentage_of_ownership') ?? '')
          : null;
      const nationality = personFieldValue(personObj, role, 'nationality') ?? null;
      rows.push({
        kyc_ref:       kycRef,
        snapshot_id:   snapshotId,
        role,
        person_index:  idx,
        full_name:     fullName,
        ownership_pct: Number.isFinite(ownershipPct) ? ownershipPct : null,
        nationality,
        attributes:    personObj,
      });
    });
  }
  if (rows.length === 0) return 0;
  const { error } = await sb.from('entity_persons').insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Extraction: exception sync ───────────────────────────────────────────────

/**
 * For each attribute with exception_flag=true in the Forge JSON, insert a row
 * in the exceptions table (source_type='forge') if none already exists for
 * that attribute+entity in an open state.
 */
async function syncForgeExceptions(kycRef, forgeData) {
  // Collect attributes that need exceptions raised.
  const candidates = [];
  for (const [key, val] of Object.entries(forgeData)) {
    if (NON_ATTRIBUTE_KEYS.has(key)) continue;
    if (!val?.exception_flag) continue;
    candidates.push({ key, exceptionType: val.exception_type ?? 'Missing Value' });
  }
  if (candidates.length === 0) return 0;

  // Check which attribute_names already have an open Forge exception.
  const attrNames = candidates.map(c => c.key);
  const { data: existing } = await sb
    .from('exceptions')
    .select('attribute_name')
    .eq('kyc_ref', kycRef)
    .eq('source_type', 'forge')
    .neq('status', 'resolved')
    .in('attribute_name', attrNames);
  const alreadyOpen = new Set((existing ?? []).map(r => r.attribute_name));

  const toInsert = candidates.filter(c => !alreadyOpen.has(c.key));
  if (toInsert.length === 0) return 0;

  // Atomically reserve a block of sequential exception numbers via DB function.
  // Avoids the MAX()+1 TOCTOU race under concurrent snapshot saves.
  const { data: startNum, error: rpcError } = await sb.rpc('alloc_exception_numbers', {
    p_kyc_ref: kycRef,
    p_count: toInsert.length,
  });
  if (rpcError) throw rpcError;
  let nextNum = startNum;

  const rows = toInsert.map(c => ({
    kyc_ref:          kycRef,
    exception_number: nextNum++,
    attribute_name:   c.key,
    field_name:       c.key,
    source_type:      'forge',
    status:           'open',
    title:            `Data quality — ${c.key.replace(/_/g, ' ')}`,
    reasoning:        [`Forge flagged exception_type: ${c.exceptionType}`],
    recommended_actions: [],
  }));

  const { error } = await sb.from('exceptions').insert(rows);
  if (error) throw error;
  return rows.length;
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

/**
 * Insert a new snapshot row (always appends, never overwrites), then
 * synchronously extract attributes, persons, and sync exception flags.
 * Returns counts for all operations.
 */
export async function saveSnapshot(kycRef, data, { agentId, runId } = {}) {
  // 1. Insert the raw blob.
  const { data: row, error } = await sb
    .from('entity_snapshots')
    .insert({ kyc_ref: kycRef, data, agent_id: agentId ?? null, run_id: runId ?? null })
    .select()
    .single();
  if (error) throw error;

  // 2. Extract in parallel; don't fail the whole request on extraction errors —
  //    the blob is always the source of truth.
  const [attrCount, personCount, excCount] = await Promise.all([
    extractAndSaveAttributes(kycRef, row.id, data).catch(e => {
      console.error('[snapshot] attribute extraction failed:', e.message);
      return 0;
    }),
    extractAndSavePersons(kycRef, row.id, data).catch(e => {
      console.error('[snapshot] person extraction failed:', e.message);
      return 0;
    }),
    syncForgeExceptions(kycRef, data).catch(e => {
      console.error('[snapshot] exception sync failed:', e.message);
      return 0;
    }),
  ]);

  return { ...row, attributeCount: attrCount, personCount, exceptionsRaised: excCount };
}

// ─── Attribute queries ────────────────────────────────────────────────────────

/**
 * Return all attribute rows for the latest snapshot of an entity.
 * Optionally filter by group ('core', 'wgq').
 */
export async function getAttributes(kycRef, { group } = {}) {
  // Find the latest snapshot id first.
  const { data: snap, error: snapErr } = await sb
    .from('entity_snapshots')
    .select('id')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapErr) throw snapErr;
  if (!snap) return [];

  let q = sb
    .from('entity_attributes')
    .select('attribute_name, attribute_group, display_value, confidence, id_flag, id_source, verification_flag, verification_source, exception_flag, exception_type')
    .eq('kyc_ref', kycRef)
    .eq('snapshot_id', snap.id)
    .order('attribute_name');

  if (group) q = q.eq('attribute_group', group);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Return the full lineage array for a single named attribute on the latest snapshot.
 * Used by the Tracing panel.
 */
export async function getAttributeTrace(kycRef, attributeName) {
  const { data: snap, error: snapErr } = await sb
    .from('entity_snapshots')
    .select('id')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapErr) throw snapErr;
  if (!snap) return null;

  const { data, error } = await sb
    .from('entity_attributes')
    .select('attribute_name, display_value, confidence, id_flag, id_source, verification_flag, verification_source, exception_flag, exception_type, lineage')
    .eq('kyc_ref', kycRef)
    .eq('snapshot_id', snap.id)
    .eq('attribute_name', attributeName)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Person queries ───────────────────────────────────────────────────────────

/**
 * Return all person records for the latest snapshot, grouped by role.
 * Shape: { beneficial_owner: [...], key_controller: [...], ... }
 */
export async function getPersons(kycRef) {
  const { data: snap, error: snapErr } = await sb
    .from('entity_snapshots')
    .select('id')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapErr) throw snapErr;
  if (!snap) return {};

  const { data, error } = await sb
    .from('entity_persons')
    .select('role, person_index, full_name, ownership_pct, nationality, attributes')
    .eq('kyc_ref', kycRef)
    .eq('snapshot_id', snap.id)
    .order('role')
    .order('person_index');
  if (error) throw error;

  // Group by role.
  const grouped = {};
  for (const p of data ?? []) {
    (grouped[p.role] ??= []).push(p);
  }
  return grouped;
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
 * Resolve an exception — updates the exceptions row and appends an immutable
 * audit entry.  resolvedBy must be the verified identity from the JWT (set by
 * the route handler — never trust client-supplied values).
 */
export async function resolveException(kycRef, exceptionNumber, { resolutionOption, resolution, resolvedBy }) {
  const resolvedAt = new Date().toISOString();

  const { data, error } = await sb
    .from('exceptions')
    .update({
      status: 'resolved',
      resolution_option: resolutionOption ?? null,
      resolution: resolution ?? null,
      resolved_by: resolvedBy ?? null,
      resolved_at: resolvedAt,
    })
    .eq('kyc_ref', kycRef)
    .eq('exception_number', exceptionNumber)
    .select()
    .single();
  if (error) throw error;

  // C5: Append immutable audit entry — never update/delete this table
  await sb.from('exception_audit_log').insert({
    kyc_ref:          kycRef,
    exception_number: exceptionNumber,
    action:           'resolved',
    actor:            resolvedBy ?? null,
    resolution_option: resolutionOption ?? null,
    resolution:       resolution ?? null,
    occurred_at:      resolvedAt,
  });

  return data;
}

// ─── Agent runs ───────────────────────────────────────────────────────────────

/**
 * Insert a new agent_runs row at the start of a run.
 * Returns the full row including the generated UUID.
 */
export async function createAgentRun({ kycRef, agentSlug, runnerType, initiatedBy }) {
  const { data, error } = await sb
    .from('agent_runs')
    .insert({
      kyc_ref:      kycRef,
      agent_slug:   agentSlug,
      runner_type:  runnerType,
      initiated_by: initiatedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update a run's status / result fields.
 * completed_at is set automatically when status transitions to 'complete' or 'failed'.
 */
export async function updateAgentRun(runId, { status, externalRunId, outputType, sourcesConsulted, error: errMsg } = {}) {
  const patch = {};
  if (status           !== undefined) patch.status            = status;
  if (externalRunId    !== undefined) patch.external_run_id   = externalRunId;
  if (outputType       !== undefined) patch.output_type       = outputType;
  if (sourcesConsulted !== undefined) patch.sources_consulted = sourcesConsulted;
  if (errMsg           !== undefined) patch.error             = errMsg;
  if (status === 'complete' || status === 'failed') patch.completed_at = new Date().toISOString();

  const { data, error } = await sb
    .from('agent_runs')
    .update(patch)
    .eq('id', runId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Return the most recent agent runs for an entity (default: last 20). */
export async function getAgentRuns(kycRef, { limit = 20 } = {}) {
  const { data, error } = await sb
    .from('agent_runs')
    .select('*')
    .eq('kyc_ref', kycRef)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Return entity_attributes rows written by a specific agent run.
 * These have snapshot_id=NULL and agent_run_id set.
 */
export async function getAttributesByRunId(kycRef, agentRunId) {
  const { data, error } = await sb
    .from('entity_attributes')
    .select('attribute_name, attribute_group, display_value, confidence, id_flag, id_source, verification_flag, verification_source, exception_flag, exception_type, lineage')
    .eq('kyc_ref', kycRef)
    .eq('agent_run_id', agentRunId)
    .order('attribute_name');
  if (error) throw error;
  return data ?? [];
}

// ─── Case files ───────────────────────────────────────────────────────────────

/**
 * Return all case_files for an entity, optionally filtered by category.
 * Joins the originating run's agent_slug and completion time for display.
 */
export async function getEntityFiles(kycRef, { category } = {}) {
  let q = sb
    .from('case_files')
    .select('*, agent_runs(agent_slug, completed_at)')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false });
  if (category) q = q.eq('file_category', category);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Generate a short-lived signed URL for a private storage file.
 * Default expiry: 1 hour — enough for a analyst review session.
 */
export async function getSignedFileUrl(storagePath, { expiresIn = 3600 } = {}) {
  const { data, error } = await sb.storage
    .from('kyc-files')
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete a file from both Supabase Storage and the case_files table.
 */
export async function deleteFile(fileId) {
  const { data: file, error: fetchErr } = await sb
    .from('case_files')
    .select('storage_path')
    .eq('id', fileId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error: storageErr } = await sb.storage
    .from('kyc-files')
    .remove([file.storage_path]);
  if (storageErr) throw storageErr;

  const { error: dbErr } = await sb.from('case_files').delete().eq('id', fileId);
  if (dbErr) throw dbErr;
}

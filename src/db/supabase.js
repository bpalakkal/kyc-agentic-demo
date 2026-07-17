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
 * Return all attribute rows for an entity, merging:
 *   1. Latest Forge snapshot attributes (base layer)
 *   2. Completed agent-run attributes (override layer — most recent run wins per attribute)
 * Optionally filter by group ('core', 'wgq').
 */
export async function getAttributes(kycRef, { group } = {}) {
  const ATTR_SELECT = 'attribute_name, attribute_group, display_value, confidence, id_flag, id_source, id_reasoning, verification_flag, verification_source, verification_reasoning, exception_flag, exception_type, lineage';

  // ── Layer 1: latest Forge snapshot ──────────────────────────────────────────
  let snapshotAttrs = [];
  {
    const { data: snap } = await sb
      .from('entity_snapshots')
      .select('id')
      .eq('kyc_ref', kycRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snap) {
      let q = sb.from('entity_attributes')
        .select(ATTR_SELECT)
        .eq('kyc_ref', kycRef)
        .eq('snapshot_id', snap.id)
        .order('attribute_name');
      if (group) q = q.eq('attribute_group', group);
      const { data, error } = await q;
      if (error) throw error;
      snapshotAttrs = data ?? [];
    }
  }

  // ── Layer 2: completed agent-run attributes ──────────────────────────────────
  // Fetch all completed runs ordered most-recent-first, then deduplicate by
  // attribute_name keeping the value from the most recent run.
  let agentRunAttrs = [];
  {
    const { data: runs } = await sb
      .from('agent_runs')
      .select('id')
      .eq('kyc_ref', kycRef)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false });

    if (runs?.length) {
      const runIds = runs.map(r => r.id);
      let q = sb.from('entity_attributes')
        .select(ATTR_SELECT + ', agent_run_id')
        .eq('kyc_ref', kycRef)
        .in('agent_run_id', runIds);
      if (group) q = q.eq('attribute_group', group);
      const { data, error } = await q;
      if (error) throw error;

      // Keep the value from the most-recent run for each attribute_name.
      // Also aggregate lineage from ALL runs so SourceStrip can compare sources.
      const runRank = new Map(runIds.map((id, i) => [id, i]));
      const best = new Map();
      for (const attr of (data ?? [])) {
        const existing = best.get(attr.attribute_name);
        const rank = runRank.get(attr.agent_run_id) ?? Infinity;
        if (!existing || rank < (runRank.get(existing.agent_run_id) ?? Infinity)) {
          best.set(attr.attribute_name, attr);
        }
      }

      // Aggregate lineage across all runs, deduplicating by source.
      // Process most-recent-first so the latest value per source wins.
      const allData = (data ?? []).slice().sort(
        (a, b) => (runRank.get(a.agent_run_id) ?? Infinity) - (runRank.get(b.agent_run_id) ?? Infinity)
      );
      const lineageByName = new Map();
      for (const attr of allData) {
        if (!lineageByName.has(attr.attribute_name)) lineageByName.set(attr.attribute_name, []);
        const list = lineageByName.get(attr.attribute_name);
        for (const entry of (attr.lineage ?? [])) {
          if (!entry.source || list.find(e => e.source === entry.source)) continue;
          list.push(entry);
        }
      }

      agentRunAttrs = Array.from(best.values()).map(attr => ({
        ...attr,
        lineage: lineageByName.get(attr.attribute_name)?.length
          ? lineageByName.get(attr.attribute_name)
          : (attr.lineage ?? null),
      }));
    }
  }

  // ── Merge: snapshot as base, agent-run overrides same-named attrs ────────────
  const merged = new Map(snapshotAttrs.map(a => [a.attribute_name, a]));
  for (const attr of agentRunAttrs) merged.set(attr.attribute_name, attr);

  return Array.from(merged.values())
    .sort((a, b) => a.attribute_name.localeCompare(b.attribute_name));
}

/**
 * Return the full lineage array for a single named attribute on the latest snapshot.
 * Used by the Tracing panel.
 */
export async function getAttributeTrace(kycRef, attributeName) {
  const TRACE_SELECT = 'attribute_name, display_value, confidence, id_flag, id_source, id_reasoning, verification_flag, verification_source, verification_reasoning, exception_flag, exception_type, lineage';

  // Layer 1: latest Forge snapshot
  const { data: snap } = await sb
    .from('entity_snapshots')
    .select('id')
    .eq('kyc_ref', kycRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snap) {
    const { data, error } = await sb
      .from('entity_attributes')
      .select(TRACE_SELECT)
      .eq('kyc_ref', kycRef)
      .eq('snapshot_id', snap.id)
      .eq('attribute_name', attributeName)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  // Layer 2: most recent completed agent run that has this attribute
  const { data: runs } = await sb
    .from('agent_runs')
    .select('id')
    .eq('kyc_ref', kycRef)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false });

  for (const run of (runs ?? [])) {
    const { data, error } = await sb
      .from('entity_attributes')
      .select(TRACE_SELECT)
      .eq('kyc_ref', kycRef)
      .eq('agent_run_id', run.id)
      .eq('attribute_name', attributeName)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

// ─── Person queries ───────────────────────────────────────────────────────────

const PERSON_SELECT = 'id, role, person_index, full_name, ownership_pct, nationality, attributes';

/**
 * Return all person records for an entity, merging:
 *   1. Latest Forge snapshot persons (base layer)
 *   2. Agent-run persons (snapshot_id IS NULL — override layer, written by no-Forge API runners)
 *
 * Shape: { beneficial_owner: [...], key_controller: [...], ... }
 * Within each role, records are sorted by person_index ascending.
 */
export async function getPersons(kycRef) {
  // Layer 1: latest Forge snapshot persons.
  let snapshotPersons = [];
  {
    const { data: snap, error: snapErr } = await sb
      .from('entity_snapshots')
      .select('id')
      .eq('kyc_ref', kycRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapErr) throw snapErr;

    if (snap) {
      const { data, error } = await sb
        .from('entity_persons')
        .select(PERSON_SELECT)
        .eq('kyc_ref', kycRef)
        .eq('snapshot_id', snap.id)
        .order('role')
        .order('person_index');
      if (error) throw error;
      snapshotPersons = data ?? [];
    }
  }

  // Layer 2: agent-run persons (snapshot_id IS NULL).
  const { data: agentPersons, error: apErr } = await sb
    .from('entity_persons')
    .select(PERSON_SELECT)
    .eq('kyc_ref', kycRef)
    .is('snapshot_id', null)
    .order('role')
    .order('person_index');
  if (apErr) throw apErr;

  // Merge: agent-run overrides snapshot for same role + person_index.
  const merged = new Map();
  for (const p of snapshotPersons)        merged.set(`${p.role}:${p.person_index}`, p);
  for (const p of (agentPersons ?? []))   merged.set(`${p.role}:${p.person_index}`, p);

  const grouped = {};
  for (const p of merged.values()) {
    (grouped[p.role] ??= []).push(p);
  }
  for (const role of Object.keys(grouped)) {
    grouped[role].sort((a, b) => (a.person_index ?? 0) - (b.person_index ?? 0));
  }

  // Layer 3: apply analyst overrides from person_overrides table.
  const { data: overrides } = await sb
    .from('person_overrides')
    .select('role, person_index, field, value')
    .eq('kyc_ref', kycRef);

  if (overrides?.length) {
    const overrideMap = {};
    for (const o of overrides) {
      const key = `${o.role}:${o.person_index}`;
      if (!overrideMap[key]) overrideMap[key] = {};
      overrideMap[key][o.field] = o.value;
    }
    for (const persons of Object.values(grouped)) {
      for (const p of persons) {
        const fields = overrideMap[`${p.role}:${p.person_index}`];
        if (!fields) continue;
        for (const [field, value] of Object.entries(fields)) {
          if (field === 'full_name')     { p.full_name     = value ?? null; continue; }
          if (field === 'nationality')   { p.nationality   = value ?? null; continue; }
          if (field === 'ownership_pct') { p.ownership_pct = value != null ? parseFloat(value) : null; continue; }
          if (p.attributes?.[field] !== undefined) {
            p.attributes[field] = { ...p.attributes[field], display_value: value, _overridden: true };
          }
        }
      }
    }
  }

  return grouped;
}

/**
 * Bulk-write agent-run person records for an entity (no Forge snapshot required).
 * Replaces all existing agent-run persons (snapshot_id IS NULL) for this kyc_ref,
 * then inserts the new rows.
 *
 * @param {string} kycRef
 * @param {Array<{
 *   role: string,
 *   personIndex: number,
 *   fullName?: string,
 *   ownershipPct?: number,
 *   nationality?: string,
 *   attributes: object
 * }>} personRows
 * @returns {Promise<number>} count of rows inserted
 */
export async function savePersons(kycRef, personRows) {
  if (!personRows?.length) return 0;

  // Replace all current agent-run persons for this entity in one operation.
  const { error: delErr } = await sb
    .from('entity_persons')
    .delete()
    .eq('kyc_ref', kycRef)
    .is('snapshot_id', null);
  if (delErr) throw delErr;

  const rows = personRows.map(p => ({
    kyc_ref:      kycRef,
    snapshot_id:  null,
    role:         p.role,
    person_index: p.personIndex,
    full_name:    p.fullName    ?? null,
    ownership_pct: p.ownershipPct ?? null,
    nationality:  p.nationality ?? null,
    attributes:   p.attributes ?? {},
  }));

  const { error } = await sb.from('entity_persons').insert(rows);
  if (error) throw error;
  return rows.length;
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

// ─── Screening ────────────────────────────────────────────────────────────────
// Results stored as a jsonb blob in screening_runs; analyst dispositions live in
// screening_dispositions and are re-applied on every read so they survive re-screens.
// Matches use the same schema as the Forge version: screening_results_schema.json.

const _dispKey = (role, idx, matchId) => `${role}::${idx ?? -1}::${matchId}`;
const _partyRefKey = (r) => `${r.party_role}::${r.party_index ?? -1}`;

/**
 * Overlay analyst dispositions from screening_dispositions onto a screening_runs row.
 * Returns the normalised screening object the UI and routes consume.
 * @param {string} kycRef
 * @param {object} runRow  — row from screening_runs (id, screened_at, data)
 */
async function _applyDispositions(kycRef, runRow) {
  const { data: disps } = await sb
    .from('screening_dispositions')
    .select('*')
    .eq('kyc_ref', kycRef);
  const map = {};
  for (const d of (disps ?? [])) {
    map[_dispKey(d.party_role, d.party_index, d.match_id)] = d;
  }
  const data = runRow.data ?? {};
  for (const r of (data.screening_results ?? [])) {
    for (const m of (r.matches ?? [])) {
      const d = map[_dispKey(r.party_role, r.party_index, m.id)];
      if (d) {
        m.disposition_status  = d.disposition;
        m.analyst_decision    = d.disposition;
        m.analyst_notes       = d.notes;
        m.decision_timestamp  = d.decided_at;
      }
    }
  }
  return { id: runRow.id, kyc_ref: kycRef, screened_at: runRow.screened_at, ...data };
}

/**
 * Initiate a screening run for a case.
 *
 * No Forge version — reads parties directly from Supabase, calls OpenSanctions,
 * then calls Claude for discounting analysis on hits above the score threshold.
 * Results are merged over any prior run (incremental: parties not re-screened
 * this time are preserved from the previous run).
 *
 * @param {string} kycRef
 * @param {{ initiatedBy?: string }} opts
 * @returns {Promise<object>}  screening result with dispositions overlaid
 */
export async function runScreening(kycRef, { initiatedBy } = {}) {
  const { ScreeningRunner } = await import('../../agents/runners/api/ScreeningRunner.js');
  const runner = new ScreeningRunner();
  const newResults = await runner.screen(kycRef);

  // Fetch the entity for metadata fields
  const ent = await getEntity(kycRef).catch(() => null);

  // Merge over prior run so parties not re-screened this time are kept
  const { data: prevRows } = await sb
    .from('screening_runs')
    .select('data')
    .eq('kyc_ref', kycRef)
    .order('screened_at', { ascending: false })
    .limit(1);
  const prev = prevRows?.[0]?.data?.screening_results ?? [];
  const byRef = new Map(prev.map((r) => [_partyRefKey(r), r]));
  for (const r of newResults) byRef.set(_partyRefKey(r), r);

  const data = {
    entity_id:           ent?.entity_id ?? kycRef,
    case_id:             ent?.case_id ?? kycRef,
    screening_timestamp: new Date().toISOString(),
    screening_config: {
      dataset_scope:   'default',
      score_threshold: 0.7,
      algorithm:       'opensanctions-direct',
      topics_filter:   [],
    },
    screening_results: Array.from(byRef.values()),
  };

  const { data: row, error } = await sb
    .from('screening_runs')
    .insert({ kyc_ref: kycRef, data, initiated_by: initiatedBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return _applyDispositions(kycRef, row);
}

/**
 * Return the latest screening run for a case, with analyst dispositions overlaid.
 * Returns null if no run exists yet.
 * @param {string} kycRef
 */
export async function getScreening(kycRef) {
  const { data: rows, error } = await sb
    .from('screening_runs')
    .select('*')
    .eq('kyc_ref', kycRef)
    .order('screened_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!rows?.length) return null;
  return _applyDispositions(kycRef, rows[0]);
}

/**
 * Set an analyst disposition for a matched entity (survives re-screens).
 * Valid analyst dispositions: true_match | false_positive | escalated
 * Passing any other value (or omitting) clears the override so the
 * runner-provided disposition_status (pending_review / discounted) shows through.
 *
 * @param {string} kycRef
 * @param {{ partyRole: string, partyIndex: number|null, matchId: string,
 *           disposition: string, notes?: string, analyst?: string }} opts
 */
export async function setScreeningDisposition(kycRef, { partyRole, partyIndex, matchId, disposition, notes, analyst }) {
  const idx = partyIndex ?? -1;
  const ANALYST_SET = new Set(['true_match', 'false_positive', 'escalated']);
  if (!ANALYST_SET.has(disposition)) {
    // Clear the override — revert to runner-provided disposition
    const { error } = await sb
      .from('screening_dispositions')
      .delete()
      .match({ kyc_ref: kycRef, party_role: partyRole, party_index: idx, match_id: matchId });
    if (error) throw error;
    return { cleared: true };
  }
  const { data, error } = await sb
    .from('screening_dispositions')
    .upsert({
      kyc_ref:    kycRef,
      party_role: partyRole,
      party_index: idx,
      match_id:   matchId,
      disposition,
      notes:      notes ?? null,
      analyst:    analyst ?? null,
      decided_at: new Date().toISOString(),
    }, { onConflict: 'kyc_ref,party_role,party_index,match_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

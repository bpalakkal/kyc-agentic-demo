/**
 * ScreeningRunner — OpenSanctions + Claude discounting
 *
 * Standalone runner (does NOT extend ApiRunner — screening has its own result
 * schema, not the attribute preview/commit flow). Reads parties directly from
 * Supabase, calls the OpenSanctions /match/default endpoint, then asks Claude
 * to evaluate whether above-threshold hits are true matches or false positives.
 *
 * Called by runScreening() in src/db/supabase.js.
 * Never imported directly by route handlers — use runScreening().
 */

import { createClaudeClient } from '../../models/claude.js';

const OPENSANCTIONS_API = 'https://api.opensanctions.org/match/default';
const SCORE_THRESHOLD   = 0.7;

// ── Lazy Anthropic client ────────────────────────────────────────────────────
// ── OpenSanctions query builder ──────────────────────────────────────────────

/**
 * Build the subjects list from DB: entity itself + all persons by role.
 * Returns an array of subject descriptors, each with enough properties to
 * build an OpenSanctions query.
 *
 * @param {string} kycRef
 * @param {{ getPersons: Function, getEntity: Function, getAttributes: Function }} db
 */
const cleanValue = (value) => {
  const text = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  return !text || /^(n\/?a|none|null|unknown|not available|-)$/i.test(text) ? null : text;
};

export const normalizeIdentityValue = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export async function buildSubjects(kycRef, db) {
  const [personsGrouped, entity, attrs] = await Promise.all([
    db.getPersons(kycRef),
    db.getEntity(kycRef).catch(() => null),
    db.getAttributes(kycRef).catch(() => []),
  ]);

  // Build a quick attr-name → display_value lookup
  const byName = {};
  for (const a of attrs) byName[a.attribute_name] = a.display_value ?? null;
  const val  = (n) => byName[n] ?? null;
  const list = (n) => (val(n) ? String(val(n)).split(',').map(s => s.trim()).filter(Boolean) : []);

  const subjects = [];
  const skipped = [];
  const identityKeys = new Map();

  // Entity subject
  const entityName = cleanValue(val('entity_name') ?? entity?.entity_name);
  if (entityName) {
    identityKeys.set(`company::${normalizeIdentityValue(entityName)}`, { party_role: 'entity', party_index: null });
    subjects.push({
      party_role:       'entity',
      party_index:      null,
      party_name:       entityName,
      query_schema:     'Company',
      query_properties: {
        name:               [entityName],
        country:            [val('country_of_incorporation')].filter(Boolean),
        jurisdiction:       [val('country_of_incorporation')].filter(Boolean),
        registrationNumber: [val('registration_number')].filter(Boolean),
        alias:              [...list('previous_names'), ...list('trading_names')],
      },
    });
  }

  // Person subjects
  for (const [role, persons] of Object.entries(personsGrouped ?? {})) {
    for (const p of (persons ?? [])) {
      const a = p.attributes ?? {};
      const cell = (k) => cleanValue(a[`${role}_${k}`]?.display_value ?? a[k]?.display_value);
      const name = cleanValue(p.full_name) ?? cell('name');
      const birthDate = cell('date_of_birth');
      const address = cell('address') ?? cell('correspondence_address') ?? cell('principal_place_of_business');
      const party = {
        party_role: role,
        party_index: p.person_index,
        party_name: name ?? `Unnamed ${String(role).replace(/_/g, ' ')}`,
      };
      if (!name) {
        skipped.push({ ...party, screening_status: 'skipped', skip_reason: 'Not screened: individual name is missing.', match_count: 0, matches: [] });
        continue;
      }
      if (!birthDate && !address) {
        skipped.push({ ...party, screening_status: 'skipped', skip_reason: 'Not screened: date of birth or address is required to reduce false-positive matches.', match_count: 0, matches: [] });
        continue;
      }
      const identityKey = birthDate
        ? `person::${normalizeIdentityValue(name)}::dob::${normalizeIdentityValue(birthDate)}`
        : `person::${normalizeIdentityValue(name)}::address::${normalizeIdentityValue(address)}`;
      const duplicateOf = identityKeys.get(identityKey);
      if (duplicateOf) {
        skipped.push({
          ...party,
          screening_status: 'skipped',
          skip_reason: `Not screened: duplicate of the same normalized individual already included as ${String(duplicateOf.party_role).replace(/_/g, ' ')}${duplicateOf.party_index == null ? '' : ` #${duplicateOf.party_index + 1}`}.`,
          match_count: 0,
          matches: [],
        });
        continue;
      }
      identityKeys.set(identityKey, { party_role: role, party_index: p.person_index });
      subjects.push({
        ...party,
        query_schema:     'Person',
        query_properties: {
          name:      [name],
          birthDate: [birthDate].filter(Boolean),
          address:   [address].filter(Boolean),
          nationality: [p.nationality ?? cell('nationality')].filter(Boolean),
          country:   [cell('country_of_residence') ?? cell('country')].filter(Boolean),
        },
      });
    }
  }

  return { subjects, skipped };
}

// ── OpenSanctions call ───────────────────────────────────────────────────────

/**
 * POST /match/default for a batch of subjects.
 *
 * OpenSanctions batch API accepts `queries` as a map of arbitrary keys →
 * { schema, properties }. We send one key per subject so one HTTP call covers
 * the whole case. The API returns `responses` with the same key structure.
 *
 * Shape assumed (2024-2025 API contract):
 *   response.responses[key] = {
 *     results: [{ id, caption, score, properties, datasets, topics }, …]
 *   }
 *
 * @param {Array<object>} subjects  — output of buildSubjects()
 * @returns {Promise<Map<string, Array>>}  subjectKey → results array
 */
async function callOpenSanctions(subjects) {
  const apiKey = process.env.OPENSANCTIONS_API_KEY;
  if (!apiKey) throw new Error('OPENSANCTIONS_API_KEY is not set');

  // Build query map: subject-0, subject-1, …
  const queries = {};
  subjects.forEach((s, i) => {
    // Strip empty arrays from properties to keep the request tidy
    const props = {};
    for (const [k, v] of Object.entries(s.query_properties ?? {})) {
      if (Array.isArray(v) && v.length) props[k] = v;
    }
    queries[`subject-${i}`] = { schema: s.query_schema, properties: props };
  });

  const resp = await fetch(OPENSANCTIONS_API, {
    method:  'POST',
    headers: {
      'Authorization': `ApiKey ${apiKey}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify({ queries }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenSanctions API error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  // Map subject-N → results array
  const out = new Map();
  for (let i = 0; i < subjects.length; i++) {
    const key     = `subject-${i}`;
    const results = data?.responses?.[key]?.results ?? [];
    out.set(key, results);
  }
  return out;
}

// ── Claude discounting ───────────────────────────────────────────────────────

/**
 * Ask Claude whether a sanctions/PEP hit is a true match or false positive.
 *
 * Returns { disposition: 'true_match'|'discounted', rationale: string }
 *
 * We use a short prompt with JSON output mode. If Claude's response cannot be
 * parsed, we default to 'pending_review' (safe — analyst reviews).
 *
 * @param {object} subject   — subject descriptor (party_role, party_name, …)
 * @param {object} match     — single OpenSanctions result
 * @returns {Promise<{ disposition: string, rationale: string }>}
 */
async function discountWithClaude(subject, match, client) {
  const prompt = `You are a KYC compliance analyst evaluating a potential sanctions/PEP screening match.

Subject being screened:
- Name: ${subject.party_name}
- Type: ${subject.query_schema}
${subject.query_properties.country?.length ? `- Country: ${subject.query_properties.country.join(', ')}` : ''}
${subject.query_properties.birthDate?.length ? `- Date of birth: ${subject.query_properties.birthDate.join(', ')}` : ''}
${subject.query_properties.registrationNumber?.length ? `- Registration: ${subject.query_properties.registrationNumber.join(', ')}` : ''}

Potential match returned by OpenSanctions (score ${match.score.toFixed(2)}):
- Matched name: ${match.caption}
- ID: ${match.id}
- Topics/categories: ${(match.topics ?? []).join(', ') || 'none'}
- Datasets: ${(match.datasets ?? []).join(', ') || 'none'}
- Properties: ${JSON.stringify(match.properties ?? {}, null, 0).slice(0, 600)}

Based on the available information, determine whether this is a TRUE MATCH (the subject and the matched entity are the same person/organisation) or a FALSE POSITIVE (different person/organisation with a similar name or profile).

Respond ONLY with valid JSON in this exact shape:
{ "disposition": "true_match" | "discounted", "rationale": "<one sentence explanation>" }`;

  try {
    const msg = await client.messages.create({
      model:      client.profile.modelId,
      max_tokens: 256,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = msg.content?.find(b => b.type === 'text')?.text ?? '';
    // Extract the first JSON object from the response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON found in Claude response');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!['true_match', 'discounted'].includes(parsed.disposition)) {
      throw new Error(`Unexpected disposition: ${parsed.disposition}`);
    }
    return { disposition: parsed.disposition, rationale: parsed.rationale ?? '' };
  } catch (err) {
    console.warn(`[ScreeningRunner] Claude discounting failed for ${subject.party_name} / ${match.id}: ${err.message}`);
    // Safe fallback — stays in pending_review for analyst
    return { disposition: 'pending_review', rationale: 'Automatic discounting unavailable — analyst review required.' };
  }
}

// ── Main runner class ────────────────────────────────────────────────────────

export class ScreeningRunner {
  constructor({ modelProfileKey = 'bedrock-claude-haiku' } = {}) {
    this.client = createClaudeClient(modelProfileKey);
  }
  /**
   * Run screening for a case. Reads parties from DB, calls OpenSanctions,
   * calls Claude for hits above the score threshold.
   *
   * Returns screening_results array (UI format):
   * [{ party_role, party_index, party_name, match_count, matches: [{ id, caption,
   *    score, topics, datasets, matched_name, disposition_status, rationale }] }]
   *
   * @param {string} kycRef
   * @returns {Promise<Array>}
   */
  async screen(kycRef) {
    // Import supabase helpers lazily (avoids circular dependency — supabase.js
    // imports this file, but only after module load, not at parse time).
    const db = await import('../../../src/db/supabase.js');

    // 1. Build subjects list from DB
    const { subjects, skipped } = await buildSubjects(kycRef, db);
    if (!subjects.length) {
      console.warn(`[ScreeningRunner] No subjects found for ${kycRef} — skipping`);
      return skipped;
    }
    console.log(`[ScreeningRunner] Screening ${subjects.length} subject(s) for ${kycRef}`);

    // 2. Call OpenSanctions (single batch request for all subjects)
    let resultsByKey;
    try {
      resultsByKey = await callOpenSanctions(subjects);
    } catch (err) {
      console.error(`[ScreeningRunner] OpenSanctions call failed: ${err.message}`);
      throw err;
    }

    // 3. For each subject, process results and discount with Claude
    const screening_results = [];

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const key     = `subject-${i}`;
      const hits    = resultsByKey.get(key) ?? [];

      // Filter to hits at or above the score threshold
      const aboveThreshold = hits.filter(h => (h.score ?? 0) >= SCORE_THRESHOLD);
      console.log(`[ScreeningRunner] ${subject.party_name}: ${hits.length} hit(s), ${aboveThreshold.length} above threshold`);

      // Run Claude discounting concurrently for all above-threshold hits
      const matches = await Promise.all(
        aboveThreshold.map(async (hit) => {
          const { disposition, rationale } = await discountWithClaude(subject, hit, this.client);
          return {
            id:               hit.id,
            caption:          hit.caption ?? null,
            score:            hit.score ?? null,
            topics:           hit.topics ?? [],
            datasets:         hit.datasets ?? [],
            // OpenSanctions may return matched_name as an array under properties
            matched_name:     hit.properties?.name ?? hit.properties?.alias ?? [],
            disposition_status: disposition,
            rationale,
          };
        })
      );

      screening_results.push({
        party_role:  subject.party_role,
        party_index: subject.party_index,
        party_name:  subject.party_name,
        query_schema: subject.query_schema,
        query_properties: subject.query_properties,
        screening_status: 'completed',
        match_count: matches.length,
        matches,
      });
    }

    return [...screening_results, ...skipped];
  }
}

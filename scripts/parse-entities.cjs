#!/usr/bin/env node
/**
 * parse-entities.js
 * Reads entities.md → generates src/data/entities-generated.ts
 *
 * Run manually:  node scripts/parse-entities.js
 * Called automatically by:  npm run build  (via the "prebuild" script)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── String helpers ────────────────────────────────────────────────────────────

function cleanCell(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) → text
    .replace(/\\([|[\]#.!()_~>\-])/g, '$1')   // unescape
    .replace(/\s+/g, ' ')
    .trim();
}

function getInitials(name) {
  return name.split(/\s+/).map(w => (w[0] || '').toUpperCase()).join('').slice(0, 2);
}

function esc(str) {
  return JSON.stringify(String(str == null ? '' : str));
}

// ─── Markdown table parser ─────────────────────────────────────────────────────

function parseTable(block) {
  const lines = block.split('\n').filter(l => l.trim().startsWith('|'));
  const headers = [];
  const rows = [];
  for (const line of lines) {
    const cells = line.split('|').slice(1, -1).map(c => cleanCell(c));
    if (cells.every(c => /^[:\-\s]*$/.test(c))) continue; // separator row
    if (headers.length === 0) { headers.push(...cells); }
    else { rows.push(cells); }
  }
  return { headers, rows };
}

// ─── List parsers ──────────────────────────────────────────────────────────────

function parseReasoningItems(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^\d+\.\s+(.+)$/);
    if (m) items.push(cleanCell(m[1]));
  }
  return items;
}

function parseActionItems(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const stripped = line.trim();
    if (!/^[\*\-\+]\s/.test(stripped)) continue;
    const withoutBullet = stripped.replace(/^[\*\-\+]\s+/, '');
    const cleaned = cleanCell(withoutBullet);
    const optMatch = cleaned.match(/^Option\s+\d+\s*[—–\-:]+\s*(.*)/i);
    if (optMatch) {
      const desc = optMatch[1].trim();
      if (desc) items.push(desc);
    }
  }
  return items;
}

// ─── Attribute mapping ─────────────────────────────────────────────────────────

const ATTR_LABELS = {
  entity_name: 'Entity Name',
  legal_entity_type: 'Legal Entity Type',
  country_of_incorporation: 'Country of Incorporation',
  date_of_incorporation: 'Date of Incorporation',
  lei_code: 'LEI Code',
  trading_names: 'Trading Names',
  previous_names: 'Previous Names',
  verification_of_existence: 'Verification of Existence',
  us_registration_number: 'US Registration Number',
  uk_registration_number: 'UK Registration Number',
  regulator: 'Regulator',
  listing_status: 'Listing Status',
  listed_exchange: 'Listed Exchange',
  entity_giin: 'Entity GIIN',
  securities_exchange_act_of_1934_section_13_or_15d_indicator: 'SEC § 13/15(d) Indicator',
  commodities_future_trading_commission_registered_indicator: 'CFTC Registered Indicator',
  legal_registered_address: 'Legal Registered Address',
  principal_place_of_business: 'Principal Place of Business',
  website_address: 'Website',
  foreign_branches_details: 'Foreign Branches',
  sub_advisor_address: 'Sub-Advisor Address',
  entity_classification: 'Entity Classification',
  entity_risk_rating: 'Entity Risk Rating',
  cip_classification: 'CIP Classification',
  entity_nature_of_business: 'Nature of Business',
  sole_proprietorship_indicator: 'Sole Proprietorship',
  parent_public_ally_listed_on_us_exchange_indicator: 'Parent Listed on US Exchange',
  other_business_activity: 'Other Business Activity',
  source_of_funds: 'Source of Funds',
  source_of_wealth: 'Source of Wealth',
  assets_under_management_aum: 'Assets Under Management',
  transacting_with_own_or_third_party_funds_indicator: 'Transacting With',
  uk_entity_tax_id_number: 'UK Tax ID',
  us_entity_tax_id_number: 'US Tax ID',
  corporate_officer: 'Corporate Officer',
  board_director: 'Board Director',
  compliance_officer_signatures_name: 'Compliance Officer',
  mlro_or_equivalent_signatures_name: 'MLRO / Equivalent',
  authorized_signatory: 'Authorized Signatory',
  acting_person: 'Acting Person',
  power_of_attorney: 'Power of Attorney',
  sub_advisor_name: 'Sub-Advisor Name',
  key_controller: 'Key Controller',
  beneficial_owner: 'Beneficial Owner (25%+)',
  list_of_subsidiaries: 'List of Subsidiaries',
  trustee: 'Trustee',
};

function getAttrLabel(key) {
  return ATTR_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getAttrSource(key) {
  const third = ['lei_code', 'us_registration_number', 'uk_registration_number', 'regulator',
                  'verification_of_existence', 'listing_status', 'beneficial_owner',
                  'country_of_incorporation', 'date_of_incorporation'];
  const forge = ['entity_risk_rating', 'cip_classification', 'entity_classification'];
  if (third.includes(key)) return '3rd';
  if (forge.includes(key)) return 'Forge';
  return 'CRM';
}

function getAttrStatus(statusText) {
  const s = (statusText || '').toLowerCase();
  if (s === 'exception') return 'alert';
  if (s === 'warning' || s === 'warn') return 'warn';
  return 'ok';
}

// ─── Exception helpers ─────────────────────────────────────────────────────────

function getCategory(title) {
  const t = title.toLowerCase();
  if (/registration|lei\b|reg.?number|crd/.test(t))          return 'Registration & Compliance';
  if (/address|place of business/.test(t))                    return 'Address Verification';
  if (/compliance.?officer|attestation|cco/.test(t))          return 'Governance & Controls';
  if (/beneficial.?owner|ubo|ownership/.test(t))              return 'Beneficial Ownership';
  if (/risk.?rating|classification|cip|naics/.test(t))        return 'Classification & Risk';
  if (/acting.?person|authority|power.?of.?attorney|poa/.test(t)) return 'Beneficial Ownership';
  if (/sanction/.test(t))                                     return 'Screening';
  return 'Compliance';
}

function getAgentsForCategory(category) {
  switch (category) {
    case 'Beneficial Ownership':       return ['beneficial-owner', 'outreach', 'audit'];
    case 'Classification & Risk':      return ['regulatory', 'risk-scoring', 'audit'];
    case 'Registration & Compliance':  return ['regulatory', 'document', 'audit'];
    case 'Address Verification':       return ['document', 'regulatory', 'audit'];
    case 'Governance & Controls':      return ['document', 'outreach', 'audit'];
    default:                           return ['document', 'audit'];
  }
}

const CONFIDENCE_BY_CATEGORY = {
  'Registration & Compliance': 90,
  'Address Verification':      88,
  'Governance & Controls':     92,
  'Beneficial Ownership':      85,
  'Classification & Risk':     78,
  'Screening':                 95,
};

function getRisk(rating) {
  if (rating === 'High')   return 'Elevated';
  if (rating === 'Medium') return 'Moderate';
  return 'Minimal';
}

function getPriority(rating) {
  if (rating === 'High')   return 'High';
  if (rating === 'Medium') return 'Medium';
  return 'Low';
}

function getDrg(jurisdiction) {
  const j = (jurisdiction || '').toLowerCase();
  if (j.includes('uk') && !j.includes('us')) return 'London Alternatives DRG';
  return 'US Private Equity DRG';
}

// ─── Exception parser ──────────────────────────────────────────────────────────

function parseException(block, kycId, entityName, entityNum, excIdx) {
  const firstLine = block.split('\n')[0] || '';
  const titleMatch = firstLine.match(/###\s+Exception\s+\d+\s+of\s+\d+:\s+(.+)$/);
  const title = titleMatch ? cleanCell(titleMatch[1]) : 'Exception';

  const id = `gen${entityNum}_${excIdx}`;
  const category = getCategory(title);
  const agents = getAgentsForCategory(category);
  const confidence = CONFIDENCE_BY_CATEGORY[category] || 85;

  // Comparison table — first table in block
  let compare = { aLabel: 'Source A', bLabel: 'Source B', rows: [] };
  const tableStart = block.indexOf('\n|');
  if (tableStart !== -1) {
    const tableBlock = block.slice(tableStart + 1);
    const table = parseTable(tableBlock);
    if (table.headers.length >= 3) {
      compare.aLabel = table.headers[1] || 'Source A';
      compare.bLabel = table.headers[2] || 'Source B';
      compare.rows = table.rows
        .filter(r => r[0])
        .map(r => {
          const a = r[1] || '';
          const b = r[2] || '';
          const conflict = (a && b && a !== b && !/^n\/?a$/i.test(a) && !/^n\/?a$/i.test(b)) ? true : undefined;
          return Object.assign({ field: r[0], a, b }, conflict ? { conflict } : {});
        });
    }
  }

  // Narrative — non-heading, non-table, non-list text lines
  const narrativeLines = block.split('\n').filter(l => {
    const t = l.trim();
    return t && !t.startsWith('#') && !t.startsWith('|') && !t.startsWith('*') &&
           !t.startsWith('-') && !t.startsWith('+') && !t.match(/^\d+\./) &&
           !t.match(/^\*Exception Summary/) && !t.match(/^---+$/);
  });
  const narrative = narrativeLines.join(' ').replace(/\s+/g, ' ').trim()
    || `${title} identified during KYC review.`;

  // Reasoning
  const reasoningBlock = block.match(/####\s+Reasoning\s*\n([\s\S]+?)(?=####|---+|$)/)?.[1] || '';
  const reasoningSteps = parseReasoningItems(reasoningBlock);

  // Actions
  const actionsBlock = block.match(/####\s+Actions\s*\n([\s\S]+?)(?=####|---+|$)/)?.[1] || '';
  const actionItems = parseActionItems(actionsBlock);

  // flagText from first conflicting row
  const conflictRow = compare.rows.find(r => r.conflict);
  const flagText = conflictRow
    ? `${conflictRow.field}: ${conflictRow.a} (${compare.aLabel}) vs ${conflictRow.b} (${compare.bLabel}).`
    : narrative.slice(0, 150).trimEnd();

  // Resolutions from action items
  const resolutions = actionItems.slice(0, 3).map((desc, i) => {
    const words = desc.replace(/[:\.\,].*/, '').split(/\s+/).slice(0, 7).join(' ');
    return {
      id: `r${i + 1}`,
      title: words,
      desc,
      recommended: i === 0,
      agents,
      agentLabel: words,
      postRunSummary: `${words}. Case status updated.`,
      updates: [
        { attr: 'Case Status', before: 'Open · Pending analyst action', after: i === 0 ? 'In Progress' : 'Escalated' },
      ],
    };
  });

  // Fallback resolution if Actions section was empty
  if (resolutions.length === 0) {
    resolutions.push({
      id: 'r1', title: `Review ${title}`, desc: `Review and resolve the ${title} exception.`,
      recommended: true, agents, agentLabel: `Review ${title}`,
      postRunSummary: `${title} reviewed. Case updated.`,
      updates: [{ attr: 'Case Status', before: 'Open', after: 'In Progress' }],
    });
  }

  return {
    id, title, confidence, status: 'Pending', entity: entityName, kyc: kycId, category,
    flagText, narrative,
    reasoningSteps: reasoningSteps.length ? reasoningSteps : [`Review required: ${title}.`],
    evidenceRationale: `${compare.aLabel} and ${compare.bLabel} are the primary evidence sources.`,
    evidence: [
      { name: compare.aLabel, sub: compare.rows[0]?.a?.slice(0, 60) || 'See comparison' },
      { name: compare.bLabel, sub: compare.rows[0]?.b?.slice(0, 60) || 'See comparison' },
    ],
    acceptability: `${title} requires analyst review and resolution before case closure.`,
    resolutions,
    compare,
  };
}

// ─── Entity parser ─────────────────────────────────────────────────────────────

function parseEntity(block) {
  const firstLine = (block.split('\n')[0] || '').trim();
  const headingMatch = firstLine.match(/^#\s+Entity\s+(\d+)\s+[—–\-]+\s+(.+)$/);
  const entityNum  = headingMatch ? parseInt(headingMatch[1]) : 1;
  const entityName = headingMatch ? cleanCell(headingMatch[2]) : 'Unknown Entity';

  // Case Details
  const cdBlock = block.match(/##\s+Case\s+Details\s*\n([\s\S]+?)(?=##|$)/)?.[1] || '';
  const cdTable = parseTable(cdBlock);
  const cd = {};
  for (const r of cdTable.rows) {
    if (r.length >= 2) cd[r[0].toLowerCase().replace(/\s+/g, '_')] = r[1];
  }

  // parseTable() treats the first row as headers, so "| Case ID | KYC-30215 |"
  // never lands in cd.  Extract the KYC ID directly with a regex instead.
  const kycIdMatch    = cdBlock.match(/\|\s*Case\s*ID\s*\|\s*(KYC-[^|\s]+)\s*\|/i);
  const kycId         = (kycIdMatch ? kycIdMatch[1].trim() : null) || `KYC-9${String(entityNum).padStart(4,'0')}`;

  const entityType    = cd['entity_type']           || 'Entity';
  const jurisdiction  = cd['jurisdiction']?.replace(/\\\|/g, '|').replace(/\|/g, '—') || 'US';
  const riskRating    = cd['client_risk_rating']    || 'Medium';
  const openExceptions = parseInt(cd['open_exceptions'] || '0');

  // Attribute Coverage
  const attrBlock = block.match(/##\s+Attribute\s+Coverage\s*\n([\s\S]+?)(?=##|$)/)?.[1] || '';
  const attrTable = parseTable(attrBlock);
  const attrs = attrTable.rows
    .filter(r => r.length >= 1 && r[0])
    .map(r => ({
      key:    r[0],
      label:  getAttrLabel(r[0]),
      value:  r[1] || '',
      status: getAttrStatus(r[2] || 'Complete'),
      source: getAttrSource(r[0]),
    }));

  // Exceptions
  const excSection = block.match(/##\s+Exceptions\s*\n([\s\S]+?)(?=\n##[^#]|$)/)?.[1] || '';
  const excBlocks  = excSection.split(/(?=###\s+Exception\s+\d+)/);
  const exceptions = excBlocks
    .filter(b => b.trim().startsWith('###'))
    .map((b, i) => parseException(b, kycId, entityName, entityNum, i + 1));

  return { entityNum, entityName, kycId, entityType, jurisdiction, riskRating, openExceptions, attrs, exceptions };
}

function parseEntities(md) {
  md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = md.split(/(?=^#\s+Entity\s+\d+)/m).filter(b => /^#\s+Entity\s+\d+/.test(b.trimStart()));
  return blocks.map(parseEntity);
}

// ─── TypeScript code generator ─────────────────────────────────────────────────

function generateTypeScript(entities) {
  const out = [];

  out.push(`// AUTO-GENERATED by scripts/parse-entities.js — do not edit manually.`);
  out.push(`// To update: edit entities.md then run \`npm run build\` (or \`node scripts/parse-entities.js\`).`);
  out.push(``);
  out.push(`import type { AgentId } from "@/components/AgentSystem";`);
  out.push(``);

  // ── GenException type ──
  out.push(`export type GenException = {`);
  out.push(`  id: string; title: string; confidence: number; status: "Pending";`);
  out.push(`  entity: string; kyc: string; category: string;`);
  out.push(`  flagText: string; narrative: string;`);
  out.push(`  reasoningSteps: string[]; evidenceRationale: string;`);
  out.push(`  evidence: { name: string; sub: string }[];`);
  out.push(`  acceptability: string;`);
  out.push(`  resolutions: {`);
  out.push(`    id: string; title: string; desc: string; recommended?: boolean;`);
  out.push(`    agents: AgentId[]; agentLabel: string;`);
  out.push(`    postRunSummary: string;`);
  out.push(`    updates: { attr: string; before: string; after: string }[];`);
  out.push(`  }[];`);
  out.push(`};`);
  out.push(``);

  // ── GENERATED_EXCEPTIONS ──
  out.push(`export const GENERATED_EXCEPTIONS: GenException[] = [`);
  for (const ent of entities) {
    for (const exc of ent.exceptions) {
      out.push(`  {`);
      out.push(`    id: ${esc(exc.id)}, title: ${esc(exc.title)}, confidence: ${exc.confidence}, status: "Pending",`);
      out.push(`    entity: ${esc(exc.entity)}, kyc: ${esc(exc.kyc)}, category: ${esc(exc.category)},`);
      out.push(`    flagText: ${esc(exc.flagText)},`);
      out.push(`    narrative: ${esc(exc.narrative)},`);
      out.push(`    reasoningSteps: [`);
      exc.reasoningSteps.forEach(s => out.push(`      ${esc(s)},`));
      out.push(`    ],`);
      out.push(`    evidenceRationale: ${esc(exc.evidenceRationale)},`);
      out.push(`    evidence: [`);
      exc.evidence.forEach(e => out.push(`      { name: ${esc(e.name)}, sub: ${esc(e.sub)} },`));
      out.push(`    ],`);
      out.push(`    acceptability: ${esc(exc.acceptability)},`);
      out.push(`    resolutions: [`);
      for (const r of exc.resolutions) {
        out.push(`      {`);
        out.push(`        id: ${esc(r.id)}, title: ${esc(r.title)}, desc: ${esc(r.desc)},`);
        if (r.recommended) out.push(`        recommended: true,`);
        out.push(`        agents: [${r.agents.map(a => esc(a)).join(', ')}] as AgentId[],`);
        out.push(`        agentLabel: ${esc(r.agentLabel)},`);
        out.push(`        postRunSummary: ${esc(r.postRunSummary)},`);
        out.push(`        updates: [`);
        r.updates.forEach(u => out.push(`          { attr: ${esc(u.attr)}, before: ${esc(u.before)}, after: ${esc(u.after)} },`));
        out.push(`        ],`);
        out.push(`      },`);
      }
      out.push(`    ],`);
      out.push(`  },`);
    }
  }
  out.push(`];`);
  out.push(``);

  // ── GENERATED_COMPARISONS ──
  out.push(`export const GENERATED_COMPARISONS: Record<string, {`);
  out.push(`  aLabel: string; bLabel: string;`);
  out.push(`  rows: { field: string; a: string; b: string; conflict?: boolean }[];`);
  out.push(`}> = {`);
  for (const ent of entities) {
    for (const exc of ent.exceptions) {
      const c = exc.compare;
      out.push(`  ${esc(exc.id)}: {`);
      out.push(`    aLabel: ${esc(c.aLabel)}, bLabel: ${esc(c.bLabel)},`);
      out.push(`    rows: [`);
      c.rows.forEach(r => {
        const conflict = r.conflict ? `, conflict: true` : '';
        out.push(`      { field: ${esc(r.field)}, a: ${esc(r.a)}, b: ${esc(r.b)}${conflict} },`);
      });
      out.push(`    ],`);
      out.push(`  },`);
    }
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_ENTITY_PROFILES ──
  out.push(`export const GENERATED_ENTITY_PROFILES: Record<string, {`);
  out.push(`  name: string; kyc: string;`);
  out.push(`  attrs: { label: string; value: string; source: "CRM" | "3rd" | "Forge"; status: "ok" | "alert" | "warn" }[];`);
  out.push(`  caseFile: string;`);
  out.push(`}> = {`);
  for (const ent of entities) {
    const { entityName, kycId, entityType, jurisdiction, riskRating, openExceptions, attrs, exceptions } = ent;

    const excLines = exceptions.map((e, i) => `${i + 1}. **${e.title}** — ${e.flagText.replace(/\.$/, '').slice(0, 80)}${e.flagText.length > 80 ? '...' : ''}.`).join('\n');
    const nextActions = exceptions.flatMap(e => e.resolutions.slice(0, 1).map(r => `- ${r.desc.slice(0, 100)}${r.desc.length > 100 ? '...' : ''}`)).slice(0, 3).join('\n');

    const caseFile = [
      `# ${entityName}`,
      ``,
      `**KYC ID:** ${kycId}  `,
      `**Entity Type:** ${entityType}  `,
      `**Jurisdiction:** ${jurisdiction}  `,
      `**Client Risk Rating:** ${riskRating}  `,
      `**Open Exceptions:** ${openExceptions}`,
      ``,
      `## Entity Summary`,
      `${entityType} with ${openExceptions} open exception${openExceptions !== 1 ? 's' : ''} requiring resolution.`,
      ``,
      `## Open Exceptions (${openExceptions})`,
      excLines || '_No exceptions._',
      ``,
      `## Next Actions`,
      nextActions || '_Review required._',
    ].join('\n');

    out.push(`  ${esc(entityName)}: {`);
    out.push(`    name: ${esc(entityName)}, kyc: ${esc(kycId)},`);
    out.push(`    attrs: [`);
    attrs.filter(a => a.value || a.status === 'alert').forEach(a => {
      out.push(`      { label: ${esc(a.label)}, value: ${esc(a.value)}, source: ${esc(a.source)}, status: ${esc(a.status)} },`);
    });
    out.push(`    ],`);
    out.push(`    caseFile: ${esc(caseFile)},`);
    out.push(`  },`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_ENTITY_GROUPS ──
  out.push(`export const GENERATED_ENTITY_GROUPS: Record<string, { drg: string; attrs: string[] }> = {`);
  for (const ent of entities) {
    const drg  = getDrg(ent.jurisdiction);
    const excAttrs = ent.attrs.filter(a => a.status === 'alert').map(a => a.label);
    const groupAttrs = excAttrs.length ? excAttrs.slice(0, 4) : ['Entity Risk Rating', 'CIP Classification', 'Entity Classification', 'Nature of Business'];
    out.push(`  ${esc(ent.entityName)}: { drg: ${esc(drg)}, attrs: [${groupAttrs.map(esc).join(', ')}] },`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_ENTITY_DRG (helper for WorkQueue) ──
  out.push(`export const GENERATED_ENTITY_DRG: Record<string, string> = {`);
  for (const ent of entities) {
    out.push(`  ${esc(ent.kycId)}: ${esc(getDrg(ent.jurisdiction))},`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_WORK_ROWS ──
  out.push(`export const GENERATED_WORK_ROWS: {`);
  out.push(`  id: string; name: string; kyc: string; due: string; confidence: string;`);
  out.push(`  customerType: string; jurisdiction: string;`);
  out.push(`  priority: "Low" | "Medium" | "High";`);
  out.push(`  risk: "Minimal" | "Moderate" | "Elevated";`);
  out.push(`  exc: number; status: "In Progress"; action: "Periodic Refresh"; selectable: true;`);
  out.push(`}[] = [`);
  const DUE_DATES = ['Jul 15, 2026', 'Jul 22, 2026', 'Jul 30, 2026', 'Aug 05, 2026', 'Aug 12, 2026'];
  for (const ent of entities) {
    const due = DUE_DATES[(ent.entityNum - 1) % DUE_DATES.length];
    out.push(`  {`);
    out.push(`    id: ${esc('gen' + ent.entityNum)}, name: ${esc(ent.entityName)}, kyc: ${esc(ent.kycId)},`);
    out.push(`    due: ${esc(due)}, confidence: "91%",`);
    out.push(`    customerType: ${esc(ent.entityType)}, jurisdiction: ${esc(ent.jurisdiction)},`);
    out.push(`    priority: ${esc(getPriority(ent.riskRating))},`);
    out.push(`    risk: ${esc(getRisk(ent.riskRating))},`);
    out.push(`    exc: ${ent.openExceptions}, status: "In Progress", action: "Periodic Refresh", selectable: true,`);
    out.push(`  },`);
  }
  out.push(`];`);
  out.push(``);

  // ── GENERATED_DASHBOARD_CASES ──
  out.push(`export const GENERATED_DASHBOARD_CASES: {`);
  out.push(`  priority: "High" | "Medium" | "Low"; id: string; entity: string;`);
  out.push(`  note: string; due: string; est: string; status: "open";`);
  out.push(`}[] = [`);
  for (const ent of entities) {
    const topExc = ent.exceptions[0];
    const rawNote = topExc
      ? `${topExc.title} — ${topExc.flagText.replace(/\.$/, '')}.`
      : `${ent.openExceptions} open exception${ent.openExceptions !== 1 ? 's' : ''} pending.`;
    const note = rawNote.slice(0, 120);
    const est  = ent.openExceptions > 3 ? '45 min' : '30 min';
    out.push(`  { priority: ${esc(getPriority(ent.riskRating))}, id: ${esc(ent.kycId)}, entity: ${esc(ent.entityName)},`);
    out.push(`    note: ${esc(note)}, due: "Jul 15", est: ${esc(est)}, status: "open" },`);
  }
  out.push(`];`);
  out.push(``);

  // ── GENERATED_COMMENTS ──
  out.push(`export const GENERATED_COMMENTS: Record<string, {`);
  out.push(`  author: string; initials: string; role: string; time: string;`);
  out.push(`  kind: "comment" | "ai" | "action"; body: string;`);
  out.push(`}[]> = {`);
  for (const ent of entities) {
    const topExc = ent.exceptions[0];
    const aiMsg  = `${ent.openExceptions} exception${ent.openExceptions !== 1 ? 's' : ''} detected. Top priority: ${topExc ? topExc.title : 'Review required'}.`;
    out.push(`  ${esc(ent.kycId)}: [`);
    out.push(`    { author: "AI Agent", initials: "AI", role: "Automated Review", time: "Today",`);
    out.push(`      kind: "ai", body: ${esc(aiMsg)} },`);
    out.push(`  ],`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_TASKS ──
  out.push(`export const GENERATED_TASKS: Record<string, {`);
  out.push(`  title: string; assignee: string; due: string; status: "Open" | "In Progress" | "Done";`);
  out.push(`}[]> = {`);
  for (const ent of entities) {
    out.push(`  ${esc(ent.kycId)}: [`);
    ent.exceptions.slice(0, 3).forEach(exc => {
      out.push(`    { title: ${esc('Resolve: ' + exc.title)}, assignee: "Unassigned", due: "TBD", status: "Open" },`);
    });
    out.push(`  ],`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_WATCHERS ──
  out.push(`export const GENERATED_WATCHERS: Record<string, {`);
  out.push(`  name: string; initials: string; role: string;`);
  out.push(`}[]> = {`);
  for (const ent of entities) {
    out.push(`  ${esc(ent.kycId)}: [`);
    out.push(`    { name: "Priya Patel", initials: "PP", role: "KYC Analyst · L1" },`);
    out.push(`    { name: "Quinn Doe",   initials: "QD", role: "Reviewer · L2" },`);
    out.push(`  ],`);
  }
  out.push(`};`);
  out.push(``);

  // ── GENERATED_ACTIVITY ──
  out.push(`export const GENERATED_ACTIVITY: Record<string, { time: string; text: string }[]> = {`);
  for (const ent of entities) {
    out.push(`  ${esc(ent.kycId)}: [`);
    out.push(`    { time: "Today", text: "Case opened from entities.md" },`);
    out.push(`    { time: "Today", text: ${esc(`AI Agent flagged ${ent.openExceptions} exception${ent.openExceptions !== 1 ? 's' : ''} during initial review`)} },`);
    out.push(`  ],`);
  }
  out.push(`};`);
  out.push(``);

  return out.join('\n');
}

// ─── Entry point ───────────────────────────────────────────────────────────────

const ROOT          = path.join(__dirname, '..');
const MD_PATH       = path.join(ROOT, 'entities.md');
const OUT_PATH      = path.join(ROOT, 'src', 'data', 'entities-generated.ts');

if (!fs.existsSync(MD_PATH)) {
  console.log('⚠  entities.md not found — generating empty placeholder');
  const placeholder = [
    `// AUTO-GENERATED — no entities.md found.`,
    `import type { AgentId } from "@/components/AgentSystem";`,
    `export type GenException = { id: string; title: string; confidence: number; status: "Pending"; entity: string; kyc: string; category: string; flagText: string; narrative: string; reasoningSteps: string[]; evidenceRationale: string; evidence: { name: string; sub: string }[]; acceptability: string; resolutions: { id: string; title: string; desc: string; recommended?: boolean; agents: AgentId[]; agentLabel: string; postRunSummary: string; updates: { attr: string; before: string; after: string }[]; }[]; };`,
    `export const GENERATED_EXCEPTIONS: GenException[] = [];`,
    `export const GENERATED_COMPARISONS: Record<string, { aLabel: string; bLabel: string; rows: { field: string; a: string; b: string; conflict?: boolean }[] }> = {};`,
    `export const GENERATED_ENTITY_PROFILES: Record<string, { name: string; kyc: string; attrs: { label: string; value: string; source: "CRM" | "3rd" | "Forge"; status: "ok" | "alert" | "warn" }[]; caseFile: string }> = {};`,
    `export const GENERATED_ENTITY_GROUPS: Record<string, { drg: string; attrs: string[] }> = {};`,
    `export const GENERATED_ENTITY_DRG: Record<string, string> = {};`,
    `export const GENERATED_WORK_ROWS: { id: string; name: string; kyc: string; due: string; confidence: string; customerType: string; jurisdiction: string; priority: "Low" | "Medium" | "High"; risk: "Minimal" | "Moderate" | "Elevated"; exc: number; status: "In Progress"; action: "Periodic Refresh"; selectable: true }[] = [];`,
    `export const GENERATED_DASHBOARD_CASES: { priority: "High" | "Medium" | "Low"; id: string; entity: string; note: string; due: string; est: string; status: "open" }[] = [];`,
    `export const GENERATED_COMMENTS: Record<string, { author: string; initials: string; role: string; time: string; kind: "comment" | "ai" | "action"; body: string }[]> = {};`,
    `export const GENERATED_TASKS: Record<string, { title: string; assignee: string; due: string; status: "Open" | "In Progress" | "Done" }[]> = {};`,
    `export const GENERATED_WATCHERS: Record<string, { name: string; initials: string; role: string }[]> = {};`,
    `export const GENERATED_ACTIVITY: Record<string, { time: string; text: string }[]> = {};`,
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, placeholder, 'utf8');
  process.exit(0);
}

const md       = fs.readFileSync(MD_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const entities = parseEntities(md);

if (entities.length === 0) {
  console.warn('⚠  No entities found in entities.md');
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, generateTypeScript(entities), 'utf8');

const totalExc = entities.reduce((n, e) => n + e.exceptions.length, 0);
console.log(`✓  Parsed ${entities.length} entities / ${totalExc} exceptions → src/data/entities-generated.ts`);

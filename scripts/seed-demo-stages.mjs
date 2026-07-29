/**
 * Seed three disposable demo cases at different lifecycle stages.
 *
 * Preview: node scripts/seed-demo-stages.mjs
 * Seed:    node scripts/seed-demo-stages.mjs --execute
 * Delete:  node scripts/seed-demo-stages.mjs --delete
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
for (const envPath of [resolve(scriptDir, '../.env'), resolve(scriptDir, '../../.env')]) {
  try {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      if (!process.env[key]) process.env[key] = line.slice(separator + 1).trim();
    }
  } catch { /* environment may be injected */ }
}

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase credentials');
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: process.env.SUPABASE_DB_SCHEMA?.trim() || 'public' },
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'kyc-files';
const execute = process.argv.includes('--execute');
const removeOnly = process.argv.includes('--delete');
const now = Date.now();
const ago = days => new Date(now - days * 86_400_000).toISOString();
const after = days => new Date(now + days * 86_400_000).toISOString().slice(0, 10);

const cases = [
  {
    entity_id: 'DEMO-DD-COMPLETE', case_id: 'SHOWCASE-2026-01',
    entity_name: 'Aurelius Harbor Investment Management LLC',
    jurisdiction: 'United States — Delaware', risk_rating: 'Low', priority: 'Low',
    status: 'open', due_date: after(45), case_owner: 'Jordan Lee', stage: 'dd_complete',
  },
  {
    entity_id: 'DEMO-SOURCED', case_id: 'SHOWCASE-2026-02',
    entity_name: 'Blue Mesa Capital Advisers LP',
    jurisdiction: 'United States — Delaware', risk_rating: 'Medium', priority: 'Medium',
    status: 'open', due_date: after(18), case_owner: 'Morgan Chen', stage: 'sourced',
  },
  {
    entity_id: 'DEMO-INTAKE', case_id: 'SHOWCASE-2026-03',
    entity_name: 'Cedar Lantern Advisory Group LLC',
    jurisdiction: 'United States — New York', risk_rating: 'High', priority: 'High',
    status: 'open', due_date: after(7), case_owner: 'Alex Rivera', stage: 'intake',
  },
].map(item => ({ ...item, kyc_ref: `${item.entity_id}_${item.case_id}` }));
const refs = cases.map(item => item.kyc_ref);

async function checked(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

async function cleanup() {
  const { data: files } = await checked(
    sb.from('case_files').select('storage_path').in('kyc_ref', refs), 'Load demo files',
  );
  const paths = (files ?? []).map(file => file.storage_path);
  if (paths.length) {
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(`Delete demo Storage: ${error.message}`);
  }
  await checked(sb.from('exception_audit_log').delete().in('kyc_ref', refs), 'Delete audit');
  await checked(sb.from('person_overrides').delete().in('kyc_ref', refs), 'Delete overrides');
  await checked(sb.from('entities').delete().in('kyc_ref', refs), 'Delete entities');
  return paths.length;
}

function lineage(value, source, days, url = null) {
  return [{ value, source, source_url: url, timestamp: ago(days), confidence_score: 0.98 }];
}

async function insertRuns(kycRef, definitions) {
  const rows = definitions.map(([slug, outputType, days, sources, steps, outcome = 'data_found']) => ({
    kyc_ref: kycRef, agent_slug: slug, runner_type: 'api', output_type: outputType,
    status: 'complete', outcome, run_phase: 'main', started_at: ago(days),
    completed_at: new Date(new Date(ago(days)).getTime() + 52_000).toISOString(),
    sources_consulted: sources, steps,
    raw_output: { demo: true, stage: 'showcase', summary: `${slug} completed successfully.` },
  }));
  const { data } = await checked(
    sb.from('agent_runs').insert(rows).select('id,agent_slug'), `Insert runs for ${kycRef}`,
  );
  return new Map(data.map(row => [row.agent_slug, row.id]));
}

async function uploadFiles(kycRef, runIds, specs) {
  const rows = [];
  for (const [localPath, filename, title, documentType, runSlug] of specs) {
    const content = readFileSync(resolve(scriptDir, '..', localPath));
    const storagePath = `${kycRef}/documents/${filename}`;
    const { error } = await sb.storage.from(BUCKET)
      .upload(storagePath, content, { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`Upload ${filename}: ${error.message}`);
    rows.push({
      kyc_ref: kycRef, agent_run_id: runIds.get(runSlug), file_category: 'document',
      mime_type: 'application/pdf', filename, title,
      caption: 'Synthetic evidence prepared for the KYC demonstration.',
      storage_path: storagePath, source_url: 'https://example.com/demo-evidence',
      content_sha256: createHash('sha256').update(content).digest('hex'),
      processing_status: 'complete', document_type: documentType,
      classification_reason: `Demo classifier identified ${documentType}.`,
      classified_at: ago(5), digitized_at: ago(5),
      processing_agent_run_id: runIds.get(runSlug),
    });
  }
  await checked(sb.from('case_files').insert(rows), `Insert files for ${kycRef}`);
}

async function insertExceptions(kycRef, rows) {
  const { data: start } = await checked(
    sb.rpc('alloc_exception_numbers', { p_kyc_ref: kycRef, p_count: rows.length }),
    `Allocate exception numbers for ${kycRef}`,
  );
  const numbered = rows.map((row, index) => ({
    ...row, kyc_ref: kycRef, exception_number: start + index,
  }));
  await checked(sb.from('exceptions').insert(numbered), `Insert exceptions for ${kycRef}`);
  await checked(sb.from('exception_audit_log').insert(numbered.map(row => ({
    kyc_ref: kycRef, exception_number: row.exception_number,
    action: row.status === 'resolved' ? 'resolved' : 'routed',
    actor: row.status === 'resolved' ? 'Demo Analyst' : 'Exception Routing Agent',
    occurred_at: ago(2),
  }))), `Insert exception audit for ${kycRef}`);
  return numbered;
}

const fullAttributeValues = (entity, overrides = {}) => {
  const defaults = {
    entity_name: entity.entity_name,
    cip_classification: 'Registered Investment Advisor or Commodity Trading Advisor',
    legal_structure: 'Limited Liability Company',
    country_of_incorporation: 'United States',
    registration_country: 'United States',
    date_of_incorporation: '2019-03-14',
    registration_number: 'DE-7842196',
    entity_status: 'Active',
    lei_code: '549300DEMOAGENTICKYC01',
    legal_registered_address: '1209 Orange Street, Wilmington, DE 19801',
    principal_place_of_business: '375 Park Avenue, New York, NY 10152',
    mailing_address: '375 Park Avenue, Suite 2400, New York, NY 10152',
    regulator: 'U.S. Securities and Exchange Commission',
    regulator_registration_number: '801-128420',
    regulatory_status: 'Active',
    government_identification: 'CRD 318420',
    evidence_of_existence: 'Certificate of Formation — Active',
    verification_of_existence: 'Registry record and formation document matched',
    entity_nature_of_business: 'Registered investment advisory services',
    activity_type: 'Financial Services/Products',
    website_address: 'https://demo-adviser.example',
    telephone_number: '+1 212 555 0142',
    email_address: 'compliance@demo-adviser.example',
    listing_status: 'No',
    parent_publicly_listed_on_united_states_exchange_indicator: 'No',
    securities_exchange_act_of_1934_section_13_or_15d_indicator: 'No',
    sole_proprietorship_indicator: 'No',
    commodities_future_trading_commission_registered_indicator: 'No',
    transacting_with_own_or_third_party_funds_indicator: 'No',
    source_of_funds: 'Investment-management and advisory fees',
    source_of_wealth: 'Retained earnings from investment-management operations',
    tax_identification_number: '84-7291056',
    annual_revenue: 'USD 48,500,000',
    assets_under_management: 'USD 6,850,000,000',
    employee_count: '86',
    risk_rating: entity.risk_rating,
  };
  return Object.entries({ ...defaults, ...overrides });
};

async function seedRichStage(drgId, entity, config) {
  await checked(sb.from('entities').insert({
    ...entity, stage: undefined, entity_type: config.entityType,
    drg_id: drgId, open_exceptions_count: config.exceptions.length,
  }), `Insert ${entity.stage} entity`);

  const runIds = await insertRuns(entity.kyc_ref, config.runs);
  const values = fullAttributeValues(entity, config.attributeOverrides);
  const rows = values.map(([name, value], index) => {
    const flagged = config.exceptions.find(item => item.attribute_name === name);
    const verified = config.verified;
    const source = index % 3 === 0 ? 'SEC IAPD' : index % 3 === 1
      ? 'State corporate registry' : 'Customer evidence';
    return {
      kyc_ref: entity.kyc_ref, snapshot_id: null,
      agent_run_id: runIds.get(config.attributeRun),
      attribute_name: name, attribute_group: 'core', display_value: value,
      source, confidence: config.confidence, id_flag: true, id_source: source,
      id_reasoning: `Identified from ${source}.`,
      verification_flag: flagged ? false : verified,
      verification_source: flagged ? [] : [source],
      verification_reasoning: flagged ? null : `Verified against ${source}.`,
      exception_flag: Boolean(flagged),
      exception_type: flagged ? flagged.exception_types : [],
      exception_reason: flagged ? flagged.reasoning : [],
      exception_recommendation: flagged
        ? flagged.recommended_actions.map(action => action.description) : [],
      lineage: lineage(value, source, config.age),
    };
  });
  const { data: inserted } = await checked(
    sb.from('entity_attributes').insert(rows).select('id,attribute_name'),
    `Insert ${entity.stage} attributes`,
  );
  const attributeId = name => inserted.find(row => row.attribute_name === name)?.id;

  await checked(sb.from('entity_persons').insert(config.people.map((person, index) => ({
    kyc_ref: entity.kyc_ref, snapshot_id: null,
    agent_run_id: runIds.get(config.peopleRun), source: 'SEC Form ADV and customer evidence',
    person_index: index, ...person,
    attributes: {
      [`${person.role}_name`]: {
        display_value: person.full_name, id_flag: true, verification_flag: config.verified,
      },
      [`${person.role}_nationality`]: {
        display_value: person.nationality, id_flag: true, verification_flag: config.verified,
      },
    },
  }))), `Insert ${entity.stage} people`);

  await insertExceptions(entity.kyc_ref, config.exceptions.map((item, index) => ({
    agent_run_id: runIds.get('exception-routing') ?? runIds.get(config.attributeRun),
    field_name: item.attribute_name, source_type: 'agent:exception-routing',
    status: index === config.exceptions.length - 1 ? 'resolved' : 'open',
    severity: item.severity, title: item.title,
    exception_types: item.exception_types, reasoning: item.reasoning,
    exception_assessments: item.exception_types.map((type, index) => ({
      exception_type: type,
      exception_reasoning: item.reasoning[index] ?? item.reasoning[0] ?? item.title,
    })),
    recommended_actions: item.recommended_actions,
    sources: { source_a: 'Authoritative source', source_b: 'Customer evidence' },
    entity_attribute_id: attributeId(item.attribute_name),
    attribute_name: item.attribute_name,
  })));
  await uploadFiles(entity.kyc_ref, runIds, config.files);
}

async function seedDdComplete(drgId) {
  const entity = cases[0];
  await checked(sb.from('entities').insert({
    ...entity, stage: undefined, entity_type: 'Limited Liability Company',
    drg_id: drgId, open_exceptions_count: 2,
  }), 'Insert DD-complete entity');

  const runIds = await insertRuns(entity.kyc_ref, [
    ['sec', 'attributes', 14, ['SEC EDGAR'], ['Resolved entity', 'Retrieved filings', 'Saved registry attributes']],
    ['iapd', 'both', 13, ['SEC IAPD'], ['Matched CRD 287451', 'Downloaded Form ADV', 'Extracted ownership']],
    ['delaware', 'both', 12, ['Delaware Division of Corporations'], ['Matched file 6739201', 'Captured evidence', 'Saved formation data']],
    ['gleif', 'attributes', 11, ['GLEIF'], ['Searched legal name', 'Matched active LEI', 'Saved LEI record']],
    ['document-processing-flow', 'both', 9, ['Customer documents'], ['Classified four documents', 'Selected digitizers', 'Completed processing']],
    ['digitize-sec-form-adv', 'both', 8, ['SEC Form ADV'], ['Extracted adviser profile', 'Mapped schema fields', 'Linked evidence']],
    ['digitize-certificate-of-incorporation', 'both', 8, ['Certificate of Formation'], ['Verified entity name', 'Verified formation date', 'Linked evidence']],
    ['ria-entity-name-idv', 'both', 6, ['SEC IAPD', 'Delaware'], ['Compared authoritative sources', 'Entity name identified', 'Entity name verified']],
    ['ria-evidence-of-existence-idv', 'both', 6, ['Delaware', 'GLEIF'], ['Validated active registration', 'Corroborated formation date', 'Completed ID&V']],
    ['ria-legal-structure-idv', 'both', 5, ['Delaware Certificate'], ['Identified LLC structure', 'Verified formation instrument']],
    ['ria-registered-address-idv', 'both', 5, ['Delaware', 'Form ADV'], ['Separated registered and principal addresses', 'Verified both address purposes']],
    ['ria-beneficial-owner-idv', 'both', 4, ['Form ADV', 'Passport'], ['Identified controlling owners', 'Verified identity evidence', 'Completed ownership review']],
    ['ria-regulator-idv', 'both', 3, ['SEC IAPD'], ['Verified SEC registration', 'Confirmed active status']],
    ['dd-all-in-one', 'both', 2, ['Binding RIA policy'], ['Completed 18 focused DD checks', 'Consolidated ID&V decisions', 'Routed one exception']],
    ['exception-routing', 'exceptions', 2, ['RIA policy', 'Entity evidence'], ['Assessed source-of-wealth gap', 'Routed to Analyst queue']],
    ['screening', 'exceptions', 1, ['OpenSanctions'], ['Screened entity and three parties', 'Discounted two candidates', 'No unresolved sanctions matches']],
  ]);

  const values = [
    ['entity_name', entity.entity_name, 'SEC IAPD', 'ria-entity-name-idv'],
    ['cip_classification', 'Registered Investment Advisor or Commodity Trading Advisor', 'SEC IAPD', 'ria-entity-name-idv'],
    ['legal_structure', 'Limited Liability Company', 'Delaware Division of Corporations', 'ria-legal-structure-idv'],
    ['country_of_incorporation', 'United States', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['registration_country', 'United States', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['date_of_incorporation', '2017-06-21', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['registration_number', '6739201', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['entity_status', 'Active', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['lei_code', '549300AURELIUSHARBOR01', 'GLEIF', 'ria-evidence-of-existence-idv'],
    ['legal_registered_address', '1209 Orange Street, Wilmington, DE 19801', 'Delaware Division of Corporations', 'ria-registered-address-idv'],
    ['principal_place_of_business', '375 Park Avenue, New York, NY 10152', 'SEC Form ADV', 'ria-registered-address-idv'],
    ['mailing_address', '375 Park Avenue, Suite 2400, New York, NY 10152', 'SEC Form ADV', 'ria-registered-address-idv'],
    ['regulator', 'U.S. Securities and Exchange Commission', 'SEC IAPD', 'ria-regulator-idv'],
    ['regulator_registration_number', '801-118742', 'SEC IAPD', 'ria-regulator-idv'],
    ['regulatory_status', 'Active', 'SEC IAPD', 'ria-regulator-idv'],
    ['government_identification', 'CRD 287451', 'SEC IAPD', 'ria-regulator-idv'],
    ['evidence_of_existence', 'Delaware Certificate of Formation — Active', 'Delaware Division of Corporations', 'ria-evidence-of-existence-idv'],
    ['entity_nature_of_business', 'Registered investment advisory services', 'SEC Form ADV', 'ria-entity-name-idv'],
    ['activity_type', 'Financial Services/Products', 'SEC Form ADV', 'ria-entity-name-idv'],
    ['website_address', 'https://aureliusharbor.example', 'SEC Form ADV', 'ria-entity-name-idv'],
    ['telephone_number', '+1 212 555 0188', 'SEC Form ADV', 'ria-entity-name-idv'],
    ['email_address', 'compliance@aureliusharbor.example', 'SEC Form ADV', 'ria-entity-name-idv'],
    ['listing_status', 'No', 'SEC Form ADV', 'ria-evidence-of-existence-idv'],
    ['parent_publicly_listed_on_united_states_exchange_indicator', 'No', 'SEC Form ADV', 'ria-evidence-of-existence-idv'],
    ['securities_exchange_act_of_1934_section_13_or_15d_indicator', 'No', 'SEC Form ADV', 'ria-evidence-of-existence-idv'],
    ['sole_proprietorship_indicator', 'No', 'Delaware Division of Corporations', 'ria-legal-structure-idv'],
    ['commodities_future_trading_commission_registered_indicator', 'No', 'SEC Form ADV', 'ria-regulator-idv'],
    ['transacting_with_own_or_third_party_funds_indicator', 'No', 'SEC Form ADV', 'ria-regulator-idv'],
    ['source_of_funds', 'Management fees from institutional advisory mandates', 'Audited Financial Report', 'dd-all-in-one'],
    ['source_of_wealth', 'Accumulated investment-management earnings', 'Audited Financial Report', 'dd-all-in-one'],
    ['tax_identification_number', '84-7291056', 'IRS Letter', 'dd-all-in-one'],
    ['annual_revenue', 'USD 72,400,000', 'Audited Financial Report', 'dd-all-in-one'],
    ['assets_under_management', 'USD 9,250,000,000', 'SEC Form ADV', 'dd-all-in-one'],
    ['employee_count', '124', 'SEC Form ADV', 'dd-all-in-one'],
    ['risk_rating', 'Low', 'KYC risk assessment', 'dd-all-in-one'],
    ['verification_of_existence', 'Verified', 'Delaware and GLEIF', 'ria-evidence-of-existence-idv'],
  ];
  const attributes = values.map(([name, value, source, slug]) => ({
    kyc_ref: entity.kyc_ref, snapshot_id: null, agent_run_id: runIds.get(slug),
    attribute_name: name, attribute_group: 'core', display_value: value,
    source, confidence: 98, id_flag: true, id_source: source,
    id_reasoning: `Identified from ${source}.`, verification_flag: true,
    verification_source: [source], verification_reasoning: `Verified against ${source}.`,
    exception_flag: false, exception_type: [], exception_reason: [],
    exception_recommendation: [], lineage: lineage(value, source, 5),
  }));
  // Preserve visible, routed exceptions while leaving nearly all attributes complete.
  const sow = attributes.find(row => row.attribute_name === 'source_of_wealth');
  sow.verification_flag = false;
  sow.exception_flag = true;
  sow.exception_type = ['Requires Manual Review'];
  sow.exception_reason = ['Audited evidence is one reporting period old and requires analyst acceptance.'];
  sow.exception_recommendation = ['Accept with documented rationale or request current financials.'];
  const taxId = attributes.find(row => row.attribute_name === 'tax_identification_number');
  taxId.verification_flag = false;
  taxId.exception_flag = true;
  taxId.exception_type = ['Document Currency'];
  taxId.exception_reason = ['The IRS confirmation letter is outside the preferred evidence window.'];
  taxId.exception_recommendation = ['Request a current IRS confirmation or approve the existing evidence.'];
  const { data: inserted } = await checked(
    sb.from('entity_attributes').insert(attributes).select('id,attribute_name'), 'Insert DD attributes',
  );
  const sowId = inserted.find(row => row.attribute_name === 'source_of_wealth')?.id;
  const taxIdId = inserted.find(row => row.attribute_name === 'tax_identification_number')?.id;
  const nameId = inserted.find(row => row.attribute_name === 'entity_name')?.id;

  await checked(sb.from('entity_persons').insert([
    ['beneficial_owner', 0, 'Isabella Laurent', 55, 'United States'],
    ['beneficial_owner', 1, 'Marcus Wei', 30, 'Singapore'],
    ['corporate_officer', 0, 'Nadia Bennett', null, 'United States'],
    ['authorized_signatory', 0, 'Samuel Ortiz', null, 'United States'],
  ].map(([role, person_index, full_name, ownership_pct, nationality]) => ({
    kyc_ref: entity.kyc_ref, snapshot_id: null, agent_run_id: runIds.get('ria-beneficial-owner-idv'),
    source: 'SEC Form ADV and identity evidence', role, person_index, full_name,
    ownership_pct, nationality, attributes: {
      [`${role}_name`]: { display_value: full_name, id_flag: true, verification_flag: true },
      [`${role}_nationality`]: { display_value: nationality, id_flag: true, verification_flag: true },
    },
  }))), 'Insert DD persons');

  await insertExceptions(entity.kyc_ref, [
    {
      agent_run_id: runIds.get('exception-routing'),
      attribute_name: 'source_of_wealth', field_name: 'source_of_wealth',
      source_type: 'agent:exception-routing', status: 'open', severity: 'medium',
      title: 'Source-of-wealth evidence requires currency review',
      exception_types: ['Requires Manual Review'],
      reasoning: ['Audited financial evidence predates the current review period.'],
      recommended_actions: [{ option: 1, title: 'Accept evidence', description: 'Document why the prior-period audit remains reliable.' }],
      sources: { source_a: 'Audited Financial Report', source_b: 'KYC policy' },
      entity_attribute_id: sowId,
    },
    {
      agent_run_id: runIds.get('exception-routing'),
      attribute_name: 'tax_identification_number', field_name: 'tax_identification_number',
      source_type: 'agent:exception-routing', status: 'open', severity: 'low',
      title: 'Tax-ID evidence is outside the preferred evidence window',
      exception_types: ['Document Currency'],
      reasoning: ['The IRS confirmation letter is valid but older than the policy preference.'],
      recommended_actions: [{ option: 1, title: 'Approve evidence', description: 'Accept the letter with a documented currency rationale.' }],
      sources: { source_a: 'IRS Letter', source_b: 'KYC policy' },
      entity_attribute_id: taxIdId,
    },
    {
      agent_run_id: runIds.get('ria-entity-name-idv'),
      attribute_name: 'entity_name', field_name: 'entity_name',
      source_type: 'agent:ria-entity-name-idv', status: 'resolved', severity: 'low',
      title: 'Entity-name suffix formatting difference resolved',
      exception_types: ['Formatting Difference'],
      reasoning: ['The registry and IAPD records use equivalent LLC suffix formatting.'],
      recommended_actions: [{ option: 1, title: 'Accept match', description: 'Retain the resolved formatting disposition.' }],
      sources: { source_a: 'SEC IAPD', source_b: 'Delaware registry' },
      entity_attribute_id: nameId,
    },
  ]);

  await uploadFiles(entity.kyc_ref, runIds, [
    ['public/sample-docs/fca-register-marshall-wace.pdf', 'sec-form-adv.pdf', 'SEC Form ADV', 'SEC Form ADV', 'digitize-sec-form-adv'],
    ['public/sample-docs/cs01-brevan-howard.pdf', 'certificate-of-formation.pdf', 'Certificate of Formation', 'Certificate of Incorporation', 'digitize-certificate-of-incorporation'],
    ['public/sample-docs/passport-alan-howard.pdf', 'passport-isabella-laurent.pdf', 'Passport — Isabella Laurent', 'Passport', 'ria-beneficial-owner-idv'],
    ['public/sample-docs/crm-snapshot-mw.pdf', 'audited-financial-report.pdf', 'Audited Financial Report', 'Audited Financial Report', 'dd-all-in-one'],
  ]);
}

async function seedSourced(drgId) {
  const entity = cases[1];
  await seedRichStage(drgId, entity, {
    entityType: 'Limited Partnership', verified: false, confidence: 96, age: 4,
    attributeRun: 'iapd', peopleRun: 'iapd',
    attributeOverrides: {
      legal_structure: 'Limited Partnership', registration_number: '7291844',
      principal_place_of_business: '1700 Lincoln Street, Denver, CO 80203',
      regulator_registration_number: '801-126902', government_identification: 'CRD 316902',
    },
    runs: [
      ['sec', 'attributes', 8, ['SEC EDGAR'], ['Resolved entity', 'Retrieved filing metadata']],
      ['iapd', 'both', 7, ['SEC IAPD'], ['Matched CRD 316902', 'Extracted Form ADV profile']],
      ['delaware', 'both', 6, ['Delaware Division of Corporations'], ['Matched active partnership', 'Saved formation record']],
      ['gleif', 'attributes', 6, ['GLEIF'], ['Resolved LEI', 'Saved reference data']],
      ['document-processing-flow', 'both', 5, ['Customer documents'], ['Classified four documents', 'Completed processing']],
      ['digitize-sec-form-adv', 'both', 4, ['SEC Form ADV'], ['Extracted all sourced attributes', 'Linked evidence']],
      ['digitize-certificate-of-incorporation', 'both', 4, ['Formation Certificate'], ['Extracted formation data']],
      ['screening', 'exceptions', 3, ['OpenSanctions'], ['Screened entity and parties', 'Retained possible match']],
      ['exception-routing', 'exceptions', 2, ['KYC policy'], ['Evaluated sourcing gaps', 'Routed exceptions']],
    ],
    people: [
      { role: 'beneficial_owner', full_name: 'Amelia Rhodes', ownership_pct: 64, nationality: 'United States' },
      { role: 'beneficial_owner', full_name: 'Daniel Okafor', ownership_pct: 26, nationality: 'United Kingdom' },
      { role: 'corporate_officer', full_name: 'Mei Tan', ownership_pct: null, nationality: 'Singapore' },
    ],
    exceptions: [
      { attribute_name: 'legal_registered_address', severity: 'medium', title: 'Registered address purpose requires confirmation', exception_types: ['Address Purpose Ambiguity'], reasoning: ['The registry lists a registered-agent address while Form ADV lists the operating office, so the address purpose requires analyst confirmation.'], recommended_actions: [{ option: 1, title: 'Confirm address', description: 'Confirm registered and operating address purposes.' }] },
      { attribute_name: 'source_of_wealth', severity: 'medium', title: 'Source of wealth not independently corroborated', exception_types: ['Insufficient Corroboration'], reasoning: ['The source-of-wealth description is supported only by customer-provided evidence and has not been independently corroborated.'], recommended_actions: [{ option: 1, title: 'Request financials', description: 'Obtain audited financial statements.' }] },
      { attribute_name: 'entity_name', severity: 'low', title: 'Legal-name punctuation difference resolved', exception_types: ['Formatting Difference'], reasoning: ['The legal-name variance is limited to punctuation, and matching registration identifiers confirm that both records refer to the same entity.'], recommended_actions: [{ option: 1, title: 'Accept match', description: 'Accept punctuation-only variance.' }] },
    ],
    files: [
      ['public/sample-docs/fca-register-marshall-wace.pdf', 'form-adv.pdf', 'SEC Form ADV', 'SEC Form ADV', 'digitize-sec-form-adv'],
      ['public/sample-docs/cs01-brevan-howard.pdf', 'formation-certificate.pdf', 'Formation Certificate', 'Certificate of Incorporation', 'digitize-certificate-of-incorporation'],
      ['public/sample-docs/passport-alan-howard.pdf', 'passport-amelia-rhodes.pdf', 'Passport — Amelia Rhodes', 'Passport', 'document-processing-flow'],
      ['public/sample-docs/crm-snapshot-mw.pdf', 'customer-profile.pdf', 'Customer Profile', 'Other', 'document-processing-flow'],
    ],
  });
}

async function seedIntake(drgId) {
  const entity = cases[2];
  await seedRichStage(drgId, entity, {
    entityType: 'Limited Liability Company', verified: false, confidence: 82, age: 2,
    attributeRun: 'crm-intake', peopleRun: 'crm-intake',
    attributeOverrides: {
      date_of_incorporation: '2021-09-08', registration_number: 'NY-6031842',
      legal_registered_address: '28 Liberty Street, New York, NY 10005',
      principal_place_of_business: '445 Park Avenue, New York, NY 10022',
      regulator_registration_number: '801-131977', government_identification: 'CRD 329177',
      website_address: 'https://cedarlantern.example',
    },
    runs: [
      ['crm-intake', 'attributes', 5, ['Client onboarding'], ['Imported onboarding profile', 'Mapped all available KYC fields']],
      ['document-processing-flow', 'both', 4, ['Customer documents'], ['Classified four intake documents', 'Completed digitization']],
      ['digitize-sec-form-adv', 'both', 3, ['Draft Form ADV'], ['Extracted adviser and ownership data']],
      ['digitize-certificate-of-incorporation', 'both', 3, ['Formation Certificate'], ['Extracted formation evidence']],
      ['screening', 'exceptions', 2, ['OpenSanctions'], ['Completed preliminary screening', 'Retained candidate for review']],
      ['exception-routing', 'exceptions', 1, ['KYC intake policy'], ['Assessed intake gaps', 'Created analyst tasks']],
    ],
    people: [
      { role: 'beneficial_owner', full_name: 'Sofia Alvarez', ownership_pct: 52, nationality: 'United States' },
      { role: 'beneficial_owner', full_name: 'Liam Gallagher', ownership_pct: 32, nationality: 'Ireland' },
      { role: 'authorized_signatory', full_name: 'Aisha Rahman', ownership_pct: null, nationality: 'United States' },
    ],
    exceptions: [
      { attribute_name: 'evidence_of_existence', severity: 'high', title: 'Formation evidence awaiting authoritative validation', exception_types: ['Unverified Evidence'], reasoning: ['Customer document has not been matched to the state registry.'], recommended_actions: [{ option: 1, title: 'Run sourcing', description: 'Validate against the New York corporate registry.' }] },
      { attribute_name: 'source_of_funds', severity: 'medium', title: 'Source-of-funds evidence incomplete', exception_types: ['Missing Supporting Evidence'], reasoning: ['Narrative is present but bank evidence is pending.'], recommended_actions: [{ option: 1, title: 'Request evidence', description: 'Obtain supporting bank or audited financial evidence.' }] },
      { attribute_name: 'entity_name', severity: 'low', title: 'Customer-provided legal name captured', exception_types: ['Pending Validation'], reasoning: ['Name is populated but sourcing has not confirmed it.'], recommended_actions: [{ option: 1, title: 'Validate name', description: 'Confirm legal name through authoritative sourcing.' }] },
    ],
    files: [
      ['public/sample-docs/fca-register-marshall-wace.pdf', 'draft-form-adv.pdf', 'Draft SEC Form ADV', 'SEC Form ADV', 'digitize-sec-form-adv'],
      ['public/sample-docs/cs01-brevan-howard.pdf', 'formation-certificate.pdf', 'Formation Certificate', 'Certificate of Incorporation', 'digitize-certificate-of-incorporation'],
      ['public/sample-docs/passport-alan-howard.pdf', 'passport-sofia-alvarez.pdf', 'Passport — Sofia Alvarez', 'Passport', 'document-processing-flow'],
      ['public/sample-docs/crm-snapshot-mw.pdf', 'onboarding-profile.pdf', 'Customer Onboarding Profile', 'Other', 'crm-intake'],
    ],
  });
}

async function main() {
  if (!execute && !removeOnly) {
    console.log('DRY RUN: would replace these disposable cases:');
    for (const item of cases) console.log(`  ${item.stage.padEnd(12)} ${item.entity_name} (${item.kyc_ref})`);
    console.log('Use --execute to seed or --delete to remove them.');
    return;
  }
  const removedFiles = await cleanup();
  if (removeOnly) {
    console.log(`Deleted ${refs.length} staged demo cases and ${removedFiles} Storage object(s).`);
    return;
  }
  const { data: drg } = await checked(
    sb.from('drgs').upsert({ name: 'North America Investment Advisers — 2026 Review' }, { onConflict: 'name' })
      .select('id').single(), 'Create demo DRG',
  );
  await seedDdComplete(drg.id);
  await seedSourced(drg.id);
  await seedIntake(drg.id);
  for (const item of cases) {
    const [{ count: runs }, { count: attributes }, { count: files }, { count: exceptions }, { count: people }] = await Promise.all([
      checked(sb.from('agent_runs').select('*', { count: 'exact', head: true }).eq('kyc_ref', item.kyc_ref), 'Count runs'),
      checked(sb.from('entity_attributes').select('*', { count: 'exact', head: true }).eq('kyc_ref', item.kyc_ref), 'Count attributes'),
      checked(sb.from('case_files').select('*', { count: 'exact', head: true }).eq('kyc_ref', item.kyc_ref), 'Count files'),
      checked(sb.from('exceptions').select('*', { count: 'exact', head: true }).eq('kyc_ref', item.kyc_ref), 'Count exceptions'),
      checked(sb.from('entity_persons').select('*', { count: 'exact', head: true }).eq('kyc_ref', item.kyc_ref), 'Count people'),
    ]);
    console.log(`${item.stage.padEnd(12)} ${item.entity_name}: ${attributes} attributes, ${people} people, ${exceptions} exceptions, ${runs} runs, ${files} files`);
  }
  console.log('Cleanup: node scripts/seed-demo-stages.mjs --delete');
}

main().catch(error => {
  console.error(`STAGED DEMO SEED FAILED: ${error.message ?? error}`);
  process.exit(1);
});

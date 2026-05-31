/**
 * Supabase seed script — populates drgs, entities, and exceptions
 * from the 15 entities defined in entities.md.
 *
 * Run: node scripts/seed-supabase.js
 * Safe to re-run: all upserts are idempotent.
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
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── DRGs ─────────────────────────────────────────────────────────────────────
const DRGS = [
  { name: 'Long Focus Capital Management' },
  { name: 'Brookfield Asset Management' },
  { name: 'Stonepeak Infrastructure Partners - United States' },
  { name: 'Invesco Ltd' },
  { name: 'Futu Trustee Ltd on behalf of BZL Fellows Trust' },
  { name: 'Kettle Hill Capital' },
  { name: 'Feoh Investments UK' },
  { name: 'UNIFI Mutual Holding Co' },
  { name: 'Brevan Howard Group Holdings Ltd' },
  { name: 'AustralianSuper Pty Ltd - Melbourne' },
];

// ─── Entities ─────────────────────────────────────────────────────────────────
// drg_name is resolved to drg_id after DRGs are inserted.
const ENTITIES = [
  {
    kyc_ref: 'KYC-30215', entity_name: 'Long Focus Capital Management, LLC',
    drg_name: 'Long Focus Capital Management',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'United States',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-07-15', open_exceptions_count: 5, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30216', entity_name: 'BROOKFIELD ASSET MANAGEMENT PIC US, LLC',
    drg_name: 'Brookfield Asset Management',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'US (Delaware) with UK branch',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-07-22', open_exceptions_count: 3, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30217', entity_name: 'STONEPEAK ADVISORS III LLC',
    drg_name: 'Stonepeak Infrastructure Partners - United States',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'US (Delaware)',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-07-30', open_exceptions_count: 3, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30218', entity_name: 'NRPL TRUST 2018-2',
    drg_name: null,
    entity_type: 'Trust', jurisdiction: 'United States',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-08-05', open_exceptions_count: 4, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30219', entity_name: '2005 Residential TRUST 3-1',
    drg_name: null,
    entity_type: 'Trust', jurisdiction: 'United States',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-08-12', open_exceptions_count: 3, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30220', entity_name: 'Invesco Global Equity Trust',
    drg_name: 'Invesco Ltd',
    entity_type: 'Trust', jurisdiction: 'United States',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-07-15', open_exceptions_count: 2, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30221', entity_name: 'Futu Trustee Limited AS Trustee of the BZL Fellows Trust',
    drg_name: 'Futu Trustee Ltd on behalf of BZL Fellows Trust',
    entity_type: 'Trust', jurisdiction: 'Hong Kong',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-07-22', open_exceptions_count: 2, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30222', entity_name: 'Kettle Hill Capital Management, LLC',
    drg_name: 'Kettle Hill Capital',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'United States',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-07-30', open_exceptions_count: 1, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30223', entity_name: 'FEOH INVESTMENTS UK LLP',
    drg_name: 'Feoh Investments UK',
    entity_type: 'LLP', jurisdiction: 'United Kingdom',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-08-05', open_exceptions_count: 2, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30224', entity_name: 'Ameritas Investment Partners, INC',
    drg_name: 'UNIFI Mutual Holding Co',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'United States',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-08-12', open_exceptions_count: 1, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30225', entity_name: 'Brevan Howard Capital Management LP',
    drg_name: 'Brevan Howard Group Holdings Ltd',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'United Kingdom',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-07-15', open_exceptions_count: 1, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30226', entity_name: 'Brevan Howard US Investment Management LP',
    drg_name: 'Brevan Howard Group Holdings Ltd',
    entity_type: 'Registered Investment Adviser (RIA)', jurisdiction: 'United Kingdom / United States',
    risk_rating: 'Medium', priority: 'Medium', status: 'open',
    due_date: '2026-07-22', open_exceptions_count: 1, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30227', entity_name: 'Australiansuper RAAD Trust',
    drg_name: 'AustralianSuper Pty Ltd - Melbourne',
    entity_type: 'Trust', jurisdiction: 'United States',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-07-30', open_exceptions_count: 1, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30228', entity_name: 'Citigroup Mortgage Loan Trust 2019-B',
    drg_name: null,
    entity_type: 'Trust', jurisdiction: 'United States',
    risk_rating: 'Low', priority: 'Low', status: 'open',
    due_date: '2026-08-05', open_exceptions_count: 2, case_owner: 'Alex',
  },
  {
    kyc_ref: 'KYC-30229', entity_name: 'Brevan Howard Asset Management LLP',
    drg_name: 'Brevan Howard Group Holdings Ltd',
    entity_type: 'LLP', jurisdiction: 'United Kingdom',
    risk_rating: 'High', priority: 'High', status: 'open',
    due_date: '2026-08-12', open_exceptions_count: 1, case_owner: 'Alex',
  },
];

// ─── Exceptions ───────────────────────────────────────────────────────────────
const EXCEPTIONS = [
  // ── KYC-30215 Long Focus Capital Management, LLC ───────────────────────────
  {
    kyc_ref: 'KYC-30215', exception_number: 1,
    field_name: 'us_registration_number',
    title: 'US Registration Number Mismatch',
    sources: {
      source_a: 'Client Onboarding Form',
      source_b: 'SEC IAPD (Form ADV Part 1A)',
      rows: [
        { field: 'US Registration Number', source_a: '801-12345 (self-reported)', source_b: '801-67890 (retrieved 2026-05-20)' },
        { field: 'Legal Entity Name', source_a: 'Long Focus Capital Management, LLC', source_b: 'Long Focus Capital Management, LLC' },
        { field: 'Principal Address', source_a: '456 Broad Avenue, New York, NY', source_b: '456 Broad Avenue, New York, NY' },
      ],
    },
    reasoning: [
      'SEC IAPD is the system of record for RIA registration numbers under KYC Policy §3.1.',
      'Legal entity name and principal address on Form ADV match the client onboarding form exactly.',
      'The client-provided number resolves in IAPD but to a different legal entity with a different address — supporting the transcription-error hypothesis rather than a substantive conflict.',
    ],
    recommended_actions: [
      { option: 1, description: 'Run SEC-ADV-Verification-Agent to confirm match, update the field to 801-67890, and log discrepancy in audit trail.' },
      { option: 2, description: 'Accept client-provided number with Senior Analyst override and documented rationale.' },
      { option: 3, description: 'Return to client via Relationship Manager for correction.' },
    ],
  },
  {
    kyc_ref: 'KYC-30215', exception_number: 2,
    field_name: 'lei_code',
    title: 'Outstanding LEI Code',
    sources: {
      source_a: 'GLEIF Registry',
      source_b: 'Client Onboarding Form',
      rows: [
        { field: 'LEI Code', source_a: 'No active LEI under entity legal name', source_b: 'Not provided' },
        { field: 'Search by US Reg # 801-67890', source_a: 'No match', source_b: 'n/a' },
        { field: 'AUM (context)', source_a: 'n/a', source_b: '$2.4B reported' },
      ],
    },
    reasoning: [
      'LEI is not a CIP requirement and does not block case closure under FinCEN CDD Rule.',
      'LEI is required for any EMIR- or Dodd-Frank-reportable derivative or swap activity, which is plausible given AUM.',
      'GLEIF returned no match against either legal name or SEC registration number, indicating no LEI has ever been issued (vs. lapsed).',
    ],
    recommended_actions: [
      { option: 1, description: 'Request LEI from client via portal with templated outreach; defer with conditional approval if client confirms no reportable activity.' },
      { option: 2, description: 'Initiate Broad Search Agent across alternative identifier registries (GMEI Utility, KY3P).' },
      { option: 3, description: 'Flag for re-verification at 30 days.' },
    ],
  },
  {
    kyc_ref: 'KYC-30215', exception_number: 3,
    field_name: 'principal_place_of_business',
    title: 'Principal Place of Business Mismatch',
    sources: {
      source_a: 'Corporate Website',
      source_b: 'Form ADV Filing (SEC)',
      rows: [
        { field: 'Principal Address', source_a: '123 Main Street, New York, NY 10001', source_b: '456 Broad Avenue, New York, NY 10005' },
        { field: 'Source Date', source_a: 'Retrieved 2026-05-20', source_b: 'Filing dated 2026-03-31' },
        { field: 'Matches Client Form', source_a: 'No', source_b: 'Yes' },
      ],
    },
    reasoning: [
      'KYC Policy §3.5 establishes a hierarchy in which regulatory filings outrank corporate website content for address verification.',
      'The Form ADV address matches the address self-reported on the client onboarding form, providing two corroborating sources.',
      'The website discrepancy is consistent with a secondary office or unmaintained content rather than a substantive change of principal place of business.',
    ],
    recommended_actions: [
      { option: 1, description: 'Accept Form ADV address (456 Broad Avenue) as authoritative; matches client form.' },
      { option: 2, description: 'Run Geolocation & Business Directory Check (D&B, Google Places) as a tiebreaker before acceptance.' },
      { option: 3, description: 'Request clarification from client.' },
    ],
  },
  {
    kyc_ref: 'KYC-30215', exception_number: 4,
    field_name: 'compliance_officer_signatures_name',
    title: 'Missing Compliance Officer Attestation',
    sources: {
      source_a: 'Form ADV Schedule A',
      source_b: 'Client Submitted Documents',
      rows: [
        { field: 'Compliance Officer Name', source_a: 'Sarah Chen (Chief Compliance Officer)', source_b: 'Not listed' },
        { field: 'Signed Attestation', source_a: 'n/a', source_b: 'Not provided' },
      ],
    },
    reasoning: [
      'CCO identity is independently verified through the regulatory filing.',
      'The gap is an artifact (signed attestation) rather than an unknown attribute.',
      'Direct request to the named officer is faster than relationship-manager-mediated outreach for a known administrative item.',
    ],
    recommended_actions: [
      { option: 1, description: 'Generate pre-filled DocuSign attestation form and send to Sarah Chen.' },
      { option: 2, description: 'Accept ADV-listed CCO name with a conditional flag for the attestation to follow.' },
      { option: 3, description: 'Escalate to client relationship team.' },
    ],
  },
  {
    kyc_ref: 'KYC-30215', exception_number: 5,
    field_name: 'beneficial_owner',
    title: 'Beneficial Ownership Not Identified',
    sources: {
      source_a: 'Form ADV Schedule A',
      source_b: 'Public Registry Traversal',
      rows: [
        { field: '25%+ Beneficial Owner', source_a: 'Long Focus Holdings LLC (100%) — entity, not individual', source_b: 'Chain terminates at Long Focus Holdings LLC; no further public data' },
        { field: 'FinCEN BOI Filing', source_a: 'Not provided by client', source_b: 'n/a' },
        { field: 'Companies House (UK branch)', source_a: 'No PSC at >25%', source_b: 'n/a' },
      ],
    },
    reasoning: [
      'The 25% beneficial ownership threshold is a regulatory requirement, not a policy preference — case closure is blocked.',
      'Delaware does not require public ownership disclosure for LLCs, so further traversal through public sources alone is unlikely to succeed.',
      'Paid registry access (LexisNexis, Sayari) may resolve ownership without client outreach, but client BOI report is the authoritative source.',
    ],
    recommended_actions: [
      { option: 1, description: 'Issue formal FinCEN BOI report request to client with 7-day SLA.' },
      { option: 2, description: 'Run Ownership Resolution Agent against paid registries (LexisNexis, Sayari) to attempt resolution before client outreach.' },
      { option: 3, description: 'Escalate to the Enhanced Due Diligence team.' },
    ],
  },

  // ── KYC-30216 BROOKFIELD ASSET MANAGEMENT PIC US, LLC ─────────────────────
  {
    kyc_ref: 'KYC-30216', exception_number: 1,
    field_name: 'entity_risk_rating',
    title: 'Risk Rating Discrepancy',
    sources: {
      source_a: 'Due Diligence',
      source_b: 'Internal Records',
      rows: [
        { field: 'Risk Rating', source_a: 'High – due to Cayman-domiciled ownership entities', source_b: 'Low – initial classification at time of RR' },
        { field: 'Client Pushback', source_a: 'Yes', source_b: 'Yes' },
      ],
    },
    reasoning: [
      'The client was previously classified as Low Risk under another division UK policy closure in January 2026, and no material adverse factors were identified at that time.',
      'The introduction of Cayman-domiciled ownership entities has systematically triggered a High Risk classification, although Cayman jurisdiction alone is not considered a high-risk trigger under UK standards.',
      'The ultimate beneficial owner is a reputable and known entity, reducing overall risk concerns from a KYC standpoint.',
      'The client has demonstrated full cooperation, and late-stage changes to ownership drilldown requirements would negatively impact client experience.',
    ],
    recommended_actions: [
      { option: 1, description: 'Threshold Alignment — seek confirmation from Compliance to proceed with a 25% ownership drilldown threshold, considering prior low-risk classification, reputable UBO, and jurisdiction-specific interpretation of Cayman exposure.' },
      { option: 2, description: 'Request a risk rating override or exception from compliance to align the entity back to Low/Medium risk, supported by historical assessment and absence of new adverse risk indicators.' },
      { option: 3, description: 'Engage Sales/Coverage teams to provide client context and relationship insights, supporting justification for maintaining a 25% threshold.' },
    ],
  },
  {
    kyc_ref: 'KYC-30216', exception_number: 2,
    field_name: 'cip_classification',
    title: 'CIP Classification and NAICS Code Discrepancy',
    sources: {
      source_a: 'Form ADV',
      source_b: 'Client Confirmation',
      rows: [
        { field: 'CIP Classification', source_a: 'Financial activity flag due to industry code mapping (investment adviser)', source_b: 'Client confirmed NFIE (Non-Financial Entity)' },
        { field: 'Nature of Business', source_a: 'Investment advisory services', source_b: 'Holding company' },
      ],
    },
    reasoning: [
      'The client has explicitly classified the entity as a Non-Financial Entity (NFIE), indicating it does not consider itself engaged in regulated financial institution activities.',
      'The internal trigger is driven by nature of business "Investment adviser / asset manager", commonly linked to investment-related activity.',
      'Validation is needed to determine whether activities are strictly intra-group or extend to investment or financial services activity.',
    ],
    recommended_actions: [
      { option: 1, description: 'Request Legal team review to assess the appropriateness of the client\'s NFIE classification, given the investment adviser nature of business and possible financial activities.' },
      { option: 2, description: 'Targeted client outreach to validate actual activities — whether investment/financial activities are for third parties vs strictly intra-group, and rationale behind NFIE classification.' },
    ],
  },
  {
    kyc_ref: 'KYC-30216', exception_number: 3,
    field_name: 'acting_person',
    title: 'Acting Person — Missing Authority Documentation',
    sources: {
      source_a: 'Form ADV Schedule A',
      source_b: 'Client Submitted Documents',
      rows: [
        { field: 'Acting Person Classification', source_a: 'Acting Person identified, not a member of Vorstand / Executive Management Board', source_b: 'Policy requires PoA or equivalent for non-board Acting Persons' },
        { field: 'Power of Attorney Evidence', source_a: 'No PoA or authorized signatory evidence available', source_b: 'PoA required to validate authority to act' },
      ],
    },
    reasoning: [
      'Guidance clearly states that Acting Persons who are not members of Vorstand cannot rely solely on their designation and must have explicit delegated authority.',
      'Acceptable forms of evidence include a formal Power of Attorney document or an authorized signatory list.',
      'In the absence of such documentation, there is insufficient evidence to validate the individual\'s authority, which presents a KYC control gap.',
    ],
    recommended_actions: [
      { option: 1, description: 'Client outreach requesting a valid PoA document confirming the individual\'s authority, or an authorized signatory list clearly evidencing their authorization.' },
      { option: 2, description: 'Revalidate Acting Person selection — confirm whether the identified Acting Person should be replaced with a Vorstand member, or whether the current Acting Person remains valid but requires formal authority documentation.' },
    ],
  },

  // ── KYC-30217 STONEPEAK ADVISORS III LLC ───────────────────────────────────
  {
    kyc_ref: 'KYC-30217', exception_number: 1,
    field_name: 'date_of_incorporation',
    title: 'Incorporation Date vs Foreign Registration Date Mismatch',
    sources: {
      source_a: 'LEI Record',
      source_b: 'NY Dept. of State (Foreign LLC Filing)',
      rows: [
        { field: 'Incorporation / Formation Date', source_a: '05-Apr-2017', source_b: '16-Oct-2017' },
        { field: 'Jurisdiction', source_a: 'US-DE (Delaware)', source_b: 'Delaware (Foreign LLC registered in NY)' },
      ],
    },
    reasoning: [
      'LEI records often reflect the entity creation/formation timeline for the legal jurisdiction.',
      'NY records reflect the date the Delaware LLC was authorized as a foreign LLC in NY, not the original formation date.',
      'Names align exactly across sources, supporting "date meaning difference" rather than true conflict.',
    ],
    recommended_actions: [
      { option: 1, description: 'Update the KYC record to store date_of_incorporation = 05-Apr-2017 (Delaware formation) and foreign_registration_date = 16-Oct-2017 (NY authority).' },
      { option: 2, description: 'If only one date field exists, use Delaware formation date as authoritative and log NY date as supporting evidence.' },
      { option: 3, description: 'Client outreach to confirm which date they want used for "incorporation date" in contracting/onboarding documents.' },
    ],
  },
  {
    kyc_ref: 'KYC-30217', exception_number: 2,
    field_name: 'legal_registered_address',
    title: 'Registered Address Mismatch',
    sources: {
      source_a: 'LEI Record',
      source_b: 'NY Dept. of State',
      rows: [
        { field: 'Legal Registered Address', source_a: 'Corporation Trust Center, 1209 Orange St, Wilmington, DE 19801', source_b: '28 Liberty St, New York, NY 10005' },
      ],
    },
    reasoning: [
      'Registered agent addresses (Delaware) are legal service addresses, not operational locations.',
      'NY foreign LLC records emphasize where legal process is served/mailed, which can differ from principal office.',
      'Different sources surface different addresses as "the Registered address", causing incorrect address mapping.',
    ],
    recommended_actions: [
      { option: 1, description: 'Save distinct fields: legal_registered_address = Corporation Trust Center, 1209 Orange St, Wilmington, DE 19801 (DE registered agent).' },
      { option: 2, description: 'Client confirmation required to confirm the address.' },
    ],
  },
  {
    kyc_ref: 'KYC-30217', exception_number: 3,
    field_name: 'principal_place_of_business',
    title: 'Principal Business Address Mismatch',
    sources: {
      source_a: 'LEI Record',
      source_b: 'NY Dept. of State & Bloomberg',
      rows: [
        { field: 'Principal Place of Business', source_a: '55 Hudson Yards, 550 W 34th St, 48th Floor, New York, NY 10001', source_b: '28 Liberty St, New York, NY 10005' },
      ],
    },
    reasoning: [
      'LEI shows HQ/principal office (NY—Hudson Yards); NY registration highlights service of process address (28 Liberty St).',
      'Registered agent addresses are legal service addresses, not operational locations.',
      'Incorrect address mapping can occur if teams populate only one address field.',
    ],
    recommended_actions: [
      { option: 1, description: 'Save 28 Liberty St, New York, NY 10005 as principal_place_of_business.' },
      { option: 2, description: 'Client confirmation required to confirm the address.' },
    ],
  },

  // ── KYC-30218 NRPL TRUST 2018-2 ────────────────────────────────────────────
  {
    kyc_ref: 'KYC-30218', exception_number: 1,
    field_name: 'cip_classification',
    title: 'CIP Classification and Legal Structure — Trust vs SPV',
    sources: {
      source_a: 'Delaware Registry (Legal Form)',
      source_b: 'Transaction Context (Functional Role)',
      rows: [
        { field: 'Legal Structure', source_a: 'Delaware Domestic Statutory Trust', source_b: 'Trust used in securitization structure (trustee-administered vehicle)' },
        { field: 'CIP Classification', source_a: 'Trust (by formation)', source_b: 'SPV (derived from securitization function)' },
      ],
    },
    reasoning: [
      'Delaware registry confirms only legal form (statutory trust) — it does not classify economic purpose.',
      'The entity name format ("Trust YYYY X") and absence of typical corporate attributes align with asset-backed securitization vehicles.',
      'Presence of trustee-based control, no directors/officers, no operating business — consistent with SPV characteristics.',
      '"SPV" is a derived classification, not a contradiction.',
    ],
    recommended_actions: [
      { option: 1, description: 'Reach out to PQA for guidance on CIP classification — whether the entity should be recorded as "Trust" based on legal form or "SPV (securitization trust)" based on functional role.' },
    ],
  },

  // ── KYC-30219 2005 Residential TRUST 3-1 ───────────────────────────────────
  {
    kyc_ref: 'KYC-30219', exception_number: 1,
    field_name: 'cip_classification',
    title: 'CIP Classification — Single Source, No Supporting Documentation',
    sources: {
      source_a: 'Delaware Registry (Legal Form)',
      source_b: 'Available Documentation',
      rows: [
        { field: 'Legal Structure', source_a: 'Delaware Domestic Statutory Trust', source_b: 'No supporting trust documentation available' },
        { field: 'CIP Classification', source_a: 'Trust (by formation)', source_b: 'Not independently validated' },
      ],
    },
    reasoning: [
      'Delaware registry confirms statutory trust status, which meets policy criteria for identification.',
      'Absence of trust documentation limits independent validation but does not negate registry-based classification.',
    ],
    recommended_actions: [
      { option: 1, description: 'Request PQA guidance on CIP classification — whether the entity should be recorded strictly as "Trust" based on legal form (Delaware statutory trust).' },
      { option: 2, description: 'Client outreach — request trust agreement / formation documents for additional validation.' },
    ],
  },

  // ── KYC-30220 Invesco Global Equity Trust ──────────────────────────────────
  {
    kyc_ref: 'KYC-30220', exception_number: 1,
    field_name: 'cip_classification',
    title: 'CIP Classification — SEC vs Commingled Trust Discrepancy',
    sources: {
      source_a: 'External / Public Sources',
      source_b: 'Client Confirmation',
      rows: [
        { field: 'Regulatory Status', source_a: 'Indicates SEC registered / SEC-linked entity', source_b: 'Confirmed as Commingled Trust (not SEC registered)' },
        { field: 'Entity Classification', source_a: 'Investment Fund (SEC regulated)', source_b: 'Commingled Trust (bank-regulated pooled vehicle)' },
      ],
    },
    reasoning: [
      'Commingled trusts are not registered with the SEC and are typically governed under banking regulatory frameworks (e.g., OCC).',
      'SEC linkage in sources likely reflects the investment manager (Invesco) rather than the trust itself.',
      'Per policy, commingled trusts are not exchange-listed and may not have publicly available documentation, leading to source misclassification.',
    ],
    recommended_actions: [
      { option: 1, description: 'Auto flag and escalate to FCC — confirm CIP classification as Commingled Trust vs commingled trust, validate correct regulatory treatment and override source-based SEC classification if required.' },
      { option: 2, description: 'Client outreach — request support documentation like declaration of trust and prospectus to evidence fund characteristics.' },
    ],
  },
  {
    kyc_ref: 'KYC-30220', exception_number: 2,
    field_name: 'regulator',
    title: 'Regulator — SEC vs OCC/Banking Framework',
    sources: {
      source_a: 'External / Public Sources',
      source_b: 'Policy / Client Confirmation',
      rows: [
        { field: 'Regulator', source_a: 'Identified as SEC regulated entity', source_b: 'Commingled trusts regulated under OCC / banking framework' },
        { field: 'Entity Classification', source_a: 'Investment Fund (SEC regulated)', source_b: 'Commingled Trust (bank-regulated pooled vehicle)' },
      ],
    },
    reasoning: [
      'Commingled trusts are not subject to SEC mutual fund regulatory requirements and are typically overseen by bank regulators (e.g., OCC).',
      'SEC regulatory linkage likely reflects investment manager (Invesco) oversight, not the trust structure itself.',
      'Applying SEC regulation at entity level results in incorrect regulatory classification and downstream KYC treatment.',
    ],
    recommended_actions: [
      { option: 1, description: 'Auto flag and escalate to FCC — confirm correct regulatory authority mapping. Validate whether entity should be classified under OCC (commingled trust) vs SEC. Apply override if required to align with policy.' },
    ],
  },

  // ── KYC-30221 Futu Trustee Limited ─────────────────────────────────────────
  {
    kyc_ref: 'KYC-30221', exception_number: 1,
    field_name: 'entity_name',
    title: 'Entity Name — Trustee Capacity Merged into Legal Name',
    sources: {
      source_a: 'Client Onboarding Form',
      source_b: 'Corporate Registry / Trustee Corporate Profile',
      rows: [
        { field: 'Legal Entity Name', source_a: '"Futu Trustee Limited as Trustee of the BZL Fellows Trust"', source_b: '"Futu Trustee Limited"' },
      ],
    },
    reasoning: [
      '"Futu Trustee Limited" is the legal entity, while "BZL Fellows Trust" is the legal arrangement — they should not be merged into a single entity name.',
      'Inclusion of "as Trustee of" indicates acting capacity, not legal identity.',
      'Using a combined name can lead to duplicate entity creation, mismatch during screening, and downstream confusion in ownership/control mapping.',
    ],
    recommended_actions: [
      { option: 1, description: 'Escalate to FCC — confirm the entity name: pure legal entity name only, or capacity-based naming (with "as Trustee of").' },
      { option: 2, description: 'Client outreach — request support documentation to confirm the entity name post FCC confirmation if needed.' },
    ],
  },
  {
    kyc_ref: 'KYC-30221', exception_number: 2,
    field_name: 'cip_classification',
    title: 'CIP Classification Ambiguity — Trust vs Trustee (FI vs Non-FI)',
    sources: {
      source_a: 'Client Onboarding Form',
      source_b: 'KYC Interpretation',
      rows: [
        { field: 'Entity Classification', source_a: 'Trust', source_b: 'Corporate Trustee (Financial Services Entity)' },
        { field: 'CIP Classification', source_a: 'Non-Financial Entity (Trust assumed)', source_b: 'Potential Financial Institution (via trustee activities)' },
      ],
    },
    reasoning: [
      'Trusts are typically classified as non-financial entities, unless actively engaged in financial activities.',
      'Corporate trustees often operate under regulated trust services frameworks, creating FI-like characteristics.',
      'Applying trustee attributes directly to the trust can lead to incorrect FI classification and misaligned due diligence requirements.',
    ],
    recommended_actions: [
      { option: 1, description: 'Escalate to PQA — confirm classification rule: should trust classification remain independent of trustee, or should trustee role influence CIP classification.' },
    ],
  },

  // ── KYC-30222 Kettle Hill Capital Management, LLC ──────────────────────────
  {
    kyc_ref: 'KYC-30222', exception_number: 1,
    field_name: 'wolfsberg_fccq',
    title: 'Wolfsberg FCCQ — WorldCheck Hit on Corporate Officer',
    sources: {
      source_a: 'SEC Form ADV',
      source_b: 'WorldCheck',
      rows: [
        { field: 'Name', source_a: 'Bryan Robert Kiss', source_b: 'Bryan R Kiss' },
        { field: 'Date of Birth', source_a: 'May 26, 1970', source_b: 'b.1962' },
        { field: 'Nationality', source_a: 'United States', source_b: 'United States' },
      ],
    },
    reasoning: [
      'A comparison of the WorldCheck report against SEC Form ADV identified a discrepancy in dates of birth.',
      'Nationalities were compared and both individuals are U.S. nationals.',
      'The middle names are similar but dates of birth differ by 8 years.',
    ],
    recommended_actions: [
      { option: 1, description: 'Given the significant age difference (8 years), Bryan R Kiss (b. 1962) can be classified as a false positive match for Bryan Robert Kiss (b. 1970).' },
    ],
  },

  // ── KYC-30223 FEOH INVESTMENTS UK LLP ──────────────────────────────────────
  {
    kyc_ref: 'KYC-30223', exception_number: 1,
    field_name: 'authorized_signatory',
    title: 'Authorized Signatory List Expired',
    sources: {
      source_a: 'On-File ASL',
      source_b: null,
      rows: [
        { field: 'Certified', source_a: 'Yes', source_b: null },
        { field: 'Document Date', source_a: 'May 10th, 2025', source_b: null },
      ],
    },
    reasoning: [
      'Based on the one-year refresh policy on the ASL document, the in-house document has expired a month ago.',
      'The ASL document is certified according to the certification standards.',
      'It took the end customer 17 business days to certify the document in the last KYC review cycle.',
      'Historical data: 76% of similar compliance exception requests have been approved based on internal records from the past 12 months.',
    ],
    recommended_actions: [
      { option: 1, description: 'Raise a compliance exception to accept the ASL document that expired less than one month ago.' },
      { option: 2, description: 'Request that Sales provide the data, as Sales confirmation of the ASL is an acceptable compliant alternative.' },
      { option: 3, description: 'Reach out to the end customer to obtain a refreshed ASL.' },
    ],
  },
  {
    kyc_ref: 'KYC-30223', exception_number: 2,
    field_name: 'beneficial_owner',
    title: 'Beneficial Ownership Threshold Difference',
    sources: {
      source_a: 'System Generated Beneficial Ownership Threshold',
      source_b: 'Organizational Structure Document',
      rows: [
        { field: 'Percentage', source_a: '10%', source_b: '9.99%' },
        { field: 'Beneficial Owner Name', source_a: 'All', source_b: 'Joey Max FRIEDMAN' },
      ],
    },
    reasoning: [
      'The system-generated beneficial ownership threshold was compared against the organizational chart provided by the end customer.',
      'The variance between the ownership stake and the threshold is minimal, at 0.01%.',
    ],
    recommended_actions: [
      { option: 1, description: 'Raise a compliance exception to confirm whether the principal holding 9.99% should be captured, to avoid case rework if the Compliance team flags it during alert review.' },
      { option: 2, description: 'Do not record the ownership stake, as it falls below the established threshold, with the risk of case amendment during Compliance alert review.' },
    ],
  },

  // ── KYC-30224 Ameritas Investment Partners, INC ────────────────────────────
  {
    kyc_ref: 'KYC-30224', exception_number: 1,
    field_name: 'principal_place_of_business',
    title: 'Principal Place of Business Variance',
    sources: {
      source_a: 'Account Opening Form',
      source_b: 'SEC Form ADV',
      rows: [
        { field: 'Principal Place of Business', source_a: '5845 R STREET, LINCOLN, Nebraska, United States, 68505', source_b: '5945 R STREET, LINCOLN, Nebraska, United States, 68505' },
      ],
    },
    reasoning: [
      'A comparison between the Account Opening Form and the SEC Form ADV identified a variance in the Principal Place of Business.',
      'The Account Opening Form was completed by hand.',
      'The discrepancy involves only a single digit in the street number (5845 vs. 5945).',
    ],
    recommended_actions: [
      { option: 1, description: 'Rolling Review Analyst to validate the Account Opening Form — the discrepancy may have resulted from a handwriting or OCR error.' },
      { option: 2, description: 'If the handwritten address is confirmed to be accurate and genuinely inconsistent with the SEC Form ADV, verify whether the client has relocated from the prior address.' },
    ],
  },

  // ── KYC-30225 Brevan Howard Capital Management LP ──────────────────────────
  {
    kyc_ref: 'KYC-30225', exception_number: 1,
    field_name: 'beneficial_owner',
    title: 'Non-Exact Beneficial Ownership Percentage',
    sources: {
      source_a: 'SEC Form ADV',
      source_b: 'Org Structure Document',
      rows: [
        { field: 'BO Percentage', source_a: '>75% owned by Alta LP, which is further 75%+ owned by Alan Eldad Howard', source_b: 'Same structure — all ownership interests are 100%, unless otherwise stated' },
        { field: 'Collection Date', source_a: 'May 8th, 2026', source_b: 'November 8th, 2022' },
      ],
    },
    reasoning: [
      'The SEC Form ADV, dated May 8th, 2026, shows a different BO threshold compared to the org chart collected in 2022.',
      'Recording the higher threshold would normally require client outreach, but given the client\'s known sensitivity and refusal to cooperate further, this outreach cannot be completed.',
      'Consistency exists between the SEC Form ADV and the on-file org chart.',
    ],
    recommended_actions: [
      { option: 1, description: 'Seek confirmation from the internal Guidance SME team to record the higher threshold (100%) given the consistency between the IAPD and the on-file org chart.' },
      { option: 2, description: 'Engage Sales to share the outstanding requirements and request their assistance in connecting with the client.' },
    ],
  },

  // ── KYC-30226 Brevan Howard US Investment Management LP ───────────────────
  {
    kyc_ref: 'KYC-30226', exception_number: 1,
    field_name: 'wolfsberg_fccq',
    title: 'Outstanding Wolfsberg Questionnaire',
    sources: {
      source_a: 'Brevan Howard Capital Management LLP',
      source_b: 'Brevan Howard Capital Management Ltd',
      rows: [
        { field: 'Wolfsberg Questionnaire', source_a: 'Missing', source_b: 'Wolfsberg Questionnaire dated May 25, 2025 provided by client during outreach' },
        { field: 'DRG', source_a: 'Brevan Howard Group Holdings Ltd', source_b: 'Brevan Howard Group Holdings Ltd' },
        { field: 'Client Pushback', source_a: 'Yes', source_b: 'Yes' },
      ],
    },
    reasoning: [
      'Given the client\'s known sensitivity and refusal to cooperate further, the Wolfsberg Questionnaire for "Brevan Howard Capital Management LLP" remains outstanding.',
      'A Wolfsberg Questionnaire is available for the general partner, "Brevan Howard Capital Management Ltd".',
      'Both entities are registered in Jersey and sit under the same DRG.',
    ],
    recommended_actions: [
      { option: 1, description: 'Request an exception from the Compliance team to satisfy the WBQ requirement for Brevan Howard Capital Management LLP using the WBQ on file for Brevan Howard Capital Management Ltd.' },
      { option: 2, description: 'Engage Sales to share the outstanding requirements and request their assistance in connecting with the client.' },
    ],
  },

  // ── KYC-30227 Australiansuper RAAD Trust ───────────────────────────────────
  {
    kyc_ref: 'KYC-30227', exception_number: 1,
    field_name: 'sub_advisor',
    title: 'Unable to Complete Sub Advisor Task',
    sources: {
      source_a: 'Client Response',
      source_b: 'System Generated Requirements',
      rows: [
        { field: 'Sub Advisor', source_a: 'N/A — per client "There is no sub-advisor of Australiansuper RAAD Trust"', source_b: 'Required' },
      ],
    },
    reasoning: [
      'Per the client\'s response, there is no sub-advisor of Australiansuper RAAD Trust.',
      'The sub-advisor task is being flagged as mandatory based on the entity\'s jurisdiction and risk rating.',
      'The Rolling Review team is unable to satisfy this requirement because no sub-advisor exists for this entity.',
    ],
    recommended_actions: [
      { option: 1, description: 'Rolling Review team to confirm the applicable jurisdiction and active accounts, then reach out to Compliance to request removal of this requirement.' },
    ],
  },

  // ── KYC-30228 Citigroup Mortgage Loan Trust 2019-B ─────────────────────────
  {
    kyc_ref: 'KYC-30228', exception_number: 1,
    field_name: 'corporate_officer',
    title: 'Deceased Individual — Corporate Officer',
    sources: {
      source_a: 'Public Records',
      source_b: 'Account Opening Form',
      rows: [
        { field: 'Verification of Existence', source_a: 'FALSE — individual is deceased', source_b: 'TRUE' },
        { field: 'Individual', source_a: 'Sulluman S. Olyayan', source_b: 'Listed as Corporate Officer' },
      ],
    },
    reasoning: [
      'Searched public records and compared them against the Account Opening Form provided by the client.',
      'Public records indicate that Sulluman S. Olyayan is deceased; therefore, he can no longer serve as a corporate officer.',
    ],
    recommended_actions: [
      { option: 1, description: 'Outreach is required to obtain an updated list of corporate officers from the client. Rolling Review team should be mindful of tone given the sensitivity. Escalate to Compliance immediately to confirm appropriate handling protocol, particularly if accounts have had recent activity authorized under the deceased individual\'s name.' },
    ],
  },
  {
    kyc_ref: 'KYC-30228', exception_number: 2,
    field_name: 'authorized_signatory',
    title: 'Deceased Individual — Authorized Signatory',
    sources: {
      source_a: 'Public Records',
      source_b: 'Account Opening Form',
      rows: [
        { field: 'Verification of Existence', source_a: 'FALSE — individual is deceased', source_b: 'TRUE' },
        { field: 'Individual', source_a: 'Sulluman S. Olyayan', source_b: 'Listed as Authorized Signatory' },
      ],
    },
    reasoning: [
      'Searched public records and compared them against the Account Opening Form provided by the client.',
      'Public records indicate that Sulluman S. Olyayan is deceased; therefore, he can no longer serve as an authorized signor.',
    ],
    recommended_actions: [
      { option: 1, description: 'Outreach is required to obtain an updated list of authorized signatories from the client. Rolling Review team should be mindful of tone. Escalate to Compliance immediately to confirm appropriate handling protocol.' },
    ],
  },

  // ── KYC-30229 Brevan Howard Asset Management LLP ──────────────────────────
  {
    kyc_ref: 'KYC-30229', exception_number: 1,
    field_name: 'authorized_signatory',
    title: 'Expired Authorized Signors List',
    sources: {
      source_a: 'In-House ASL',
      source_b: null,
      rows: [
        { field: 'Collection Date', source_a: 'February 1st, 2025', source_b: null },
        { field: 'Expiry', source_a: 'Expired — annual refresh required', source_b: null },
      ],
    },
    reasoning: [
      'Searched all in-house documentation; the most recent ASL on file was collected on 2/1/2025.',
      'Internal guidance requires this document to be refreshed annually.',
      'As a result, the document has now expired.',
    ],
    recommended_actions: [
      { option: 1, description: 'Client outreach is required to obtain the latest ASL. The rolling review analyst should provide the specific certification language up front to avoid unnecessary back-and-forth. Based on historical outreach records, more than 62% of ASL-related client outreach results in multiple reach-outs.' },
    ],
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('Seeding DRGs…');
  const { data: drgs, error: drgErr } = await sb
    .from('drgs')
    .upsert(DRGS, { onConflict: 'name' })
    .select('id, name');
  if (drgErr) { console.error('DRG error:', drgErr.message); process.exit(1); }
  console.log(`  ✓ ${drgs.length} DRGs`);

  const drgByName = Object.fromEntries(drgs.map(d => [d.name, d.id]));

  console.log('Seeding entities…');
  const entityRows = ENTITIES.map(({ drg_name, ...e }) => ({
    ...e,
    drg_id: drg_name ? (drgByName[drg_name] ?? null) : null,
  }));
  const { error: entErr } = await sb
    .from('entities')
    .upsert(entityRows, { onConflict: 'kyc_ref' });
  if (entErr) { console.error('Entity error:', entErr.message); process.exit(1); }
  console.log(`  ✓ ${entityRows.length} entities`);

  console.log('Seeding exceptions…');
  const { error: excErr } = await sb
    .from('exceptions')
    .upsert(EXCEPTIONS, { onConflict: 'kyc_ref,exception_number' });
  if (excErr) { console.error('Exception error:', excErr.message); process.exit(1); }
  console.log(`  ✓ ${EXCEPTIONS.length} exceptions`);

  console.log('\n✓ Seed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });

export type ForgeAttrRow = {
  attribute_name: string;
  attribute_group: string;
  display_value: string | null;
  confidence: number | null;
  id_flag: boolean;
  id_source: string | null;
  verification_flag: boolean;
  verification_source: string[] | null;
  exception_flag: boolean;
  exception_type: string[] | null;
  exception_reason?: string[] | null;
  exception_recommendation?: string[] | null;
  exception_assessments?: { exception_type: string; exception_reasoning: string }[] | null;
  lineage?: ForgeLineageEntry[] | null;
};

export type ForgeLineageEntry = {
  value: unknown;
  source?: string;
  context?: string;
  document?: string;
  document_type?: string;
  confidence_score: number;
  timestamp: string;
};

export type ForgeTraceRow = ForgeAttrRow & { lineage: ForgeLineageEntry[] | null };

export type ForgePersonRow = {
  kyc?: string;
  role: string;
  person_index: number;
  full_name: string | null;
  ownership_pct: number | null;
  nationality: string | null;
  attributes: Record<string, { display_value?: string; id_flag?: boolean; verification_flag?: boolean; exception_flag?: boolean; lineage?: ForgeLineageEntry[] }>;
};

export const WGQ_GROUPS: { label: string; prefix: string[] }[] = [
  { label: "Ownership & Structure",       prefix: ["wgq_q6", "wgq_q7", "wgq_q8", "wgq_q9"] },
  { label: "AML Program",                prefix: ["wgq_q11"] },
  { label: "Policy & Third Parties",     prefix: ["wgq_q12", "wgq_q13", "wgq_q14", "wgq_q15", "wgq_q16", "wgq_q17"] },
  { label: "Prohibited Activities",      prefix: ["wgq_q18", "wgq_q19", "wgq_q20", "wgq_q21"] },
  { label: "CDD & Beneficial Ownership", prefix: ["wgq_q22", "wgq_q23", "wgq_q24", "wgq_q25"] },
  { label: "Risk & PEP",                 prefix: ["wgq_q26", "wgq_q27", "wgq_q28", "wgq_q29"] },
  { label: "Enhanced Due Diligence",     prefix: ["wgq_q30"] },
  { label: "Transaction Monitoring",     prefix: ["wgq_q31", "wgq_q32", "wgq_q33", "wgq_q34", "wgq_q35"] },
  { label: "Correspondent Banking",      prefix: ["wgq_q36", "wgq_q37"] },
  { label: "Sanctions",                  prefix: ["wgq_q38", "wgq_q39", "wgq_q40", "wgq_q41", "wgq_q42"] },
  { label: "Training & Audit",           prefix: ["wgq_q43", "wgq_q44", "wgq_q45"] },
];

export const PERSON_ROLE_LABELS: { role: string; label: string }[] = [
  { role: "key_controller",       label: "Key Controllers" },
  { role: "beneficial_owner",     label: "Beneficial Owners" },
  { role: "authorized_signatory", label: "Authorized Signatories" },
  { role: "board_director",       label: "Board Directors" },
  { role: "corporate_officer",    label: "Corporate Officers" },
  { role: "trustee",              label: "Trustees" },
  { role: "investment_advisor",   label: "Investment Advisors" },
  { role: "power_of_attorney",    label: "Powers of Attorney" },
  { role: "acting_person",        label: "Acting Persons" },
];

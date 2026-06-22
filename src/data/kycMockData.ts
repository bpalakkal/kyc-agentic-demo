import type { AgentId } from "@/components/AgentSystem";

// ─── Attribute types ──────────────────────────────────────────────────────────

export type AttrDocKind = "filing" | "screenshot" | "register" | "passport" | "letter";
export type AttrDoc = {
  id: string;
  title: string;
  source: string;
  date: string;
  kind: AttrDocKind;
  pages?: number;
  body: string[];
  fields?: { label: string; value: string; highlight?: boolean }[];
};
export type EntityAttr = { label: string; value: string; source: "CRM" | "3rd" | "Forge"; status: "ok" | "warn" | "alert"; docs?: AttrDoc[] };
export type EntityProfile = { name: string; kyc?: string; attrs: EntityAttr[]; caseFile: string };

export type AttrTrace = {
  value: string;
  status: "verified" | "flagged";
  confidence: number;
  agents: { id: AgentId; name: string; action: string; thought: string; source: string }[];
  conclusion: string;
};

export type AuditEntry = {
  type: "agent" | "analyst_action" | "override";
  actor: string;
  role?: string;
  action: string;
  valueBefore?: string;
  valueAfter?: string;
  confidence?: number;
  isManual?: boolean;
  timestamp: string;
  source?: string;
};

export type NestedSubField = {
  label: string;
  value: string;
  source: EntityAttr["source"];
  status: EntityAttr["status"];
};
export type NestedEntry = { name: string; tag: string; fields: NestedSubField[] };

export type CaseDoc = {
  id: string;
  title: string;
  entity: string;
  kyc: string;
  source: string;
  kind: AttrDocKind;
  date: string;
  size: string;
  url: string;
  linkedAttrs: string[];
};

// ─── Display constants ────────────────────────────────────────────────────────

export const SOURCE_STYLE: Record<EntityAttr["source"], string> = {
  CRM: "bg-info-soft text-primary border-primary/30",
  "3rd": "bg-warning-soft text-warning border-warning-soft-border",
  Forge: "bg-secondary text-foreground border-border",
};

export const DOT_STYLE: Record<EntityAttr["status"], string> = {
  ok: "bg-success", warn: "bg-warning", alert: "bg-alert",
};

export const SOURCE_AGENT: Record<EntityAttr["source"], { name: string; system: string; icon: string }> = {
  CRM: { name: "CRM Sync Agent", system: "Salesforce CRM (Customer 360)", icon: "🗂" },
  "3rd": { name: "External Data Agent", system: "GLEIF / SEC EDGAR / OFAC / Refinitiv", icon: "🌐" },
  Forge: { name: "Forge Policy Agent", system: "Internal Forge Knowledge Graph", icon: "⚙" },
};

export const STATUS_LABEL: Record<EntityAttr["status"], string> = {
  ok: "Verified", warn: "Review", alert: "Action Required",
};

export const COMPLETENESS_LABEL: Record<EntityAttr["status"], string> = {
  ok: "Complete", warn: "Review", alert: "Incomplete",
};

export const COMPLETENESS_STYLE: Record<EntityAttr["status"], string> = {
  ok: "bg-success-soft text-success border-success-soft-border",
  warn: "bg-warning-soft text-warning border-warning-soft-border",
  alert: "bg-alert-soft text-alert border-alert-soft-border",
};

export const DOC_KIND_META: Record<AttrDocKind, { label: string; tone: string }> = {
  filing:     { label: "Filing",         tone: "bg-info-soft text-primary border-primary/30" },
  screenshot: { label: "Screenshot",     tone: "bg-secondary text-foreground border-border" },
  register:   { label: "Register Entry", tone: "bg-warning-soft text-[hsl(30_70%_40%)] border-warning-soft-border" },
  passport:   { label: "Identity Doc",   tone: "bg-success-soft text-success border-success-soft-border" },
  letter:     { label: "Letter",         tone: "bg-info-soft text-primary border-primary/30" },
};

// ─── Attribute traces ─────────────────────────────────────────────────────────

export const ATTRIBUTE_TRACES: Record<string, AttrTrace> = {
  "Persons of Significant Control": {
    value: "Mr Alan Eldad Howard · 75–100% voting rights (PSC address drift)",
    status: "flagged",
    confidence: 88,
    agents: [
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Pulled live PSC register", thought: "Companies House returns 1 PSC: Mr Alan Eldad Howard, b. 1963-09, British, voting-rights 75–100% and right-to-share-surplus-assets 25–50%.", source: "Companies House PSC API · OC302636" },
      { id: "document", name: "Document Intelligence", action: "Cross-checked CS01 filing", thought: "Latest CS01 (03/14/2026) lists a different correspondence address than the live PSC record. 14-day notification window has lapsed.", source: "Form CS01 · 03/14/2026" },
      { id: "regulatory", name: "Regulatory Agent", action: "Assessed Schedule 1A CA 2006", thought: "PSC address change must be filed via PSC02 within 14 days. Failure is a technical breach, not an AML event.", source: "Companies Act 2006 Sch. 1A" },
      { id: "audit", name: "Audit Agent", action: "Logged trace for review", thought: "Wrote provenance entry to immutable audit log with all 3 source citations.", source: "Audit Log #30214-A14" },
    ],
    conclusion: "PSC identity confirmed; address drift flagged for client PSC02 correction filing.",
  },
  "Designated Members": {
    value: "2 corporate members · 1 Jersey-domiciled (EDD required)",
    status: "flagged",
    confidence: 92,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Enumerated designated members", thought: "Found 2 corporate-llp-designated-members: BH Partnership Holdings Limited (Jersey 106333) and Brevan Howard Asset Management Services Limited (UK 11117501).", source: "Companies House Officers · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Applied EDD jurisdiction matrix", thought: "Jersey is listed on internal EDD policy POL-EDD-23. UK member is in-scope but standard tier.", source: "EDD Policy POL-EDD-23" },
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Attempted UBO traversal on Jersey leg", thought: "JFSC registry returned active entity but no on-file natural-person UBO map. EDD pack required.", source: "JFSC Registry Lookup" },
    ],
    conclusion: "Two designated members verified; Jersey corporate member triggers EDD workflow.",
  },
  "Registered Office": {
    value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB",
    status: "verified",
    confidence: 99,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Extracted from Companies House primary record", thought: "entity_registered_address returns '4th Floor Phoenix House, 1 Station Hill, Reading, Berkshire, RG1 1NB, United Kingdom' for OC302636.", source: "Companies House · OC302636" },
      { id: "identity", name: "Identity Agent", action: "Cross-verified with FCA register", thought: "FCA Register principal place of business matches the Companies House registered office. No divergence.", source: "FCA Register FRN lookup" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed RG postcode jurisdiction", thought: "Reading, Berkshire — UK jurisdiction, FCA-supervised. Active and in good standing.", source: "Royal Mail PAF · UK gov" },
    ],
    conclusion: "Registered office is confirmed across Companies House and FCA register with no divergence.",
  },
  "Company Number": {
    value: "OC302636 · LLP, incorporated 2002-07-16",
    status: "verified",
    confidence: 100,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Pulled Companies House primary record", thought: "OC302636 returns entity_company_type='llp', entity_company_status='active', entity_incorporated_on='2002-07-16'.", source: "Companies House · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed LLP status under LLP Act 2000", thought: "Active limited liability partnership under the Limited Liability Partnerships Act 2000.", source: "LLP Act 2000" },
      { id: "audit", name: "Audit Agent", action: "Stamped immutable record reference", thought: "Pinned snapshot of Companies House response with retrieval timestamp.", source: "Audit Log #30214-CN01" },
    ],
    conclusion: "Company number, type, status, and incorporation date verified directly from the statutory register.",
  },
  "Previous Names": {
    value: "Rivage Capital Management LLP (until 2007)",
    status: "flagged",
    confidence: 95,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Read previous name history", thought: "entity_previous_company_names contains 'RIVAGE CAPITAL MANAGEMENT LLP'. Same company number preserved through name change.", source: "Companies House Name History" },
      { id: "regulatory", name: "Regulatory Agent", action: "Verified FCA permission continuity", thought: "FCA Register shows FRN unchanged through the name change — regulatory continuity confirmed.", source: "FCA Register FRN history" },
      { id: "document", name: "Document Intelligence", action: "Flagged CRM gap", thought: "Internal CRM does not store the prior name. Lineage view will break for analysts on legacy contracts.", source: "CRM Entity Record" },
    ],
    conclusion: "Name change is lawful and regulator-attested; CRM backfill of prior name is recommended.",
  },
  "FCA Permissions": {
    value: "Investment management + Managing an AIF (added 2026-02-11)",
    status: "flagged",
    confidence: 79,
    agents: [
      { id: "regulatory", name: "Regulatory Agent", action: "Polled FCA Register live", thought: "FRN 211088 shows newly added 'Managing an AIF' permission effective 02/11/2026.", source: "FCA Register · FRN 211088" },
      { id: "document", name: "Document Intelligence", action: "Compared with CRM snapshot", thought: "CRM permission set last refreshed 11/02/2025 — does not include the new AIF permission. Drift confirmed.", source: "CRM Permission Set" },
      { id: "risk-scoring", name: "Risk Scoring Agent", action: "Computed risk-model impact", thought: "AIFMD scope adds Article 23 disclosure obligations. Tier may need recomputation post-sync.", source: "Risk Model v4.1 · AIFMD SI 2013/1773" },
    ],
    conclusion: "FCA permission scope has drifted from internal record; sync and re-score required.",
  },
  "Sanctions Screening": {
    value: "1 fuzzy false-positive cleared (PSC name)",
    status: "verified",
    confidence: 97,
    agents: [
      { id: "sanctions", name: "Sanctions Agent", action: "Screened all PSCs and officers", thought: "Ran HMT, OFAC, EU CFSP, UN 1267. One 84% fuzzy hit on PSC name; identity divergence on DOB and nationality.", source: "HMT · OFAC SDN · EU CFSP · UN 1267" },
      { id: "identity", name: "Identity Agent", action: "Confirmed identity divergence", thought: "HMRC-verified passport and Companies House DOB confirm a different individual from the listed namesake.", source: "Passport · Companies House DOB" },
      { id: "audit", name: "Audit Agent", action: "Logged false-positive clearance", thought: "Cleared identity pair added to screening allowlist with full evidence chain.", source: "Audit Log #30188-S03" },
    ],
    conclusion: "Sanctions name-match is a confirmed false positive; cleared with retained evidence.",
  },
  "Controllers": {
    value: "2 controllers identified (LLP designated members + 25%+ PSCs)",
    status: "verified",
    confidence: 94,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Resolved controller set under FCA SUP 11", thought: "Aggregated designated members + PSCs holding ≥25% voting or capital rights. Returned 2 controllers with shareholding bands.", source: "FCA SUP 11.2 · Companies House" },
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Verified upstream ownership chain", thought: "Traversed corporate-member upstream to ultimate natural persons. No undisclosed holders above the 25% threshold.", source: "Companies House PSC · JFSC Registry" },
      { id: "regulatory", name: "Regulatory Agent", action: "Cross-checked FCA Form A history", thought: "All current controllers have approved Form A submissions on file with the FCA. No notification gaps.", source: "FCA Form A archive" },
      { id: "audit", name: "Audit Agent", action: "Pinned controller snapshot", thought: "Immutable snapshot of resolved controller graph stamped to audit log.", source: "Audit Log #30214-CTL" },
    ],
    conclusion: "Controller set reconciled across Companies House, FCA, and upstream registries with no gaps.",
  },
  "Principal Place of Business": {
    value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB",
    status: "verified",
    confidence: 99,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Extracted PPoB from FCA register", thought: "FCA Register principal-place-of-business field returns the Reading address for FRN 209517.", source: "FCA Register · FRN 209517" },
      { id: "identity", name: "Identity Agent", action: "Reconciled with Companies House registered office", thought: "Companies House registered office matches FCA PPoB exactly — no divergence.", source: "Companies House · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed UK supervision footprint", thought: "PPoB sits inside FCA jurisdictional perimeter; no cross-border passporting impact.", source: "FCA Handbook · PERG 2" },
    ],
    conclusion: "Principal place of business confirmed and synchronised between FCA and Companies House.",
  },
};

ATTRIBUTE_TRACES["Persons with Significant Control"] = ATTRIBUTE_TRACES["Persons of Significant Control"];
ATTRIBUTE_TRACES["FCA Regulatory Permissions"] = ATTRIBUTE_TRACES["FCA Permissions"];
ATTRIBUTE_TRACES["Previous Company Names"] = ATTRIBUTE_TRACES["Previous Names"];

// ─── Audit log ────────────────────────────────────────────────────────────────

export const ATTR_AUDIT_LOG: Record<string, AuditEntry[]> = {
  "LEI Number": [
    { type: "agent", actor: "Document Agent", action: "Retrieved from GLEIF registry", valueAfter: "549300TRJQK6NRSF5M51", confidence: 87, timestamp: "2024-10-28 · 14:32 UTC", source: "GLEIF Registry" },
    { type: "analyst_action", actor: "James Holloway", role: "Analyst", action: "Re-ran agent — value inconsistent with CRM record", timestamp: "2024-11-01 · 09:17 UTC" },
    { type: "agent", actor: "Document Agent", action: "Re-processed GLEIF + CRM cross-reference", valueBefore: "549300TRJQK6NRSF5M51", valueAfter: "549300TRJQK6NRSF5M52", confidence: 71, timestamp: "2024-11-01 · 09:18 UTC", source: "GLEIF + CRM" },
  ],
  "Incorporation Date": [
    { type: "agent", actor: "Document Agent", action: "Retrieved from Companies House filing", valueAfter: "2002-11-19", confidence: 87, timestamp: "2024-10-28 · 14:32 UTC", source: "Companies House" },
    { type: "analyst_action", actor: "James Holloway", role: "Analyst", action: "Re-ran agent — date inconsistent with articles of association", timestamp: "2024-11-01 · 09:17 UTC" },
    { type: "agent", actor: "Document Agent", action: "Re-processed Companies House + MoA", valueBefore: "2002-11-19", valueAfter: "2002-11-12", confidence: 71, timestamp: "2024-11-01 · 09:18 UTC", source: "Companies House + MoA" },
    { type: "override", actor: "Sarah Chen", role: "Senior Analyst", action: "Manual override — confirmed via incorporation certificate #IC-2002-441", valueBefore: "2002-11-12", valueAfter: "2002-11-14", confidence: 100, isManual: true, timestamp: "2024-11-02 · 11:45 UTC" },
  ],
  "Persons of Significant Control": [
    { type: "agent", actor: "Document Agent", action: "Retrieved from Companies House PSC register", valueAfter: "Alan Howard · 75–100% voting rights", confidence: 88, timestamp: "2024-11-01 · 10:05 UTC", source: "Companies House" },
    { type: "agent", actor: "Audit Agent", action: "Cross-referenced against OFAC + Refinitiv", confidence: 82, timestamp: "2024-11-01 · 10:06 UTC", source: "OFAC / Refinitiv" },
  ],
};

// ─── Entity profiles ──────────────────────────────────────────────────────────

export const ENTITY_PROFILES: Record<string, EntityProfile> = {
  "London Alternatives DRG": {
    name: "London Alternatives DRG",
    attrs: [
      { label: "Jurisdiction", value: "United Kingdom", source: "CRM", status: "ok" },
      { label: "Entity Count", value: "2 in-scope RIAs", source: "Forge", status: "ok" },
      { label: "Constituent Entities", value: "Brevan Howard AM LLP · Marshall Wace LLP", source: "Forge", status: "ok" },
      { label: "Primary Regulator", value: "Financial Conduct Authority (UK)", source: "3rd", status: "ok" },
      { label: "Customer Type", value: "Registered Investment Advisers (LLP)", source: "CRM", status: "ok" },
      { label: "KYC Refresh Cycle", value: "Annual", source: "Forge", status: "ok" },
      { label: "CIP Status", value: "In Progress — 2 attributes pending", source: "Forge", status: "warn" },
      { label: "AML Policy Version", value: "AML-POL-UK-2025-v2", source: "Forge", status: "ok" },
      { label: "Open Exceptions", value: "5 (under review)", source: "Forge", status: "warn" },
      { label: "Sanctions Screening", value: "Cleared — 2026-04-19", source: "3rd", status: "ok" },
      { label: "PEP Exposure", value: "None Identified", source: "3rd", status: "ok" },
      { label: "Cross-Border Exposure", value: "Jersey (BH corporate member) — EDD active", source: "Forge", status: "warn" },
    ],
    caseFile: `# London Alternatives DRG — Case File\n\n**Case ID:** DRG-LON-ALT-2026-001  \n**Risk Tier:** Elevated  \n**Last Refresh:** 2026-04-19\n\n## Group Overview\nThe London Alternatives DRG consolidates 2 UK-domiciled limited liability partnerships operating as FCA-authorised Registered Investment Advisers running alternative-investment / hedge-fund strategies.\n\n## Constituent Entities\n| Entity | CH # | FCA FRN | Status |\n|--------|------|---------|--------|\n| Brevan Howard Asset Management LLP | OC302636 | 209517 | Active |\n| Marshall Wace LLP | OC302228 | 211088 | Active |\n\n## Regulatory Footprint\n- **FCA** — both entities authorised as investment managers\n- **AIFMD** — Marshall Wace recently added 'Managing an AIF' permission\n- **HMT / OFSI** — sanctions regime applicable\n\n## Open Exceptions (5)\n1. Undisclosed PSC Address Change — *Brevan Howard*\n2. Cross-Jurisdiction Corporate Member (Jersey) — *Brevan Howard*\n3. Previous Company Name Continuity — *Brevan Howard*\n4. FCA Permission Scope Drift — *Marshall Wace*\n5. Sanctions Screening — PSC Name Hit — *Marshall Wace*\n\n## Risk Notes\n- Jersey-domiciled corporate member triggers EDD on the Brevan Howard leg.\n- Sanctions name hit on Marshall Wace PSC is a confirmed false positive.\n\n## Next Actions\n- Resolve 5 open exceptions before **2026-04-25** SLA.\n- Complete EDD pack on BH Partnership Holdings Limited (Jersey).\n- Sync Marshall Wace permission set with FCA register.`,
  },
  "Brevan Howard Asset Management LLP": {
    name: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30229",
    attrs: [
      { label: "Legal Form", value: "Limited Liability Partnership (LLP)", source: "3rd", status: "ok" },
      { label: "Company Number", value: "OC302636", source: "3rd", status: "ok",
        docs: [{ id: "ch-cert-bh", title: "Certificate of Incorporation on Change of Name", source: "Companies House", date: "2007-04-16", kind: "filing", pages: 1,
          body: ["I HEREBY CERTIFY that **RIVAGE CAPITAL MANAGEMENT LLP**, having by special resolution changed its name, is now incorporated under the name of", "%%BREVAN HOWARD ASSET MANAGEMENT LLP%%", "Given at Companies House, Cardiff, the 16th day of April 2007."],
          fields: [{ label: "Company Number", value: "OC302636", highlight: true }, { label: "Type", value: "Limited Liability Partnership" }, { label: "Effective Date", value: "16 April 2007" }],
        }],
      },
      { label: "Incorporated On", value: "2002-07-16", source: "3rd", status: "ok" },
      { label: "Company Status", value: "Active", source: "3rd", status: "ok" },
      { label: "Registered Office", value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB", source: "3rd", status: "ok",
        docs: [{ id: "ch-ad01-bh", title: "Form AD01 — Change of Registered Office", source: "Companies House", date: "2019-08-22", kind: "filing", pages: 2,
          body: ["Form AD01 — Notice of change of registered office address, filed under section 87 of the Companies Act 2006.", "The registered office of the company has been changed to:", "%%4th Floor Phoenix House, 1 Station Hill, Reading, Berkshire, RG1 1NB, United Kingdom%%", "Signed by a designated member of the LLP on 22 August 2019. Accepted and registered by the Registrar of Companies for England and Wales."],
          fields: [{ label: "Company Name", value: "Brevan Howard Asset Management LLP" }, { label: "Company Number", value: "OC302636" }, { label: "New Office", value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB", highlight: true }],
        }],
      },
      { label: "Previous Names", value: "Rivage Capital Management LLP (until 2007)", source: "3rd", status: "warn",
        docs: [{ id: "ch-prevnames-bh", title: "Companies House — Previous Names Snapshot", source: "Companies House Public Data API", date: "2026-04-19", kind: "screenshot",
          body: ["Snapshot captured from the Companies House web service for company OC302636.", "Previous company names recorded against the same registration number:"],
          fields: [{ label: "Current Name", value: "Brevan Howard Asset Management LLP" }, { label: "Previous Name", value: "Rivage Capital Management LLP", highlight: true }, { label: "Effective From", value: "2002-07-16" }, { label: "Effective To", value: "2007-04-16", highlight: true }],
        }],
      },
      { label: "Primary Regulator", value: "FCA · FRN 209517", source: "3rd", status: "ok" },
      { label: "FCA Permissions", value: "Investment management, MiFID II", source: "3rd", status: "ok",
        docs: [{ id: "fca-perms-bh", title: "FCA Register — Permissions Snapshot", source: "FCA Register · FRN 209517", date: "2026-04-19", kind: "screenshot",
          body: ["Snapshot of the regulatory permissions held by Brevan Howard Asset Management LLP as recorded on the FCA Register."],
          fields: [{ label: "FRN", value: "209517" }, { label: "Status", value: "Authorised" }, { label: "Permissions", value: "Arranging deals in investments · Managing investments · Advising on investments (except Pension Transfers)", highlight: true }, { label: "Last Updated", value: "2026-04-19" }],
        }],
      },
      { label: "Designated Members", value: "2 corporate (1 UK, 1 Jersey)", source: "Forge", status: "alert" },
      { label: "Persons of Significant Control", value: "Mr Alan Eldad Howard (75–100% voting)", source: "3rd", status: "warn",
        docs: [
          { id: "ch-psc-bh", title: "PSC Register Extract — Mr A E Howard", source: "Companies House PSC API", date: "2026-04-19", kind: "screenshot",
            body: ["Live extract from the Persons with Significant Control register for OC302636."],
            fields: [{ label: "Name", value: "Mr Alan Eldad Howard" }, { label: "Date of Birth", value: "September 1963" }, { label: "Nationality", value: "British" }, { label: "Country of Residence", value: "United Kingdom" }, { label: "Voting Rights", value: "75% to 100%", highlight: true }, { label: "Correspondence Address", value: "82 Baker Street, London, W1U 6AE", highlight: true }],
          },
          { id: "ch-cs01-bh", title: "Form CS01 — Confirmation Statement (excerpt)", source: "Companies House Filing", date: "2026-03-14", kind: "filing", pages: 6,
            body: ["Confirmation statement filed under section 853A of the Companies Act 2006 on behalf of Brevan Howard Asset Management LLP.", "Part 4 — Persons with Significant Control. The following information is confirmed as accurate at the confirmation date:", "Mr Alan Eldad Howard, correspondence address: %%27 Hill Street, London, W1J 5LP%%.", "Note: address differs from the live PSC register entry — PSC02 amendment outstanding."],
          },
        ],
      },
      { label: "PSC Date of Birth", value: "1963-09", source: "3rd", status: "ok" },
      { label: "PSC Nationality", value: "British", source: "3rd", status: "ok",
        docs: [{ id: "passport-aeh", title: "Passport — Mr A E Howard (redacted)", source: "HMRC-verified identity document", date: "2024-11-02", kind: "passport",
          body: ["HMRC-verified passport scan retained in the Evidence Locker for identity verification purposes."],
          fields: [{ label: "Surname", value: "HOWARD" }, { label: "Given Names", value: "ALAN ELDAD" }, { label: "Nationality", value: "BRITISH CITIZEN", highlight: true }, { label: "Date of Birth", value: "•• SEP 1963" }, { label: "Passport No.", value: "•••••••42" }, { label: "Issuing Authority", value: "HMPO" }],
        }],
      },
      { label: "Sanctions Screening", value: "Cleared — 2026-04-19", source: "3rd", status: "ok" },
      { label: "Last KYC Refresh", value: "2025-11-02", source: "Forge", status: "ok" },
      { label: "Risk Tier", value: "Elevated (Jersey EDD active)", source: "Forge", status: "alert" },
    ],
    caseFile: `# Brevan Howard Asset Management LLP\n\n**KYC ID:** KYC-30229  \n**Companies House #:** OC302636  \n**FCA FRN:** 209517\n\n## Entity Summary\nUK-domiciled limited liability partnership and FCA-authorised investment manager. Founded in 2002 as **Rivage Capital Management LLP**; renamed to Brevan Howard Asset Management LLP in 2007. Runs global macro and multi-strategy hedge funds for institutional clients.\n\n## Registered Particulars (Companies House)\n- **Number:** OC302636  \n- **Type:** LLP  \n- **Status:** Active  \n- **Incorporated:** 2002-07-16  \n- **Office:** 4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB, United Kingdom\n\n## Designated Members\n| Name | Domicile | Reg. # |\n|------|----------|--------|\n| BH Partnership Holdings Limited | Jersey | 106333 |\n| Brevan Howard Asset Management Services Limited | United Kingdom | 11117501 |\n\n## Persons of Significant Control\n- **Mr Alan Eldad Howard** — b. 1963-09, British  \n  Voting rights: 75–100% (LLP)  \n  Right to share of surplus assets: 25–50%  \n  Correspondence: 82 Baker Street, London W1U 6AE *(address drift flagged)*\n\n## Active Exceptions\n- **Undisclosed PSC Address Change** — PSC02 correction requested\n- **Cross-Jurisdiction Corporate Member (Jersey)** — EDD pack pending\n- **Previous Company Name Continuity** — CRM backfill recommended\n\n## Next Actions\n1. Run EDD on BH Partnership Holdings Limited (Jersey).\n2. Request PSC02 correction filing from client.\n3. Backfill 'Rivage Capital Management LLP' alias into CRM.`,
  },
  "Marshall Wace LLP": {
    name: "Marshall Wace LLP",
    kyc: "KYC-30188",
    attrs: [
      { label: "Legal Form", value: "Limited Liability Partnership (LLP)", source: "3rd", status: "ok" },
      { label: "Company Number", value: "OC302228", source: "3rd", status: "ok" },
      { label: "Incorporated On", value: "2003-04-02", source: "3rd", status: "ok" },
      { label: "Company Status", value: "Active", source: "3rd", status: "ok" },
      { label: "Registered Office", value: "George House, 131 Sloane Street, London, SW1X 9AT", source: "3rd", status: "ok",
        docs: [{ id: "ch-office-mw", title: "Companies House Register — Registered Office", source: "Companies House", date: "2026-04-19", kind: "screenshot",
          body: ["Live extract of the registered office on file for OC302228."],
          fields: [{ label: "Company Name", value: "Marshall Wace LLP" }, { label: "Office Address", value: "George House, 131 Sloane Street, London, SW1X 9AT", highlight: true }, { label: "Country", value: "United Kingdom" }],
        }],
      },
      { label: "Primary Regulator", value: "FCA · FRN 211088", source: "3rd", status: "ok" },
      { label: "FCA Permissions", value: "Investment management + Managing an AIF (drift)", source: "3rd", status: "alert",
        docs: [{ id: "fca-perms-mw", title: "FCA Register — Permissions Snapshot", source: "FCA Register · FRN 211088", date: "2026-04-19", kind: "screenshot",
          body: ["Snapshot of the regulatory permissions held by Marshall Wace LLP. A new permission was activated on 2026-02-11 and has not yet been mirrored into the internal CRM permission set."],
          fields: [{ label: "FRN", value: "211088" }, { label: "Status", value: "Authorised" }, { label: "Existing Permissions", value: "Arranging deals in investments · Managing investments" }, { label: "New Permission", value: "Managing an AIF (effective 2026-02-11)", highlight: true }],
        }],
      },
      { label: "Designated Members", value: "4 individuals + 1 corporate", source: "3rd", status: "ok" },
      { label: "Persons of Significant Control", value: "Sir Paul Marshall, Ian Wace (each 25–50% voting)", source: "3rd", status: "ok",
        docs: [{ id: "ch-psc-mw", title: "PSC Register Extract — Marshall Wace LLP", source: "Companies House PSC API", date: "2026-04-19", kind: "screenshot",
          body: ["Live extract of all Persons with Significant Control associated with OC302228."],
          fields: [{ label: "PSC 1", value: "Sir Paul Marshall · b. Aug 1959 · British", highlight: true }, { label: "Voting Rights (1)", value: "25% to 50%" }, { label: "PSC 2", value: "Ian Wace · b. Dec 1963 · British", highlight: true }, { label: "Voting Rights (2)", value: "25% to 50%" }],
        }],
      },
      { label: "Sanctions Screening", value: "1 fuzzy hit cleared (false positive)", source: "3rd", status: "warn",
        docs: [
          { id: "hmt-screening-mw", title: "HMT Consolidated List — Match Detail", source: "HMT / OFSI Consolidated List", date: "2026-04-01", kind: "register",
            body: ["The matched record on the HMT consolidated list (designation has since been lifted)."],
            fields: [{ label: "Listed Name", value: "Paul Marshall", highlight: true }, { label: "Date of Birth", value: "1971", highlight: true }, { label: "Nationality", value: "Zimbabwean", highlight: true }, { label: "Regime", value: "Zimbabwe (de-listed 2014)" }, { label: "Match Score", value: "84% (fuzzy name only)" }],
          },
          { id: "wc-log-mw", title: "World-Check Screening Log", source: "Refinitiv World-Check One", date: "2026-04-19", kind: "screenshot",
            body: ["Screening run executed against all PSCs and officers of Marshall Wace LLP. One fuzzy match returned and cleared with documented identity divergence.", "%%Cleared as confirmed false positive — DOB and nationality differ from listed namesake.%%"],
          },
        ],
      },
      { label: "PEP Exposure", value: "None Identified", source: "3rd", status: "ok" },
      { label: "AUM Disclosed", value: "≈ USD 70bn (2025)", source: "CRM", status: "ok" },
      { label: "Last KYC Refresh", value: "2025-11-02", source: "Forge", status: "ok" },
      { label: "Risk Tier", value: "Elevated (FCA scope drift)", source: "Forge", status: "alert" },
    ],
    caseFile: `# Marshall Wace LLP\n\n**KYC ID:** KYC-30188  \n**Companies House #:** OC302228  \n**FCA FRN:** 211088\n\n## Entity Summary\nUK-domiciled limited liability partnership and FCA-authorised investment manager. Co-founded in 1997 by Sir Paul Marshall and Ian Wace; LLP registered in 2003. Runs long/short equity and quantitative TOPS strategies for global institutions.\n\n## Registered Particulars (Companies House)\n- **Number:** OC302228  \n- **Type:** LLP  \n- **Status:** Active  \n- **Incorporated:** 2003-04-02  \n- **Office:** George House, 131 Sloane Street, London, SW1X 9AT, United Kingdom\n\n## Persons of Significant Control\n| Name | DOB | Nationality | Voting Rights |\n|------|-----|-------------|---------------|\n| Sir Paul Marshall | 1959-08 | British | 25–50% |\n| Ian Wace | 1963-12 | British | 25–50% |\n\n## FCA Permissions\n- Arranging deals in investments\n- Managing investments\n- **Managing an AIF** *(added 2026-02-11 — CRM sync pending)*\n\n## Active Exceptions\n- **FCA Permission Scope Drift** — sync CRM with FCA register\n- **Sanctions Screening — PSC Name Hit** — confirmed false positive on 'Paul Marshall' (different DOB & nationality)\n\n## Next Actions\n1. Sync CRM permission set with FCA register.\n2. Request AIFMD Article 23 disclosure pack from client.\n3. Add cleared name pair to sanctions allowlist.`,
  },
  "Long Focus Capital Management, LLC": {
    name: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    attrs: [
      { label: "Entity Name", value: "LONG FOCUS CAPITAL MANAGEMENT, LLC", source: "CRM", status: "ok" },
      { label: "Legal Entity Type", value: "Limited Liability Company", source: "3rd", status: "ok" },
      { label: "Country of Incorporation", value: "USA", source: "3rd", status: "ok" },
      { label: "Date of Incorporation", value: "2012-05-10", source: "3rd", status: "ok" },
      { label: "LEI Code", value: "Not provided · no GLEIF match", source: "3rd", status: "alert" },
      { label: "Trading Names", value: "Long Focus Capital", source: "CRM", status: "ok" },
      { label: "Previous Names", value: "Focus Capital Partners LLC", source: "3rd", status: "ok" },
      { label: "Verification of Existence", value: "Verified via Delaware State Registry", source: "3rd", status: "ok" },
      { label: "US Registration Number", value: "801-12345 (client) vs 801-67890 (SEC IAPD)", source: "3rd", status: "alert" },
      { label: "UK Registration Number", value: "N/A", source: "CRM", status: "ok" },
      { label: "Regulator", value: "SEC", source: "3rd", status: "ok" },
      { label: "Listing Status", value: "Not Listed", source: "3rd", status: "ok" },
      { label: "Entity GIIN", value: "987XYZ.654ABC.AB.123", source: "3rd", status: "ok" },
      { label: "Section 13 / 15d Indicator", value: "No", source: "CRM", status: "ok" },
      { label: "CFTC Registered", value: "No", source: "CRM", status: "ok" },
      { label: "Legal Registered Address", value: "1209 Orange Street, Wilmington, DE 19801, USA", source: "3rd", status: "ok" },
      { label: "Principal Place of Business", value: "Conflict: Website 123 Main St vs Form ADV 456 Broad Ave", source: "3rd", status: "alert" },
      { label: "Foreign Branches", value: "UK Branch · FCA #123456", source: "3rd", status: "ok" },
      { label: "Sub-Advisor Address", value: "N/A", source: "CRM", status: "ok" },
      { label: "Entity Classification", value: "Registered Investment Adviser (RIA)", source: "Forge", status: "ok" },
      { label: "Entity Risk Rating", value: "Medium-High", source: "Forge", status: "warn" },
      { label: "CIP Classification", value: "Legal Entity — LLC", source: "Forge", status: "ok" },
      { label: "Nature of Business", value: "Long/Short Equity Investment Management", source: "CRM", status: "ok" },
      { label: "Sole Proprietorship", value: "No", source: "CRM", status: "ok" },
      { label: "Parent Listed on US Exchange", value: "No", source: "CRM", status: "ok" },
      { label: "Other Business Activity", value: "None", source: "CRM", status: "ok" },
      { label: "Source of Funds", value: "Management Fees, Performance Fees", source: "CRM", status: "ok" },
      { label: "Source of Wealth", value: "Founder's Capital", source: "CRM", status: "ok" },
      { label: "Assets Under Management", value: "$2.4B", source: "CRM", status: "ok" },
      { label: "Transacting With", value: "Third Party Funds", source: "CRM", status: "ok" },
      { label: "US Tax ID", value: "98-7654321", source: "3rd", status: "ok" },
      { label: "UK Tax ID", value: "N/A", source: "CRM", status: "ok" },
      { label: "Corporate Officer", value: "Michael J. Anderson (CEO)", source: "3rd", status: "ok" },
      { label: "Board Directors", value: "Michael J. Anderson, Sarah K. Lee", source: "3rd", status: "ok" },
      { label: "Compliance Officer Attestation", value: "Sarah Chen (CCO) · signed attestation not on file", source: "3rd", status: "alert" },
      { label: "MLRO / Equivalent", value: "N/A", source: "CRM", status: "ok" },
      { label: "Authorized Signatory", value: "Michael J. Anderson", source: "CRM", status: "ok" },
      { label: "Power of Attorney", value: "None on file", source: "CRM", status: "ok" },
      { label: "Key Controller", value: "Michael J. Anderson", source: "CRM", status: "ok" },
      { label: "Beneficial Owner (25%+)", value: "Unresolved — chain ends at Long Focus Holdings LLC", source: "3rd", status: "alert" },
      { label: "List of Subsidiaries", value: "Long Focus UK Branch", source: "3rd", status: "ok" },
      { label: "Trustee", value: "N/A", source: "CRM", status: "ok" },
      { label: "Tax Residency", value: "United States (Delaware)", source: "3rd", status: "ok" },
      { label: "FATCA Classification", value: "Reporting Model 1 FFI", source: "Forge", status: "ok" },
      { label: "CRS Classification", value: "Investment Entity", source: "Forge", status: "ok" },
      { label: "Sanctions Screening", value: "Cleared — 2026-05-12 (OFAC/EU/UN)", source: "3rd", status: "ok" },
      { label: "PEP Screening", value: "No Match", source: "3rd", status: "ok" },
      { label: "Adverse Media Screening", value: "No Material Adverse Media", source: "3rd", status: "ok" },
      { label: "Last KYC Refresh", value: "2025-09-18", source: "Forge", status: "ok" },
      { label: "Next KYC Refresh Due", value: "2026-09-18 (Annual)", source: "Forge", status: "ok" },
      { label: "Wolfsberg Questionnaire", value: "Not Applicable (non-bank RIA)", source: "Forge", status: "ok" },
      { label: "Source of Funds Verified", value: "Yes — management & performance fees", source: "Forge", status: "ok" },
      { label: "EIN / TIN Verified", value: "98-7654321 · IRS verified", source: "3rd", status: "ok" },
    ],
    caseFile: `# Long Focus Capital Management, LLC\n\n**KYC ID:** KYC-30215  \n**Entity Type:** Registered Investment Adviser (RIA)  \n**Jurisdiction:** US (Delaware) with UK branch  \n**Client Risk Rating:** High  \n**Open Exceptions:** 5\n\n## Entity Summary\nDelaware-incorporated LLC operating as a SEC-registered investment adviser with a UK branch (FCA #123456). Founded 2012 (previously Focus Capital Partners LLC). Runs long/short equity strategies; AUM $2.4B.\n\n## Registered Particulars\n- **Legal Form:** Limited Liability Company  \n- **Incorporated:** 2012-05-10 · Delaware, USA  \n- **Registered Office:** 1209 Orange Street, Wilmington, DE 19801  \n- **Regulator:** SEC (CRD pending reconciliation — see exception 1)  \n- **GIIN:** 987XYZ.654ABC.AB.123  \n- **US Tax ID:** 98-7654321\n\n## Key People\n| Role | Name |\n|------|------|\n| CEO / Authorized Signatory | Michael J. Anderson |\n| Board Director | Sarah K. Lee |\n| Chief Compliance Officer | Sarah Chen *(attestation outstanding)* |\n\n## Open Exceptions (5)\n1. **US Registration Number Mismatch** — 801-12345 vs 801-67890 (IAPD)\n2. **Outstanding LEI Code** — no GLEIF match\n3. **Principal Place of Business Mismatch** — website vs Form ADV\n4. **Missing Compliance Officer Attestation** — Sarah Chen, signature missing\n5. **Beneficial Ownership Not Identified** — chain ends at Long Focus Holdings LLC\n\n## Next Actions\n1. Verify CRD via SEC IAPD and update to 801-67890.\n2. Request LEI from client (or confirm no reportable derivatives activity).\n3. Adopt Form ADV principal address (456 Broad Avenue).\n4. Send DocuSign attestation to CCO Sarah Chen.\n5. Issue formal FinCEN BOI report request to client.`,
  },
  "Brookfield Asset Management PIC US, LLC": {
    name: "Brookfield Asset Management PIC US, LLC",
    kyc: "KYC-30216",
    attrs: [
      { label: "Entity Name", value: "BROOKFIELD ASSET MANAGEMENT PIC US, LLC", source: "CRM", status: "ok" },
      { label: "Legal Entity Type", value: "Limited Liability Company", source: "3rd", status: "ok" },
      { label: "Country of Incorporation", value: "United States (Delaware)", source: "3rd", status: "ok" },
      { label: "Date of Incorporation", value: "2009-07-22", source: "3rd", status: "ok" },
      { label: "LEI Code", value: "549300FML6EDDNTAVG88", source: "3rd", status: "ok" },
      { label: "Trading Names", value: "BAM PIC US", source: "CRM", status: "ok" },
      { label: "Previous Names", value: "None", source: "CRM", status: "ok" },
      { label: "Verification of Existence", value: "Active — SEC registered investment adviser + Delaware entity", source: "3rd", status: "ok" },
      { label: "US Registration Number", value: "CRD: 151599 / SEC#: 801-72031", source: "3rd", status: "ok" },
      { label: "UK Registration Number", value: "Not applicable", source: "CRM", status: "ok" },
      { label: "Regulator", value: "U.S. SEC (registered investment adviser)", source: "3rd", status: "ok" },
      { label: "Listing Status", value: "Not listed (private LLC)", source: "3rd", status: "ok" },
      { label: "Legal Registered Address", value: "C/O Corporation Service Company, 251 Little Falls Drive, Wilmington, DE 19808, USA", source: "3rd", status: "ok" },
      { label: "Principal Place of Business", value: "225 Liberty Street, 8th Floor, New York, NY 10281-1023, USA", source: "3rd", status: "ok" },
      { label: "Entity Classification", value: "Investment adviser / asset manager", source: "Forge", status: "alert" },
      { label: "Entity Risk Rating", value: "High (system) vs Low (initial classification Jan 2026)", source: "Forge", status: "alert" },
      { label: "CIP Classification", value: "NFIE (client-confirmed) vs Financial Entity (system-flagged)", source: "Forge", status: "alert" },
      { label: "Nature of Business", value: "Investment advisory services — private funds, pooled vehicles, institutional accounts", source: "CRM", status: "ok" },
      { label: "Sole Proprietorship", value: "No", source: "CRM", status: "ok" },
      { label: "Parent Listed on US Exchange", value: "Yes — Brookfield Asset Management group", source: "CRM", status: "ok" },
      { label: "Other Business Activity", value: "Multi-sector alternatives — real estate, infrastructure, energy, private equity", source: "CRM", status: "ok" },
      { label: "Source of Funds", value: "Institutional investor capital (pooled vehicles, funds)", source: "CRM", status: "ok" },
      { label: "Source of Wealth", value: "Investment management earnings / fund structures", source: "CRM", status: "ok" },
      { label: "Assets Under Management", value: "~USD 105.3B (regulatory AUM, Dec 31 2025)", source: "CRM", status: "ok" },
      { label: "Transacting With", value: "Third-party client funds", source: "CRM", status: "ok" },
      { label: "Key Controller", value: "Brookfield Asset Management group", source: "3rd", status: "ok" },
      { label: "Beneficial Owner (25%+)", value: "Brookfield Asset Management group", source: "3rd", status: "ok" },
      { label: "Acting Person", value: "Identified — authority documentation pending (PoA required)", source: "Forge", status: "alert" },
      { label: "Power of Attorney", value: "Not provided", source: "CRM", status: "warn" },
      { label: "Sanctions Screening", value: "Cleared — 2026-05-20 (OFAC/EU/UN/HMT)", source: "3rd", status: "ok" },
      { label: "PEP Screening", value: "No Match", source: "3rd", status: "ok" },
      { label: "Adverse Media Screening", value: "No Material Adverse Media", source: "3rd", status: "ok" },
      { label: "Last KYC Refresh", value: "2026-01-15 (UK policy closure)", source: "Forge", status: "ok" },
      { label: "Next KYC Refresh Due", value: "2027-01-15 (Annual)", source: "Forge", status: "ok" },
    ],
    caseFile: `# Brookfield Asset Management PIC US, LLC\n\n**KYC ID:** KYC-30216  \n**Entity Type:** Registered Investment Adviser (RIA)  \n**Jurisdiction:** US (Delaware)  \n**Client Risk Rating:** Low (initial) / High (system — Cayman entities)  \n**Open Exceptions:** 3\n\n## Entity Summary\nDelaware-incorporated LLC operating as a SEC-registered investment adviser under the Brookfield Asset Management group. Provides investment advisory services to private funds, pooled vehicles, and institutional accounts across real estate and alternative assets. Regulatory AUM approximately USD 105.3B (Dec 2025).\n\n## Registered Particulars\n- **Legal Form:** Limited Liability Company  \n- **Incorporated:** 2009-07-22 · Delaware, USA  \n- **Registered Office:** C/O Corporation Service Company, 251 Little Falls Drive, Wilmington, DE 19808  \n- **Principal Office:** 225 Liberty Street, 8th Floor, New York, NY 10281-1023  \n- **Regulator:** U.S. SEC · CRD 151599 / SEC# 801-72031  \n- **LEI:** 549300FML6EDDNTAVG88  \n- **Parent:** Brookfield Asset Management group (publicly listed)\n\n## Sub-Advisers\n- Fairfield Realty Advisors LLC\n- Thayer Lodging Group LLC\n\n## Open Exceptions (3)\n1. **Risk Rating Discrepancy** — System High vs initial Low (Cayman ownership trigger)\n2. **CIP Classification / NAICS Code** — Client confirmed NFIE vs system Financial Entity flag\n3. **Acting Person Authority Documentation Gap** — PoA or signatory list required\n\n## Next Actions\n1. Seek Compliance confirmation for 25% ownership drilldown threshold.\n2. Engage Legal to assess NFIE vs Financial Entity classification.\n3. Request Power of Attorney or authorised signatory list from client.`,
  },
};

// ─── Trace docs (derived from entity profiles) ───────────────────────────────

const TRACE_ALIAS: Record<string, string[]> = {
  "Persons of Significant Control": ["Persons with Significant Control"],
  "FCA Permissions": ["FCA Regulatory Permissions"],
  "Previous Names": ["Previous Company Names"],
  "Registered Office": ["Principal Place of Business"],
};

export const TRACE_DOCS: Record<string, { entity: string; attr: EntityAttr; doc: AttrDoc }[]> = (() => {
  const out: Record<string, { entity: string; attr: EntityAttr; doc: AttrDoc }[]> = {};
  for (const [entityName, profile] of Object.entries(ENTITY_PROFILES)) {
    for (const a of profile.attrs) {
      if (!a.docs?.length) continue;
      const keys = [a.label, ...(TRACE_ALIAS[a.label] ?? [])];
      for (const k of keys) {
        (out[k] ??= []).push(...a.docs.map((d) => ({ entity: entityName, attr: a, doc: d })));
      }
    }
  }
  return out;
})();

TRACE_DOCS["Controllers"] = [...(TRACE_DOCS["Persons of Significant Control"] ?? [])];
TRACE_DOCS["Designated Members"] = [...(TRACE_DOCS["Persons of Significant Control"] ?? []).slice(0, 1)];

// ─── Nested attr profiles ─────────────────────────────────────────────────────

export const NESTED_ATTR_PROFILES: Record<string, NestedEntry[]> = {
  "Persons of Significant Control": [
    { name: "Alan Howard", tag: "Founder · 75–100%", fields: [
      { label: "Name", value: "Alan Howard", source: "CRM", status: "ok" },
      { label: "Date of Birth", value: "1964-09-15", source: "CRM", status: "ok" },
      { label: "Country", value: "United Kingdom", source: "Forge", status: "ok" },
    ]},
  ],
  "Persons with Significant Control": [
    { name: "Alan Howard", tag: "Founder · 75–100%", fields: [
      { label: "Name", value: "Alan Howard", source: "CRM", status: "ok" },
      { label: "Date of Birth", value: "1964-09-15", source: "CRM", status: "ok" },
      { label: "Country", value: "United Kingdom", source: "Forge", status: "ok" },
    ]},
  ],
  "Beneficial Owner (25%+)": [
    { name: "BH Capital Ltd (Cayman)", tag: "UBO · 61%", fields: [
      { label: "Entity Name", value: "BH Capital Ltd", source: "3rd", status: "ok" },
      { label: "Jurisdiction", value: "Cayman Islands", source: "Forge", status: "alert" },
      { label: "Ownership %", value: "61.4%", source: "CRM", status: "ok" },
    ]},
  ],
  "Directors": [
    { name: "Aron Landy", tag: "CEO", fields: [
      { label: "Name", value: "Aron Landy", source: "CRM", status: "ok" },
      { label: "Date of Birth", value: "1970-04-22", source: "CRM", status: "ok" },
      { label: "Nationality", value: "British", source: "3rd", status: "ok" },
    ]},
    { name: "Carsten Kengeter", tag: "Non-exec Director", fields: [
      { label: "Name", value: "Carsten Kengeter", source: "CRM", status: "ok" },
      { label: "Date of Birth", value: "1967-01-09", source: "CRM", status: "ok" },
      { label: "Nationality", value: "German", source: "3rd", status: "warn" },
    ]},
  ],
};

// ─── Case documents ───────────────────────────────────────────────────────────

export const CASE_DOCUMENTS: CaseDoc[] = [
  { id: "d1", title: "Annual Confirmation Statement (CS01)", entity: "Brevan Howard Asset Management LLP", kyc: "KYC-30229", source: "Companies House", kind: "filing", date: "2026-03-14", size: "2.5 KB", url: "/sample-docs/cs01-brevan-howard.pdf", linkedAttrs: ["Principal Place of Business", "Registered Office"] },
  { id: "d2", title: "Persons with Significant Control Register", entity: "Brevan Howard Asset Management LLP", kyc: "KYC-30229", source: "Companies House", kind: "register", date: "2026-05-12", size: "2.7 KB", url: "/sample-docs/psc-register-brevan-howard.pdf", linkedAttrs: ["Persons with Significant Control", "Controllers"] },
  { id: "d3", title: "Passport — Alan E. Howard", entity: "Brevan Howard Asset Management LLP", kyc: "KYC-30229", source: "HMRC GOV.UK Verify", kind: "passport", date: "2024-11-02", size: "2.5 KB", url: "/sample-docs/passport-alan-howard.pdf", linkedAttrs: ["Persons with Significant Control"] },
  { id: "d4", title: "FCA Register Extract — FRN 170583", entity: "Marshall Wace LLP", kyc: "KYC-30188", source: "FCA Register", kind: "register", date: "2026-05-22", size: "2.4 KB", url: "/sample-docs/fca-register-marshall-wace.pdf", linkedAttrs: ["Previous Company Names", "FCA Regulatory Permissions"] },
  { id: "d5", title: "FCA Name Change Notification (2007)", entity: "Marshall Wace LLP", kyc: "KYC-30188", source: "FCA Correspondence", kind: "letter", date: "2007-09-03", size: "2.2 KB", url: "/sample-docs/fca-name-change-letter.pdf", linkedAttrs: ["Previous Company Names"] },
  { id: "d6", title: "CRM Snapshot — Customer 360", entity: "Marshall Wace LLP", kyc: "KYC-30188", source: "Salesforce CRM", kind: "screenshot", date: "2026-02-11", size: "2.5 KB", url: "/sample-docs/crm-snapshot-mw.pdf", linkedAttrs: ["Previous Company Names", "FCA Regulatory Permissions"] },
  { id: "d7", title: "Client Onboarding Form (signed)", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "Client Submission", kind: "filing", date: "2026-04-02", size: "—", url: "/sample-docs/cs01-brevan-howard.pdf", linkedAttrs: ["US Registration Number", "Principal Place of Business", "LEI Code"] },
  { id: "d8", title: "Form ADV (Part 1 + Schedule A)", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "SEC IAPD", kind: "filing", date: "2026-03-30", size: "—", url: "/sample-docs/cs01-brevan-howard.pdf", linkedAttrs: ["US Registration Number", "Principal Place of Business", "Beneficial Owner (25%+)"] },
  { id: "d9", title: "SEC IAPD Registration Extract — CRD 801-67890", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "SEC IAPD", kind: "register", date: "2026-05-15", size: "—", url: "/sample-docs/fca-register-marshall-wace.pdf", linkedAttrs: ["US Registration Number", "Regulator"] },
  { id: "d10", title: "GLEIF LEI Lookup — No Match", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "GLEIF Registry", kind: "register", date: "2026-05-20", size: "—", url: "/sample-docs/fca-register-marshall-wace.pdf", linkedAttrs: ["LEI Code"] },
  { id: "d11", title: "Compliance Officer Attestation (DRAFT — unsigned)", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "Internal · DocuSign Envelope", kind: "letter", date: "2026-04-10", size: "—", url: "/sample-docs/fca-name-change-letter.pdf", linkedAttrs: ["Compliance Officer Attestation"] },
  { id: "d12", title: "Delaware Secretary of State — Certificate of Formation", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "Delaware State Registry", kind: "filing", date: "2012-05-10", size: "—", url: "/sample-docs/cs01-brevan-howard.pdf", linkedAttrs: ["Date of Incorporation", "Country of Incorporation", "Legal Registered Address"] },
  { id: "d13", title: "Corporate Website Snapshot — Contact Page", entity: "Long Focus Capital Management, LLC", kyc: "KYC-30215", source: "longfocuscapital.com (archived)", kind: "screenshot", date: "2026-05-18", size: "—", url: "/sample-docs/crm-snapshot-mw.pdf", linkedAttrs: ["Principal Place of Business"] },
  { id: "d14", title: "SEC Form ADV Part 1A", entity: "Brookfield Asset Management PIC US, LLC", kyc: "KYC-30216", source: "SEC IAPD", kind: "filing", date: "2026-03-31", size: "—", url: "/sample-docs/cs01-brevan-howard.pdf", linkedAttrs: ["US Registration Number", "Entity Classification", "Principal Place of Business"] },
  { id: "d15", title: "Delaware Entity Registry — Active Status", entity: "Brookfield Asset Management PIC US, LLC", kyc: "KYC-30216", source: "Delaware Division of Corporations", kind: "register", date: "2026-05-20", size: "—", url: "/sample-docs/psc-register-brevan-howard.pdf", linkedAttrs: ["Legal Entity Type", "Date of Incorporation", "Legal Registered Address"] },
  { id: "d16", title: "Internal Risk Classification Record", entity: "Brookfield Asset Management PIC US, LLC", kyc: "KYC-30216", source: "Forge · Risk Engine", kind: "screenshot", date: "2026-05-15", size: "—", url: "/sample-docs/crm-snapshot-mw.pdf", linkedAttrs: ["Entity Risk Rating", "CIP Classification"] },
];

// ─── Collaboration data ───────────────────────────────────────────────────────

export type CaseComment = {
  author: string;
  initials: string;
  role: string;
  time: string;
  body: string;
  kind: "comment" | "ai" | "action";
};

export const kindTone: Record<CaseComment["kind"], string> = {
  comment: "bg-info-soft text-primary",
  ai: "bg-success-soft text-success",
  action: "bg-secondary text-foreground",
};

export const COMMENTS_BY_KYC: Record<string, CaseComment[]> = {
  "KYC-30229": [
    { author: "Quinn Doe", initials: "QD", role: "Reviewer · L2", time: "Today, 7:08 AM", kind: "comment", body: "Drafted outreach to Brevan Howard Compliance for the PSC02 correction. Expecting filing within the 7-day SLA." },
    { author: "Aanya Sharma", initials: "AS", role: "EDD Specialist", time: "Yesterday, 6:03 AM", kind: "comment", body: "BH Partnership Holdings (Jersey) still needs source-of-funds before we can sign off on the Jersey leg." },
    { author: "Identity Agent", initials: "AI", role: "AI · auto-note", time: "Yesterday, 3:12 PM", kind: "ai", body: "Refreshed CS01 and PSC register for OC302636 from Companies House. 1 new diff detected on PSC address." },
  ],
  "KYC-30188": [
    { author: "Marcus Lee", initials: "ML", role: "Reviewer · L2", time: "Today, 8:21 AM", kind: "comment", body: "FCA permission scope drift confirmed against latest Gabriel return — pinging RM for AIFMD Article 23 pack." },
    { author: "Sanctions Agent", initials: "AI", role: "AI · auto-note", time: "April 21, 2026, 2:11 PM", kind: "ai", body: "Auto-cleared 1 sanctions false positive on PSC name match — DOB & nationality divergence verified." },
    { author: "You", initials: "YO", role: "Reviewer · L1", time: "April 22, 2026, 7:18 AM", kind: "action", body: "Confirmed PSC for Marshall Wace LLP — no further action needed on the beneficial-owner leg." },
  ],
  "KYC-30215": [
    { author: "Marcus Lee", initials: "ML", role: "Reviewer · L2", time: "April 21, 2026, 11:02 AM", kind: "comment", body: "LEI mismatch with GLEIF — requested re-issue confirmation from Long Focus client services." },
    { author: "Document Agent", initials: "AI", role: "AI · auto-note", time: "April 20, 2026, 4:30 PM", kind: "ai", body: "Pulled Form ADV Part 1A from SEC IAPD. Compliance officer attestation date precedes last refresh." },
  ],
  "KYC-30216": [
    { author: "Priya Patel", initials: "PP", role: "Approver · L3", time: "Today, 9:15 AM", kind: "comment", body: "Risk rating discrepancy needs Compliance sign-off before we can proceed. Escalating to the risk committee." },
    { author: "Risk Agent", initials: "AI", role: "AI · auto-note", time: "Yesterday, 11:30 AM", kind: "ai", body: "Cayman-domiciled ownership entities detected in submitted structure chart. Risk model auto-triggered High classification per jurisdiction matrix." },
    { author: "Dana Ortiz", initials: "DO", role: "US Compliance", time: "May 20, 2026, 3:45 PM", kind: "comment", body: "Reviewing NFIE vs Investment Entity classification — awaiting Legal's position on the nature-of-business trigger." },
  ],
};

export type Watcher = { name: string; initials: string; role: string };
export const WATCHERS_BY_KYC: Record<string, Watcher[]> = {
  "KYC-30229": [
    { name: "Quinn Doe", initials: "QD", role: "Reviewer · L2" },
    { name: "Aanya Sharma", initials: "AS", role: "EDD Specialist" },
    { name: "Priya Patel", initials: "PP", role: "Approver · L3" },
  ],
  "KYC-30188": [
    { name: "Marcus Lee", initials: "ML", role: "Reviewer · L2" },
    { name: "Priya Patel", initials: "PP", role: "Approver · L3" },
  ],
  "KYC-30215": [
    { name: "Marcus Lee", initials: "ML", role: "Reviewer · L2" },
    { name: "Dana Ortiz", initials: "DO", role: "US Compliance" },
  ],
  "KYC-30216": [
    { name: "Priya Patel", initials: "PP", role: "Approver · L3" },
    { name: "Dana Ortiz", initials: "DO", role: "US Compliance" },
    { name: "Quinn Doe", initials: "QD", role: "Reviewer · L2" },
  ],
};

export type Activity = { time: string; text: string };
export const ACTIVITY_BY_KYC: Record<string, Activity[]> = {
  "KYC-30229": [
    { time: "Today, 7:08 AM", text: "Quinn Doe posted a comment" },
    { time: "Today, 6:00 AM", text: "Identity Agent refreshed Companies House data" },
    { time: "Yesterday, 4:40 PM", text: "Form CS01 uploaded to locker" },
    { time: "Yesterday, 3:12 PM", text: "Document Agent attached PSC register diff" },
    { time: "2 days ago", text: "Case assigned to Quinn Doe" },
  ],
  "KYC-30188": [
    { time: "Today, 8:21 AM", text: "Marcus Lee posted a comment" },
    { time: "Yesterday, 2:11 PM", text: "Sanctions Agent auto-cleared 1 false positive" },
    { time: "April 22, 2026, 7:18 AM", text: "You confirmed PSC for Marshall Wace LLP" },
  ],
  "KYC-30215": [
    { time: "April 21, 2026, 11:02 AM", text: "Marcus Lee posted a comment" },
    { time: "April 20, 2026, 4:30 PM", text: "Document Agent pulled Form ADV Part 1A" },
  ],
};

---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "corporate_officer"
governs_attributes: ["corporate_officer_correspondence_address", "corporate_officer_country", "corporate_officer_country_of_incorporation", "corporate_officer_country_of_residence", "corporate_officer_date_of_birth", "corporate_officer_cip_classification", "corporate_officer_legal_structure", "corporate_officer_name", "corporate_officer_nationality", "corporate_officer_regulator", "corporate_officer_role"]
version: "1.0"
---

# Corporate Officer — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Appointment of corporate officers, partners, or managers and their authority | Global | Primary | Constitutional Documentation |
| Active officers, directors, partners, or managers and appointment status | Global | Primary | Certificate of Incumbency |
| Formal appointment or removal of corporate officers | Global | Primary | Board Resolutions / Board Minutes |
| Registered directors, officers, and management roles | Global | Primary | Government Company Register |
| Corporate officer and director records | US | Primary | US Secretary of State |
| Disclosure of officers and senior management | Global | Primary | Exchange / Regulator / Government Filings (≤12 months) |
| Senior management and control persons | Global | Primary | Bankers Almanac |
| Executive and management listings | Global | Primary | Dun & Bradstreet |
| Officer and principal identification | Global | Primary | LexisNexis / Accurint |
| Identification of corporate officers where permitted | Global | Primary | Client Confirmation (Written) |
| Directors and senior management disclosures | Global | Secondary | Audited Annual Report |
| Management and governance structure | Global | Secondary | Audit / Governance Report |
| Leadership / management team listing | Global | Secondary | Client Website |
| Management and executive overview | Global | Secondary | Investor Presentation |
| Executive profile information | Global | Secondary | Bloomberg / Businessweek |
| Company executive listings | Global | Secondary | Hoovers / Morningstar |
| Corporate officer data | Global | Secondary | Markit / Bloomberg Entity Exchange / Eikon |
| Officer and signatory details | Global | Secondary | SWIFT KYC Registry |
| Corporate officers for Japan-domiciled entities | Japan | Secondary | Teikoku Databank (www.tdb.co.jp) |
| Officer information | Korea | Secondary | DART (Korea Registry) |
| Full legal name and country of domicile of principals | Global | Secondary | Sales Confirmation (Written) |

## Decision Logic
- **CO_001** — IF corporate officers are required to be identified THEN identify individuals with significant authority or executive power over the entity.
- **CO_002** — IF both a Supervisory Board and an Executive / Management Board exist THEN record Supervisory Board members as Board Directors and Executive / Management Board members as Corporate Officers.
- **CO_003** — IF the entity is a corporation/company and policy is not DE, FR, HK, or SG THEN it is acceptable to identify only CEO and CFO (or equivalents); IF the entity is an LLC, LP, or LLP THEN identify the top two managers / managing partners / general partners / designated members (or fewer if only one is indicated by approved sources).
- **CO_004** — IF a corporate officer role is held by a private fund THEN record the ultimate management of the fund (e.g., Manager, GP, CEO/CFO); IF the private fund is List 4 THEN escalate to FCC.
- **CO_005** — IF the client confirms no formal corporate officer titles exist THEN clarify who controls, manages, or influences the entity; at least one individual must always be identified.
- **CO_006** — IF the client confirms there are no controlling individuals THEN escalate as required.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Corporate officer identified from approved source | Titles may vary across jurisdictions | Do not assume roles without evidence |
| Role evidences executive authority | Functional equivalence acceptable | Clarify with client if unclear |
| Use of secondary sources | Must be reconfirmed with client | Obtain confirmation before validation |
| Client confirmation used | Acceptable where permitted | Document confirmation |
| Private fund acting as officer | Ultimate management captured | Escalate if List 4 |
| No officer identified | At least one controller required | Escalate if none identified |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| corporate_officer | Officer(s): name, role (mapped to master $defs.CorporateOfficerRole) |
| evidence_source | Source name + date accessed |

**Escalation:** Escalate to FCC if a corporate-officer role is held by a List 4 private fund, or if no controlling individual can be identified.

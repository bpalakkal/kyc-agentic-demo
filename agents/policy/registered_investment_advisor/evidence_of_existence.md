---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "evidence_of_existence"
governs_attributes: ["country_of_incorporation", "date_of_incorporation", "entity_status", "listed_exchange", "listing_status", "registration_number", "verification_of_existence"]
version: "1.0"
---

# Evidence of Existence — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirms legal formation and existence | Global | Primary | Certificate of Incorporation / Formation (entity specific) |
| Legal establishment documentation | Global | Primary | Memorandum & Articles of Association (entity specific) |
| Legal existence of partnerships / LLCs | Global | Primary | LLC / LP / Operating Agreement (entity specific) |
| Confirms entity's legal standing | Global | Primary | Certificate of Incumbency (entity specific) |
| Legal name, status, incorporation date | Global | Primary | Government Corporate Register Extract (jurisdiction-specific) |
| Confirms continued legal existence | Global | Primary | Government-issued Certificate / Letter of Good Standing (issued ≤1 year) |
| Legal registration evidence | US / DE | Primary | Evidence of Government Registration / Filing (e.g. 10-K, NFA Registration) |
| Confirms existence and operational status | Global | Primary | Audited Annual Report (entity specific) |
| Supporting existence evidence | US / UK / HK | Secondary | Government-issued Business License (entity specific) |
| Sole acceptable EOE for Cayman entities | Cayman Islands only | Primary | Cayman Islands General Registry — actual printout only |
| Legal existence incl. representatives | DE | Primary | German Commercial Register (Handelsregister) (https://www.handelsregister.de) |
| Supporting legal existence | DE / Global | Secondary | GLEIF — LEI Registry (https://www.gleif.org) |
| Supporting existence evidence | Global | Secondary | Dun & Bradstreet (https://www.dnb.com) |
| Acceptable EOE for Iberian clients | Spain (DE guidance) | Primary | Spanish Regulatory Registry (CNMV, etc.) |
| Legal existence for government entities | DE (Govt / CBs) | Primary | Government Website Screenprint (entity specific) |
| Legal existence confirmation | DE | Primary | Extract from Exchange Listing (entity specific) |
| Legal existence of investment advisers | DE / US (RIA) | Primary | ADV Form (https://adviserinfo.sec.gov) |
| Legal existence of trusts | Global | Primary | Trust Deed (entity specific) |
| Acceptable where full extract unavailable | DE | Primary (conditional) | GS Affiliate — Partial Registry Extract (screenprint) |

## Decision Logic
- **EOE_001** (General) — IF one document of existence is required THEN at least one primary source must be obtained.
- **EOE_002** (General) — IF more than one document of existence is required THEN at least one primary source is mandatory; secondary sources may supplement once a primary is obtained.
- **EOE_003** (Private Operating Companies — US / UK / HK) — IF verifying existence for a private operating company THEN reference one primary or two secondary sources, ensuring at least one primary source is obtained.
- **EOE_004** (RIA — all policies) — IF evidencing legal existence of a Registered Investment Adviser THEN Form 10-K must NOT be used to evidence existence of a subsidiary.
- **EOE_005** (Cayman Islands — RIA) — IF the entity is incorporated in the Cayman Islands THEN only an actual printout from the Cayman Islands General Registry is acceptable; website search results are not sufficient.
- **EOE_006** (Germany — client level) — IF a commercial / government register is available THEN obtain an extract showing entity name, address, incorporation date, and legal representatives; IF a full downloadable extract is available THEN obtain the full extract; IF a full extract cannot be downloaded THEN a screenprint of the full registry page is acceptable.
- **EOE_007** (Germany — special entity types) — IF the entity is a government agency or central bank THEN obtain a government website screenprint and an extract from GLEIF or Dun & Bradstreet; IF the client is an Iberian entity THEN an extract from the Spanish regulatory website is acceptable.
- **EOE_008** (Germany — principal level) — IF evidencing existence at principal level THEN acceptable sources include incorporation documents, registry extracts, regulatory / exchange evidence, audited annual reports, ADV forms, trust deeds, or GLEIF extracts.
- **EOE_009** (GS Affiliates — DE) — IF a full registry extract is unavailable or behind a paywall THEN partial extracts (screenprints) are acceptable only if they include full entity name, legal form, government ID, address, incorporation / registration date, entity status, and timestamp of sourcing.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Primary document obtained where required | None | If missing, task cannot be validated |
| Cayman entity evidenced via registry printout | Search result not acceptable | Request correct registry printout |
| DE registry extract completeness | All mandatory data points present | If incomplete, obtain alternative extract |
| Secondary sources used | Only after primary obtained | If used standalone, invalidate |
| Registry extract recency (where required) | As per guidance | If outdated, refresh |
| Subsidiary evidenced via Form 10-K | Not permitted | Reject and obtain alternative evidence |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| verification_of_existence | Existence verified (source + document type) |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

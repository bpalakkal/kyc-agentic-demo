---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "address_registered"
governs_attributes: ["legal_registered_address", "registration_country"]
version: "1.0"
---

# Address, Registered — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Registered address filed with the authority | Global | Primary | Commercial / Company Registry Extract (jurisdiction-specific) |
| Registered address at formation | Global | Primary | Incorporation / Formation Documents (entity specific) |
| Registered office address | Global | Primary | Memorandum or Articles of Association (entity specific) |
| Confirms registered address | Global | Primary | Certificate of Good Standing (entity specific) |
| Registered address | Global | Primary | Partnership / LLC Agreement (entity specific) |
| Registered address disclosure | Global | Primary | Website of an approved regulator (e.g. SEC, FCA, ASIC) |
| Registered address | Global | Primary | Website of a recognized stock exchange |
| Registered address (supporting) | Global | Secondary | Client Website (entity specific) |
| Address supplementation | Global | Secondary | Business Card (entity specific) |
| Address supplementation | Global | Secondary | Letterhead (entity specific) |
| Address supplementation | Global | Secondary | Articles of Incorporation (entity specific) |
| Address supplementation | Global | Secondary | Confirmation from business or investment professional (site visit) |
| Address supplementation | Global | Secondary | Confirmation from local offices |
| Address supplementation | Global | Secondary | Other financial institutions |
| Address corroboration | Global | Secondary | Approved public data sources |
| Responsible entity / trustee address | Australia | Primary | ASIC Register (Australia) — https://asic.gov.au |
| Trustee or responsible entity address | Australia | Primary | Trust / Constitution Documentation (Australia) |

## Decision Logic
- **RA_001** — IF recording the Registered Address THEN capture the address filed with the Commercial Registry of the Country of Organization, which must always be in the same country as the Country of Organization.
- **RA_002** — IF the registered address contains PO Box information only and the jurisdiction permits PO Box usage THEN supplement with street name, number, or building details using acceptable secondary sources.
- **RA_003** — IF the address includes "c/o" THEN input the address using c/o in the first address line.
- **RA_004** — IF List 1 standards apply THEN an address containing street name and number, city, and country is sufficient, and postcode confirmation is not required where missing.
- **RA_005** — IF the entity is Swiss-incorporated and postcode discrepancies exist across sources THEN client confirmation of the correct postcode may be used to refresh the registered address.
- **RA_006** — IF the entity is an Australia-domiciled fund or unit trust THEN use the registered address of the responsible entity (where registered) or the trustee / responsible entity (where unregistered), as documented in ASIC records or trust documentation.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Registered address matches registry or incorporation records | Minor formatting differences only | Correct using authoritative registry evidence |
| Registered address country matches Country of Organization | No variance permitted | Do not validate |
| PO Box only address | Allowed only with supplementation | Request supplementary evidence |
| Swiss postcode discrepancy | Client confirmation acceptable | Obtain confirmation if missing |
| Australia fund address logic applied | Correct entity used | Correct before validation |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| legal_registered_address | Registered address (street, city, country) |
| registration_country | Country of registration (must equal Country of Organization) |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "government_identification"
governs_attributes: ["tax_identification_number", "registration_number"]
version: "1.0"
---

# Government Identification — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirms government-issued tax or identification number | Jurisdiction specific | Primary | Tax Form (e.g. W-9, W-8) |
| Displays government ID or registration number linked to entity | Jurisdiction specific | Primary | Company Register |
| Government ID or incorporation number issued at formation | Jurisdiction specific | Primary | Certificate of Formation |
| Includes government identification number provided by entity | Global | Primary | Account Opening Agreement |
| Confirms entity identification number from regulator source | Jurisdiction specific | Primary | Regulator Screenprint |
| Supporting confirmation where Identify task applies | Global | Secondary | Client Confirmation |

## Decision Logic
- **GID_001** — IF the country of organization is USA THEN obtain a US tax ID number (e.g. EIN, TIN, SSN).
- **GID_002** — IF the country of organization is not USA THEN obtain the Government ID number issued by the relevant authority.
- **GID_003** — IF a government ID is already on file together with documentary evidence of its origin THEN there is no requirement to re-verify the number.
- **GID_004** — IF the government ID is missing or has changed THEN obtain the updated number and save supporting evidence to the client file.
- **GID_005** — IF the entity is a fund under an umbrella structure and is not legally recognized as an independent entity THEN use the main fund's tax ID (a fund-level government ID is not acceptable, except for BO identification where applicable).
- **GID_006** — IF entering a US EIN THEN enter it without dashes to avoid account-opening impact.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Government ID matches documentary evidence | None | Do not validate |
| US EIN entered without dash | None | Correct format before proceeding |
| Government ID change evidenced | Documentary proof provided | Do not proceed without evidence |
| Verify task supported | Documentary evidence required | Do not validate without documentation |
| Identify task supported | Documentary evidence or client confirmation | Obtain missing confirmation |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| tax_identification_number | US tax ID (EIN/TIN/SSN, no dashes) or non-US government tax ID |
| registration_number | Government / registry identification number where applicable |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

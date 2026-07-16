---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "address_principal_business"
governs_attributes: ["principal_place_of_business"]
version: "1.0"
---

# Address, Principal Business — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Registered or principal business address | Global | Primary | Company Registry Extract (jurisdiction-specific) |
| Registered or business address | Global | Primary | Memorandum or Articles of Association (entity specific) |
| Business address | Global | Primary | Certificate of Incumbency (entity specific) |
| Registered address | Global | Primary | Certificate of Incorporation / Certificate of Good Standing (entity specific) |
| Business address | Global | Primary | Partnership / LLC Agreement (entity specific) |
| Principal business / head office address | Global | Primary | Website of an approved regulator (e.g., SEC, FCA, BaFin, SFC, ASIC) |
| Address disclosure | Global | Primary | Website of a non-approved regulator |
| Address confirmation | Global | Primary | Written confirmation from an approved regulator |
| Head office / business address | Global | Primary | Website of a recognized stock exchange |
| Address confirmation | Global | Primary | Website of a non-recognized stock exchange or written confirmation |
| Business / contact address | Global | Secondary | Entity website (entity specific) |
| Business address | Global | Secondary | LexisNexis / Accurint (https://www.lexisnexis.com) |
| Headquarters / business address | Global | Secondary | Dun & Bradstreet (https://www.dnb.com) |

## Decision Logic
<!-- Convention-based baseline (dd-guidance-reader standard corroboration). To be refined by the team. -->
- **APB_001** — IF capturing principal_place_of_business THEN record the principal / head-office business address evidenced by the ranked Sources above.
- **APB_002** — Apply the standard corroboration convention: a single Primary source stands alone; absent any Primary, at least two independent Secondary sources must agree.
- **APB_003** — IF the address on file is solely a registered/legal address that differs from the principal place of business THEN capture the principal business address, not the registered address.
- **APB_004** — IF the task is already greened out (id_flag / verification_flag = Yes) THEN do not update.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Value evidenced by a ranked source | Primary stands alone; else ≥2 independent Secondary agree | Do not validate without a qualifying source |
| Address reflects the principal place of business (not solely a registered address) | Consistent across sources | Flag and remediate |
| Verification uses a source independent of id_source | Must differ from id_source | Do not verify by reusing id_source |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| principal_place_of_business | Principal place of business / head-office address |
| evidence_source | Source name + date accessed |

**Escalation:** If a principal place of business cannot be evidenced from any ranked source, escalate to the analyst / FCC.

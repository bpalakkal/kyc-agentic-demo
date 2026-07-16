---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "sole_proprietorship_indicator"
governs_attributes: ["sole_proprietorship_indicator"]
version: "1.0"
---

# Sole Proprietorship Indicator — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirms operation under owner name or fictitious business name | Jurisdiction specific | Primary | Business Registration / DBA Filing |
| Indicates individual ownership and tax reporting as sole proprietor | Jurisdiction specific | Primary | Tax Documentation |
| Identifies legal structure as individual-owned business | Global | Primary | Account Opening Documentation |
| Confirmation of sole proprietorship status where identification applies | Global | Secondary | Client Confirmation |

## Decision Logic
- **SP_001** — IF the business is owned and operated by one individual with no legal distinction between the owner and the business THEN mark the Sole Proprietorship Indicator "Yes".
- **SP_002** — IF the business operates under a fictitious or trade name (DBA) THEN this does not create a separate legal personality from the owner (still a sole proprietorship if owned by one individual).
- **SP_003** — IF the business is incorporated or has formation documents THEN it is not a sole proprietorship.
- **SP_004** — IF conflicting information exists across sources THEN resolve using authoritative documentation or escalate.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Ownership structure confirms a single individual owner | None | Do not validate |
| No formation or incorporation documents exist | None | Treat as incorporated entity if present |
| DBA usage correctly interpreted | DBA does not equal a legal entity | Correct classification if misapplied |
| Evidence or confirmation supports status | Documentary or client confirmation | Obtain missing support |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| sole_proprietorship_indicator | Yes / No |
| evidence_source | Source name + date accessed |

**Escalation:** If the Sole Proprietorship Indicator cannot be determined, escalate to FCC or use HITL. If formation/incorporation documents are later identified, do not treat as sole proprietorship — reclassify the entity.

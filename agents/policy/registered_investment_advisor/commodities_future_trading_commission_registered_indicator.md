---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "commodities_future_trading_commission_registered_indicator"
governs_attributes: ["commodities_future_trading_commission_registered_indicator"]
version: "1.0"
---

# Commodities Futures Trading Commission Registered Indicator — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Legal entity name, legal form, and business description used to understand nature of entity | Jurisdiction specific | Primary | Company Registry Extract |
| Confirmation of CFTC-related registration or regulatory status | US | Primary | CFTC / NFA Public Registers |
| Regulatory status confirmation where entity operates under a recognized regulator | Jurisdiction specific | Primary | Regulator Website |
| Certified documents evidencing regulatory status, where required by task-specific guidance | Global | Primary | Certified Documentation |
| Supporting confirmation where permitted by task guidance | Global | Secondary | Client Confirmation |
| Supplementary information supporting regulatory status | Global | Secondary | Other Public Sources |

## Decision Logic
- **CFTC_001** — IF the CFTC Registered Indicator task is triggered THEN completion of the task is mandatory in line with COBNEXT guidance.
- **CFTC_002** — IF required CIP elements are incomplete THEN account opening must not proceed unless a 60-Day Rule exception is applied.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Evidence supports CFTC Registered Indicator | None | Do not validate task without appropriate evidence |
| CIP requirements completed prior to account opening | Only permitted exception is a valid 60-Day Rule | Do not proceed without completion or rule application |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| commodities_future_trading_commission_registered_indicator | Yes / No, per evidenced CFTC/NFA registration status |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "parent_publicly_listed_us_exchange_indicator"
governs_attributes: ["parent_publicly_listed_on_united_states_exchange_indicator"]
version: "1.0"
---

# Parent Publicly Listed on United States Exchange Indicator — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirms listing of parent entity on NYSE | United States | Primary | NYSE Website — https://www.nyse.com |
| Confirms listing of parent entity on NASDAQ | United States | Primary | NASDAQ Website — https://www.nasdaq.com |
| Confirms that the entity itself is US organized | United States | Primary | Secretary of State Registers |
| Confirms parent ownership, listing status, and stake percentage | United States | Primary | EDGAR — 10-K Document |

## Decision Logic
- **PPL_001** — IF the parent (51%+ stake owner) is listed on NYSE or NASDAQ and the entity itself is US organized THEN the indicator may be marked Yes.
- **PPL_002** — IF a different CDD exemption is applied to the client THEN it is acceptable to input "No" for this indicator without evidencing.
- **PPL_003** — IF the entity is not US organized THEN the indicator must be marked No.
- **PPL_004** — IF the entity is organized in Puerto Rico THEN it is not considered US organized for the purposes of this exemption.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Parent listing evidenced on NYSE or NASDAQ | None | Do not validate without proof |
| Parent ownership stake ≥ 51% | None | Do not apply exemption if threshold not met |
| Entity confirmed as US organized | Puerto Rico excluded | Mark indicator No if not US organized |
| Evidence recency | Evidence within 1 year | Obtain updated evidence |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| parent_public_ally_listed_on_us_exchange_indicator | Yes / No |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

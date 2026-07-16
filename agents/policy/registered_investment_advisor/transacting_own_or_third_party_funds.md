---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "transacting_own_or_third_party_funds"
governs_attributes: ["transacting_with_own_or_third_party_funds_indicator"]
version: "1.0"
---

# Transacting With Own or Third-Party Funds — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Determines transaction nature based on relationship structure (e.g., IA-BO setup) | Global | Primary | Account / Relationship Setup Type |
| Confirms whether client is transacting with own funds or clients' funds | Global | Primary | Client / Salesperson Confirmation |
| Supports inference where salesperson has certainty | Global | Secondary | Business Model Understanding |

## Decision Logic
- **TXN_001** — IF the client is trading its own funds for its own benefit THEN classify as Transacting with own funds (Proprietary Trading).
- **TXN_002** — IF the client is trading clients' (third-party) funds, either at the explicit direction of the client or for the client's benefit THEN classify as Transacting with third-party funds (Agency Trading).
- **TXN_003** — IF the relationship is an IA-BO structure THEN the IA is transacting with third-party funds by default.
- **TXN_004** — IF the client acts in both proprietary and agency capacity THEN treat the client as transacting with third-party funds by default.
- **TXN_005** — IF both the IA and BO in the relationship are registered Financial Institutions THEN the IA is transacting with third-party funds and the BO with own funds by default.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Classification reflects transaction nature | None | Do not validate |
| IA-BO inference applied correctly | Based on setup type | Correct classification |
| Sales confirmation relied upon | Only if salesperson is sure | Obtain client confirmation if unclear |
| Direct BO setup confirmed | Confirmation obtained | Do not infer from setup |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| transacting_with_own_or_third_party_funds_indicator | Own funds (Proprietary) / Third-party funds (Agency) |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

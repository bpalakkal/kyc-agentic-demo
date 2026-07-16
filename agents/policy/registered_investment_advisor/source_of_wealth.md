---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "source_of_wealth"
governs_attributes: ["source_of_wealth"]
version: "1.0"
---

# Source of Wealth — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Description and explanation of source of wealth and estimated size | Global | Primary | Client written confirmation (client provided) |
| Verification of wealth derived from business activities | Global | Primary | Audited Financial Statements / Annual Report (entity specific) |
| Evidence of wealth held or generated through trust structures | Global | Primary | Trust Deeds (entity specific) |
| Evidence of employment-based wealth | Global | Primary | Salary Slips (individual specific) |
| Verification of income and accumulated wealth | Global | Primary | Tax Returns (individual or entity specific) |
| Evidence of asset accumulation | Global | Primary | Bank Statements (individual or entity specific) |
| Supporting evidence for entrepreneurial wealth | Global | Secondary | Public Sources (e.g. company disclosures, registries) |
| Clarifies structure and underlying source of wealth | Global | Secondary | Client clarification on underlying holdings (client provided) |

## Decision Logic
- **SOW_001** — IF Source of Wealth is captured THEN collect an estimated size of the wealth, derived from evidenced public sources or directly from the client; sales confirmation is not acceptable.
- **SOW_002** — IF the onboarding entity is an investment holding entity THEN clearly understand and confirm the underlying source of wealth with the client; "investment holding" alone is insufficient without clarification of the underlying investments / entities.
- **SOW_003** — IF the source of wealth is derived from a parent entity THEN drill down to identify and document the parent's source of wealth and capture it for the task.
- **SOW_004** — IF the client is confirmed to be an asset holding company THEN clarify for whom the assets are held and drill down to the underlying source of wealth of that party.
- **SOW_005** — IF the review is a rolling refresh or the addition of accounts to an existing relationship THEN confirm the source of wealth remains up to date and capture incremental changes to total net worth / total assets held (and, for SG policy only, any changes relating to beneficial owners).
- **SOW_006** — IF the client is classified as high risk THEN verify the source of wealth using supporting documentation and escalate to FCC for review and corroboration.
- **SOW_007** — IF FCC review is required THEN FCC email approval must be obtained and uploaded to complete the verification task; closing the task without FCC approval is a policy and regulatory breach and must be reported. IF SG policy applies THEN source of wealth must be collected for both the facing entity and any ultimate beneficial owners identified.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Source of wealth description provided | Reasonable narrative supported by evidence | Obtain clarification from client |
| Estimated size of wealth captured | Approximation acceptable | Request estimate if missing |
| Investment holding entity clarified | Underlying investments identified | Do not validate if unclear |
| Parent-derived wealth drilled down | Parent SOW documented | Escalate if not obtained |
| High-risk client supporting documents obtained | Approved document types only | Do not validate without evidence |
| FCC approval obtained (high-risk only) | Email approval uploaded | Escalate if missing |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| source_of_wealth | Source of wealth narrative + estimated size (mapped to master $defs.SourceOfWealth) |
| evidence_source | Source name + date accessed |

**Escalation:** For high-risk clients, verify with supporting documentation and escalate to FCC; FCC email approval must be obtained and uploaded before the verification task can be closed.

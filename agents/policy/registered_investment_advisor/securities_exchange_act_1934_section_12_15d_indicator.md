---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "securities_exchange_act_1934_section_12_15d_indicator"
governs_attributes: ["securities_exchange_act_of_1934_section_13_or_15d_indicator"]
version: "1.0"
---

# Securities Exchange Act of 1934 Section 12 or 15(d) Indicator — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Search entity filings and confirm reporting obligation status | US / Global issuers | Primary | SEC EDGAR |
| Cover-page check indicating whether registrant is not required to file under Section 13 or 15(d) | US issuers | Primary | Form 10-K |
| Cover-page check indicating whether registrant is not required to file under Section 13 or 15(d) | Non-US issuers | Primary | Form 20-F |

## Decision Logic
- **SEA_001** — IF a different CDD exemption is applied to the client THEN it is acceptable to input "No" for this indicator without evidencing.
- **SEA_002** — IF reviewing a US issuer THEN search SEC EDGAR and review the Form 10-K cover page.
- **SEA_003** — IF reviewing a non-US issuer THEN search SEC EDGAR and review the Form 20-F cover page.
- **SEA_004** — IF the filing indicates by check mark that the registrant is not required to file reports pursuant to Section 13 or Section 15(d) THEN mark the indicator "No".

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Filing sourced from SEC EDGAR | None | Do not validate without EDGAR evidence |
| Correct filing reviewed (10-K or 20-F) | Issuer type aligned | Obtain correct filing |
| Section 13 / 15(d) indicator checked correctly | Must reflect filing cover page | Do not validate if unclear |
| Evidence recency | Within 1 year | Obtain updated filing |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| securities_exchange_act_of_1934_section_13_or_15d_indicator | Yes / No per filing cover page |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

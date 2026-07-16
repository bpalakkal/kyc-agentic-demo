---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "entity_name"
governs_attributes: ["entity_name", "previous_names", "trading_names"]
version: "1.0"
---

# Entity Name — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Legal entity name listed as Registered Name | Jurisdiction specific | Primary | Company Registry Extract |
| Displayed as Legal / Registered Name (ADV Item 1.B not treated as a trading-name source) | Jurisdiction specific | Primary | Regulator Website (SEC IAPD / Form ADV) |
| Full legal name stated in governing provisions | Global | Primary | Constitutional Documents (MoA / AoA / Trust Deed / LLC Agreement) |
| Presented on cover page and corporate information section | Global | Primary | Audited Annual Report & Accounts |
| Official confirmation of old vs new legal name | Global | Primary | Certificate of Name Change |
| Registry record detailing name change | Global | Primary | Company Registry (Name History) |
| Legal amendment reflecting updated name | Global | Primary | Amendment to Trust Deed |
| Legal confirmation of individual (principal) name change | Global | Primary | Deed Poll / Marriage Certificate |
| Displayed on main page | Global | Secondary | Client Website |
| Listed under Company Executives | Global | Secondary | Bloomberg |
| Used only as supporting evidence | Global (policy restricted) | Secondary | Client Written Confirmation |

## Decision Logic
- **EN_REC_001** — IF recording an entity name THEN capture the full legal name as evidenced in constitutional or legal-existence documents.
- **EN_SRC_001** — IF a Primary source evidences entity_name / previous_names / trading_names THEN it may be relied upon standalone, without secondary corroboration.
- **EN_SRC_002** — IF Primary sources are unavailable or silent THEN at least two independent Secondary sources must corroborate the same information before it is recorded.
- **EN_REC_002** — IF no previous or trading names are identified after reasonable review THEN record "N/A" and proceed without escalation.
- **EN_VAL_001** — IF the recorded name differs from the name on legal-existence documents THEN cross-check and correct before case progression.
- **EN_CHG_001** — IF there is a change in client name or legal form THEN evidence it with acceptable name-change documentation and record the prior name in previous_names.
- **EN_CHG_002** — IF a structural change has occurred THEN reconfirm the government ID, as identifiers may also change.
- **EN_PRN_001** — IF evidencing principal (individual) names THEN use approved primary or secondary sources relevant to the principal-level role.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Recorded name matches the full legal name on constitutional / legal-existence documents | Minor non-substantive variations only (punctuation, spacing, legal-suffix abbreviation e.g. Ltd. vs Limited) | If materially different, do not validate; correct before progressing |
| Name matches across primary sources (registry, regulator, constitutional docs) | Consistent legal name across sources | If mismatch, identify the authoritative source and resolve before proceeding |
| Client has undergone a legal name change | Change evidenced through approved documentation | If not evidenced, do not proceed; obtain name-change documentation |
| Structure change has occurred (merger, conversion, trust amendment) | Updated legal name and identifiers confirmed | Reconfirm government ID; if not updated/inconsistent, flag for review |
| Principal (individual) names validated against approved sources | Minor formatting variations (initials vs full first name) | If substantively different, do not validate; obtain corroborating evidence |
| Client confirmation used as supporting evidence | Only in addition to approved documentary sources | Client confirmation alone is insufficient; escalate if no documentary evidence |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| entity_name | Full legal entity name |
| previous_names | Prior legal names, or "N/A" |
| trading_names | Trading / DBA names, or "N/A" |
| evidence_source | Source name + date accessed (e.g., "SEC IAPD, accessed 2026-03-25") |

**Escalation:** If entity_name, previous_names, or trading_names cannot be determined from approved sources, escalate to analyst.

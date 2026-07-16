---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "proxy_beneficial_owner"
governs_attributes: ["Proxy_BO_address", "Proxy_BO_cip_classification", "Proxy_BO_country_of_incorporation", "Proxy_BO_country_of_residence", "Proxy_BO_date_of_birth", "Proxy_BO_evidence_of_existence", "Proxy_BO_legal_structure", "Proxy_BO_name", "Proxy_BO_nationality", "Proxy_BO_nature_of_business", "Proxy_BO_past_nationality", "Proxy_BO_percentage_of_ownership"]
version: "1.0"
---

# Proxy Beneficial Owner — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirmation of appropriate proxy beneficial owner | Global | Primary | Client written confirmation (client provided) |
| Identification of senior management / control | Global | Primary | Constitutional Documents / Articles of Association (entity specific) |
| Senior management or control persons | Global | Primary | Company / Commercial Register (jurisdiction-specific) |

## Decision Logic
<!-- Convention-based baseline (dd-guidance-reader standard corroboration). To be refined by the team. -->
- **PBO_001** — IF no qualifying beneficial owner is identified THEN capture the proxy beneficial owner (senior management / control person) for each child attribute from the ranked Sources.
- **PBO_002** — Apply the standard corroboration convention per attribute: a single Primary source stands alone; absent any Primary, at least two independent Secondary sources must agree.
- **PBO_003** — IF the proxy beneficial owner is an entity THEN individual-only attributes (date_of_birth, nationality, past_nationality) may be recorded as "N/A".
- **PBO_004** — IF the task is already greened out (id_flag / verification_flag = Yes) for an attribute THEN do not update it.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Each attribute value evidenced by a ranked source | Primary stands alone; else ≥2 independent Secondary agree | Do not validate without a qualifying source |
| Proxy BO applied only where no qualifying beneficial owner exists | Per policy | Flag and remediate |
| Verification uses a source independent of id_source | Must differ from id_source | Do not verify by reusing id_source |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| beneficial_owner | Proxy beneficial owner (senior management / control person) where no qualifying BO is identified |
| evidence_source | Source name + date accessed |

**Escalation:** If a proxy beneficial owner cannot be evidenced, escalate to the analyst / FCC.

---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "legal_structure"
governs_attributes: ["legal_structure"]
version: "1.0"
---

# Legal Structure — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Confirms legal form of incorporation | Global | Primary | Evidence of Existence / Incorporation Documents (entity specific) |
| Legal structure stated in governing documents | Global | Primary | Constitutional Documents (MoA / AoA / Trust Deed / LLC Agreement) (entity specific) |
| Legal form as recorded by the authority | Global | Primary | Company Register / Commercial Registry (jurisdiction-specific) |
| Indicative legal structure | Global | Secondary | Entity Name Suffix (e.g., Ltd, PLC, LLP) (derived) |
| Confirmation of entity's legal form | Global | Secondary | Client Written Confirmation (client provided) |

## Decision Logic
- **LS_001** — IF capturing the Legal Structure THEN record the legal form under which the entity is incorporated or established (e.g., Limited, PLC, LLP).
- **LS_002** — IF incorporation or constitutional documents are available THEN use them as the primary source to determine Legal Structure.
- **LS_003** — IF the legal structure can be reliably identified from the company / commercial registry THEN use the registry record as authoritative evidence.
- **LS_004** — IF the Legal Structure is derived from the entity name suffix THEN corroborate against incorporation or registry documentation.
- **LS_005** — IF client confirmation is used THEN it must clearly state the legal form and be consistent with other evidence.
- **LS_006** — IF the task is already greened out THEN do not update the Legal Structure.
- **LS_007** — IF country-specific limitations exist THEN only the permitted legal structure options for that country may be selected.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Legal structure matches incorporation or constitutional documents | None | Correct before validation |
| Legal structure aligns with registry record | Exact match | Flag and remediate |
| Legal structure derived from name suffix | Must be corroborated | Do not validate standalone |
| Client confirmation used | Consistent with legal evidence | Request clarification if inconsistent |
| Task already greened out | No changes permitted | Do not update |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| legal_structure | Legal form (mapped to master $defs.LegalStructure) |
| evidence_source | Source name + date accessed |

**Escalation:** _Not specified in source guidance — to be completed._

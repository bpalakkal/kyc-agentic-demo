---
entity_type: "<exact CIPClassification enum value, e.g. Registered Investment Advisor or Commodity Trading Advisor>"
attribute: "<attribute slug, e.g. beneficial_owner>"
governs_attributes: ["<master-schema attribute name>", "..."]   # what this note populates; must mirror the master schema
version: "1.0"
---

# <Attribute Display Name> — <Entity Type>

## Sources
<!-- Ranked evidence. Primary may stand alone; absent a Primary, ≥2 independent Secondary sources must corroborate (see dd-guidance-reader). -->
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| <what the source evidences> | <Global / jurisdiction> | Primary\|Secondary | <source> |

## Decision Logic
<!-- Deterministic IF/THEN rules, each with a stable Rule ID. -->
- **[RULE_ID]** — IF <condition> THEN <action>.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| <what must hold> | <tolerated variance> | <what to do on fail> |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| <master-schema attribute> | <what to populate / how to express> |
| evidence_source | Source name + date accessed (e.g., "SEC IAPD, accessed 2026-03-25") |

**Escalation:** <when to escalate, and to whom>

<!--
  AUTHORING RULES (keep the contract intact — dd-guidance-reader keys off this):
  - Never rename/reorder the four ## headings, and never drop the front-matter keys.
  - governs_attributes must list real master-schema attribute names.
  - Every Decision Logic rule gets a stable ID (e.g. BO_SRC_001) so exceptions can cite it.
  - If the source guidance does not specify a section, keep the heading and write:
      > _Not specified in source guidance — to be completed._
    (the reader will flag the note as incomplete rather than run on a gap.)
-->

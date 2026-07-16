---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "authorized_signatory"
governs_attributes: ["authorized_signatory_address", "authorized_signatory_country", "authorized_signatory_date_of_birth", "authorized_signatory_government_identification_number", "authorized_signatory_legal_structure", "authorized_signatory_name", "authorized_signatory_nationality", "authorized_signatory_signatory_date", "authorized_signatory_signature", "authorized_signatory_title"]
version: "1.0"
---

# Authorized Signatory — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Account agreements, ADV for Registered IAs, LLC/LP agreements mentioning signing authority | Global | Primary | Account Opening Documents |
| Board Resolutions, Partnership/Trust Agreements, Certificates of Good Standing, Articles of Organization clearly enumerating signatories | Global | Primary | Constitutional / Public Documents |
| Approved source for identification and appointment of authorized signatories (banks providing access) | Global | Primary | SignatureNet |
| Letter from a List 1/2 financial institution for verification of identity (JMLSG s.5.3.171) | UK | Primary | Representation Letter |
| Written client confirmation of signatories (alternative to documentary evidence; HIC accounts under US policy) | Global | Secondary | Client Confirmation |
| Identifies individuals with access to move money on the account | US (GSAS only) | Secondary | Entity Questionnaire or Qualified Retirement Plan |

## Decision Logic
- **AS_001** — IF onboarding a client THEN obtain the full list of authorized signatories for the account and scan it with the account documents.
- **AS_002** — IF there are more than 10 authorized signatories THEN confirm the most active or senior signatories (up to 10) and record those individuals.
- **AS_003** — IF the client is unable to confirm the top 10 signatories THEN contact FCC/PQA for guidance.
- **AS_004** — IF the client explicitly confirms they will interact with a smaller subset (e.g., 5 or 6 individuals) THEN it is acceptable to document and capture only those designated individuals.
- **AS_005** — IF opening a Sub Account THEN a negative-consent approach may be used to confirm no change to the Authorised Signatories List (ASL).
- **AS_006** — IF the client is unable to provide verification of identity (UK) THEN a Representation Letter for Verification of Signatories may be obtained from a List 1/2 financial institution.
- **AS_007** — IF a document does not clearly enumerate the signatories THEN it is not an acceptable source.
- **AS_008** — IF no approved documentary evidence can be found THEN written client confirmation may be used as an alternative.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Signatories are evidenced by an approved source | One document from the approved list is sufficient | If no approved documentary evidence, written client confirmation may be used |
| Document enumerates the signatories | Signatories must be clearly listed | If not clearly listed, not an acceptable source |
| A list of 10+ signatories is received | Top 10 most active/senior confirmed, or client-designated smaller subset | Do not proceed with all; escalate to PQA if confirmation cannot be obtained |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| authorized_signatory_name | Full legal name (first, middle, last) |
| authorized_signatory_country | Country of residence / state |
| authorized_signatory_legal_structure | Legal structure of the signatory (mapped to master $defs.LegalStructure) |
| authorized_signatory_title | Role / appointment held |
| authorized_signatory_signatory_date | Date of signatory appointment / signing |
| authorized_signatory_signature | Signature evidence reference |
| evidence_source | Source name + date accessed |

**Escalation:** If the analyst is unable to comply with the applicable guidance to identify or verify the authorized signatories, escalate to FCC for advice by raising an exception in the system (notifies the relevant FCC team). If more than 10 signatories and the client cannot confirm the top 10, escalate to PQA.

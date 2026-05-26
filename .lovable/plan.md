## Goal

Wire up **Long Focus Capital Management, LLC (KYC-30215)** end-to-end using the attached demo script, so it can be selected from the Work Queue and reviewed in the Exception Review screen exactly like Brevan Howard / Marshall Wace today.

## Scope

Pure data/content wiring in two files. No UI restructuring, no new PDFs, no changes to the attribute-tree visualization (it stays focused on the London DRG entities).

## Changes

### 1. `src/pages/WorkQueue.tsx`
Add Long Focus Capital as the top row of the **US Private Equity DRG** group:
- Name: `Long Focus Capital Management, LLC`
- KYC: `KYC-30215`
- Jurisdiction: `US — DE / UK`
- Priority: `High`, Risk: `Elevated`, Exceptions: `5`, Status: `In Progress`
- `selectable: true` so checkbox works → it gets passed via router state to the review screen

### 2. `src/pages/ExceptionReview.tsx`

**a. Add 5 new exceptions** to the `exceptions` array (all `kyc: "KYC-30215"`, `entity: "Long Focus Capital Management, LLC"`):

| ID | Title | Category | Conf | Recommended action |
|---|---|---|---|---|
| e6 | US Registration Number Mismatch | Identity Consistency | 92 | Run SEC-ADV Verification Agent, update to 801-67890 |
| e7 | Outstanding LEI Code | Regulatory Status | 78 | Request LEI from client via portal (7-day SLA) |
| e8 | Principal Place of Business Mismatch | Identity Consistency | 90 | Accept Form ADV address as authoritative |
| e9 | Missing Compliance Officer Attestation | Document Completeness | 95 | Generate pre-filled DocuSign to Sarah Chen |
| e10 | Beneficial Ownership Not Identified | Beneficial Ownership | 85 | Issue formal FinCEN BOI request to client |

Each exception gets the full `narrative`, `reasoningSteps`, `evidenceRationale`, `evidence[]`, `acceptability`, and **3 resolution options** (recommended + 2 alternatives) per the demo script — each with `agents`, `agentLabel`, `postRunSummary`, and `updates[]` so the existing "confirm & run agents → addressed" flow works unchanged.

**b. Add 5 entries to `COMPARISONS`** (`e6`–`e10`) — side-by-side tables matching the script:
- e6: Client Onboarding Form vs SEC IAPD
- e7: GLEIF Registry vs Client Onboarding Form
- e8: Corporate Website vs Form ADV
- e9: Form ADV Schedule A vs Client Submitted Documents
- e10: Form ADV Schedule A vs Public Registry Traversal

**c. Add `ENTITY_PROFILES["Long Focus Capital Management, LLC"]`** with all attributes from the doc (entity_name, legal_entity_type, country_of_incorporation, lei_code, us_registration_number, regulator=SEC, entity_giin, legal_registered_address, principal_place_of_business, AUM=$2.4B, corporate_officer=Michael J. Anderson, compliance_officer=[exception], beneficial_owner=[exception], foreign_branches=UK Branch FCA #123456, etc.) — exception fields tagged `status: "alert"` so they render red in the entity panel. Includes a markdown `caseFile` summary.

## Out of scope (call out)

- The **AttributeTree** visualization currently hardcodes Brevan Howard + Marshall Wace under the London DRG. It will remain unchanged. When you select only Long Focus, the left exception list and details fully reflect the new entity; the right-side tree still shows the London DRG view. Happy to restructure the tree in a follow-up if you want it dynamic.
- No new sample PDFs — evidence references in exceptions will point to source names (SEC IAPD, GLEIF, Form ADV, FinCEN) as text-only citations, consistent with how the other exceptions handle non-PDF sources.

## Validation

After build, navigate Work Queue → check only Long Focus → Review Selected → confirm: 5 exceptions in the left rail, each opens with comparison table, narrative, reasoning, evidence, and 3 confirmable recommendations.

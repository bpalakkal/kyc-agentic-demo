# Sourcing behavior specification

Status: authoritative implementation contract
Baseline: Forge export `../latest flows.zip` (22 July 2026)
Last reviewed: 22 July 2026

This document is the golden contract for sourcing behavior in the No-Forge
application. Forge is the baseline unless an explicit approved override appears
below. Code, registry orchestration, automated tests, and operational validation
must remain consistent with this document.

## Approved differences from Forge

### Companies House document scope

Only the **latest incorporation document** is downloaded and digitized.

- Do not download annual returns.
- Do not download confirmation statements.
- Do not download name-change documents.
- If several incorporation-category filings exist, select the newest filing that
  has downloadable document metadata.
- Structured profile, active-officer, and PSC retrieval remains unchanged.

This is an intentional product decision. The Forge export has not yet been
updated and must not be copied for this behavior.

## Cross-source contract

Every source runner must:

1. Resolve the entity using the source-specific matching rule below.
2. Persist every non-null structured field in `entity_attributes` and every
   person/organization party in `entity_persons`.
3. Preserve source name, source URL, retrieval timestamp, confidence, and value
   in lineage.
4. Download every document listed below into private `kyc-files` Storage and add
   its metadata to `case_files`.
5. Classify and digitize downloaded documents, then persist extracted fields and
   parties using the same database publishers as structured sourcing data.
6. Capture and store screenshots for browser/non-API sources at the search result
   and selected detail/evidence pages listed below.
7. Return `no_data` only after a valid source response confirms no acceptable
   match. Network, authentication, parsing, persistence, and browser failures are
   operational failures, never confirmed no-data results.
8. Use canonical schema attribute names and enum normalization. Missing values
   are omitted from persistence rather than stored as `N/A` or fabricated data.
9. Keep source outputs independent. Parent flows orchestrate children; they do
   not replace source-level run, lineage, file, or error history.

## Orchestration

| Parent | Children | Execution | Failure policy |
|---|---|---|---|
| UK - All Sources | FCA, Companies House, Jersey FSC | Parallel | Continue; fail only when every child fails |
| US - All Sources | IAPD, SEC EDGAR, NYSE, NFA, Delaware, Puerto Rico, GLEIF | Parallel | Continue; fail only when every child fails |

## Source contracts

### UK Companies House

- Access: official Companies House REST and Document APIs.
- Match: normalized exact legal-name match; accept a sole result only when it is
  the single unambiguous candidate.
- Structured entity fields: entity name, registration number, status,
  incorporation date, legal structure, registered address, incorporation
  country, previous names, other business activity, source URL, existence.
- Parties: all active officers; all PSCs as beneficial owners and key
  controllers. Preserve names, roles, legal structure, birth month/year,
  nationality, residence/incorporation country, addresses, ownership/control
  details, and registration country when the source provides them.
- Documents: latest downloadable incorporation document only.
- Digitization: classify the incorporation document and extract incorporation
  date, registration number, entity name, legal structure, registered address,
  incorporation country, share capital, and objects where present.
- Screenshots: not required because this is an API source.

### UK Financial Conduct Authority

- Access: official FCA Register REST endpoints.
- Match: resolve FRN through the official search endpoint using normalized exact
  match; a single unambiguous result may be accepted.
- Structured data: core firm record, addresses, permissions, regulators,
  individuals, and all controlled-function pages.
- Entity fields: name, status, FRN/registration number, principal business
  address, website, activity/permissions, regulators, and source URL.
- Parties: corporate officers and key controllers with name, role/function, and
  available person metadata.
- Documents: none.
- Screenshots: not required because this is an API source.

### Jersey Financial Services Commission

- Access: browser-capable retrieval of the official JFSC registry only.
- Match: normalized exact or near-exact match ignoring punctuation and legal
  suffixes; reject records with extra entity qualifiers.
- Structured fields: entity name, registration number, status, incorporation
  date, registered address, incorporation country, legal structure, regulator,
  and source URL.
- Documents: none.
- Screenshots: search results and selected entity detail page, or the no-match
  search result.

### Global GLEIF

- Access: official GLEIF API.
- Match: exact normalized legal name; reject aliases and partial matches.
- Structured fields: entity name, status, legal structure, LEI, previous names,
  registered address, headquarters/principal address, incorporation country and
  date, registration number, beneficial owner when available, source URL, and
  existence.
- Parties: parent/beneficial-owner relationship records returned by GLEIF.
- Documents: none.
- Screenshots: not required because this is an API source.

### US IAPD / Form ADV

- Access: SEC Form ADV API and official IAPD report URL.
- Match: exact legal/business name first, then the Forge relaxed-match rule; do
  not blindly accept the first search result.
- Structured calls: firm search/status and Schedule A direct owners. The current
  Forge flow does not call Schedule B.
- Entity fields: entity name, CRD/registration number, principal address,
  regulator, legal structure, business activity, website, document date,
  registration country, sole-proprietorship indicator, status, classification,
  CPO/CTA indicator, source URL, and existence.
- Parties: qualifying beneficial owners with ownership percentage and legal
  structure; corporate officers with name, role, classification, and legal
  structure.
- Documents: current Form ADV PDF.
- Digitization: Form ADV classifier/extractor; persist all canonical entity and
  party fields with document lineage.
- Screenshots: not required because the required evidence is API data plus the
  retained Form ADV document.

### US SEC EDGAR

- Access: official SEC datasets and filing endpoints with compliant User-Agent.
- Match: exact normalized company name first; do not accept an ambiguous partial
  match.
- Structured fields: entity name, listing status, registered and principal
  addresses, previous names, CIK/registration number, regulatory status,
  regulator registration number, existence, regulator, exchange, business
  activity/SIC, EIN, incorporation country, website, LEI, and source URL.
- Documents: latest annual report and latest prospectus when available.
- Digitization: classify each retained filing and extract its applicable entity
  and party fields; structured SEC data wins conflicts over document data.
- Screenshots: not required because this is an API source.

### US New York Stock Exchange

- Access: official NYSE browser experience, not a substitute third-party or SEC
  exchange-association dataset.
- Match: exact full legal name under the Forge legal-suffix rules.
- Structured fields: entity name, listing status, source URL, trading names,
  listed exchange, website, and corporate officers with role/legal structure.
- Documents: none.
- Screenshots: search result and matched quote/detail page, or no-match result.

### US National Futures Association

- Access: official NFA BASIC browser experience.
- Match: normalized strict name match under Forge rules.
- Structured fields: entity name, previous names, NFA ID/registration number,
  existence, principal address, CFTC-registration indicator, status, regulator
  and regulatory status, source URL.
- Parties: corporate officers and beneficial owners returned by BASIC.
- Documents: none.
- Screenshots: search results and matched detail pages, or no-match result.

### US State of Delaware

- Access: browser automation against the official ICIS registry.
- Match: normalized exact legal name.
- Structured fields: entity name, file/registration number, incorporation date,
  legal structure, registered address, incorporation country, source URL, and
  existence.
- Documents: none.
- Screenshots: search results and matched detail page, or no-match result.

### US State of Puerto Rico

- Access: official registry API for structured data plus browser-capable official
  registry access for documents/evidence.
- Match: exact full legal name.
- Structured fields: entity name, registration number, status, legal structure,
  incorporation date, principal and registered addresses, previous names,
  nature of business, source URL, and existence.
- Parties: corporate officers and authorized signatories with available roles,
  address, and legal-structure fields.
- Documents: latest incorporation/formation document when available.
- Digitization: incorporation-document extraction followed by structured-source
  precedence during consolidation.
- Screenshots: document/result/detail pages used by the browser portion.

## Change-control checklist

For every sourcing behavior change:

1. Update this document in the same pull request.
2. Identify whether the change is a Forge sync or an approved Forge override.
3. Update source fixtures and contract tests.
4. Test found, not-found, ambiguous, pagination, partial-failure, document, and
   screenshot paths as applicable.
5. Confirm database rows in `entity_attributes`, `entity_persons`, `case_files`,
   and `agent_runs`.
6. Record deliberate residual differences in the approved-differences section.

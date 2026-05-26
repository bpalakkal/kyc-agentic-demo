
# Entity 1 — Long Focus Capital Management, LLC

## Case Details

| Field | Value |
| :--- | :--- |
| **Case ID** | KYC-30215 |
| **Entity Type** | Registered Investment Adviser (RIA) |
| **Jurisdiction** | United States \| United Kingdom |
| **Client Risk Rating** | High |
| **Open Exceptions** | 5 |

## Attribute Coverage

| Attribute | Value | Status |
| :--- | :--- | :--- |
| **entity_name** | LONG FOCUS CAPITAL MANAGEMENT, LLC | Complete |
| **legal_entity_type** | Limited Liability Company | Complete |
| **country_of_incorporation** | USA | Complete |
| **date_of_incorporation** | 5/10/2012 | Complete |
| **lei_code** | *\[See Exception Details\]* | Exception |
| **trading_names** | Long Focus Capital | Complete |
| **previous_names** | Focus Capital Partners LLC | Complete |
| **verification_of_existence** | Verified via Delaware State Registry | Complete |
| **us_registration_number** | *\[See Exception Details\]* | Exception |
| **uk_registration_number** |  | Complete |
| **regulator** | SEC | Complete |
| **listing_status** | Not Listed | Complete |
| **listed_exchange** |  | Complete |
| **entity_giin** | 987XYZ.654ABC.AB.123 | Complete |
| **securities_exchange_act_of_1934_section_13_or_15d_indicator** | No | Complete |
| **commodities_future_trading_commission_registered_indicator** | No | Complete |
| **legal_registered_address** | 1209 Orange Street, Wilmington, DE 19801, USA | Complete |
| **principal_place_of_business** | *\[See Exception Details\]* | Exception |
| **website_address** | [www.longfocuscapital.com](http://www.longfocuscapital.com) | Complete |
| **foreign_branches_details** | UK Branch (FCA \#123456) | Complete |
| **sub_advisor_address** |  | Complete |
| **entity_classification** | RIA | Complete |
| **entity_risk_rating** | Medium | Complete |
| **cip_classification** | Legal Entity - LLC | Complete |
| **entity_nature_of_business** | Long/Short Equity Investment Management | Complete |
| **sole_proprietorship_indicator** | No | Complete |
| **parent_public_ally_listed_on_us_exchange_indicator** | No | Complete |
| **other_business_activity** | None | Complete |
| **source_of_funds** | Management Fees, Performance Fees | Complete |
| **source_of_wealth** | Founder's Capital | Complete |
| **assets_under_management_aum** | \$2.4B | Complete |
| **transacting_with_own_or_third_party_funds_indicator** | Third Party Funds | Complete |
| **uk_entity_tax_id_number** |  | Complete |
| **us_entity_tax_id_number** | 98-7654321 | Complete |
| **corporate_officer** | Michael J. Anderson (CEO) | Complete |
| **board_director** | Michael J. Anderson, Sarah K. Lee | Complete |
| **compliance_officer_signatures_name** | *\[See Exception Details\]* | Exception |
| **mlro_or_equivalent_signatures_name** |  | Complete |
| **authorized_signatory** | Michael J. Anderson | Complete |
| **acting_person** |  | Complete |
| **power_of_attorney** | None on file | Complete |
| **sub_advisor_name** |  | Complete |
| **key_controller** | Michael J. Anderson | Complete |
| **beneficial_owner** | *\[See Exception Details\]* | Exception |
| **list_of_subsidiaries** | Long Focus UK Branch | Complete |
| **trustee** |  | Complete |

## Exceptions

### Exception 1 of 5: US Registration Number Mismatch
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*

| Field | Source A · Client Onboarding Form | Source B · SEC IAPD (Form ADV Part 1A) |
| :--- | :--- | :--- |
| **US Registration Number** | 801-12345 (self-reported) | 801-67890 (retrieved 2026-05-20) |
| **Legal Entity Name** | Long Focus Capital Management, LLC | Long Focus Capital Management, LLC |
| **Principal Address** | 456 Broad Avenue, New York, NY | 456 Broad Avenue, New York, NY |

The client-provided CRD number (801-12345) maps to a separate entity, "Long Focus Capital LLC" — without "Management" — in IAPD. The legal name and registered address on the onboarding form match the entity registered under 801-67890. This is most likely a transcription error on the onboarding form and can be corrected with regulator data taken as authoritative.

#### Reasoning
1. SEC IAPD is the system of record for RIA registration numbers under KYC Policy §3.1.
2. Legal entity name and principal address on Form ADV match the client onboarding form exactly.
3. The client-provided number resolves in IAPD but to a different legal entity with a different address — supporting the transcription-error hypothesis rather than a substantive conflict.

#### Actions
* **Option 1 —** Run SEC-ADV-Verification-Agent to confirm match, update the field to 801-67890, and log discrepancy in audit trail.
* **Option 2 —** Accept client-provided number with Senior Analyst override and documented rationale.
* **Option 3 —** Return to client via Relationship Manager for correction.

---

### Exception 2 of 5: Outstanding LEI Code
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*

| Field | Source A · GLEIF Registry | Source B · Client Onboarding Form |
| :--- | :--- | :--- |
| **LEI Code** | No active LEI under entity legal name | Not provided |
| **Search by US Reg \# 801-67890** | No match |  |
| **AUM (context)** |  | \$2.4B reported |

No active LEI was found on GLEIF under the entity's legal name or against its SEC registration number. For an RIA with \$2.4B AUM, an LEI is typically expected for swap and derivatives counterparty reporting under EMIR and Dodd-Frank. The absence may indicate the client does not transact in reportable instruments, or that LEI registration has lapsed or is pending.

#### Reasoning
1. LEI is not a CIP requirement and does not block case closure under FinCEN CDD Rule.
2. LEI is required for any EMIR- or Dodd-Frank-reportable derivative or swap activity, which is plausible given AUM.
3. GLEIF returned no match against either legal name or SEC registration number, indicating no LEI has ever been issued (vs. lapsed).

#### Actions
* **Option 1 —** Request LEI from client via portal with templated outreach; defer with conditional approval if client confirms no reportable activity.
* **Option 2 —** Initiate Broad Search Agent across alternative identifier registries (GMEI Utility, KY3P).
* **Option 3 —** Flag for re-verification at 30 days.

---

### Exception 3 of 5: Principal Place of Business Mismatch
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*

| Field | Source A · Corporate Website | Source B · Form ADV Filing (SEC) |
| :--- | :--- | :--- |
| **Principal Address** | 123 Main Street, New York, NY 10001 | 456 Broad Avenue, New York, NY 10005 |
| **Source Date** | Retrieved 2026-05-20 | Filing dated 2026-03-31 |
| **Matches Client Form** | No | Yes |

Two of three sources (Form ADV and client onboarding form) agree on 456 Broad Avenue. The corporate website shows 123 Main Street, likely a secondary office or stale content. Per KYC Policy §3.5 the regulatory filing supersedes marketing material for address determination.

#### Reasoning
1. KYC Policy §3.5 establishes a hierarchy in which regulatory filings outrank corporate website content for address verification.
2. The Form ADV address matches the address self-reported on the client onboarding form, providing two corroborating sources.
3. The website discrepancy is consistent with a secondary office or unmaintained content rather than a substantive change of principal place of business.

#### Actions
* **Option 1 —** Accept Form ADV address (456 Broad Avenue) as authoritative; matches client form.
* **Option 2 —** Run Geolocation \& Business Directory Check (D\&B, Google Places) as a tiebreaker before acceptance.
* **Option 3 —** Request clarification from client.

---

### Exception 4 of 5: Missing Compliance Officer Attestation
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*

| Field | Source A · Form ADV Schedule A | Source B · Client Submitted Documents |
| :--- | :--- | :--- |
| **Compliance Officer Name** | Sarah Chen (Chief Compliance Officer) | Not listed |
| **Signed Attestation** |  | Not provided |

The Chief Compliance Officer's identity is known via Form ADV Schedule A. What is missing is a signed attestation, not the name itself. A templated DocuSign request to the named CCO is the most direct path.

#### Reasoning
1. CCO identity is independently verified through the regulatory filing.
2. The gap is an artifact (signed attestation) rather than an unknown attribute.
3. Direct request to the named officer is faster than relationship-manager-mediated outreach for a known administrative item.

#### Actions
* **Option 1 —** Generate pre-filled DocuSign attestation form and send to Sarah Chen.
* **Option 2 —** Accept ADV-listed CCO name with a conditional flag for the attestation to follow.
* **Option 3 —** Escalate to client relationship team.

---

### Exception 5 of 5: Beneficial Ownership Not Identified
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*

| Field | Source A · Form ADV Schedule A | Source B · Public Registry Traversal |
| :--- | :--- | :--- |
| **25%+ Beneficial Owner** | Long Focus Holdings LLC (100%) — entity, not individual | Chain terminates at Long Focus Holdings LLC; no further public data |
| **FinCEN BOI Filing** | Not provided by client |  |
| **Companies House (UK branch)** | No PSC at \>25% |  |

The ownership chain terminates at a Delaware holding company with no publicly disclosed ownership. The FinCEN CDD Rule (31 CFR 1010.230) requires identification of natural-person beneficial owners at the 25%+ threshold, so this case cannot close until a natural person is identified or the client provides a FinCEN BOI report.

#### Reasoning
1. The 25% beneficial ownership threshold is a regulatory requirement, not a policy preference — case closure is blocked.
2. Delaware does not require public ownership disclosure for LLCs, so further traversal through public sources alone is unlikely to succeed.
3. Paid registry access (LexisNexis, Sayari) may resolve ownership without client outreach, but client BOI report is the authoritative source.

#### Actions
* **Option 1 —** Issue formal FinCEN BOI report request to client with 7-day SLA.
* **Option 2 —** Run Ownership Resolution Agent against paid registries (LexisNexis, Sayari) to attempt resolution before client outreach.
* **Option 3 —** Escalate to the Enhanced Due Diligence team.

---
---

# Entity 2 — BROOKFIELD ASSET MANAGEMENT PIC US, LLC

## Case Details

| Field | Value |
| :--- | :--- |
| **Case ID** | KYC-30216 |
| **Entity Type** | Registered Investment Adviser (RIA) |
| **Jurisdiction** | US (Delaware) with UK branch |
| **Client Risk Rating** | Low |
| **Open Exceptions** | 3 |

## Attribute Coverage

| Attribute | Value | Status |
| :--- | :--- | :--- |
| **entity_name** | BROOKFIELD ASSET MANAGEMENT PIC US, LLC | Complete |
| **legal_entity_type** | Limited Liability Company | Complete |
| **country_of_incorporation** | United States (Delaware) | Complete |
| **date_of_incorporation** | 22 July 2009 | Complete |
| **lei_code** | 549300FML6EDDNTAVG88 | Complete |
| **trading_names** | BAM PIC US (commonly referenced) | Complete |
| **previous_names** |  | Complete |
| **verification_of_existence** | Active (SEC registered investment adviser + Delaware entity) | Complete |
| **us_registration_number** | CRD: 151599 / SEC\#: 801-72031 | Complete |
| **uk_registration_number** | Not applicable | Complete |
| **regulator** | U.S. SEC (registered investment adviser) | Complete |
| **listing_status** | Not listed (private LLC) | Complete |
| **listed_exchange** | Not applicable | Complete |
| **entity_giin** |  | Complete |
| **securities_exchange_act_of_1934_section_13_or_15d_indicator** | Not applicable | Complete |
| **commodities_future_trading_commission_registered_indicator** |  | Complete |
| **legal_registered_address** | C/O Corporation Service Company, 251 Little Falls Drive, Wilmington, Delaware 19808, USA | Complete |
| **principal_place_of_business** | Brookfield, 225 Liberty Street, 8th Floor, New York, NY 10281-1023, USA | Complete |
| **website_address** | <https://www.brookfield.com> | Complete |
| **foreign_branches_details** |  | Complete |
| **sub_advisor_address** |  | Complete |
| **entity_classification** | Investment adviser / asset manager | Exception |
| **entity_risk_rating** | Medium | Exception |
| **cip_classification** | Registered Investment Advisor | Exception |
| **entity_nature_of_business** | Provides investment advisory services to private funds, pooled vehicles, institutional accounts across real estate and alternative assets | Complete |
| **sole_proprietorship_indicator** | No | Complete |
| **parent_public_ally_listed_on_us_exchange_indicator** | Yes | Complete |
| **other_business_activity** | Multi-sector alternative investments (real estate, infrastructure, energy, private equity) | Complete |
| **source_of_funds** | Institutional investor capital (pooled vehicles, funds) | Complete |
| **source_of_wealth** | Investment management earnings / fund structures | Complete |
| **assets_under_management_aum** | \~USD 105.3B (regulatory AUM, Dec 31 2025) | Complete |
| **transacting_with_own_or_third_party_funds_indicator** | Third-party client funds | Complete |
| **uk_entity_tax_id_number** | Not applicable | Complete |
| **us_entity_tax_id_number** |  | Complete |
| **corporate_officer** |  | Complete |
| **board_director** |  | Complete |
| **compliance_officer_signatures_name** |  | Complete |
| **mlro_or_equivalent_signatures_name** |  | Complete |
| **authorized_signatory** |  | Complete |
| **acting_person** |  | Exception |
| **power_of_attorney** |  | Complete |
| **sub_advisor_name** | Fairfield Realty Advisors LLC, Thayer Lodging Group LLC | Complete |
| **key_controller** | Brookfield Asset Management group | Complete |
| **beneficial_owner** | Brookfield Asset Management group | Complete |
| **list_of_subsidiaries** |  | Complete |
| **trustee** | Not applicable | Complete |

## Exceptions

### Exception 1 of 3: Risk Rating
*Exception Summary*

| Field | Source A · Due Diligence | Source B · Internal records |
| :--- | :--- | :--- |
| **Risk Rating** | High – Due to adding an optional field ownership country | Low – Initial classification during the time of RR |
| **Client Pushback** | Yes | Yes |

Given the change in risk rating triggered during onboarding due to the addition of Cayman-domiciled ownership entities, there is a discrepancy between the initial risk classification (Low) and the current system-generated classification (High).

The client has remained cooperative throughout the process, and the ultimate parent entity is a well-established and known client to the firm. The current ownership structure update has led to additional drilldown requirements, which may not align with jurisdiction-specific risk interpretation.

#### Reasoning
1. The client was previously classified as Low Risk under another division's UK policy closure in January 2026, and no material adverse factors were identified at that time.
2. The introduction of Cayman-domiciled ownership entities (which is an optional task during onboarding) has systematically triggered a High Risk classification, although Cayman jurisdiction alone is not considered a high-risk trigger under UK standards.
3. The ultimate beneficial owner is a reputable and known entity, reducing overall risk concerns from a KYC standpoint.
4. The client has demonstrated full cooperation, and late-stage changes to ownership drilldown requirements (e.g., shifting from 25% to 10%) would negatively impact client experience.

#### Actions
* **Option 1 — Threshold Alignment:** Seek confirmation from Compliance to proceed with a 25% ownership drilldown threshold, considering:
  * Prior low-risk classification
  * Reputable UBO
  * Jurisdiction-specific interpretation of Cayman exposure
* **Option 2 — Policy Exception / Risk Revalidation:** Request a risk rating override or exception from compliance to align the entity back to Low/Medium risk, supported by:
  * Historical assessment
  * Absence of new adverse risk indicators
  * Client cooperation and transparency
* **Option 3 — Stakeholder Escalation (if required):** Engage Sales / Coverage teams to:
  * Provide client context and relationship insights
  * Support justification for maintaining a 25% threshold
  * Avoid additional documentation requests that may disrupt onboarding

---

### Exception 2 of 3: CIP Classification and NAICS code
*Exception Summary*

| Field | Source A · Form ADV | Source B - Client Confirmation |
| :--- | :--- | :--- |
| **CIP classification** | Internal classification and Nature of business trigger indicates **financial activity flag** due to industry code mapping | Client confirmed the entity should be classified as **NFIE (Non-Financial Entity)** |
| **Nature of Business** | investment advisory services | Indicates Holding company as per the nature of business shared |
| **Client Pushback** | Client has provided responses and classification (no refusal) | Client has provided responses and classification (no refusal) |

During onboarding the client confirmed the entity should be classified as **NFIE (Non-Financial Entity)**. However, an internal due diligence trigger has been raised due to the entity being mapped to Investment adviser / asset manager which is generally associated with **financial investment-related activities**.

This creates a **classification discrepancy**, requiring confirmation on whether the entity should remain classified as **NFIE** or be reclassified as a **Financial Entity (Investment Entity)**.

#### Reasoning
1. The client has explicitly classified the entity as a **Non-Financial Entity (NFIE)**, indicating that it does not consider itself to be engaged in regulated financial institution activities.
2. The internal trigger is driven by the nature of business **Investment adviser / asset manager**, which is commonly linked to **investment-related or financial activity**, and therefore may indicate that the entity operates in a manner consistent with a **Financial Entity / Investment Entity** under KYC classification standards.
3. The onboarding request further supports the need to assess whether the entity is functioning in a **financial capacity**, particularly if such activities extend beyond internal treasury or hedging purposes.
4. While the **nature of business** describes the entity as a **holding company / financing vehicle for group companies** shared by the client, this needs to be validated to determine whether activities are strictly **intra-group** or extend to **investment or financial services activity**, which would change the classification outcome.

#### Actions
* **Option 1 - Request a Legal team review to assess the appropriateness of the client’s NFIE classification:** Based on the nature of business (Investment adviser / asset manager), the entity’s access to derivatives trading products, and the possibility of investment-related activities, Legal is to evaluate whether the entity is more appropriately classified as a Financial Entity (Investment Entity / Financial Institution) and provide a documented position.
* **Option 2 – Targeted Client Outreach for Clarification:** Conduct client outreach to validate the entity’s actual activities and support classification, specifically:
  * Whether the entity performs investment or financial activities for third parties vs strictly intra-group purposes
  * Whether the entity is regulated, licensed, or operating in a capacity similar to an investment adviser or financial investment entity
  * Clarification on the rationale behind the client’s NFIE classification, given the alignment with the entity's nature of business
* **Option 3 – Use responses to substantiate classification** as either Financial Entity or NFIE and ensure alignment with internal policy.

---

### Exception 3 of 3: Acting Person
*Exception Summary*

| Field | Source A · Form ADV Schedule A | Source B · Client Submitted Documents |
| :--- | :--- | :--- |
| **Acting Person Classification** | Acting Person identified, but not a member of Vorstand / Executive Management Board | Policy states non-board Acting Persons must have documented authority (Power of Attorney or equivalent) |
| **Power of Attorney (PoA) Evidence** | No PoA or authorized signatory evidence available | PoA or equivalent documentation required to validate authority to act |

During KYC review, an **Acting Person (AP)** has been identified for the entity; however, the individual is **not a member of the Vorstand** (Executive Management Board) or equivalent governing body. 

As per the guidance, where the Acting Person is not part of the governing body, the individual must also be supported by documented authority, typically evidenced through a **Power of Attorney (PoA)** or inclusion in an authorized signatory list. In this case, no such supporting documentation has been provided, creating a gap in validating the individual’s authority to act on behalf of the entity.

#### Reasoning
1. Guidance clearly states that Acting Persons who are not members of Vorstand (or equivalent senior governing authority) cannot rely solely on their designation and must have explicit delegated authority.
2. The purpose of linking an individual as both **Acting Person and Power of Attorney** is to ensure there is legal evidence supporting their authority to represent the entity.
3. Acceptable forms of such evidence include:
  * A **formal Power of Attorney document**, or
  * An **authorized signatory list** where the individual is listed.
  
  In the absence of such documentation, there is insufficient evidence to validate the individual’s authority, which presents a KYC control gap.

#### Actions
* **Option 1 – Client reach out requesting supporting Authority Documentation:** Reach out to the client to obtain a valid **Power of Attorney (PoA)** document confirming the individual’s authority, or an **authorized signatory list** clearly evidencing authorization. This will allow proper linkage of the individual as both **Acting Person and authorized representative**.
* **Option 2 – Revalidate Acting Person Selection:** Request confirmation from the client on whether the identified Acting Person should be replaced with an **individual who is part of the Vorstand / Executive Management Board**, or if the current Acting Person remains valid but requires **formal authority documentation**.
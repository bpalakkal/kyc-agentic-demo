# Entity 1 — Long Focus Capital Management, LLC
## Case Details
| Case ID | KYC-30215 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United States | United Kingdom |
| Client Risk Rating | High |
| Open Exceptions | 5 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | Long Focus Capital Mgmt | Complete |
| entity_name | LONG FOCUS CAPITAL MANAGEMENT, LLC | Complete |
| legal_entity_type | Limited Liability Company | Complete |
| country_of_incorporation | USA | Complete |
| date_of_incorporation | 5/10/2012 | Complete |
| lei_code | [See Exception Details] | Exception |
| trading_names | Long Focus Capital | Complete |
| previous_names | Focus Capital Partners LLC | Complete |
| verification_of_existence | Verified via Delaware State Registry | Complete |
| us_registration_number | [See Exception Details] | Exception |
| uk_registration_number | N/A | Complete |
| regulator | SEC | Complete |
| listing_status | Not Listed | Complete |
| listed_exchange | N/A | Complete |
| entity_giin | 987XYZ.654ABC.AB.123 | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | No | Complete |
| commodities_future_trading_commission_registered_indicator | No | Complete |
| legal_registered_address | 1209 Orange Street, Wilmington, DE 19801, USA | Complete |
| principal_place_of_business | [See Exception Details] | Exception |
| website_address | www.longfocuscapital.com [www.longfocuscapital.com](https://www.google.com/url?q=http%3A%2F%2Fwww.longfocuscapital.com) | Complete |
| foreign_branches_details | UK Branch (FCA #123456) | Complete |
| sub_advisor_address | N/A | Complete |
| entity_classification | RIA | Complete |
| entity_risk_rating | Medium | Complete |
| cip_classification | Legal Entity - LLC | Complete |
| entity_nature_of_business | Long/Short Equity Investment Management | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | No | Complete |
| other_business_activity | None | Complete |
| source_of_funds | Management Fees, Performance Fees | Complete |
| source_of_wealth | Founder's Capital | Complete |
| assets_under_management_aum | $2.4B | Complete |
| transacting_with_own_or_third_party_funds_indicator | Third Party Funds | Complete |
| uk_entity_tax_id_number | N/A | Complete |
| us_entity_tax_id_number | 98-7654321 | Complete |
| corporate_officer | Michael J. Anderson (CEO) | Complete |
| board_director | Michael J. Anderson, Sarah K. Lee | Complete |
| compliance_officer_signatures_name | [See Exception Details] | Exception |
| mlro_or_equivalent_signatures_name | N/A | Complete |
| authorized_signatory | Michael J. Anderson | Complete |
| acting_person | N/A | Complete |
| power_of_attorney | None on file | Complete |
| sub_advisor_name | N/A | Complete |
| key_controller | Michael J. Anderson | Complete |
| beneficial_owner | [See Exception Details] | Exception |
| list_of_subsidiaries | Long Focus UK Branch | Complete |
| trustee | N/A | Complete |

## Exceptions
### Exception 1 of 5: US Registration Number Mismatch
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*
| Field | Source A · Client Onboarding Form | Source B · SEC IAPD (Form ADV Part 1A) |
| :--- | :--- | :--- |
| US Registration Number | 801-12345 (self-reported) | 801-67890 (retrieved 2026-05-20) |
| Legal Entity Name | Long Focus Capital Management, LLC | Long Focus Capital Management, LLC |
| Principal Address | 456 Broad Avenue, New York, NY | 456 Broad Avenue, New York, NY |

The client-provided CRD number (801-12345) maps to a separate entity, "Long Focus Capital LLC" — without "Management" — in IAPD. The legal name and registered address on the onboarding form match the entity registered under 801-67890. This is most likely a transcription error on the onboarding form and can be corrected with regulator data taken as authoritative.
#### Reasoning
* SEC IAPD is the system of record for RIA registration numbers under KYC Policy §3.1.
* Legal entity name and principal address on Form ADV match the client onboarding form exactly.
* The client-provided number resolves in IAPD but to a different legal entity with a different address — supporting the transcription-error hypothesis rather than a substantive conflict.
#### Actions
* Option 1 — Run SEC-ADV-Verification-Agent to confirm match, update the field to 801-67890, and log discrepancy in audit trail.
* Option 2 — Accept client-provided number with Senior Analyst override and documented rationale.
* Option 3 — Return to client via Relationship Manager for correction.
---
### Exception 2 of 5: Outstanding LEI Code
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*
| Field | Source A · GLEIF Registry | Source B · Client Onboarding Form |
| :--- | :--- | :--- |
| LEI Code | No active LEI under entity legal name | Not provided |
| Search by US Reg # 801-67890 | No match | n/a |
| AUM (context) | n/a | $2.4B reported |

No active LEI was found on GLEIF under the entity's legal name or against its SEC registration number. For an RIA with $2.4B AUM, an LEI is typically expected for swap and derivatives counterparty reporting under EMIR and Dodd-Frank. The absence may indicate the client does not transact in reportable instruments, or that LEI registration has lapsed or is pending.
#### Reasoning
* LEI is not a CIP requirement and does not block case closure under FinCEN CDD Rule.
* LEI is required for any EMIR- or Dodd-Frank-reportable derivative or swap activity, which is plausible given AUM.
* GLEIF returned no match against either legal name or SEC registration number, indicating no LEI has ever been issued (vs. lapsed).
#### Actions
* Option 1 — Request LEI from client via portal with templated outreach; defer with conditional approval if client confirms no reportable activity.
* Option 2 — Initiate Broad Search Agent across alternative identifier registries (GMEI Utility, KY3P).
* Option 3 — Flag for re-verification at 30 days.
---
### Exception 3 of 5: Principal Place of Business Mismatch
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*
| Field | Source A · Corporate Website | Source B · Form ADV Filing (SEC) |
| :--- | :--- | :--- |
| Principal Address | 123 Main Street, New York, NY 10001 | 456 Broad Avenue, New York, NY 10005 |
| Source Date | Retrieved 2026-05-20 | Filing dated 2026-03-31 |
| Matches Client Form | No | Yes |

Two of three sources (Form ADV and client onboarding form) agree on 456 Broad Avenue. The corporate website shows 123 Main Street, likely a secondary office or stale content. Per KYC Policy §3.5 the regulatory filing supersedes marketing material for address determination.
#### Reasoning
* KYC Policy §3.5 establishes a hierarchy in which regulatory filings outrank corporate website content for address verification.
* The Form ADV address matches the address self-reported on the client onboarding form, providing two corroborating sources.
* The website discrepancy is consistent with a secondary office or unmaintained content rather than a substantive change of principal place of business.
#### Actions
* Option 1 — Accept Form ADV address (456 Broad Avenue) as authoritative; matches client form.
* Option 2 — Run Geolocation & Business Directory Check (D&B, Google Places) as a tiebreaker before acceptance.
* Option 3 — Request clarification from client.
---
### Exception 4 of 5: Missing Compliance Officer Attestation
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*
| Field | Source A · Form ADV Schedule A | Source B · Client Submitted Documents |
| :--- | :--- | :--- |
| Compliance Officer Name | Sarah Chen (Chief Compliance Officer) | Not listed |
| Signed Attestation | n/a | Not provided |

The Chief Compliance Officer's identity is known via Form ADV Schedule A. What is missing is a signed attestation, not the name itself. A templated DocuSign request to the named CCO is the most direct path.
#### Reasoning
* CCO identity is independently verified through the regulatory filing.
* The gap is an artifact (signed attestation) rather than an unknown attribute.
* Direct request to the named officer is faster than relationship-manager-mediated outreach for a known administrative item.
#### Actions
* Option 1 — Generate pre-filled DocuSign attestation form and send to Sarah Chen.
* Option 2 — Accept ADV-listed CCO name with a conditional flag for the attestation to follow.
* Option 3 — Escalate to client relationship team.
---
### Exception 5 of 5: Beneficial Ownership Not Identified
*Exception Summary — Entity 1 — Long Focus Capital Management, LLC (KYC-30215)*
| Field | Source A · Form ADV Schedule A | Source B · Public Registry Traversal |
| :--- | :--- | :--- |
| 25%+ Beneficial Owner | Long Focus Holdings LLC (100%) — entity, not individual | Chain terminates at Long Focus Holdings LLC; no further public data |
| FinCEN BOI Filing | Not provided by client | n/a |
| Companies House (UK branch) | No PSC at >25% | n/a |

The ownership chain terminates at a Delaware holding company with no publicly disclosed ownership. The FinCEN CDD Rule (31 CFR 1010.230) requires identification of natural-person beneficial owners at the 25%+ threshold, so this case cannot close until a natural person is identified or the client provides a FinCEN BOI report.
#### Reasoning
* The 25% beneficial ownership threshold is a regulatory requirement, not a policy preference — case closure is blocked.
* Delaware does not require public ownership disclosure for LLCs, so further traversal through public sources alone is unlikely to succeed.
* Paid registry access (LexisNexis, Sayari) may resolve ownership without client outreach, but client BOI report is the authoritative source.
#### Actions
* Option 1 — Issue formal FinCEN BOI report request to client with 7-day SLA.
* Option 2 — Run Ownership Resolution Agent against paid registries (LexisNexis, Sayari) to attempt resolution before client outreach.
* Option 3 — Escalate to the Enhanced Due Diligence team.
---
# Entity 2 — BROOKFIELD ASSET MANAGEMENT PIC US, LLC
## Case Details
| Case ID | KYC-30216 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US (Delaware) with UK branch |
| Client Risk Rating | Low |
| Open Exceptions | 3 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | Brookfield Asset Mgmt | Complete |
| entity_name | BROOKFIELD ASSET MANAGEMENT PIC US, LLC | Complete |
| legal_entity_type | Limited Liability Company | Complete |
| country_of_incorporation | United States | Complete |
| date_of_incorporation | 22 July 2009 | Complete |
| lei_code | 549300FML6EDDNTAVG88 | Complete |
| trading_names | BAM PIC US | Complete |
| previous_names | | Complete |
| verification_of_existence | Active (SEC registered investment adviser + Delaware entity) | Complete |
| us_registration_number | 151599 | Complete |
| uk_registration_number | | Complete |
| regulator | U.S. SEC | Complete |
| listing_status | Not listed | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | | Complete |
| commodities_future_trading_commission_registered_indicator | | Complete |
| legal_registered_address | C/O Corporation Service Company, 251 Little Falls Drive, Wilmington, Delaware 19808, USA | Complete |
| principal_place_of_business | Brookfield, 225 Liberty Street, 8th Floor, New York, NY 10281-1023, USA | Complete |
| website_address | https://www.brookfield.com [brookfield.com] [[brookfield.com]](https://www.brookfield.com/) | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | [See Exception Below] | Exception |
| entity_risk_rating | [See Exception Below] | Exception |
| cip_classification | [See Exception Below] | Exception |
| entity_nature_of_business | Provides investment advisory services to private funds, pooled vehicles, institutional accounts across real estate and alternative assets | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | Yes (ultimate ownership through Brookfield listed entities) | Complete |
| other_business_activity | Multi-sector alternative investments (real estate, infrastructure, energy, private equity) | Complete |
| source_of_funds | Institutional investor capital (pooled vehicles, funds) | Complete |
| source_of_wealth | Investment management earnings / fund structures (not publicly detailed) | Complete |
| assets_under_management_aum | ~USD 105.3B (regulatory AUM, Dec 31 2025) | Complete |
| transacting_with_own_or_third_party_funds_indicator | Third-party funds | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | | Complete |
| acting_person | [See Exception Below] | Exception |
| power_of_attorney | | Complete |
| sub_advisor_name | Fairfield Realty Advisors LLC, Thayer Lodging Group LLC | Complete |
| key_controller | | Complete |
| beneficial_owner | Brookfield Asset Management group | Complete |
| list_of_subsidiaries | | Complete |
| trustee | | Complete |

## Exceptions
### Exception 1 of 3: Risk Rating
*Exception Summary*
| Field | Source A · Due Diligence | Source B · Internal records |
| :--- | :--- | :--- |
| Risk Rating | High – Due to adding an optional field ownership country | Low – Initial classification during the time of RR |
| Client Pushback | Yes | Yes |

Given the change in risk rating triggered during onboarding due to the addition of Cayman-domiciled ownership entities, there is a discrepancy between the initial risk classification (Low) and the current system-generated classification (High). The client has remained cooperative throughout the process, and the ultimate parent entity, , is a well-established and known client to the firm. The current ownership structure update has led to additional drilldown requirements, which may not align with jurisdiction-specific risk interpretation.
#### Reasoning
* The client was previously classified as Low Risk under the another division UK policy closure in January 2026, and no material adverse factors were identified at that time.
* The introduction of Cayman-domiciled ownership entities which is an optional task during onboarding has systematically triggered a High Risk classification, although Cayman jurisdiction alone is not considered a high-risk trigger under UK standards.
* The ultimate beneficial owner is a reputable and known entity, reducing overall risk concerns from a KYC standpoint.
* The client has demonstrated full cooperation, and late-stage changes to ownership drilldown requirements (e.g., shifting from 25% to 10%) would negatively impact client experience.
#### Actions
* Option 1 – Threshold Alignment Seek confirmation from Compliance to proceed with a 25% ownership drilldown threshold, considering:
  * Prior low-risk classification
  * Reputable UBO
  * Jurisdiction-specific interpretation of Cayman exposure
* Option 2 – Policy Exception / Risk Revalidation Request a risk rating override or exception from compliance to align the entity back to Low/Medium risk, supported by:
  * Historical assessment
  * Absence of new adverse risk indicators
  * Client cooperation and transparency
* Option 3 – Stakeholder Escalation (if required) Engage Sales / Coverage teams to:
  * Provide client context and relationship insights
  * Support justification for maintaining a 25% threshold
  * Avoid additional documentation requests that may disrupt onboarding
---
### Exception 2 of 3: CIP Classification and NAICS code
*Exception Summary*
| Field | Source A · Form ADV | Source B- Client Confirmation |
| :--- | :--- | :--- |
| CIP classification | Internal classification and Nature of business trigger indicates financial activity flag due to industry code mapping | Client confirmed the entity should be classified as NFIE (Non-Financial Entity) |
| Nature of Business | investment advisory services | Indicates Holding company as per the nature of business shared |
| Client Pushback | Client has provided responses and classification (no refusal) | Client has provided responses and classification (no refusal) |

During onboarding the client confirmed the entity should be classified as NFIE (Non-Financial Entity).However, an internal due diligence trigger has been raised due to the entity being mapped to Investment adviser / asset manager which is generally associated with financial investment-related activities. This creates a classification discrepancy, requiring confirmation on whether the entity should remain classified as NFIE or be reclassified as a Financial Entity (Investment Entity).
#### Reasoning
* The client has explicitly classified the entity as a Non-Financial Entity (NFIE), indicating that it does not consider itself to be engaged in regulated financial institution activities.
* The internal trigger is driven by nature of business Investment adviser / asset manager, which is commonly linked to investment-related or financial activity, and therefore may indicate that the entity operates in a manner consistent with a Financial Entity / Investment Entity under KYC classification standards.
* The onboarding request further supports the need to assess whether the entity is functioning in a financial capacity, particularly if such activities extend beyond internal treasury or hedging purposes.
* While the nature of business describes the entity as a holding company / financing vehicle for group companies shared by the client, this needs to be validated to determine whether activities are strictly intra-group or extend to investment or financial services activity, which would change the classification outcome.
#### Actions
* Option 1 - Request a Legal team review to assess the appropriateness of the client’s NFIE (Non-Financial Entity) classification. Based on:
  * Nature of business Investment adviser / asset manager, the entity’s access to derivatives trading products and the possibility of investment-related activities
* Legal to evaluate whether the entity is more appropriately classified as a Financial Entity (Investment Entity / Financial Institution) and provide a documented position, which may disagree with the client’s NFIE classification.
* Option 2 – Targeted Client Outreach for Clarification Conduct client outreach to validate the entity’s actual activities and support classification, specifically:
  * Whether the entity performs investment or financial activities for third parties vs strictly intra-group purposes
  * Whether the entity is regulated, licensed, or operating in a capacity similar to an investment adviser or financial investment entity
  * Clarification on the rationale behind the client’s NFIE classification, given the alignment with entity;s nature of business Investment adviser / asset manager
* Use the responses to substantiate classification as either Financial Entity or NFIE and ensure alignment with internal policy.
---
### Exception 3 of 3: Acting Person
*Exception Summary*
| Field | Source A · Form ADV Schedule A | Source B · Client Submitted Documents |
| :--- | :--- | :--- |
| Acting Person Classification | Acting Person identified, but not a member of Vorstand / Executive Management Board | Policy states non-board Acting Persons must have documented authority (Power of Attorney or equivalent) |
| Power of Attorney (PoA) Evidence | No PoA or authorized signatory evidence available | PoA or equivalent documentation required to validate authority to act |

During KYC review, an Acting Person (AP) has been identified for the entity; however, the individual is not a member of the Vorstand (Executive Management Board) or equivalent governing body. As per the guidance, where the Acting Person is not part of the governing body, the individual must also be supported by documented authority, typically evidenced through a Power of Attorney (PoA) or inclusion in an authorized signatory list. In this case, no such supporting documentation has been provided, creating a gap in validating the individual’s authority to act on behalf of the entity.
#### Reasoning
* Guidance clearly states that Acting Persons who are not members of Vorstand (or equivalent senior governing authority) cannot rely solely on their designation and must have explicit delegated authority.
* The purpose of linking an individual as both Acting Person and Power of Attorney is to ensure there is legal evidence supporting their authority to represent the entity.
* Acceptable forms of such evidence include:
  * A formal Power of Attorney document, or
  * An authorized signatory list where the individual is listed
* In the absence of such documentation, there is insufficient evidence to validate the individual’s authority, which presents a KYC control gap.
#### Actions
* Option 1 – Client reach out requesting supporting Authority Documentation Reach out to the client to obtain one of the following:
  * A valid Power of Attorney (PoA) document confirming the individual’s authority, or
  * An authorized signatory list clearly evidencing the individual’s authorization
* This will allow proper linkage of the individual as both Acting Person and authorized representative.
* Option 2 – Revalidate Acting Person Selection Request confirmation from the client on whether:
  * The identified Acting Person should be replaced with an individual who is part of the Vorstand / Executive Management Board, or
  * The current Acting Person remains valid but requires formal authority documentation
---
# Entity 3 — STONEPEAK ADVISORS III LLC
## Case Details
| Case ID | KYC-30217 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US (Delaware) |
| Client Risk Rating | Low |
| Open Exceptions | 3 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | Stonepeak Infrastructure Partners - United States | Complete |
| entity_name | STONEPEAK ADVISORS III LLC | Complete |
| legal_entity_type | Limited Liability Company | Complete |
| country_of_incorporation | United States (Delaware) | Complete |
| date_of_incorporation | [See Exception Below] | Exception |
| lei_code | 549300AELE325GG98G07 | Complete |
| trading_names | | Complete |
| previous_names | | Complete |
| verification_of_existence | Active (verified via Delaware + NY records and LEI) | Complete |
| us_registration_number | 6370991 | Complete |
| uk_registration_number | | Complete |
| regulator | Delaware Division of Corporations; NY Department of State | Complete |
| listing_status | Not listed | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | | Complete |
| commodities_future_trading_commission_registered_indicator | | Complete |
| legal_registered_address | [See Exception Below] | Exception |
| principal_place_of_business | [See Exception Below] | Exception |
| website_address | https://stonepeak.com | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | Investment adviser / private fund advisory entity (Stonepeak group) | Complete |
| entity_risk_rating | To be determined internally | Complete |
| cip_classification | Financial Institution (private investment advisor structure) | Complete |
| entity_nature_of_business | Provides advisory services to infrastructure and real asset investment funds | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | No | Complete |
| other_business_activity | Alternative asset investing (infrastructure, real estate, energy, logistics) | Complete |
| source_of_funds | Institutional investor capital (private funds) | Complete |
| source_of_wealth | Investment management fees / fund performance | Complete |
| assets_under_management_aum | Not directly attributable at entity level (Stonepeak group ~70–88B AUM) | Complete |
| transacting_with_own_or_third_party_funds_indicator | | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | | Complete |
| acting_person | | Complete |
| power_of_attorney | | Complete |
| sub_advisor_name | | Complete |
| key_controller | Michael Dorrell | Complete |
| beneficial_owner | | Complete |
| list_of_subsidiaries | | Complete |

## Exceptions
### Exception 1 of 3: Incorporation Date vs Foreign Registration Date Mismatch
*Exception Summary*
| Field | Source A · LEI Record | Source B · NY Dept. of State (Foreign LLC Filing) |
| :--- | :--- | :--- |
| Incorporation / Formation Date | 05-Apr-2017 | 16-Oct-2017 |
| Jurisdiction | US-DE (Delaware) | Delaware (Foreign LLC registered in NY) |

The entity shows two different “dates” depending on the source: the Delaware formation date versus the New York foreign registration (authority to do business) date. This is a common structural difference, but it creates a KYC “date mismatch”
#### Reasoning
* LEI records often reflect the entity creation/formation timeline for the legal jurisdiction.
* NY records reflect the date the Delaware LLC was authorized/registered as a foreign LLC in NY, not the original formation date.
* Names align exactly across sources, supporting “date meaning difference” rather than true conflict.
#### Actions
* Option 1 — Update the KYC record to store:
  * date_of_incorporation = 05-Apr-2017 (Delaware formation) and
  * foreign_registration_date = 16-Oct-2017 (NY authority)
* Option 2 — If only one date field exists, use Delaware formation date as authoritative and log NY date as supporting evidence.
* Option 3 — Client outreach to confirm which date they want used for “incorporation date” in contracting/onboarding documents.
---
### Exception 2 of 3: Registered Address
*Exception Summary*
| Field | Source A · LEI Record | Source B . NY Dept. of State |
| :--- | :--- | :--- |
| Legal Registered Address | Corporation Trust Center, 1209 Orange St, Wilmington, DE 19801 | 28 Liberty St, New York, NY 10005 |

Different sources surface different addresses as “the Registered address”:
* LEI shows registered agent address (DE) and HQ/principal office (NY—Hudson Yards).
* NY registration highlights service of process address (28 Liberty St).
This can cause incorrect address mapping if teams populate only one address field (e.g., principal office accidentally set to registered agent or service address).
#### Reasoning
* Registered agent addresses (Delaware) are legal service addresses, not operational locations.
* NY foreign LLC records emphasize where legal process is served/mailed, which can differ from principal office.
#### Actions
* Option 1 — Save distinct fields (recommended):
  * legal_registered_address - Corporation Trust Center, 1209 Orange St, Wilmington, DE 19801
  * (DE registered agent)
* Option 2 — Client confirmation required to confirm the address.
---
### Exception 3 of 3: Principal Business Address
*Exception Summary*
| Field | Source A · LEI Record | Source B · NY Dept. of State & Bloomberg |
| :--- | :--- | :--- |
| Principal Place of Business | 55 Hudson Yards, 550 W 34th St, 48th Floor, New York, NY 10001 | 28 Liberty St, New York, NY 10005 |

Different sources surface different addresses as “the address”:
* LEI shows registered agent address (DE) and HQ/principal office (NY—Hudson Yards).
* NY registration highlights service of process address (28 Liberty St).
This can cause incorrect address mapping if teams populate only one address field (e.g., principal office accidentally set to registered agent or service address).
#### Reasoning
* Registered agent addresses (Delaware) are legal service addresses, not operational locations.
* NY foreign LLC records emphasize where legal process is served/mailed, which can differ from principal office.
#### Actions
* Option 1 — Save fields (recommended):
  * 28 Liberty St, New York, NY 10005
* Option 2 — Client confirmation required to confirm the address.
---
# Entity 4 — NRPL TRUST 2018‑2
## Case Details
| Case ID | KYC-30218 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US |
| Client Risk Rating | Low |
| Open Exceptions | 4 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | N/A | Complete |
| entity_name | NRPL TRUST 20182 | Complete |
| legal_entity_type | [See Exception Below] | Exception |
| country_of_incorporation | United States (Delaware) | Complete |
| date_of_incorporation | November 14, 2018 | Complete |
| lei_code | | Complete |
| trading_names | | Complete |
| previous_names | | Complete |
| verification_of_existence | Active (Delaware Secretary of State record) | Complete |
| us_registration_number | 7147484 | Complete |
| uk_registration_number | | Complete |
| regulator | SEC | Complete |
| listing_status | Not listed | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | | Complete |
| commodities_future_trading_commission_registered_indicator | | Complete |
| legal_registered_address | 500 Delaware Avenue, 11th Floor, Wilmington, DE 19801, USA | Complete |
| principal_place_of_business | | Complete |
| website_address | | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | [See Exception Below] | Exception |
| entity_risk_rating | | Complete |
| cip_classification | [See Exception Below] | Exception |
| entity_nature_of_business | Holds mortgage / loan assets and issues assetbacked securities (RMBS-type structure) | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | | Complete |
| other_business_activity | Mortgage foreclosure enforcement and loan servicing through trustee actions [ | Complete |
| source_of_funds | Proceeds from securitization / investor capital (ABS issuance) | Complete |
| source_of_wealth | Cash flows from underlying mortgage / loan pools | Complete |
| assets_under_management_aum | Not disclosed (pool-based securitized assets) | Complete |
| transacting_with_own_or_third_party_funds_indicator | Third-party investor funds | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | | Complete |
| acting_person | Wilmington Savings Fund Society, FSB | Complete |
| power_of_attorney | | Complete |
| sub_advisor_name | | Complete |
| key_controller | Wilmington Savings Fund Society, FSB | Complete |
| beneficial_owner | | Complete |
| list_of_subsidiaries | | Complete |
| Trustee | Wilmington Savings Fund Society, FSB | Complete |

## Exceptions
### Exception 1 of 1: CIP Classification and Legal structure
*Exception Summary*
| Field | Source A · Delaware Registry (Legal Form) | Source B · Transaction Context (Functional Role) |
| :--- | :--- | :--- |
| Legal structure | Delaware Domestic Statutory Trust | Trust used in securitization structure (trustee-administered vehicle) |
| CIP Classification | Trust (by formation) | SPV (derived from securitization function) |

NRPL TRUST 20182 is legally incorporated as a Delaware statutory trust, however its operational purpose is to function as a securitization vehicle holding loan assets and issuing securities to investors. This results in classification being recorded differently across systems — “Trust” in legal registries vs “SPV” in structured finance/KYC contexts.
#### Reasoning
* Delaware registry confirms only legal form (statutory trust) it does not classify economic purpose.
* The entity name format (“Trust YYYY X”) and absence of typical corporate attributes strongly align with asset-backed securitization vehicles.
* Presence of:
  * Trustee-based control
  * No directors/officers
  * No operating business
  * indicates non-operating structured vehicle, consistent with SPV characteristics.
  * Therefore, “SPV” is a derived classification, not a contradiction.
#### Actions
* Option 1 — Reach out to PQA for guidance
* Request PQA guidance on CIP classification for NRPL TRUST 20182 — whether the entity should be recorded strictly as a “Trust” based on legal form (Delaware statutory trust) or as an “SPV (securitization trust)” based on functional role within structured finance transactions.
---
# Entity 5 — 2005 Residential TRUST 3-1
## Case Details
| Case ID | KYC-30219 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US |
| Client Risk Rating | Low |
| Open Exceptions | 3 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | N/A | Complete |
| entity_name | 2005 Residential TRUST 3-1 | Complete |
| legal_entity_type | [See Exception Below] | Exception |
| country_of_incorporation | United States (Delaware) | Complete |
| date_of_incorporation | November 14, 2018 | Complete |
| lei_code | | Complete |
| trading_names | | Complete |
| previous_names | | Complete |
| verification_of_existence | Active (Delaware Secretary of State record) | Complete |
| us_registration_number | 6312402 | Complete |
| uk_registration_number | | Complete |
| regulator | | Complete |
| listing_status | Not listed | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | | Complete |
| commodities_future_trading_commission_registered_indicator | | Complete |
| legal_registered_address | 500 Delaware Avenue, 11th Floor, Wilmington, DE 19801, USA | Complete |
| principal_place_of_business | | Complete |
| website_address | | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | [See Exception Below] | Exception |
| entity_risk_rating | | Complete |
| cip_classification | [See Exception Below] | Exception |
| entity_nature_of_business | Holds mortgage / loan assets and issues assetbacked securities (RMBS-type structure) | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | | Complete |
| other_business_activity | | Complete |
| source_of_funds | | Complete |
| source_of_wealth | | Complete |
| assets_under_management_aum | | Complete |
| transacting_with_own_or_third_party_funds_indicator | | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | | Complete |
| acting_person | | Complete |
| power_of_attorney | | Complete |
| sub_advisor_name | | Complete |
| key_controller | | Complete |
| beneficial_owner | | Complete |
| list_of_subsidiaries | | Complete |
| Trustee | | Complete |

## Exceptions
### Exception 1 of 1: CIP Classification and Legal structure
*Exception Summary*
| Field | Source A · Delaware Registry (Legal Form) | Source B · Available Documentation |
| :--- | :--- | :--- |
| Legal structure | Delaware Domestic Statutory Trust | No supporting trust documentation available |
| CIP Classification | Trust (by formation) | Not independently validated due to lack of documents |

2005 Residential Trust 3-1 is identified as a Delaware statutory trust; however, no supporting documentation is available to validate the classification beyond registry evidence, resulting in reliance on single-source identification.
#### Reasoning
* Delaware registry confirms statutory trust status, which meets policy criteria for identification.
* Absence of trust documentation limits independent validation but does not negate registry-based classification.
#### Actions
* Option 1 — Reach out to PQA for guidance
* Request PQA guidance on CIP classification whether the entity should be recorded strictly as a “Trust” based on legal form (Delaware statutory trust)
* Option 2 – Client reach out
* Request trust agreement / formation documents for additional validation.
---
# Entity 6 — Invesco Global Equity Trust
## Case Details
| Case ID | KYC-30220 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US |
| Client Risk Rating | Low |
| Open Exceptions | 2 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | Invesco Ltd | Complete |
| entity_name | Invesco Global Equity Trust | Complete |
| legal_entity_type | Investment Trust / Unit Trust (Collective Investment Scheme) | Exception |
| country_of_incorporation | United States | Complete |
| date_of_incorporation | | Complete |
| lei_code | | Complete |
| trading_names | | Complete |
| previous_names | | Complete |
| verification_of_existence | Verified via Fund Prospectus / SEC filings | Complete |
| us_registration_number | | Complete |
| uk_registration_number | | Complete |
| regulator | U.S. Securities and Exchange Commission (SEC) | Exception |
| listing_status | | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | Yes | Complete |
| commodities_future_trading_commission_registered_indicator | No | Complete |
| legal_registered_address | | Complete |
| principal_place_of_business | | Complete |
| website_address | https://www.invesco.com | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | Financial Institution (Investment Fund) | Exception |
| entity_risk_rating | | Complete |
| cip_classification | Investment Vehicle / Trust | Exception |
| entity_nature_of_business | Global equity investment fund investing in listed equities | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | Yes | Complete |
| other_business_activity | | Complete |
| source_of_funds | Investor subscriptions | Complete |
| source_of_wealth | Investment income / capital appreciation | Complete |
| assets_under_management_aum | | Complete |
| transacting_with_own_or_third_party_funds_indicator | | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | | Complete |
| acting_person | | Complete |
| power_of_attorney | | Complete |
| sub_advisor_name | | Complete |
| key_controller | | Complete |
| beneficial_owner | | Complete |
| list_of_subsidiaries | | Complete |
| Trustee | Typically U.S. Bank / State Street | Complete |

## Exceptions
### Exception 1 of 2: CIP Classification
*Exception Summary*
| Field | Source A · External / Public Sources | Source B · Client Confirmation |
| :--- | :--- | :--- |
| Regulatory Status | Indicates SEC registered / SEC-linked entity | Confirmed as Commingled Trust (not SEC registered) |
| Entity Classification | Appears as Investment Fund (SEC regulated) | Identified as Commingled Trust (bank-regulated pooled vehicle) |

During verification, there is a discrepancy where:
* external/public sources suggest SEC registration or linkage, while
* client confirmation identifies the entity as a commingled trust, which is not SEC registered
#### Reasoning
* Commingled trusts are not registered with the SEC and are typically governed under banking regulatory frameworks (e.g., OCC)
* SEC linkage in sources likely reflects the investment manager (Invesco) rather than the trust itself
* Per policy, commingled trusts are not exchange-listed and may not have publicly available documentation, leading to source misclassification
#### Actions
* Option 1 — Auto flag and escalate to FCC
* Confirm CIP classification as: Commingled Trust vs commingled trust, to Validate correct regulatory treatment and override source-based SEC classification if required
* Option 2 – Client reach out
* Request support documentation like declaration of trust and prospectus to evidence fund;s characteristics
---
### Exception 2 of 2: Regulator
*Exception Summary*
| Field | Source A · External / Public Sources | Source B · Policy / Client Confirmation |
| :--- | :--- | :--- |
| Regulator | Identified as SEC regulated entity | Commingled trusts should be regulated under OCC / banking framework |
| Entity Classification | Appears as Investment Fund (SEC regulated) | Identified as Commingled Trust (bank-regulated pooled vehicle) |

During regulatory verification, there is a discrepancy where:
* sources indicate the entity is regulated by the SEC, while
* policy and client confirmation establish that a commingled trust should fall under OCC/banking regulation, not SEC
#### Reasoning
* Commingled trusts are not subject to SEC mutual fund regulatory requirements and are typically overseen by bank regulators (e.g., OCC)
* SEC regulatory linkage likely reflects investment manager (Invesco) oversight, not the trust structure itself
* Applying SEC regulation at entity level results in incorrect regulatory classification and downstream KYC treatment
#### Actions
* Option 1 — Auto flag and escalate to FCC
* Confirm correct regulatory authority mapping- Validate whether entity should be classified under OCC (commingled trust) vs SEC. Apply override if required to align with policy
---
# Entity 7 — Futu Trustee Limited AS Trustee of the BZL Fellows Trust
## Case Details
| Case ID | KYC-30221 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | US |
| Client Risk Rating | Low |
| Open Exceptions | 2 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | Futu Trustee Ltd on behalf of Bzl Fellows Trust | Complete |
| entity_name | FUTU TRUSTEE LIMITED AS TRUSTEE OF THE BZL FELLOWS TRUST | Exception |
| legal_entity_type | Trust | Exception |
| country_of_incorporation | Hong Kong | Complete |
| date_of_incorporation | 28-Aug-2017 | Complete |
| lei_code | | Complete |
| trading_names | | Complete |
| previous_names | | Complete |
| verification_of_existence | | Complete |
| us_registration_number | | Complete |
| uk_registration_number | | Complete |
| regulator | Hong Kong Companies Registry | Complete |
| listing_status | Not listed | Complete |
| listed_exchange | | Complete |
| entity_giin | | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | | Complete |
| commodities_future_trading_commission_registered_indicator | | Complete |
| legal_registered_address | 34/F, United Centre, 95 Queensway, Admiralty, Hong Kong | Complete |
| principal_place_of_business | | Complete |
| website_address | https://www.fututrustee.com | Complete |
| foreign_branches_details | | Complete |
| sub_advisor_address | | Complete |
| entity_classification | Trust | Exception |
| entity_risk_rating | To be determined internally | Complete |
| cip_classification | Financial Institution (Trust structure with corporate trustee) | Exception |
| entity_nature_of_business | Trust structure holding and administering assets (e.g., employee benefit, ESOP, or private wealth trust) | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | Yes | Complete |
| other_business_activity | Equity incentive trusts, family trusts, asset protection and wealth planning | Complete |
| source_of_funds | Contributions from settlor / sponsoring entity / beneficiaries | Complete |
| source_of_wealth | Investment returns, trust contributions | Complete |
| assets_under_management_aum | Not entity-specific (Trustee manages >USD 20B aggregate across clients) | Complete |
| transacting_with_own_or_third_party_funds_indicator | | Complete |
| uk_entity_tax_id_number | | Complete |
| us_entity_tax_id_number | | Complete |
| corporate_officer | | Complete |
| board_director | | Complete |
| compliance_officer_signatures_name | | Complete |
| mlro_or_equivalent_signatures_name | | Complete |
| authorized_signatory | Futu Trustee Limited | Complete |
| acting_person | Futu Trustee Limited | Complete |
| power_of_attorney | | Complete |
| sub_advisor_name | | Complete |
| key_controller | Futu Trustee Limited | Complete |
| beneficial_owner | | Complete |
| list_of_subsidiaries | Not applicable (trust structure) | Complete |
| Trustee | | Complete |

## Exceptions
### Exception 1 of 2: CIP Classification
*Exception Summary*
| Field | Source A · Client Onboarding Form | Source B · Corporate Registry / Trustee Corporate Profile |
| :--- | :--- | :--- |
| Legal Entity Name | “Futu Trustee Limited as Trustee of the BZL Fellows Trust” | “Futu Trustee Limited” |

The onboarding record captures the entity name including the trustee capacity, effectively combining two distinct constructs:
* Legal entity (Trustee company)
* Legal arrangement (Trust)
This results in non-standard naming, where “as Trustee of” is included in the entity name, instead of being captured as a relationship or role field.
#### Reasoning
* “Futu Trustee Limited” is the legal entity, while “BZL Fellows Trust” is the legal arrangement — they should not be merged into a single entity name.
* Inclusion of “as Trustee of” indicates acting capacity, not legal identity.
* Using a combined name can lead to:
  * Duplicate entity creation
  * Mismatch during screening (name won’t match registry records)
  * Downstream confusion in ownership/control mapping
#### Actions
* Option 1 — Escalate to FCC
* To confirm the entity name Pure legal entity name only, OR Capacity-based naming (with “as Trustee of”)
* Option 2 – Client reach out
* Request support documentation like declaration of trust and prospectus to confirm the entity name post FCC confirmation if needed.
---
### Exception 2 of 2: CIP Classification Ambiguity — Trust vs Trustee (FI vs Non-FI Treatment)
*Exception Summary*
| Field | Source A · Client Onboarding Form | Source B · KYC Interpretation |
| :--- | :--- | :--- |
| Entity Classification | Trust | Corporate Trustee (Financial Services Entity) |
| CIP Classification | Non-Financial Entity (Trust assumed) | Potential Financial Institution (via trustee activities) |

The entity is currently classified as a Trust, however the presence of a professional corporate trustee (Futu Trustee Limited) introduces ambiguity in CIP classification, as:
* The trust itself may be treated as non-FI
* The trustee entity may qualify as a financial services provider / TCSP
This creates uncertainty on whether:
* CIP classification should reflect the trust structure OR
* Inherit characteristics from the trustee entity
#### Reasoning
* Trusts are typically classified as non-financial entities, unless actively engaged in financial activities.
* Corporate trustees often operate under regulated trust services frameworks, creating FI-like characteristics.
* Applying trustee attributes directly to the trust can lead to:
  * Incorrect FI classification
  * Misaligned due diligence requirements
#### Actions
* Option 1 — Escalate to PQA
* Confirm classification rule: Should trust classification remain independent of trustee, Or Should trustee role influence CIP classification
---
# Entity 8 — Kettle Hill Capital Management, LLC
## Case Details
| Case ID | KYC-30222 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United States |
| Client Risk Rating | High |
| Open Exceptions | 1 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | Kettle Hill Capital LLC | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | Kettle Hill Capital Management, LLC | Complete |
| principal_place_of_business | 747 THIRD AVENUE, 19th Floor, NEW YORK, New York, 10017 | Complete |
| registration_country | United States | Complete |
| legal_registered_address | 251 LITTLE FALLS DRIVE, Wilmington, Delaware, US, 19808 | Complete |
| legal_structure | Limited Liability Company (LLC) | Complete |
| Regulator | U.S. Securities and Exchange Commission (SEC) | Complete |
| verification_of_existence | TRUE | Complete |
| commodities_future_trading_commission_registered_indicator | FALSE | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | FALSE | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | FALSE | Complete |
| sole_proprietorship_indicator | FALSE | Complete |
| us_entity_tax_id_number | 12-3456789 | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Andrew Yoichi Kurita | Complete |
| corporate_officer.role | Managing Member | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | [See Exception below] | Exception |
| corporate_officer.role | CFO | CCO | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Afroz Qadeer | Complete |
| corporate_officer.role | CFO | CCO | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |

## Exceptions
### Exception 1 of 1: Wolfsberg FCCQ Questionnaire Signature Issue
*Exception Summary — Entity 8 — Kettle Hill Capital Management, LLC*
| Field | Source A · SEC Form ADV | Source B · World Check |
| :--- | :--- | :--- |
| Name | Bryan Robert Kiss | Bryan R Kiss |
| Date of Birth | May 26, 1970 | b.1962 |
| Nationality | United States | United States |

The Corporate Officer identified on SEC Form ADV is Bryan Robert Kiss. During WorldCheck screening, an alert was generated for a separate individual, Bryan R. Kiss, who has been linked to money laundering activity. This screening hit has been escalated to the rolling review team for further assessment.
#### Reasoning
* A comparison of the WorldCheck report against SEC Form ADV identified a discrepancy in dates of birth.
* Nationalities were compared and both individuals are U.S. nationals.
* The middle names are similar.
#### Action
* Option 1 - Given the significant age difference (8 years), Bryan R Kiss (b. 1962) can be classified as a false positive match for Bryan Robert Kiss (b. 1970).
---
# Entity 9 — FEOH INVESTMENTS UK LLP
## Case Details
| Case ID | KYC-30223 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United Kingdom |
| Client Risk Rating | High |
| Open Exceptions | 2 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | Feoh Invs UK LLP | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | FEOH INVESTMENTS UK LLP | Complete |
| principal_place_of_business | 15-16 Margaret Street, 4th Floor, London, W1W 8RW, UNITED KINGDOM | Complete |
| registration_country | United Kingdom | Complete |
| legal_registered_address | 6th Floor One London Wall, London, United Kingdom, EC2Y 5EB | Complete |
| legal_structure | Limited Liability Partnership (LLP) | Complete |
| regulator | Financial Conduct Authority (FCA) | Complete |
| verification_of_existence | TRUE | Complete |
| uk_registration_number | OC428955 | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Ola Rye MALM | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Wessel Ijsbrand MEIJDAM | Complete |
| corporate_officer.role | Designated Member | CFO | Complete |
| corporate_officer.country_of_residence | Netherlands | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Joey Max FRIEDMAN | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Member | Complete |
| corporate_officer.role | Lucas Jullian Sahr | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | [See Exception below] | Exception |
| authorized_signatory.name | [See Exception below] | Exception |
| authorized_signatory.country_of_residence | [See Exception below] | Exception |
| authorized_signatory.legal_structure | [See Exception below] | Exception |
| authorized_signatory.cip_classification | [See Exception below] | Exception |
| authorized_signatory.name | [See Exception below] | Exception |
| authorized_signatory.country_of_residence | [See Exception below] | Exception |
| authorized_signatory.legal_structure | [See Exception below] | Exception |
| authorized_signatory.cip_classification | [See Exception below] | Exception |
| authorized_signatory.name | [See Exception below] | Exception |
| authorized_signatory.country_of_residence | [See Exception below] | Exception |
| authorized_signatory.legal_structure | [See Exception below] | Exception |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Ola Rye MALM | Complete |
| beneficial_owner.country_of_residence | United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 88% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Joey Max FRIEDMAN | Complete |
| beneficial_owner.country_of_residence | United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 10.0% | Exception |

## Exceptions
### Exception 1 of 2: Authorized Signatory List Missing
*Exception Summary — Entity 9 — FEOH INVESTMENTS UK LLP*
| Field | Source A · On-File ASL |
| :--- | :--- |
| Certified | Yes |
| Document Date | May 10th, 2025 |

The in-house ASL for FEOH Investments UK LLP expired less than one month ago. Outreach records indicate that third-party document certification is typically a time-consuming process for end customers. Given this, the rolling review team should rely on the existing in-house documentation and pursue approval through internal channels. This approach is supported by historical data, as 76% of similar compliance exception requests have been approved based on internal records from the past 12 months.
#### Reasoning
* Based on the one-year refresh policy on the ASL document, the in-house document has expired a month ago.
* The ASL document is certified according to the certification standards.
* It took the end customer 17 business days to certify the document in the last KYC review cycle.
#### Action
* Option 1 — Raise a compliance exception to accept the ASL document that expired less than one month ago.
* Option 2 — Request that Sales provide the data, as Sales confirmation of the ASL is an acceptable compliant alternative.
* Option 3 — Reach out to the end customer to obtain a refreshed ASL.
---
### Exception 2 of 2: Beneficial Ownership Threshold Difference
*Exception Summary — Entity 4 — FEOH INVESTMENTS UK LLP (KYC-50215)*
| Field | Source A · System generated Beneficial Ownership Threshold | Source B · Organizational Structure Document |
| :--- | :--- | :--- |
| Percentage | 10% | 9.99% |
| Beneficial Owner Name | All | Joey Max FRIEDMAN |

Based on the entity's jurisdiction and risk rating, the system-generated beneficial ownership threshold is 10%. During outreach, the end customer confirmed that Joey Max Friedman holds a 9.99% ownership stake, which falls just 0.01% below the threshold.
#### Rationale:
* The system-generated beneficial ownership threshold was compared against the organizational chart provided by the end customer.
* The variance between the ownership stake and the threshold is minimal, at 0.01%.
#### Action:
* Option 1 — Raise a compliance exception to confirm whether the principal holding 9.99% should be captured, in order to avoid case rework if the Compliance team flags it during alert review.
* Option 2 — Do not record the ownership stake, as it falls below the established threshold, with the risk of case amendment during Compliance alert review.
---
# Entity 10 — Ameritas Investment Partners, INC
## Case Details
| Case ID | KYC-30224 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United States |
| Client Risk Rating | High |
| Open Exceptions | 1 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | UNIFI Mutual Holding Co | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | Ameritas Investment Partners, INC | Complete |
| principal_place_of_business | 5945 R STREET, LINCOLN, Nebraska, United States, 68505 | Exception |
| registration_country | United States | Complete |
| legal_registered_address | 5900 O STREET, LINCOLN, Nebraska, United States, 68510 | Complete |
| legal_structure | C Corporation (C Corp) | Complete |
| regulator | U.S. Securities and Exchange Commission (SEC) | Complete |
| verification_of_existence | TRUE | Complete |
| commodities_future_trading_commission_registered_indicator | FALSE | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | TRUE | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | FALSE | Complete |
| sole_proprietorship_indicator | FALSE | Complete |
| us_entity_tax_id_number | 47-0676622 | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Suan Kay Wilkinson | Complete |
| corporate_officer.role | Executive Director | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Matthew John Knsella | Complete |
| corporate_officer.role | CCO | Vice President | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Tina Jean Udell | Complete |
| corporate_officer.role | CEO | President | Executive Director | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Michele Xiaoming Wu | Complete |
| corporate_officer.role | Executive Director | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |

## Exceptions
### Exception 1 of 1: Principal Place of Business Variance
*Exception Summary — Entity 5 — Ameritas Investment Partners, INC*
| Field | Source A · Account Opening Form | Source B · SEC Form ADV |
| :--- | :--- | :--- |
| Principal Place of Business | 5845 R STREET, LINCOLN, Nebraska, United States, 68505 | 5945 R STREET, LINCOLN, Nebraska, United States, 68505 |

The Principal Place of Business listed on the in-house Account Opening Form is 5845 R Street, Lincoln, Nebraska 68505, United States, whereas the latest SEC Form ADV records the Principal Place of Business as 5945 R Street, Lincoln, Nebraska 68505, United States. The Rolling Review Team is requested to review this discrepancy.
#### Reasoning
* A comparison between the Account Opening Form and the SEC Form ADV identified a variance in the Principal Place of Business.
* The Account Opening Form was completed by hand.
* The discrepancy involves only a single digit in the street number (5845 vs. 5945).
#### Action
* Option 1: The Rolling Review Analyst to validate the Account Opening Form, as the discrepancy may have resulted from a handwriting or OCR error.
* Option 2: If the handwritten address is confirmed to be accurate and genuinely inconsistent with the SEC Form ADV, the Rolling Review Analyst to verify whether the client has relocated from the prior address.
---
# Entity 11 — Brevan Howard Capital Management LP
## Case Details
| Case ID | KYC-30225 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United Kingdom |
| Client Risk Rating | High |
| Open Exceptions | 1 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | Brevan Howard Group Holdings Ltd | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | Brevan Howard Capital Management LP | Complete |
| principal_place_of_business | 15-16 Margaret Street, 4th Floor, London, W1W 8RW, UNITED KINGDOM | Complete |
| registration_country | United Kingdom | Complete |
| legal_registered_address | 6th Floor One London Wall, London, United Kingdom, EC2Y 5EB | Complete |
| legal_structure | Limited Liability Partnership (LLP) | Complete |
| regulator | Financial Conduct Authority (FCA) | Complete |
| verification_of_existence | TRUE | Complete |
| uk_registration_number | OC428955 | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Ola Rye MALM | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Wessel Ijsbrand MEIJDAM | Complete |
| corporate_officer.role | Designated Member | CFO | Complete |
| corporate_officer.country_of_residence | Netherlands | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Joey Max FRIEDMAN | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | Member | Complete |
| corporate_officer.role | Lucas Jullian Sahr | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Ola Rye MALM | Complete |
| authorized_signatory.country_of_residence | United Kingdom | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Wessel IJsbrand Meijdam | Complete |
| authorized_signatory.country_of_residence | Netherlands | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Joey Max Friedman | Complete |
| authorized_signatory.country_of_residence | United Kingdom | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | James William Edward Vernon | Complete |
| authorized_signatory.country_of_residence | Jersey, Channel Islands | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Prasath Sithamparanathan | Complete |
| authorized_signatory.country_of_residence | Jersey, Channel Islands | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Jonathan Paul Hughes | Complete |
| authorized_signatory.country_of_residence | Jersey, Channel Islands | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Reamonn O'Sullivan | Complete |
| authorized_signatory.country_of_residence | Jersey, Channel Islands | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| beneficial_owner.cip_classification | Individual | Complete |
| | | |
| beneficial_owner.type | Individual | Complete |
| | | |
| beneficial_owner.name | Ola Rye MALM | Complete |
| beneficial_owner.country_of_residence | United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 88% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Joey Max FRIEDMAN | Complete |
| beneficial_owner.country_of_residence | United E | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 9.99% | Complete |
| beneficial_owner.cip_classification | Unresolved Exception | Exception |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | Alta L.P. | Complete |
| beneficial_owner.address | 6th Floor, 37 Esplanade, St. Helier, JE2 3QA, Jersey | Complete |
| beneficial_owner.legal_structure | Limited Partnership (LP) | Complete |
| beneficial_owner.percentage_of_ownership | [See Exception Below] | Exception |
| beneficial_owner.country_of_incorporation | Jersey, Channel Islands | Complete |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Alan Eldad Howard | Complete |
| beneficial_owner.country_of_residence | London, United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | Exception to be Resolved | Complete |

## Exceptions
### Exception 1 of 1: Non-Exact Beneficial Ownership Percentage
*Exception Summary - Brevan Howard Capital Management LP*
| | Source A · SEC Form ADV | Source B · Org Structure Doc |
| :--- | :--- | :--- |
| BO Percentage | >75% owned by Alta LP, which is further 75% or more owned by Alan Eldad Howard | 1. Same structure captured except for the structure glossary specifying that all ownership interests are 100%, unless otherwise stated. |
| Collection Date | May 8th, 2026 | November 8th, 2022 |

#### Reasoning
The SEC Form ADV, dated May 8th, 2026, shows a different BO threshold compared to the org chart collected in 2022. Recording the higher threshold would normally require client outreach under current guidance; however, given the client’s known sensitivity and refusal to corporate further during the last outreach cycle, this outreach cannot be completed. Considering the consistency between the SEC Form ADV and the on-file org chart, the rolling review team should seek internal confirmation to complete the task.
* Pulled the SEC Form ADV dated May 8th to check for the BO percentage
* Compared the SEC Form ADV with the in-house Org Chart
#### Actions
* Option 1 – Seek confirmation from the internal Guidance SME team to record the higher threshold (100%) given the consistency between the IAPD and the on-file org chart.
* Option 2 – Engage Sales to share the outstanding requirements and request their assistance in connecting with the client.
---
# Entity 12 — Brevan Howard US Investment Management LP
## Case Details
| Case ID | KYC-30226 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United Kingdom | United States |
| Client Risk Rating | Medium |
| Open Exceptions | 1 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | Brevan Howard Group Holdings Ltd | Complete |
| entity_risk_rating | Medium | Complete |
| entity_jurisdiction | United States | United Kingdom |
| | | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | Brevan Howard US Investment Management LP | Complete |
| principal_place_of_business | 1345 Avenue of the Americas, 20th Floor, New York, New York, 10105 | Complete |
| registration_country | United States | Complete |
| legal_registered_address | CORPORATION TRUST CENTER 1209 ORANGE STREET, WILMINGTON, DE, US, 19801 | Complete |
| legal_structure | Limited Partnership (LP) | Complete |
| regulator | U.S. Securities and Exchange Commission (SEC) | Complete |
| verification_of_existence | TRUE | Complete |
| commodities_future_trading_commission_registered_indicator | FALSE | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | FALSE | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | FALSE | Complete |
| sole_proprietorship_indicator | FALSE | Complete |
| transacting_with_own_or_third_party_funds_indicator | Third Party Funds | Complete |
| source_of_wealth | Financial Services / Products | Complete |
| us_entity_tax_id_number | 80-0811470 | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | ADAM JOSEPH GIBBONS | Complete |
| corporate_officer.role | CEO | Complete |
| corporate_officer.correspondence_address | 1345 Avenue of the Americas, 20th Floor, New York, New York, 10105 | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.entity_classification | Private Operating Company | Complete |
| corporate_officer.name | BH GP LLC | Complete |
| corporate_officer.role | Entity | Complete |
| corporate_officer.legal_structure | Limited Liability Company (LLC) | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | BHUS Holdings LLC | Complete |
| beneficial_owner.legal_structure | Limited Liability Company (LLC) | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.country_of_incorporation | United States | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | Brevan Howard Asset Management Services LTD | Complete |
| beneficial_owner.legal_structure | (CO) Company | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.country_of_incorporation | United States | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | Brevan Howard Investment Holdings Limited | Complete |
| beneficial_owner.legal_structure | (CO) Company | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.country_of_incorporation | United States | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | Brevan Howard Capital Management LP | Complete |
| beneficial_owner.legal_structure | (CO) Company | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.country_of_incorporation | United States | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| | | |
| beneficial_owner.type | Entity | Complete |
| | | |
| beneficial_owner.name | Brevan Howard Capital Management LP | Complete |
| beneficial_owner.legal_structure | (CO) Company | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |
| beneficial_owner.country_of_incorporation | United States | Complete |
| beneficial_owner.cip_classification | Private Operating Company | Complete |
| beneficial_owner.type | Entity | Complete |
| beneficial_owner.name | Alta L.P. | Complete |
| beneficial_owner.address | 6th Floor, 37 Esplanade, St. Helier, JE2 3QA, Jersey | Complete |
| beneficial_owner.legal_structure | Limited Partnership (LP) | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.country_of_incorporation | Jersey, Channel Islands | Complete |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Alan Eldad Howard | Complete |
| beneficial_owner.country_of_residence | London, United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | ADAM JOSEPH GIBBONS | Complete |
| authorized_signatory.country_of_residence | United Kingdom | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Johnathan Huges | Complete |
| authorized_signatory.country_of_residence | United Kingdom | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| authorized_signatory.cip_classification | Individual | Complete |
| authorized_signatory.name | Christopher Dixton | Complete |
| authorized_signatory.country_of_residence | United Kingdom | Complete |
| authorized_signatory.legal_structure | Individual | Complete |
| wolfsberg_fccq_Indicator | [See Exception below] | Exception |

## Exceptions
### Exception 1 of 1: Outstanding Wolfsberg Questionnaire
*Exception Summary - Brevan Howard Capital Management LP*
| Field | Source A · Brevan Howard Capital Management LLP | Source B · Brevan Howard Capital Management Ltd |
| :--- | :--- | :--- |
| Wolfsberg Questionnaire | Missing | Wolfsberg Questionnaire dated May 25, 2025 provided by Client during outreach |
| DRG | Brevan Howard Group Holdings Ltd | Brevan Howard Group Holdings Ltd |
| Client Pushback | Yes | Yes |

#### Reasoning
Given the client’s known sensitivity and refusal to cooperate further during the last outreach cycle, the Wolfsberg Questionnaire for “Brevan Howard Capital Management LLP” remains outstanding. The rolling review team should leverage available internal sources as far as possible to satisfy the WBQ requirement and to help rebuild the client relationship.
* A Wolfsberg Questionnaire is available for the general partner, “Brevan Howard Capital Management Ltd” of “Brevan Howard Capital Management LLP”.
* Both “Brevan Howard Capital Management Limited” and “Brevan Howard Capital Management LLP” are registered in Jersey.
* “Brevan Howard Capital Management Ltd” and “Brevan Howard Capital Management LLP” sit under the same DRG, “Brevan Howard Group Holdings Ltd”.
#### Actions
* Option 1 – Request an exception from the Compliance team to satisfy the WBQ requirement for Brevan Howard Capital Management LLP using the WBQ on file for Brevan Howard Capital management Ltd.
* Option 2 – Engage Sales to share the outstanding requirements and request their assistance in connecting with the client.
---
# Entity 13 — Australiansuper RAAD Trust
## Case Details
| Case ID | KYC-30227 |
| :--- | :--- |
| Entity Type | Trust |
| Jurisdiction | United States |
| Client Risk Rating | Low |
| Open Exceptions | 1 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | AustralianSuper Pty Ltd - Melbourne | Complete |
| entity_name | AustralianSuper RAAD Trust | Complete |
| legal_entity_type | TRUST | Complete |
| country_of_incorporation | Australia | Complete |
| date_of_incorporation | null | Complete |
| lei_code | null | Complete |
| trading_names | n/a | Complete |
| previous_names | null | Complete |
| verification_of_existence | TRUE | Complete |
| us_registration_number | null | Complete |
| uk_registration_number | n/a | Complete |
| regulator | Australian Prudential Regulatory Authority (APRA), Australian Securities and Investment Commission (ASIC) | Complete |
| listing_status | FALSE | Complete |
| listed_exchange | null | Complete |
| entity_giin | null | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | null | Complete |
| commodities_future_trading_commission_registered_indicator | null | Complete |
| legal_registered_address | null | Complete |
| principal_place_of_business | Australiansuper RAAD PTY LTD Acting as IA, Level 30, 130 Lonsdale Street, Melbourne, AU4, 3000 | Complete |
| website_address | null | Complete |
| foreign_branches_details | null | Complete |
| sub_advisor_address | null | Complete |
| entity_classification | Trust or family foundation | Complete |
| entity_nature_of_business | null | Complete |
| sole_proprietorship_indicator | null | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | null | Complete |
| other_business_activity | n/a | Complete |
| source_of_funds | Intercompany loans or capital injections | Complete |
| source_of_wealth | Real Estate, Rental and Leasing | Complete |
| assets_under_management_aum | null | Complete |
| transacting_with_own_or_third_party_funds_indicator | null | Complete |
| uk_entity_tax_id_number | null | Complete |
| us_entity_tax_id_number | null | Complete |
| corporate_officer.entity_classification | Individual | Complete |
| corporate_officer.name | David Dubrovsky | Complete |
| corporate_officer.role | Director | Complete |
| corporate_officer.country_of_residence | United States | Complete |
| corporate_officer.legal_structure | Individual | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| sub_advisor_name | [See Exeption below] | Complete |
| key_controller | null | Complete |
| beneficial_owner | Null | Complete |
| list_of_subsidiaries | N/A | Complete |
| trustee | AustralianSuper RAAD Pty Ltd | Complete |

## Exceptions
### Exception 1 of 1: Unable to Complete Sub Advisor Task
*Exception Summary – Australiansuper RAAD Trust*
| Field | Source A · Client Response | Source B · System Generated Requirements |
| :--- | :--- | :--- |
| Beneficial Owner | N/A | Required |

#### Reasoning:
* Per the client's response: "There is no sub-advisor of Australiansuper RAAD Trust."
* The sub-advisor task is being flagged as mandatory based on the entity's jurisdiction and risk rating.
* The Rolling Review team is unable to satisfy this requirement because no sub-advisor exists for this entity.
#### Actions:
* Option 1: The Rolling Review team to confirm the applicable jurisdiction and active accounts, then reach out to Compliance to request removal of this requirement.
---
# Entity 14 — Citigroup Mortgage Loan Trust 2019-B
## Case Details
| Case ID | KYC-30228 |
| :--- | :--- |
| Entity Type | Trust |
| Jurisdiction | United States |
| Client Risk Rating | Low |
| Open Exceptions | 2 |

## Attribute Coverage
| Attribute | Value | Status |
| :--- | :--- | :--- |
| drg_name | N/A | Complete |
| entity_name | Citigroup Mortgage Loan Trust 2019-B | Complete |
| legal_entity_type | TRUST | Complete |
| country_of_incorporation | United States | Complete |
| date_of_incorporation | 17-Jun-19 | Complete |
| lei_code | null | Complete |
| trading_names | n/a | Complete |
| previous_names | null | Complete |
| verification_of_existence | TRUST | Complete |
| us_registration_number | null | Complete |
| uk_registration_number | null | Complete |
| regulator | U.S. Securities and Exchange Commission (SEC) | Complete |
| listing_status | FALSE | Complete |
| listed_exchange | n/a | Complete |
| entity_giin | null | Complete |
| securities_exchange_act_of_1934_section_13_or_15d_indicator | Yes | Complete |
| commodities_future_trading_commission_registered_indicator | No | Complete |
| legal_registered_address | Corporation Trust Center, 1209 Orange Street, Wilmington, DE 19801, USA | Complete |
| principal_place_of_business | 390 Greenwich Street, New York, NY 10013, USA | Complete |
| website_address | null | Complete |
| foreign_branches_details | n/a | Complete |
| sub_advisor_address | n/a | Complete |
| entity_risk_rating | null | Complete |
| entity_nature_of_business | n/a | Complete |
| sole_proprietorship_indicator | No | Complete |
| parent_public_ally_listed_on_us_exchange_indicator | null | Complete |
| other_business_activity | n/a | Complete |
| source_of_funds | Proceeds from bond or equity issuances | Complete |
| source_of_wealth | null | Complete |
| assets_under_management_aum | null | Complete |
| transacting_with_own_or_third_party_funds_indicator | Own Funds | Complete |
| uk_entity_tax_id_number | n/a | Complete |
| us_entity_tax_id_number | null | Complete |
| board_director | n/a | Complete |
| compliance_officer_signatures_name | null | Complete |
| mlro_or_equivalent_signatures_name | n/a | Complete |
| authorized_signatory | [See Exception Below] | Exception |
| acting_person | n/a | Complete |
| power_of_attorney | null | Complete |
| sub_advisor_name | n/a | Complete |
| key_controller | Citigroup Mortgage Loan Trust Inc. | Complete |
| corporate_officer | [See Exception Below] | Exception |
| list_of_subsidiaries | null | Complete |
| trustee | null | Complete |

## Exceptions
### Exception 1 of 2: Deceased Individual – Corporate Officer
*Exception Summary — Entity 14 — Citigroup Mortgage Loan Trust 2019-B (KYC-30228)*
*Exception Summary – Australiansuper RAAD Trust (KYC-90215)*
| Field | Source A · Public Records | Source B · Account Opening Form |
| :--- | :--- | :--- |
| Verification of Existence | FALSE | TRUE |

Sulluman S. Olyayan is identified as a corporate officer on the Account Opening Form provided by the end customer. However, because the individual is high-profile, public records were available for review and indicate that he is deceased. The rolling review team needs to review this discrepancy.
#### Reasoning:
* Searched public records and compared them against the Account Opening Form provided by the client.
* Public records indicate that Sulluman S. Olyayan is deceased; therefore, he can no longer serve as a corporate officer of the AustralianSuper RAAD Trust.
#### Action:
* Option 1: Outreach is required to obtain an updated list of corporate officers from the client. The rolling review team should be mindful of tone given the sensitivity of the situation. In addition, Rolling Review team needs to escalate to Compliance immediately to confirm the appropriate handling protocol, particularly if the accounts have had recent activity authorized under the deceased individual's name.
---
### Exception 2 of 2: Deceased Individual – Authorized Signatory List
*Exception Summary – Australiansuper RAAD Trust (KYC-90215)*
| Field | Source A · Public Records | Source B · Account Opening Form |
| :--- | :--- | :--- |
| Verification of Existence | FALSE | TRUE |

#### Summary:
Sulluman S. Olyayan is identified as an authorized signor on the Account Opening Form provided by the end customer. However, because the individual is high-profile, public records were available for review and indicate that he is deceased. The rolling review team needs to review this discrepancy.
#### Reasoning:
* Searched public records and compared them against the Account Opening Form provided by the client.
* Public records indicate that Sulluman S. Olyayan is deceased; therefore, he can no longer serve as an authorized signor of the AustralianSuper RAAD Trust.
#### Action:
* Option 1: Outreach is required to obtain an updated list of corporate officers from the client. The rolling review team should be mindful of tone given the sensitivity of the situation. In addition, Rolling Review team needs to escalate to Compliance immediately to confirm the appropriate handling protocol, particularly if the accounts have had recent activity authorized under the deceased individual's name.
---
# Entity 15 — Brevan Howard Asset Management LLP
## Case Details
| Case ID | KYC-30229 |
| :--- | :--- |
| Entity Type | Registered Investment Adviser (RIA) |
| Jurisdiction | United Kingdom |
| Client Risk Rating | High |
| Open Exceptions | 1 |

## Attribute Coverage
| Attributes | Value | Status |
| :--- | :--- | :--- |
| drg_name | Brevan Howard Group Holdings Ltd | Complete |
| cip_classification | Registered Investment Advisor or Commodity Trading Advisor | Complete |
| entity_name | Brevan Howard Asset Management LLP | Complete |
| principal_place_of_business | 82 Baker Street, London, W1U 6AE, United Kingdom | Complete |
| registration_country | United Kingdom | Complete |
| legal_registered_address | 4th Floor, Reading Bridge House, George Street, Reading, Berkshire, RG1 8LS, United Kingdom | Complete |
| legal_structure | Limited Liability Partnership (LLP) | Complete |
| regulator | Financial Conduct Authority (FCA) | Complete |
| verification_of_existence | TRUE | Complete |
| uk_registration_number | OC302636 | Complete |
| corporate_officer.entity_classification | Entity | Complete |
| corporate_officer.name | Brevan Howard Partnership Holdings Limited | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | Jersey, Channel Islands | Complete |
| corporate_officer.evidence_of_existence | TRUE | Complete |
| corporate_officer.legal_structure | Limited Company | Complete |
| corporate_officer.entity_classification | Entity | Complete |
| corporate_officer.name | Brevan Howard Asset Management Services Limited | Complete |
| corporate_officer.role | Designated Member | Complete |
| corporate_officer.country_of_residence | United Kingdom | Complete |
| corporate_officer.legal_structure | Private Limited Company | Complete |
| authorized_signatory.cip_classification | [See Exception Details] | Exception |
| authorized_signatory.name | [See Exception Details] | Exception |
| authorized_signatory.country_of_residence | [See Exception Details] | Exception |
| authorized_signatory.legal_structure | [See Exception Details] | Exception |
| beneficial_owner.cip_classification | Individual | Complete |
| beneficial_owner.type | Individual | Complete |
| beneficial_owner.name | Alan Eldad Howard | Complete |
| beneficial_owner.country_of_residence | England, United Kingdom | Complete |
| beneficial_owner.legal_structure | Individual | Complete |
| beneficial_owner.percentage_of_ownership | 100% | Complete |
| beneficial_owner.evidence_of_existence | TRUE | Complete |

## Exceptions
### Exception 1 of 1: Expired Authorized Signors List
*Exception Summary — Entity 15 — Brevan Howard Asset Management LLP (KYC-30229)*
*Exception Summary - Brevan Howard Asset Management LLP*
| | Source A · In-House ASL |
| :--- | :--- |
| Collection Date | February 1st, 2025 |

The in-house ASL expired on February 1st, 2025. Due to the risk rating and jurisdiction of Brevan Howard Asset Management LLP, the ASL is required to be refreshed on an annual basis. As the ASL is not available through public sources, the rolling review team will need to review the expired document and re-obtain a certified ASL directly from Brevan Howard Asset Management LLP.
#### Reasoning
* Searched all in-house documentation; the most recent ASL on file was collected on 2/1/2025.
* Internal guidance requires this document to be refreshed annually. As a result, the document has now expired.
#### Actions
* Option 1 – Client outreach: Outreach to the client is required to obtain the latest ASL. The rolling review analyst should provide the specific certification language up front to avoid unnecessary back-and-forth during the outreach process. Based on historical outreach records, more than 62% of ASL-related client outreach results in multiple reach-outs, as the certification completed by the end customer often does not meet our internal guidance.


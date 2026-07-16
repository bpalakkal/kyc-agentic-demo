---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "regulator"
governs_attributes: ["regulator", "registration_number", "fca_firm_reference_number"]
version: "1.0"
---

# Regulator — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| SEC registration status shown as "Approved"; Form ADV access | US | Primary | SEC Investment Adviser Public Disclosure (IAPD) — https://adviserinfo.sec.gov |
| Broker-Dealer registration | US | Primary | FINRA BrokerCheck — https://brokercheck.finra.org |
| NFA membership and registration category (CTA, CPO, Swap Firm, etc.) | US | Primary | NFA BASIC — https://www.nfa.futures.org/basicnet |
| Regulatory status (Authorized, EEA Authorized, Registered for AML, Appointed Representative) | UK | Primary | FCA Register — https://register.fca.org.uk |
| Regulatory status | HK | Primary | SFC — https://www.sfc.hk |
| Regulatory status | HK | Primary | HKMA — https://www.hkma.gov.hk |
| Regulatory status | Singapore | Primary | MAS — https://www.mas.gov.sg |
| Regulatory status | Australia | Primary | ASIC — https://asic.gov.au |
| Provincial regulation confirmation | Canada | Primary | Canadian Securities Administrators (CSA) |
| Regulatory licensing status | Cayman Islands | Primary | Cayman Islands Monetary Authority (CIMA) — https://www.cima.ky |
| Confirmation of future regulation where public proof is unavailable | Global | Primary | Regulatory approval letter (entity specific) |
| Evidence of Relying Adviser status under Scenario A or B | US | Primary | Form ADV (including Schedule R / Schedule D) |
| Supporting regulatory context | Global | Secondary | Company Registry Extract (jurisdiction specific) |
| Confirmation of regulated activities | Global | Secondary | Audited Annual Report (entity specific) |
| Regulatory profile | Global | Secondary | Bloomberg — https://www.bloomberg.com/professional |
| Supporting evidence only where Identify is permitted | Global | Secondary | Client written confirmation (client provided) |

## Decision Logic
- **REG_001** — IF an entity has an Approved registration status with the SEC or a relevant state regulator THEN it is considered Registered / Regulated.
- **REG_002** — IF an entity has Relying Adviser status with the SEC THEN it may be treated as registered provided either it is listed on Schedule R of the Filing Adviser's Form ADV, or both conditions under Scenario B are met (the Filing Adviser's Schedule D confirms a single ADV filing AND a separate Section 1.B of Schedule D is submitted for the Relying Adviser); in such cases scan the Filing Adviser's Form ADV and Schedule 1.B together as evidence.
- **REG_003** — IF the regulator does not provide a Registration Number and the field is mandatory THEN escalate to the regional champion to raise a JIRA for Tech and enter "NA" in the Registration Number field to complete the task. IF the entity is regulated by the FCA THEN Authorized, EEA Authorized, Registered (supervised for AML), and Appointed Representative (with a completed representation letter from an FCA-authorized firm) are considered approved statuses.
- **REG_004** — IF regulation is by the Insurance Companies Control Service of Cyprus THEN this is acceptable only for Cyprus entities; all non-Cyprus entities must be treated as unregulated.
- **REG_005** — IF the entity is regulated by the NFA and its status is Swap Firm Approved, NFA Member Approved, Commodity Pool Operator Registered, or Commodity Trading Advisor Registered THEN it is considered regulated regardless of other statuses.
- **REG_006** — IF the entity is an Exempt Commodity Trading Advisor or Exempt Commodity Pool Operator THEN it is not considered regulated unless the applicable exemption fields (4.14(a)(8) or 4.13(a)(5) respectively) are explicitly present.
- **REG_007** — IF the entity is registered as an Introducing Broker, Futures Commission Merchant, Swap Dealer, or Forex Dealer Member … _[source guidance truncated at this point — to be completed]_

## Validation Rules
> _Not specified in source guidance (section truncated) — to be completed._

## Outputs
| Output Field | Value / Mapping |
|---|---|
| regulator | Regulator(s) (mapped to master $defs.Regulator) and approved status |
| registration_number | Registration number, or "NA" per REG_003 |
| fca_firm_reference_number | FCA FRN where the entity is FCA-regulated |
| evidence_source | Source name + date accessed |

**Escalation:** Per REG_003, where a mandatory Registration Number is unavailable, escalate to the regional champion to raise a JIRA for Tech before entering "NA".

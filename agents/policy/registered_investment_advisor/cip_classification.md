---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "cip_classification"
governs_attributes: ["cip_classification", "entity_nature_of_business"]
version: "1.0"
---

# CIP Classification — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Entity legal name, form of organization and stated business activity used to understand nature of business | Jurisdiction specific | Primary | Company Registry Extract |
| SEC registration status displayed as "Investment Adviser"; Form ADV confirming RIA status | USA | Primary | Regulator Website (SEC IAPD) |
| Schedule R confirms Relying Adviser status; Schedule D supports single ADV filing / Section 1.B | USA | Primary | Form ADV (incl. Schedule R / Schedule D) |
| NFA registration category (CTA/CPO Registered, Swap Firm Approved) or exemption fields 4.14(a)(8) / 4.13(a)(5) | USA | Primary | NFA BASIC |
| Broker-Dealer registration status; identifies Reg BD where dual RIA / BD exists | USA | Primary | FINRA BrokerCheck |
| Authorization / registration status, incl. Authorized or Appointed Representative | UK | Primary | FCA Register |
| Regulated activity and licensing status confirming regulated advisory activity | Hong Kong | Primary | SFC Register |
| Authorization / supervision status confirming regulated financial activity | Hong Kong | Primary | HKMA Register |
| Licensing / registration confirming regulated advisory or fund management activity | Singapore | Primary | MAS Register |
| AFSL or Authorized Representative status evidencing regulated advisory activity | Australia | Primary | ASIC Register (AFSL) |
| Client registration / enrolment (supporting ASIC authorized representative scenario) | Australia | Primary | AUSTRAC Register |
| Licensing status; entities registered only as "Securities – Registered Person" identified as not regulated | Cayman Islands | Primary | Cayman Islands Monetary Authority (CIMA) |
| Official confirmation of pending / future regulation supporting temporary exception cases | Global | Primary | Regulatory Approval / Confirmation Letter |
| Stated nature of business | Global | Secondary | Client Website |
| Stated nature of business | Global | Secondary | Bloomberg |
| Nature-of-business confirmation (supporting) | Global | Secondary | Client confirmation on nature of business |

## Decision Logic
- **CIP_001** — IF a client is both a Registered Investment Advisor (RIA) and a Registered Broker Dealer (Reg BD) THEN the CIP class of Reg BD must be used (higher policy requirement).
- **CIP_002** — IF an entity shows SEC registration as an Investment Advisor THEN it may be treated as a Registered Investment Advisor.
- **CIP_003** — IF an entity has SEC Relying Adviser status THEN it can be considered SEC-registered only where listed on Schedule R (umbrella registration) OR Schedule D confirms a single ADV filing AND a separate Section 1.B of Schedule D is submitted for the Relying Adviser (both documents scanned together as proof).
- **CIP_004** — IF an entity holds NFA status of Swap Firm Approved, NFA Member Approved, Commodity Pool Operator Registered, or Commodity Trading Advisor Registered THEN it is considered regulated regardless of other statuses.
- **CIP_005** — IF an entity is an Exempt Commodity Trading Advisor THEN it is not regulated unless it has Firm Exemption 4.14(a)(8).
- **CIP_006** — IF an entity is an Exempt Commodity Pool Operator THEN it is not regulated unless it has Firm Exemption 4.13(a)(5).
- **CIP_007** — IF an entity is registered as an Introducing Broker, Futures Commission Merchant, Swap Dealer, or Forex Dealer Member THEN classify it as a Broker Dealer.
- **CIP_008** — IF an entity holds SEC 120-day approved status THEN grant a temporary exception treating it as RIA for CIP purposes and exempt from the CDD Rule.
- **CIP_009** — IF an entity holds NFA Member Pending status (45-day approval) THEN grant a temporary exception treating it as RIA for CIP purposes and exempt from the CDD Rule.
- **CIP_010** — IF the entity is UK-based with FCA Appointed Representative status THEN treat as approved only where a completed representation letter from an FCA-authorized firm is received.
- **CIP_011** — IF an entity is regulated by the FCA THEN the following are approved statuses: Authorized, EEA Authorized, Registered (supervised for AML), and Appointed Representative (with representation letter).
- **CIP_012** — IF regulation is by the Insurance Companies Control Service of Cyprus THEN acceptable only for Cyprus-domiciled entities; non-Cyprus entities are treated as unregulated.
- **CIP_013** — IF an entity is dual-regulated THEN the regulator of the country of organization is the main regulator and others are sub-regulators.
- **CIP_014** — IF regulation proof is unavailable on public sources but an official regulator letter confirms future regulation THEN that letter may be accepted as evidence.
- **CIP_015** — IF the regulator does not issue a Registration Number and the system requires one THEN escalate to the regional champion to raise a JIRA to Tech and enter "NA" in the Registration Number field.
- **CIP_016** — IF none of the approved scenarios apply THEN the entity must be treated as unregulated per GS policy.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Regulatory status evidenced via official regulator website | None | Do not validate without regulator proof |
| Schedule R / Schedule D conditions satisfied | All conditions met | Do not classify as RIA if incomplete |
| NFA status validated (if applicable) | None | Do not treat as regulated if required NFA category/exemption not evidenced |
| Temporary exception documented | Expiry date recorded | Escalate if missing |
| Evidence recency | Screenprint ≤ 1 month old | Refresh evidence |
| Dual classification check completed (RIA + Reg BD) | None | If both apply, must classify as Reg BD |
| Exempt CTA / Exempt CPO exemption codes checked | Only if 4.14(a)(8) / 4.13(a)(5) explicitly present | Treat as not regulated if missing |
| Relying Adviser evidence meets Scenario A or B | Must satisfy Scenario A OR B | Do not treat as registered if incomplete |
| FCA "Appointed Representative" status | Representation letter required | Do not accept as approved status without letter |
| Temporary exception cases (SEC 120 / NFA 45) | Expiry recorded and revalidation noted | Escalate / do not apply temporary treatment if expiry not captured |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| cip_classification | CIP class (mapped to master $defs.CIPClassification), e.g. "Registered Investment Advisor or Commodity Trading Advisor" |
| entity_nature_of_business | Stated nature of business derived from registry / regulator evidence |
| evidence_source | Source name + date accessed |

**Escalation:** If the regulator issues no Registration Number, escalate to the regional champion (JIRA to Tech). If no approved regulatory scenario can be evidenced, treat as unregulated per GS policy and escalate to FCC where a temporary-exception letter is relied upon.

<!-- NOTE: CIP Classification is a general (entity-type-agnostic) policy. Compiled here from the RIA consolidated guidance; may be relocated to a shared/general policy path. -->

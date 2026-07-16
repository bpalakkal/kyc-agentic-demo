---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "beneficial_owner"
governs_attributes: ["beneficial_owner_address", "beneficial_owner_cip_classification", "beneficial_owner_country_of_incorporation", "beneficial_owner_country_of_residence", "beneficial_owner_date_of_birth", "beneficial_owner_evidence_of_existence", "beneficial_owner_legal_structure", "beneficial_owner_name", "beneficial_owner_nationality", "beneficial_owner_nature_of_business", "beneficial_owner_past_nationality", "beneficial_owner_percentage_of_ownership", "beneficial_owner_source_of_wealth"]
version: "1.0"
---

# Beneficial Owner — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Listed as Shareholder Name, Number of Shares, % Ownership in share register or certificates | Global | Primary | Share Register / Share Certificate |
| Partners / Members listed under Capital Contributions, Ownership Interests, or Members and Percentages | Global | Primary | LP / LLC Agreement |
| Organization chart showing individuals/entities with ownership percentages and control lines | Global | Primary | Certified Organization Chart (Licensed Individual) |
| Organization chart signed or emailed by authorized signatory showing ownership structure | UK, DE, HK | Primary | Organization Chart signed by authorized signatory / Vorstand |
| Organization chart certified by General Counsel / Director / Head of Compliance or Company Secretary | UK, HK | Primary | Certified Org Chart (GC / Director / HoC / Company Secretary) |
| Ownership / shareholders disclosed in Notes to Financial Statements or Shareholding Structure section | Global | Primary | Audited Annual Report (with % defined) |
| Grantor / Settlor / Trustee / Beneficiary names stated in trust deed provisions or trustee confirmation | Global | Primary | Trust Deed / Trustee Letter |
| Law firm letter stating ownership structure and naming beneficial owners | Global | Primary | Law Firm Certification / Representation Letter |
| Shareholders listed under Members / Shareholders section with effective date | Global | Primary | Certificate of Incumbency (< 6 months) |
| Ownership rights and shareholders defined in articles, ROM, or equivalent sections | Global | Primary | Constitutional Documents (ROM / AoA etc. < 6 months) |
| Shareholders listed under Shareholding, Members, or Ownership section of registry | Global | Primary | Company Registry Extract (< 6 months) |
| Management company ownership as shown in CNMV registry records | Spain (Global clients) | Primary | CNMV Registry Extract |
| Ownership / control details displayed in regulatory filings or disclosures | US, UK, HK, DE, Global | Primary / Secondary | Government / Regulator Website |
| Entity shown as Listed on recognized exchange index or issuer profile | UK, DE | Primary | Recognized Stock Exchange Proof of Listing |
| Ownership table showing Beneficial Owner Name and % Shares Outstanding | Global | Primary | Bloomberg Terminal (with % ownership) |
| Shareholding disclosures showing holders exceeding reporting thresholds | US, UK, DE | Primary | Stock Exchange Websites (with threshold %) |

## Decision Logic
<!-- Convention-based baseline (dd-guidance-reader standard corroboration). To be refined by the team. -->
- **BO_001** — IF capturing a beneficial owner record THEN, for each child attribute, record the value evidenced by the ranked Sources.
- **BO_002** — Apply the standard corroboration convention per attribute: a single Primary source stands alone; absent any Primary, at least two independent Secondary sources must agree.
- **BO_003** — IF the beneficial owner is an entity THEN individual-only attributes (date_of_birth, nationality, past_nationality) may be recorded as "N/A".
- **BO_004** — IF ownership evidence discloses a percentage THEN record beneficial_owner_percentage_of_ownership from that ownership source.
- **BO_005** — IF the task is already greened out (id_flag / verification_flag = Yes) for an attribute THEN do not update it.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Each attribute value evidenced by a ranked source | Primary stands alone; else ≥2 independent Secondary agree | Do not validate without a qualifying source |
| Ownership percentage consistent with the ownership evidence | Exact / disclosed band | Flag and remediate |
| Verification uses a source independent of id_source | Must differ from id_source | Do not verify by reusing id_source |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| beneficial_owner | Beneficial owner(s): name, ownership %, and type per master schema |
| evidence_source | Source name + date accessed |

**Escalation:** If a beneficial owner attribute cannot be evidenced, or ownership/control cannot be established, escalate to the analyst / FCC.

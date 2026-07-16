---
entity_type: "Registered Investment Advisor or Commodity Trading Advisor"
attribute: "board_of_director"
governs_attributes: ["board_director"]
version: "1.0"
---

# Board of Director — Registered Investment Advisor

## Sources
| Evidence Type | Jurisdiction | Rank | Source Name |
|---|---|---|---|
| Identification and confirmation of board director appointment | Global | Primary | Client written confirmation (client provided) |
| Board composition, appointments, resignations | Global | Primary | Audited annual report / governance report (entity specific) |
| Official record of board directors | Global | Primary | Constitutional documents / Company registry extract (jurisdiction-specific registry) |
| Confirms current directors | Global | Primary | Certificate of incumbency (entity specific) |
| Appointment or resignation evidence | Global | Primary | Board resolution / board meeting minutes (entity specific) |
| Board member disclosure | Global | Primary | Client website (entity specific) |
| Identification of directors | Global | Primary | Investor presentation (entity specific) |
| Formal disclosure of board appointments | US / UK / DE / HK | Primary | Exchange / regulator / government filings (≤12 months) — SEC, FCA Register, BaFin, HKEX |
| Board and executive identification | Global | Primary | Bloomberg |
| Governance and board information | Global | Primary | Businessweek |
| Director and institutional reference | Global | Primary | Bankers Almanac |
| Board / leadership records | Global | Primary | Dun & Bradstreet |
| Board and company leadership | Global | Primary | Hoovers (D&B Hoovers) |
| Board and governance details | Global | Primary | Morningstar |
| Corporate governance information | Global | Primary | Markit (S&P Global) |
| Director and executive information | Global | Primary | Eikon (Refinitiv) |
| Identity and appointment confirmation | Global | Primary | LexisNexis / Accurint |
| Full legal name and country of domicile | US / UK / DE / HK | Primary | Sales / banker confirmation (internal, documented) |
| Verification of appointment; ID copies not required | UK policy | Primary | Swiss Commercial Registry (ZEFIX) |
| Board appointment verification | HK policy | Primary | ACRA (Singapore registry) |
| Supplementary board identification | Global | Secondary | SWIFT KYC Registry |
| Identity verification | Global | Verification | Government-issued ID (passport / national ID / driving licence) |
| Identity verification where image is available | Global (List 1–3 entities) | Verification | Client website with image (entity specific) |

## Decision Logic
- **BOD_001** — IF an individual is a member of the board of directors or acts in an equivalent governance capacity THEN identify and record the individual as a Board Director.
- **BOD_002** — IF a board director is a corporate or nominee entity THEN drill down to identify all individuals acting on behalf of that entity.
- **BOD_003** — IF both a supervisory board and an effective management board exist THEN record supervisory board members as Board Directors and executive management board members as Corporate Directors.
- **BOD_004** — IF an entity lists multiple role titles THEN record all individuals listed on the board, irrespective of role title.
- **BOD_005** (US / UK / DE) — IF acceptable primary sources evidence appointment THEN no secondary confirmation is required; IF sales or banker confirmation is used THEN retain documentation of the confirmation.
- **BOD_006** (UK — Swiss registry exception) — IF the board director is evidenced through the Swiss Commercial Registry THEN ID copies are not required, as verification is conducted by the registry.
- **BOD_007** (Hong Kong) — IF the entity is subject to HK policy THEN capture only individuals with executive authority; IF public sources do not distinguish executive vs non-executive THEN obtain client confirmation and record accordingly; IF other policies also apply THEN identify all directors and officers regardless of role title.
- **BOD_008** (Germany — RIA) — IF the client is a Registered Investment Advisor in Germany THEN capture all board directors.
- **BOD_009** (role mapping — capture as Board Director + noted role) — Director General / General Director → Board Director + Managing Director; Vice President → Board Director + Vice President; Independent Director → Board Director + Executive Director; Director → Board Director + Executive Director; Financial Director → Board Director + CFO; President → Board Director + President / Chairperson; CEO → Board Director + CEO.
- **BOD_010** (do NOT capture) — Technical Director; Commercial Director; Non-board Secretary; Deputy Secretary (non-director); other non-director roles.

## Validation Rules
| Validation Check | Acceptable Variance | Fail Action |
|---|---|---|
| Board director name appears consistently across sources | Minor formatting differences | If materially inconsistent, clarify using primary source |
| Appointment / resignation evidenced | Evidence dated within policy expectations | If missing, obtain updated evidence |
| Sales / banker confirmation used | Confirmation documented | If undocumented, cannot validate |
| HK executive authority determination | Client confirmation acceptable | If unclear, escalate |
| Corporate nominee board directors drilled down | Complete individual details obtained | If not, do not validate |

## Outputs
| Output Field | Value / Mapping |
|---|---|
| board_director | Board director(s): name, role, and verification status per master schema |
| evidence_source | Source name + date accessed |

**Escalation:** Escalate where HK executive-authority status is unclear, or where a corporate nominee director cannot be drilled down to individuals.

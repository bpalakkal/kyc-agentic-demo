/**
 * ExceptionReview — KYC exception detail and resolution workspace
 *
 * Layout
 * ──────
 * Left sidebar   Exception list for the selected entities (from WorkQueue state)
 * Centre panel   Active exception: flag text, narrative, evidence, resolutions
 * Right panel    Attributes / Document Locker / Collaboration (collapsible)
 * Top bar        QA Review · Escalate · Outreach · Submit actions
 * Bottom-right   Agent Console Dock (from AgentSystem
 *
 * Data sources (current state — demo)
 * ─────────────────────────────────────
 * `exceptions`         Hard-coded array below (~13 curated exceptions across
 *                      Brevan Howard and Marshall Wace).  These are the only
 *                      entities with full exception detail.
 * GENERATED_EXCEPTIONS Auto-generated from entities.md — merged at runtime
 *                      (Long Focus, Brookfield).
 * GENERATED_*          All other generated data (attributes, comparisons,
 *                      activity, comments, tasks) from entities-generated.ts.
 *
 * TODO (production)
 * ─────────────────
 * - Replace `exceptions` + GENERATED_EXCEPTIONS with GET /api/cases/:kycId/exceptions
 * - Replace attribute panels with GET /api/cases/:kycId/attributes
 * - Replace activity feed with a real-time websocket or polling subscription
 * - Resolution submission (handleSubmit) currently only sets local state —
 *   wire to POST /api/cases/:kycId/exceptions/:excId/resolve
 * - Escalation and Outreach are UI-only — wire to notification/email service
 * - Zoom meeting creation already calls a real API (server.js /api/zoom/create-meeting)
 */

import { useState, useEffect, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Info, X, AlertTriangle, FileText, ChevronDown, CheckCircle2,
  Send, Mail, Plus, ThumbsUp, ThumbsDown, RotateCw, Paperclip,
  ShieldCheck, Database, Search, Sparkles, ChevronRight, Play, Settings2, Building2, Clock,
  ShieldAlert, Briefcase, ArrowRight, UserCircle2, MessageSquare, Bot, Video, Calendar, Network, Zap, ClipboardList,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAgents, type AgentId, AGENT_API_BASE } from "@/components/AgentSystem";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GENERATED_EXCEPTIONS, GENERATED_COMPARISONS, GENERATED_ENTITY_PROFILES, GENERATED_COMMENTS, GENERATED_WATCHERS, GENERATED_ACTIVITY } from "@/data/entities-generated";
import { GraphView } from "@/components/GraphView";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ForgeAttrRow, ForgeTraceRow, ForgePersonRow } from "@/types/forgeTypes";
import { PERSON_ROLE_LABELS } from "@/types/forgeTypes";
import {
  type AttrTrace, type AttrDoc, type AttrDocKind, type EntityAttr, type EntityProfile, type AuditEntry,
  type CaseDoc,
  ENTITY_PROFILES, ATTRIBUTE_TRACES, SOURCE_STYLE, DOT_STYLE, SOURCE_AGENT,
  STATUS_LABEL, COMPLETENESS_LABEL, COMPLETENESS_STYLE, DOC_KIND_META,
  ATTR_AUDIT_LOG, NESTED_ATTR_PROFILES, CASE_DOCUMENTS, TRACE_DOCS,
  COMMENTS_BY_KYC, WATCHERS_BY_KYC, ACTIVITY_BY_KYC,
} from "@/data/kycMockData";
import { ForgeLineagePanel } from "@/components/kyc/ForgeLineagePanel";
import { ForgePersonCard } from "@/components/kyc/ForgePersonCard";
import { WgqTabContent } from "@/components/kyc/WgqTabContent";
import { CollabPanel } from "@/components/kyc/CollabPanel";
import { EntityFiles } from "@/components/kyc/EntityFiles";
import { SimpleFieldRow, InlineTraceDrawer, NestedObjectBlock } from "@/components/kyc/SimpleFieldRow";




type RecordUpdate = { attr: string; before: string; after: string };
type Resolution = {
  id: string;
  title: string;
  desc: string;
  recommended?: boolean;
  agents: AgentId[];
  agentLabel: string;
  postRunSummary: string;
  updates: RecordUpdate[];
};

type Evidence = { name: string; sub: string };

type Exc = {
  id: string;
  title: string;
  confidence: number;
  status: "Pending" | "Addressed";
  entity: string;
  kyc: string;
  category: string;
  flagText: string;
  narrative: string;
  reasoningSteps: string[];
  evidenceRationale: string;
  evidence: Evidence[];
  acceptability: string;
  resolutions: Resolution[];
  attrLabel?: string; // field_name from DB — the attribute this exception is tied to
};

const exceptions: Exc[] = [
  {
    id: "e1",
    title: "Undisclosed PSC Address Change",
    category: "Beneficial Ownership",
    confidence: 88,
    status: "Pending",
    entity: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30229",
    flagText: "PSC Mr Alan Eldad Howard's correspondence address on file (82 Baker Street, London) does not match the most recent Form CS01 submission to Companies House.",
    narrative: "Companies House PSC register lists '82 Baker Street, London W1U 6AE' but the firm's latest annual confirmation statement filed on 03/14/2026 references a different correspondence address ('27 Hill Street, London W1J 5LP'). PSCs are required to notify changes within 14 days under Schedule 1A of the Companies Act 2006. No PSC02 amendment has been received.",
    reasoningSteps: [
      "Pulled current PSC record for OC302636 from Companies House Public Data API.",
      "Compared PSC.psc_correspondence_address against latest CS01 submission text.",
      "Confirmed 14-day notification window under Sch.1A CA 2006 has lapsed without a PSC02 filing.",
    ],
    evidenceRationale: "Companies House is the authoritative source for UK PSC and registered-address data. The firm's own CS01 is a counter-evidence source filed under directors' personal liability.",
    evidence: [
      { name: "Companies House PSC Filing", sub: "OC302636 · Mr A E Howard" },
      { name: "Form CS01 (03/14/2026)", sub: "Brevan Howard LLP · Confirmation Statement" },
      { name: "Companies Act 2006 Sch. 1A", sub: "PSC notification window" },
    ],
    acceptability: "Address-only PSC changes carry low ML/TF risk if the underlying identity (DOB, nationality, nature-of-control) is unchanged. Remediation is typically a 14-day client request for a corrected PSC02 filing.",
    resolutions: [
      { id: "r1", title: "Request PSC02 correction filing from client", desc: "Send automated reach-out to Brevan Howard Compliance asking for a backdated PSC02 to align the register. SLA: 7 business days.", recommended: true,
        agents: ["beneficial-owner", "outreach", "audit"], agentLabel: "Request PSC02 correction",
        postRunSummary: "Outreach drafted to Brevan Howard Compliance requesting a backdated PSC02 filing. Case held in 'awaiting client' state with a 7-business-day SLA; no PSC data overwritten yet.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (PSC02 correction requested) · SLA 2026-04-30" },
          { attr: "Outreach Log", before: "—", after: "Email queued to compliance@brevanhoward.com · Template PSC02_CORRECTION_v2" },
          { attr: "PSC Correspondence Address", before: "82 Baker Street, London W1U 6AE (Companies House)", after: "82 Baker Street, London W1U 6AE — pending PSC02 confirmation" },
        ],
      },
      { id: "r2", title: "Accept current Companies House record as authoritative", desc: "Adopt the on-file PSC address (82 Baker Street) and flag the CS01 cell-level mismatch as a non-material filing typo.",
        agents: ["beneficial-owner", "document", "audit"], agentLabel: "Adopt Companies House record",
        postRunSummary: "Companies House PSC record adopted as authoritative. CS01 address mismatch annotated as a non-material filing typo and case closed.",
        updates: [
          { attr: "PSC Correspondence Address", before: "Conflict (CS01 vs PSC register)", after: "82 Baker Street, London W1U 6AE (Companies House · authoritative)" },
          { attr: "CS01 Annotation", before: "—", after: "Cell-level address typo — non-material, retained for audit" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Accepted" },
        ],
      },
      { id: "r3", title: "Escalate to MLRO for PSC integrity review", desc: "Use if the address change suggests an undisclosed change in control or nominee arrangement.",
        agents: ["beneficial-owner", "risk-scoring", "outreach", "audit"], agentLabel: "Escalate to MLRO",
        postRunSummary: "Case escalated to MLRO with a precautionary risk-tier bump pending PSC integrity review.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Escalated — MLRO review" },
          { attr: "Risk Tier", before: "Elevated", after: "High (precautionary · pending MLRO outcome)" },
          { attr: "Owner", before: "KYC Analyst (Tier 2)", after: "MLRO · J. Mendes" },
        ],
      },
    ],
  },
  {
    id: "e2",
    title: "Cross-Jurisdiction Corporate Member (Jersey)",
    category: "Enhanced Due Diligence",
    confidence: 92,
    status: "Pending",
    entity: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30229",
    flagText: "Designated member 'BH Partnership Holdings Limited' is incorporated in Jersey, Channel Islands — a jurisdiction requiring EDD under FCA SYSC 6.3.",
    narrative: "Per Companies House, BH Partnership Holdings Limited (Jersey reg. 106333) is one of two corporate designated members of Brevan Howard Asset Management LLP. Jersey is on the firm's EDD-required list owing to bank-secrecy heritage, despite being FATF-compliant. EDD requires source-of-funds for the Jersey member and beneficial-owner mapping up to natural persons.",
    reasoningSteps: [
      "Identified two corporate-llp-designated-members from Companies House OC302636.",
      "Matched officer_place_registered 'JERSEY, CHANNEL ISLANDS' against EDD jurisdiction policy POL-EDD-23.",
      "Confirmed no EDD pack on file for the Jersey member in the Evidence Locker.",
    ],
    evidenceRationale: "Companies House officer record is authoritative for the corporate member's domicile. The firm's internal EDD jurisdiction list (POL-EDD-23) is the policy reference for triggering EDD.",
    evidence: [
      { name: "Companies House Officer Record", sub: "BH Partnership Holdings · Jersey 106333" },
      { name: "EDD Jurisdiction Policy POL-EDD-23", sub: "Internal · Jersey listed" },
      { name: "Jersey Financial Services Comm.", sub: "Registry Lookup · Active" },
    ],
    acceptability: "Jersey corporate members are permissible under FCA rules but mandate full EDD — source-of-wealth, source-of-funds, and natural-person beneficial-owner traversal. Common for UK alt-investment LLPs.",
    resolutions: [
      { id: "r1", title: "Run Enhanced Due Diligence on Jersey member", desc: "Trigger EDD pack: pull JFSC entity record, traverse ownership to natural-person UBOs, source-of-wealth declaration.", recommended: true,
        agents: ["beneficial-owner", "regulatory", "sanctions", "pep", "audit"], agentLabel: "Run EDD on BH Partnership Holdings",
        postRunSummary: "EDD pack generated: JFSC record retrieved, UBO chain resolved to natural persons, and source-of-wealth declaration linked. Jersey member upgraded to EDD-cleared.",
        updates: [
          { attr: "EDD Status (BH Partnership Holdings Ltd)", before: "Not Started", after: "EDD Cleared · 2026-04-19" },
          { attr: "UBO Chain (Jersey leg)", before: "Unresolved at corporate-member layer", after: "Resolved to Mr A E Howard (100% upstream attribution)" },
          { attr: "Evidence Locker", before: "0 EDD artefacts", after: "+3 artefacts (JFSC extract, UBO chart, SOW declaration)" },
        ],
      },
      { id: "r2", title: "Request natural-person UBO chart from client", desc: "Ask the client to supply a signed UBO map for the Jersey member up to natural persons with >25% voting rights.",
        agents: ["beneficial-owner", "outreach", "audit"], agentLabel: "Request UBO chart from client",
        postRunSummary: "Outreach sent to client requesting a signed UBO map for the Jersey member. Case parked pending response.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (UBO chart requested)" },
          { attr: "Outreach Log", before: "—", after: "Email to compliance@brevanhoward.com · Template UBO_REQUEST_v1" },
        ],
      },
      { id: "r3", title: "Accept member as conduit of Mr A E Howard ownership", desc: "Treat the Jersey member as a transparent holding vehicle for the disclosed PSC. Document rationale; no further EDD.",
        agents: ["beneficial-owner", "document", "audit"], agentLabel: "Accept Jersey member as transparent",
        postRunSummary: "Jersey corporate member treated as a transparent holding vehicle for the disclosed PSC. Rationale documented and case closed.",
        updates: [
          { attr: "EDD Status (BH Partnership Holdings Ltd)", before: "EDD Required", after: "Waived — transparent holding for disclosed PSC" },
          { attr: "Rationale Memo", before: "—", after: "MEMO-EDD-WAIVE-30214 · attached" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Accepted" },
        ],
      },
    ],
  },
  {
    id: "e3",
    title: "Previous Company Name Continuity",
    category: "Identity Consistency",
    confidence: 95,
    status: "Pending",
    entity: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30229",
    flagText: "Entity was previously registered as 'RIVAGE CAPITAL MANAGEMENT LLP' — chain-of-title verification required.",
    narrative: "Companies House shows OC302636 was originally registered as 'Rivage Capital Management LLP' before changing its name to 'Brevan Howard Asset Management LLP'. The internal CRM has only the current name with no prior-name link. KYC policy requires positive identification that the regulated entity is the same legal person across the name change to preserve audit chain.",
    reasoningSteps: [
      "Read entity_previous_company_names array from Companies House for OC302636.",
      "Searched FCA Register for both names — confirmed FRN history continuous since 2003.",
      "Flagged CRM gap: prior name not stored, breaking the lineage view for analysts.",
    ],
    evidenceRationale: "Companies House preserves prior names against the same company number. FCA Register independently confirms the regulatory permission was carried across the change.",
    evidence: [
      { name: "Companies House Name History", sub: "OC302636 · Rivage → Brevan Howard" },
      { name: "FCA Register FRN", sub: "Permission continuous since 2003" },
      { name: "CRM Entity Record", sub: "Internal · Prior name missing" },
    ],
    acceptability: "Lawful name changes preserve the underlying company number and regulatory permissions. No AML concern arises if FCA and Companies House records are consistent.",
    resolutions: [
      { id: "r1", title: "Backfill prior name into CRM and close exception", desc: "Auto-write 'Rivage Capital Management LLP (until 2007)' into CRM aliases; close exception with audit log.", recommended: true,
        agents: ["identity", "document", "audit"], agentLabel: "Backfill prior name into CRM",
        postRunSummary: "CRM alias backfilled with the prior legal name and lineage view restored. Exception closed with full audit trail.",
        updates: [
          { attr: "CRM · Entity Aliases", before: "—", after: "Rivage Capital Management LLP (until 2007-04-16)" },
          { attr: "Lineage Continuity", before: "Broken at 2007 name change", after: "Continuous (same OC302636 · FRN 209517)" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Resolved" },
        ],
      },
      { id: "r2", title: "Request board minutes evidencing name change", desc: "Use if FCA / CH evidence is insufficient for governance committee review.",
        agents: ["document", "outreach", "audit"], agentLabel: "Request board minutes",
        postRunSummary: "Document request issued to client for board minutes covering the 2007 name change; case held pending document upload.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (board minutes requested)" },
          { attr: "Document Requests", before: "—", after: "DOC-REQ-30214-NAME-2007 (board minutes · 2007 name change)" },
        ],
      },
      { id: "r3", title: "Defer pending FCA letter retrieval", desc: "Pause case until the original FCA name-change confirmation letter is uploaded.",
        agents: ["outreach", "audit"], agentLabel: "Defer pending FCA letter",
        postRunSummary: "Case deferred until the original FCA name-change confirmation letter is retrieved from the archive.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Deferred (awaiting FCA letter)" },
          { attr: "Next Review", before: "—", after: "2026-05-03" },
        ],
      },
    ],
  },
  {
    id: "e4",
    title: "FCA Permission Scope Drift",
    category: "Regulatory Status",
    confidence: 79,
    status: "Pending",
    entity: "Marshall Wace LLP",
    kyc: "KYC-30188",
    flagText: "FCA register shows a new permission ('Managing an AIF') added on 02/11/2026 — internal record not yet updated.",
    narrative: "Marshall Wace LLP (FRN 211088) extended its FCA permissions in February 2026 to include 'Managing an Alternative Investment Fund' on top of its existing investment-management permissions. The CRM permission set was last refreshed in November 2025 and has not been re-synced, creating a drift between the regulator-of-record and our internal risk model.",
    reasoningSteps: [
      "Polled FCA Register API for FRN 211088 permissions versus stored snapshot.",
      "Detected delta: new permission 'Managing an AIF' active since 02/11/2026.",
      "Computed risk-model impact: AIFMD scope adds disclosure obligations under SI 2013/1773.",
    ],
    evidenceRationale: "The FCA Register is the statutory source for UK authorised firm permissions. The CRM snapshot is the internal source-of-truth that drives risk scoring.",
    evidence: [
      { name: "FCA Register FRN 211088", sub: "Permissions snapshot 04/19/2026" },
      { name: "CRM Permission Set", sub: "Internal · Snapshot 11/02/2025" },
      { name: "AIFMD SI 2013/1773", sub: "Statutory Instrument" },
    ],
    acceptability: "Adding regulated permissions is a routine corporate event for a multi-strategy LLP. The control concern is delayed internal sync, not the underlying permission, which is lawful.",
    resolutions: [
      { id: "r1", title: "Sync CRM permission set with FCA register", desc: "Auto-write 'Managing an AIF' into CRM permission set with effective date 02/11/2026 and re-run the risk model.", recommended: true,
        agents: ["regulatory", "risk-scoring", "audit"], agentLabel: "Sync permissions with FCA",
        postRunSummary: "FCA register snapshot pulled and CRM permission set synchronised. Risk model re-scored with the AIFMD scope expansion factored in.",
        updates: [
          { attr: "CRM · FCA Permissions", before: "Investment management, MiFID II", after: "Investment management, MiFID II, Managing an AIF (eff. 2026-02-11)" },
          { attr: "Composite Risk Score", before: "58 (Elevated)", after: "64 (Elevated · AIFMD scope)" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Resolved" },
        ],
      },
      { id: "r2", title: "Request AIFMD disclosure pack from client", desc: "Ask Marshall Wace Compliance for the AIFMD Article 23 disclosure pack covering the newly in-scope funds.",
        agents: ["regulatory", "document", "outreach", "audit"], agentLabel: "Request AIFMD disclosure",
        postRunSummary: "Outreach issued to Marshall Wace Compliance requesting the Article 23 disclosure pack covering the newly in-scope AIFs.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (AIFMD Art. 23 pack)" },
          { attr: "Outreach Log", before: "—", after: "Email to compliance@mwam.com · Template AIFMD_ART23_v1" },
          { attr: "Document Requests", before: "—", after: "DOC-REQ-30188-AIFMD-2026" },
        ],
      },
      { id: "r3", title: "Elevate risk tier pending review", desc: "Apply a precautionary tier bump until the new AIF scope is fully evidenced and re-scored.",
        agents: ["risk-scoring", "regulatory", "audit"], agentLabel: "Elevate risk tier",
        postRunSummary: "Precautionary risk-tier bump applied to Marshall Wace pending full evidencing of the AIF scope expansion.",
        updates: [
          { attr: "Risk Tier", before: "Elevated", after: "High (precautionary · AIFMD scope drift)" },
          { attr: "Review Cadence", before: "Annual", after: "Semi-annual until tier revert" },
        ],
      },
    ],
  },
  {
    id: "e5",
    title: "Sanctions Screening — PSC Name Hit",
    category: "Sanctions",
    confidence: 97,
    status: "Pending",
    entity: "Marshall Wace LLP",
    kyc: "KYC-30188",
    flagText: "PSC 'Sir Paul Marshall' matches a non-sanctioned namesake on the UK HMT consolidated list at 84% fuzzy similarity.",
    narrative: "HMT consolidated list contains 'Paul Marshall' (b. 1971, Zimbabwean national, designated under Zimbabwe regime — now de-listed). Marshall Wace's Sir Paul Marshall (b. 1959, British, knighted 2016) is verifiably a different individual. Identity divergence is conclusive on DOB, nationality, and HMRC-verified passport.",
    reasoningSteps: [
      "Screened all PSCs against OFAC SDN, EU CFSP, UN 1267, HMT consolidated lists.",
      "Fuzzy match returned 84% similarity on name; exact DOB and nationality differ.",
      "Confirmed identity divergence using HMRC-verified passport and Companies House DOB.",
    ],
    evidenceRationale: "HMT's primary list and the client's verified identity documents (passport + Companies House DOB) are the authoritative sources for resolving sanctions name-match alerts.",
    evidence: [
      { name: "HMT Consolidated List", sub: "Updated 04/01/2026 · de-listed entry" },
      { name: "Passport — Sir Paul Marshall", sub: "GBR · Verified on file" },
      { name: "World-Check Screening Log", sub: "Run 04/19/2026" },
    ],
    acceptability: "Documented false positives are routinely cleared at the analyst level with the underlying identity evidence retained in the case file. No regulatory reporting obligation arises from a confirmed non-match.",
    resolutions: [
      { id: "r1", title: "Clear as confirmed false positive", desc: "Identity divergence is conclusive: different DOB, nationality, and verified passport. Retain evidence and update screening exception list.", recommended: true,
        agents: ["sanctions", "identity", "audit"], agentLabel: "Clear as confirmed false positive",
        postRunSummary: "Identity divergence (DOB, nationality, passport) confirmed against the HMT match. Alert cleared as a false positive with evidence retained.",
        updates: [
          { attr: "Sanctions Alert (Sir Paul Marshall)", before: "Open · 84% fuzzy match", after: "Cleared — Confirmed False Positive" },
          { attr: "Evidence Locker", before: "Identity docs on file", after: "+1 clearance memo (DOB / nationality divergence)" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Cleared" },
        ],
      },
      { id: "r2", title: "Suppress future fuzzy matches for this name pair", desc: "Add the cleared identity pair to the screening allowlist to prevent recurring alerts on subsequent runs.",
        agents: ["sanctions", "audit"], agentLabel: "Suppress future fuzzy matches",
        postRunSummary: "Cleared identity pair added to the sanctions allowlist to suppress recurring fuzzy alerts on subsequent screening runs.",
        updates: [
          { attr: "Screening Allowlist", before: "—", after: "Sir Paul Marshall (b. 1959, British) vs HMT 'Paul Marshall' (b. 1971, ZWE)" },
          { attr: "Expected Future Alerts", before: "≈ 1 per screening cycle", after: "0 (suppressed)" },
        ],
      },
      { id: "r3", title: "Request fresh identity verification before clearing", desc: "Use if existing identity documents are older than 12 months or if heightened HMT scrutiny is warranted.",
        agents: ["identity", "outreach", "audit"], agentLabel: "Request fresh identity verification",
        postRunSummary: "Fresh identity-verification request issued to the client. Alert held open until refreshed documents are on file.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (fresh ID verification)" },
          { attr: "Outreach Log", before: "—", after: "Email to compliance@mwam.com · Template IDV_REFRESH_v2" },
        ],
      },
    ],
  },
  // ===== Long Focus Capital Management, LLC (KYC-30215) =====
  {
    id: "e6",
    title: "US Registration Number Mismatch",
    category: "Identity Consistency",
    confidence: 92,
    status: "Pending",
    entity: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    flagText: "Client-provided CRD 801-12345 resolves to a different legal entity in SEC IAPD. IAPD record for the matching legal name shows 801-67890.",
    narrative: "The client onboarding form lists US Registration Number 801-12345. That CRD resolves in IAPD to 'Long Focus Capital LLC' — a different legal entity with a different address. The legal name and principal address on the onboarding form match the entity registered under 801-67890. Most likely a transcription error on the onboarding form; SEC IAPD is the authoritative system of record under KYC Policy §3.1.",
    reasoningSteps: [
      "SEC IAPD is the system of record for RIA registration numbers under KYC Policy §3.1.",
      "Legal entity name and principal address on Form ADV match the client onboarding form exactly.",
      "Client-provided number resolves in IAPD but to a different legal entity with a different address — supports transcription-error hypothesis.",
    ],
    evidenceRationale: "SEC IAPD (Form ADV Part 1A) is the statutory source for US RIA registration numbers; client onboarding form is the counter-source.",
    evidence: [
      { name: "SEC IAPD — Form ADV Part 1A", sub: "Retrieved 2026-05-20 · CRD 801-67890" },
      { name: "Client Onboarding Form", sub: "Self-reported · CRD 801-12345" },
      { name: "KYC Policy §3.1", sub: "Authoritative source hierarchy" },
    ],
    acceptability: "Field-level transcription errors against an authoritative regulator source are routinely corrected to the regulator value with an audit-trail entry. No EDD or escalation typically required.",
    resolutions: [
      { id: "r1", title: "Run SEC-ADV Verification Agent and update to 801-67890", desc: "Verify match against SEC IAPD, write 801-67890 to the entity record, and log the discrepancy in the audit trail.", recommended: true,
        agents: ["regulatory", "identity", "audit"], agentLabel: "Verify and update US Reg #",
        postRunSummary: "SEC IAPD match confirmed for legal name + principal address. Entity record updated to CRD 801-67890 with a full discrepancy memo in the audit log.",
        updates: [
          { attr: "US Registration Number", before: "801-12345 (client self-reported)", after: "801-67890 (SEC IAPD · authoritative)" },
          { attr: "Discrepancy Memo", before: "—", after: "MEMO-30215-CRD · client transcription error vs IAPD" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Resolved" },
        ],
      },
      { id: "r2", title: "Accept client-provided number with Senior Analyst override", desc: "Retain 801-12345 with documented rationale and a Senior Analyst override signature.",
        agents: ["identity", "audit"], agentLabel: "Accept with override",
        postRunSummary: "Client-provided CRD retained under Senior Analyst override; rationale memo attached to case.",
        updates: [
          { attr: "US Registration Number", before: "801-12345 (unverified)", after: "801-12345 (Senior Analyst override · MEMO-30215-OVR)" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Accepted with Override" },
        ],
      },
      { id: "r3", title: "Return to client via Relationship Manager", desc: "Route back to RM for client to confirm the correct CRD; case parked pending response.",
        agents: ["outreach", "audit"], agentLabel: "Return to client for CRD confirmation",
        postRunSummary: "RM outreach queued requesting confirmation of the correct CRD; case held pending client response.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (CRD confirmation requested)" },
          { attr: "Outreach Log", before: "—", after: "RM Anderson · Template CRD_CONFIRM_v1 · SLA 5 business days" },
        ],
      },
    ],
  },
  {
    id: "e7",
    title: "Outstanding LEI Code",
    category: "Regulatory Status",
    confidence: 78,
    status: "Pending",
    entity: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    flagText: "No active LEI found on GLEIF under the entity's legal name or SEC registration number. AUM of $2.4B suggests reportable derivatives activity is plausible.",
    narrative: "GLEIF returned no match for the legal name 'Long Focus Capital Management, LLC' or against US Reg # 801-67890. For an RIA with $2.4B AUM an LEI is typically expected for swap and derivatives counterparty reporting under EMIR / Dodd-Frank. Absence may indicate the client does not transact in reportable instruments, or that registration has lapsed / is pending.",
    reasoningSteps: [
      "LEI is not a CIP requirement and does not block case closure under the FinCEN CDD Rule.",
      "LEI is required for any EMIR- or Dodd-Frank-reportable derivative or swap activity, which is plausible given AUM.",
      "GLEIF returned no match on either legal name or SEC registration number — indicates no LEI has ever been issued (vs. lapsed).",
    ],
    evidenceRationale: "GLEIF is the global registry of record for LEI codes; the client onboarding form is the counter-source for self-declared identifiers.",
    evidence: [
      { name: "GLEIF Registry Lookup", sub: "Legal name + CRD 801-67890 · no match" },
      { name: "Client Onboarding Form", sub: "LEI field left blank" },
      { name: "EMIR / Dodd-Frank Reporting Rules", sub: "Reportable derivative activity trigger" },
    ],
    acceptability: "Absence of LEI is acceptable if the client does not transact in reportable derivatives. Conditional approval pending client confirmation is a common path.",
    resolutions: [
      { id: "r1", title: "Request LEI from client via portal", desc: "Send a templated outreach to the client requesting an LEI; conditionally approve the case if the client confirms no reportable activity. SLA: 7 business days.", recommended: true,
        agents: ["outreach", "regulatory", "audit"], agentLabel: "Request LEI from client",
        postRunSummary: "Outreach drafted to client requesting LEI registration or written confirmation of no reportable derivatives activity. Case held in conditional-approval state with a 7-business-day SLA.",
        updates: [
          { attr: "LEI Code", before: "Not provided", after: "Pending client (LEI request · SLA 2026-06-02)" },
          { attr: "Outreach Log", before: "—", after: "Email to client portal · Template LEI_REQUEST_v2" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Conditional approval — awaiting LEI" },
        ],
      },
      { id: "r2", title: "Initiate Broad Search Agent across alternative registries", desc: "Sweep GMEI Utility, KY3P, and other identifier registries before client outreach to rule out an alternative LEI source.",
        agents: ["identity", "regulatory", "audit"], agentLabel: "Broad search alternative registries",
        postRunSummary: "Broad Search Agent swept GMEI Utility and KY3P; no alternative LEI was found. Case advanced for client outreach.",
        updates: [
          { attr: "Alternative Registry Search", before: "Not run", after: "GMEI Utility · KY3P · 0 matches (2026-05-25)" },
          { attr: "Recommendation", before: "—", after: "Proceed to client LEI request" },
        ],
      },
      { id: "r3", title: "Flag for re-verification at 30 days", desc: "Park the field with a 30-day re-verification flag; close all other exceptions independently.",
        agents: ["regulatory", "audit"], agentLabel: "Defer 30-day re-verification",
        postRunSummary: "LEI field flagged for re-verification on 2026-06-24; case can close on remaining attributes pending that follow-up.",
        updates: [
          { attr: "LEI Code", before: "Not provided", after: "Deferred — re-verify 2026-06-24" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Open — non-blocking deferral" },
        ],
      },
    ],
  },
  {
    id: "e8",
    title: "Principal Place of Business Mismatch",
    category: "Identity Consistency",
    confidence: 90,
    status: "Pending",
    entity: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    flagText: "Corporate website shows 123 Main Street, NY 10001; Form ADV (SEC filing) and the client onboarding form both show 456 Broad Avenue, NY 10005.",
    narrative: "Two of three sources (Form ADV and client onboarding form) agree on 456 Broad Avenue, NY 10005. The corporate website shows 123 Main Street — likely a secondary office or stale marketing content. Per KYC Policy §3.5 the regulatory filing supersedes marketing material for address determination.",
    reasoningSteps: [
      "KYC Policy §3.5 places regulatory filings above corporate website content for address verification.",
      "Form ADV address matches the address self-reported on the client onboarding form — two corroborating sources.",
      "Website discrepancy is consistent with a secondary office or stale content, not a substantive change of principal place of business.",
    ],
    evidenceRationale: "Form ADV (regulatory filing) and client onboarding form (self-attestation) are the authoritative sources; corporate website is marketing material.",
    evidence: [
      { name: "Form ADV Filing (SEC)", sub: "Filed 2026-03-31 · 456 Broad Avenue, NY 10005" },
      { name: "Corporate Website", sub: "Retrieved 2026-05-20 · 123 Main Street, NY 10001" },
      { name: "Client Onboarding Form", sub: "Self-reported · 456 Broad Avenue, NY 10005" },
    ],
    acceptability: "When two authoritative sources corroborate and only marketing content diverges, accepting the filing address with an audit note is standard practice.",
    resolutions: [
      { id: "r1", title: "Accept Form ADV address as authoritative", desc: "Adopt 456 Broad Avenue (Form ADV + client form) as the principal place of business; annotate the website mismatch as non-material stale content.", recommended: true,
        agents: ["regulatory", "document", "audit"], agentLabel: "Accept Form ADV address",
        postRunSummary: "Form ADV address adopted as authoritative; website discrepancy annotated as non-material stale content and case closed.",
        updates: [
          { attr: "Principal Place of Business", before: "Conflict (Website vs Form ADV)", after: "456 Broad Avenue, NY 10005 (Form ADV · authoritative)" },
          { attr: "Website Annotation", before: "—", after: "Stale marketing content — non-material, retained for audit" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Closed — Accepted" },
        ],
      },
      { id: "r2", title: "Run Geolocation & Business Directory check", desc: "Use D&B and Google Places as a tiebreaker before acceptance — confirms the 456 Broad address is operationally active.",
        agents: ["identity", "document", "audit"], agentLabel: "Geolocation tiebreaker check",
        postRunSummary: "D&B and Google Places both confirm 456 Broad Avenue is the operationally active office; 123 Main Street is listed as a secondary location. Acceptance recommended.",
        updates: [
          { attr: "D&B Lookup", before: "Not run", after: "456 Broad Avenue · primary operating address" },
          { attr: "Google Places", before: "Not run", after: "456 Broad Avenue · open · 4.6★ (regional HQ)" },
        ],
      },
      { id: "r3", title: "Request clarification from client", desc: "Ask the client to confirm the primary operating address and explain the website divergence.",
        agents: ["outreach", "audit"], agentLabel: "Request address clarification",
        postRunSummary: "Outreach sent to client requesting written confirmation of the principal place of business and an explanation of the website divergence.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client (address clarification)" },
          { attr: "Outreach Log", before: "—", after: "Email to compliance@longfocus.com · Template PPOB_CLARIFY_v1" },
        ],
      },
    ],
  },
  {
    id: "e9",
    title: "Missing Compliance Officer Attestation",
    category: "Document Completeness",
    confidence: 95,
    status: "Pending",
    entity: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    flagText: "CCO identity (Sarah Chen) is known via Form ADV Schedule A, but no signed attestation has been provided by the client.",
    narrative: "Form ADV Schedule A independently identifies Sarah Chen as Chief Compliance Officer. The gap is a missing signed attestation, not the CCO's identity. A templated DocuSign request to the named CCO is the most direct remediation path.",
    reasoningSteps: [
      "CCO identity is independently verified through Form ADV Schedule A — a regulatory filing.",
      "The gap is an artefact (a signed attestation) rather than an unknown attribute.",
      "Direct DocuSign outreach to the verified CCO closes the gap without RM mediation.",
    ],
    evidenceRationale: "Form ADV Schedule A is the regulatory source for named compliance officers; the artefact gap is procedural rather than substantive.",
    evidence: [
      { name: "Form ADV Schedule A", sub: "Sarah Chen · Chief Compliance Officer" },
      { name: "Client Submitted Documents", sub: "No signed attestation on file" },
      { name: "KYC Policy §4.2", sub: "CCO attestation requirement" },
    ],
    acceptability: "Procedural gaps where the underlying attribute is verified are typically closed via templated outreach; conditional approval is also acceptable while the signature is in flight.",
    resolutions: [
      { id: "r1", title: "Generate pre-filled DocuSign attestation to Sarah Chen", desc: "Auto-populate the attestation form with ADV-confirmed CCO details and send via DocuSign. SLA: 5 business days.", recommended: true,
        agents: ["document", "outreach", "audit"], agentLabel: "DocuSign attestation to CCO",
        postRunSummary: "Pre-filled DocuSign attestation queued to Sarah Chen (CCO). Case held in awaiting-signature state with a 5-business-day SLA.",
        updates: [
          { attr: "Compliance Officer Attestation", before: "Not provided", after: "Pending signature (DocuSign envelope #DS-30215-CCO)" },
          { attr: "Outreach Log", before: "—", after: "DocuSign to schen@longfocus.com · Template CCO_ATTEST_v3" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting signature — DocuSign" },
        ],
      },
      { id: "r2", title: "Accept ADV-listed CCO with conditional flag", desc: "Accept the CCO identity from Form ADV and flag the attestation to follow; allow case to close on other attributes.",
        agents: ["regulatory", "audit"], agentLabel: "Accept ADV CCO conditionally",
        postRunSummary: "CCO identity accepted from Form ADV with a conditional flag pending signed attestation. Case can advance on other attributes.",
        updates: [
          { attr: "Compliance Officer", before: "Identified · attestation missing", after: "Sarah Chen (ADV-verified) · attestation conditional flag" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Conditional approval — attestation outstanding" },
        ],
      },
      { id: "r3", title: "Escalate to client relationship team", desc: "Route to the RM to chase the attestation directly with the client's compliance team.",
        agents: ["outreach", "audit"], agentLabel: "Escalate to RM team",
        postRunSummary: "Case escalated to the RM team to chase the signed CCO attestation directly.",
        updates: [
          { attr: "Owner", before: "KYC Analyst (Tier 2)", after: "RM Anderson · client relationship team" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Escalated — RM follow-up" },
        ],
      },
    ],
  },
  {
    id: "e10",
    title: "Beneficial Ownership Not Identified",
    category: "Beneficial Ownership",
    confidence: 85,
    status: "Pending",
    entity: "Long Focus Capital Management, LLC",
    kyc: "KYC-30215",
    flagText: "Ownership chain terminates at a Delaware holding company (Long Focus Holdings LLC, 100%) with no publicly disclosed natural-person owners. FinCEN BOI report not on file.",
    narrative: "Form ADV Schedule A lists Long Focus Holdings LLC as 100% owner — an entity, not a natural person. Public registry traversal terminates at that holding company; Delaware does not require public disclosure of LLC ownership. The FinCEN CDD Rule (31 CFR 1010.230) requires identification of natural-person beneficial owners at the 25%+ threshold, so case closure is blocked until a natural person is identified or the client supplies a FinCEN BOI report.",
    reasoningSteps: [
      "25% beneficial-ownership threshold is a regulatory requirement under 31 CFR 1010.230 — case closure is blocked.",
      "Delaware does not require public disclosure of LLC ownership, so traversal through public sources alone is unlikely to succeed.",
      "Paid registries (LexisNexis, Sayari) may resolve ownership without client outreach, but the client BOI report is the authoritative source.",
    ],
    evidenceRationale: "FinCEN BOI report is the statutory source for natural-person beneficial owners; Form ADV Schedule A and Companies House (UK branch) are supporting evidence.",
    evidence: [
      { name: "Form ADV Schedule A", sub: "Owner: Long Focus Holdings LLC (100%)" },
      { name: "Delaware Division of Corporations", sub: "No public ownership disclosure" },
      { name: "Companies House (UK branch)", sub: "PSC register · no PSC > 25%" },
      { name: "31 CFR 1010.230", sub: "FinCEN CDD Rule · 25% UBO requirement" },
    ],
    acceptability: "Ownership behind a Delaware holding company is common for US RIAs. The control concern is the missing BOI report; a 7-day formal request is the standard remediation.",
    resolutions: [
      { id: "r1", title: "Issue formal FinCEN BOI report request to client", desc: "Send a formal BOI report request with a 7-day SLA; case held in awaiting-client state until natural-person UBOs are identified.", recommended: true,
        agents: ["beneficial-owner", "outreach", "regulatory", "audit"], agentLabel: "Request FinCEN BOI report",
        postRunSummary: "Formal FinCEN BOI report request issued to the client. Case held in awaiting-client state with a 7-business-day SLA; closure blocked until natural-person UBOs are identified.",
        updates: [
          { attr: "Beneficial Owner (25%+)", before: "Unresolved — chain ends at Long Focus Holdings LLC", after: "Pending — FinCEN BOI report requested" },
          { attr: "Outreach Log", before: "—", after: "Formal request to compliance@longfocus.com · Template FINCEN_BOI_v1 · SLA 2026-06-02" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Blocked — Awaiting FinCEN BOI report" },
        ],
      },
      { id: "r2", title: "Run Ownership Resolution Agent against paid registries", desc: "Sweep LexisNexis and Sayari to attempt to resolve natural-person ownership before client outreach.",
        agents: ["beneficial-owner", "identity", "audit"], agentLabel: "Run Ownership Resolution Agent",
        postRunSummary: "Ownership Resolution Agent traversed LexisNexis and Sayari; partial signal found — proceed to client BOI request for authoritative confirmation.",
        updates: [
          { attr: "Paid Registry Traversal", before: "Not run", after: "LexisNexis · Sayari · partial signal (1 candidate UBO)" },
          { attr: "Recommendation", before: "—", after: "Proceed to client BOI request for authoritative confirmation" },
        ],
      },
      { id: "r3", title: "Escalate to Enhanced Due Diligence team", desc: "Route to the EDD team for full ownership investigation given the opaque Delaware holding structure.",
        agents: ["beneficial-owner", "risk-scoring", "audit"], agentLabel: "Escalate to EDD team",
        postRunSummary: "Case escalated to the EDD team for full ownership investigation. Precautionary risk-tier bump applied pending EDD outcome.",
        updates: [
          { attr: "Owner", before: "KYC Analyst (Tier 2)", after: "EDD Team · Lead: K. Okafor" },
          { attr: "Risk Tier", before: "Medium-High", after: "High (precautionary · pending EDD outcome)" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Escalated — EDD investigation" },
        ],
      },
    ],
  },
  // ===== Brookfield Asset Management PIC US, LLC (KYC-30216) =====
  {
    id: "b1",
    title: "Risk Rating Discrepancy",
    category: "Classification & Risk",
    confidence: 82,
    status: "Pending",
    entity: "Brookfield Asset Management PIC US, LLC",
    kyc: "KYC-30216",
    flagText: "System-generated High Risk classification triggered by Cayman-domiciled ownership entities conflicts with initial Low Risk assessment and prior UK policy closure (January 2026).",
    narrative: "During onboarding, the addition of Cayman-domiciled ownership entities automatically triggered a High Risk classification. The entity was previously classified as Low Risk under another division's UK policy closure in January 2026 — no material adverse factors were identified at that time. Cayman jurisdiction alone is not considered a high-risk trigger under UK standards. The ultimate beneficial owner is a reputable and known entity. The client has demonstrated full cooperation throughout the process.",
    reasoningSteps: [
      "Entity previously classified as Low Risk at UK policy closure in January 2026 — no adverse factors identified.",
      "Introduction of Cayman-domiciled ownership entities triggered automatic High Risk classification.",
      "Cayman jurisdiction alone is not a high-risk indicator under UK standards; ultimate beneficial owner is reputable and known.",
      "Late-stage threshold changes (25% → 10%) would negatively impact client experience without commensurate risk benefit.",
    ],
    evidenceRationale: "Internal risk model output and prior classification history are the primary sources. Client cooperation and UBO reputation are mitigating factors.",
    evidence: [
      { name: "Internal Risk Model Output", sub: "High Risk triggered · Cayman ownership entities" },
      { name: "Prior UK Policy Closure (Jan 2026)", sub: "Low Risk — no adverse factors identified" },
      { name: "Client KYC File", sub: "Full cooperation on record throughout process" },
    ],
    acceptability: "A risk rating override is supportable where the trigger is jurisdiction-based and the UBO is a known, reputable entity with no adverse indicators. Compliance sign-off and documented rationale are required.",
    resolutions: [
      { id: "r1", title: "Seek Compliance confirmation for 25% ownership threshold", desc: "Request Compliance to confirm that a 25% ownership drilldown threshold is appropriate given the prior low-risk classification, reputable UBO, and jurisdiction-specific interpretation of Cayman exposure.", recommended: true,
        agents: ["regulatory", "beneficial-owner", "audit"], agentLabel: "Confirm threshold with Compliance",
        postRunSummary: "Compliance confirmed 25% ownership drilldown threshold is appropriate. Risk rating retained with documented rationale. No additional documentation requests required.",
        updates: [
          { attr: "Ownership Threshold", before: "10% (system-triggered)", after: "25% (Compliance-confirmed)" },
          { attr: "Risk Rating", before: "High (system-generated)", after: "Low (Compliance-approved override)" },
          { attr: "Rationale Memo", before: "—", after: "MEMO-30216-RISK · Compliance sign-off attached" },
        ],
      },
      { id: "r2", title: "Request formal risk rating override from Compliance", desc: "Request a risk rating exception or override from Compliance to align the entity back to Low/Medium risk, supported by historical assessment, absence of new adverse risk indicators, and client cooperation.",
        agents: ["regulatory", "risk-scoring", "audit"], agentLabel: "Request risk rating override",
        postRunSummary: "Risk rating override request submitted to Compliance with supporting rationale. Awaiting Compliance decision.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Escalated — Compliance override decision pending" },
          { attr: "Override Request", before: "—", after: "Submitted to Compliance · MEMO-30216-OVR" },
        ],
      },
      { id: "r3", title: "Escalate to Sales / Coverage for client context", desc: "Engage Sales and Coverage teams to provide client relationship context and support justification for the 25% threshold to avoid additional documentation requests that could disrupt onboarding.",
        agents: ["outreach", "audit"], agentLabel: "Escalate to Sales and Coverage",
        postRunSummary: "Sales and Coverage teams engaged for client relationship context. Supporting memo attached to case for Compliance review.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Escalated — Sales/Coverage stakeholder input pending" },
          { attr: "Outreach Log", before: "—", after: "Coverage team notified · Template STAKE_ESCALATE_v1" },
        ],
      },
    ],
  },
  {
    id: "b2",
    title: "CIP Classification / NAICS Code Discrepancy",
    category: "Classification & Risk",
    confidence: 75,
    status: "Pending",
    entity: "Brookfield Asset Management PIC US, LLC",
    kyc: "KYC-30216",
    flagText: "Client confirmed entity as NFIE (Non-Financial Entity) but internal due diligence trigger classifies it as a financial/investment entity based on 'Investment adviser / asset manager' NAICS mapping.",
    narrative: "During onboarding the client confirmed the entity as a Non-Financial Entity (NFIE), indicating it does not consider itself engaged in regulated financial institution activities. The internal trigger is driven by the 'Investment adviser / asset manager' nature of business, commonly associated with financial investment activity. The entity's activities — described by the client as a holding company / financing vehicle — require validation to determine whether they extend beyond intra-group purposes to third-party investment or financial services activity.",
    reasoningSteps: [
      "Client explicitly classified entity as Non-Financial Entity (NFIE) during onboarding.",
      "Internal CIP trigger fired on 'Investment adviser / asset manager' nature-of-business code, typically linked to financial/investment entity classification.",
      "Resolution requires validation of whether entity activities are strictly intra-group or extend to third-party investment services.",
      "Outcome determines whether entity remains NFIE or is reclassified as Financial Entity (Investment Entity).",
    ],
    evidenceRationale: "Form ADV and client onboarding form are the primary sources. The classification discrepancy requires Legal or Compliance determination.",
    evidence: [
      { name: "Form ADV (SEC)", sub: "Nature of business: Investment adviser / asset manager" },
      { name: "Client Onboarding Response", sub: "Self-classified as NFIE · holding company / financing vehicle" },
      { name: "Internal CIP Classification Policy", sub: "Financial activity flag triggered by NAICS mapping" },
    ],
    acceptability: "NFIE classification is supportable if the entity's activities are strictly intra-group and do not constitute regulated financial services for third parties. Legal review or targeted client outreach is required to substantiate.",
    resolutions: [
      { id: "r1", title: "Request Legal team review of NFIE classification", desc: "Engage Legal to assess the appropriateness of the NFIE classification based on nature of business, derivatives access, and whether activities extend to third parties.", recommended: true,
        agents: ["regulatory", "identity", "audit"], agentLabel: "Legal review of NFIE classification",
        postRunSummary: "Legal review completed. Entity confirmed as NFIE — activities limited to intra-group financing and advisory services. Classification retained as Non-Financial Entity.",
        updates: [
          { attr: "CIP Classification", before: "Exception — Financial activity flag raised", after: "NFIE — confirmed by Legal · MEMO-30216-CIP" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Resolved — Legal-confirmed NFIE classification" },
        ],
      },
      { id: "r2", title: "Targeted client outreach for activity clarification", desc: "Contact client to confirm whether entity performs investment or financial activities for third parties vs strictly intra-group, and clarify the basis for their NFIE classification.",
        agents: ["outreach", "document", "audit"], agentLabel: "Client outreach for CIP clarification",
        postRunSummary: "Client outreach sent requesting clarification on nature of activities and basis for NFIE classification. Case held pending client response.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client — CIP clarification requested" },
          { attr: "Outreach Log", before: "—", after: "Email queued · Template CIP_CLARIFY_v1 · SLA 7 business days" },
        ],
      },
    ],
  },
  {
    id: "b3",
    title: "Acting Person — Authority Documentation Gap",
    category: "Beneficial Ownership",
    confidence: 88,
    status: "Pending",
    entity: "Brookfield Asset Management PIC US, LLC",
    kyc: "KYC-30216",
    flagText: "Acting Person identified is not a member of the Vorstand / Executive Management Board. No Power of Attorney or authorised signatory list provided to evidence delegated authority.",
    narrative: "An Acting Person (AP) has been identified for the entity; however, the individual is not a member of the Vorstand (Executive Management Board) or equivalent governing body. Per KYC guidance, where the Acting Person is not part of the governing body, the individual must have documented authority — evidenced through a Power of Attorney (PoA) or inclusion in an authorised signatory list. No such documentation has been provided, creating a KYC control gap.",
    reasoningSteps: [
      "KYC guidance requires Acting Persons not on the governing board to provide explicit delegated authority documentation.",
      "Acceptable evidence: formal Power of Attorney document, or an authorised signatory list naming the individual.",
      "No PoA or authorised signatory evidence has been provided or identified in the document locker.",
      "Without such documentation there is insufficient evidence to validate the individual's authority to act on behalf of the entity.",
    ],
    evidenceRationale: "Form ADV Schedule A identifies the Acting Person. Absence of PoA or signatory list is confirmed from the document locker review.",
    evidence: [
      { name: "Form ADV Schedule A", sub: "Acting Person identified — not on governing board" },
      { name: "Client Submitted Documents", sub: "No PoA or authorised signatory list on file" },
      { name: "KYC Authority Documentation Policy", sub: "PoA or signatory list required for non-board APs" },
    ],
    acceptability: "Acting Person designation without supporting authority documentation is not acceptable under current KYC policy. The gap must be resolved before case closure.",
    resolutions: [
      { id: "r1", title: "Request Power of Attorney documentation from client", desc: "Reach out to the client to obtain a valid PoA document or authorised signatory list confirming the individual's authority to act on behalf of the entity.", recommended: true,
        agents: ["outreach", "document", "audit"], agentLabel: "Request PoA from client",
        postRunSummary: "Client outreach sent requesting Power of Attorney or authorised signatory list. Case held pending receipt of documentation.",
        updates: [
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Awaiting client — PoA documentation requested" },
          { attr: "Outreach Log", before: "—", after: "Email queued · Template POA_REQUEST_v1 · SLA 7 business days" },
          { attr: "Acting Person Authority", before: "Not evidenced", after: "Pending — PoA requested" },
        ],
      },
      { id: "r2", title: "Revalidate Acting Person — replace with board member", desc: "Request client confirmation on whether the identified Acting Person should be replaced with a Vorstand / Executive Management Board member, or confirm current AP with formal authority documentation.",
        agents: ["identity", "document", "audit"], agentLabel: "Revalidate Acting Person selection",
        postRunSummary: "Client confirmed Acting Person selection and provided updated signatory documentation. Case updated with evidenced authority.",
        updates: [
          { attr: "Acting Person", before: "Unconfirmed — no authority documentation", after: "Confirmed — PoA / authorised signatory on file" },
          { attr: "Case Status", before: "Open · Pending analyst action", after: "Resolved — authority documented" },
        ],
      },
    ],
  },
];

// ---------- Side-by-side comparison data per exception ----------
type CompareRow = { field: string; a: string; b: string; conflict?: boolean };
type Compare = { aLabel: string; bLabel: string; rows: CompareRow[] };

const COMPARISONS: Record<string, Compare> = {
  e1: {
    aLabel: "Companies House PSC Register",
    bLabel: "Form CS01 (03/14/2026)",
    rows: [
      { field: "PSC Name", a: "Mr Alan Eldad Howard", b: "Mr Alan Eldad Howard" },
      { field: "Correspondence Address", a: "82 Baker Street, London W1U 6AE", b: "27 Hill Street, London W1J 5LP", conflict: true },
      { field: "PSC02 Notification (14-day window)", a: "Not received", b: "Not filed", conflict: true },
      { field: "Date of Birth", a: "1963-09", b: "1963-09" },
    ],
  },
  e2: {
    aLabel: "Companies House Officer Record",
    bLabel: "EDD Policy POL-EDD-23",
    rows: [
      { field: "Corporate Member", a: "BH Partnership Holdings Limited", b: "BH Partnership Holdings Limited" },
      { field: "Jurisdiction", a: "Jersey, Channel Islands", b: "Jersey listed — EDD required", conflict: true },
      { field: "EDD Pack on File", a: "Not present", b: "Required (SOW + UBO chart)", conflict: true },
      { field: "UBO Resolution", a: "Unresolved at corporate layer", b: "Required to natural persons", conflict: true },
    ],
  },
  e3: {
    aLabel: "Companies House",
    bLabel: "Internal CRM",
    rows: [
      { field: "Current Name", a: "Brevan Howard Asset Management LLP", b: "Brevan Howard Asset Management LLP" },
      { field: "Previous Name", a: "Rivage Capital Management LLP (until 2007)", b: "— (not stored)", conflict: true },
      { field: "Company Number", a: "OC302636", b: "OC302636" },
      { field: "FCA FRN Continuity", a: "Continuous since 2003", b: "Lineage gap at 2007 name change", conflict: true },
    ],
  },
  e4: {
    aLabel: "FCA Register (04/19/2026)",
    bLabel: "CRM Permission Set (11/02/2025)",
    rows: [
      { field: "FRN", a: "211088", b: "211088" },
      { field: "Investment Management", a: "Active", b: "Active" },
      { field: "Managing an AIF", a: "Active · eff. 2026-02-11", b: "Not present", conflict: true },
      { field: "AIFMD Scope", a: "In-scope (Art. 23 disclosure)", b: "Out-of-scope", conflict: true },
    ],
  },
  e5: {
    aLabel: "HMT Consolidated List entry",
    bLabel: "Client Identity on File",
    rows: [
      { field: "Name", a: "Paul Marshall", b: "Sir Paul Marshall" },
      { field: "Date of Birth", a: "1971", b: "1959", conflict: true },
      { field: "Nationality", a: "Zimbabwean", b: "British", conflict: true },
      { field: "Status", a: "De-listed (Zimbabwe regime)", b: "Active KYC · knighted 2016" },
      { field: "Passport", a: "—", b: "HMRC-verified on file" },
    ],
  },
  e6: {
    aLabel: "Client Onboarding Form",
    bLabel: "SEC IAPD (Form ADV Part 1A)",
    rows: [
      { field: "US Registration Number", a: "801-12345 (self-reported)", b: "801-67890 (retrieved 2026-05-20)", conflict: true },
      { field: "Legal Entity Name", a: "Long Focus Capital Management, LLC", b: "Long Focus Capital Management, LLC" },
      { field: "Principal Address", a: "456 Broad Avenue, New York, NY", b: "456 Broad Avenue, New York, NY" },
    ],
  },
  e7: {
    aLabel: "GLEIF Registry",
    bLabel: "Client Onboarding Form",
    rows: [
      { field: "LEI Code", a: "No active LEI under entity legal name", b: "Not provided", conflict: true },
      { field: "Search by US Reg # 801-67890", a: "No match", b: "n/a", conflict: true },
      { field: "AUM (context)", a: "n/a", b: "$2.4B reported" },
    ],
  },
  e8: {
    aLabel: "Corporate Website",
    bLabel: "Form ADV Filing (SEC)",
    rows: [
      { field: "Principal Address", a: "123 Main Street, New York, NY 10001", b: "456 Broad Avenue, New York, NY 10005", conflict: true },
      { field: "Source Date", a: "Retrieved 2026-05-20", b: "Filing dated 2026-03-31" },
      { field: "Matches Client Form", a: "No", b: "Yes", conflict: true },
    ],
  },
  e9: {
    aLabel: "Form ADV Schedule A",
    bLabel: "Client Submitted Documents",
    rows: [
      { field: "Compliance Officer Name", a: "Sarah Chen (Chief Compliance Officer)", b: "Not listed", conflict: true },
      { field: "Signed Attestation", a: "n/a", b: "Not provided", conflict: true },
    ],
  },
  e10: {
    aLabel: "Form ADV Schedule A",
    bLabel: "Public Registry Traversal",
    rows: [
      { field: "25%+ Beneficial Owner", a: "Long Focus Holdings LLC (100%) — entity, not individual", b: "Chain terminates at Long Focus Holdings LLC; no further public data", conflict: true },
      { field: "FinCEN BOI Filing", a: "Not provided by client", b: "n/a", conflict: true },
      { field: "Companies House (UK branch)", a: "No PSC at >25%", b: "n/a" },
    ],
  },
  b1: {
    aLabel: "Internal Risk Model Output",
    bLabel: "Prior UK Policy Closure (Jan 2026)",
    rows: [
      { field: "Risk Rating", a: "High (Cayman ownership triggered)", b: "Low (no adverse factors)", conflict: true },
      { field: "Ownership Threshold Applied", a: "10% (system-triggered)", b: "25% (prior assessment)", conflict: true },
      { field: "UBO", a: "Brookfield Asset Management group", b: "Brookfield Asset Management group" },
      { field: "Client Cooperation", a: "Full cooperation on record", b: "Full cooperation on record" },
    ],
  },
  b2: {
    aLabel: "Form ADV (SEC)",
    bLabel: "Client Onboarding Response",
    rows: [
      { field: "Nature of Business", a: "Investment adviser / asset manager", b: "Holding company / financing vehicle (intra-group)", conflict: true },
      { field: "CIP Classification", a: "Financial Entity (Investment Entity) — system-triggered", b: "NFIE (Non-Financial Entity) — client confirmed", conflict: true },
      { field: "Third-Party Activity", a: "Indicates financial investment activity", b: "Intra-group only (per client)", conflict: true },
    ],
  },
  b3: {
    aLabel: "Form ADV Schedule A",
    bLabel: "Client Submitted Documents",
    rows: [
      { field: "Acting Person Classification", a: "Identified — not on governing board", b: "No authority documentation provided", conflict: true },
      { field: "Power of Attorney Evidence", a: "Not on file", b: "Not provided", conflict: true },
      { field: "Authorised Signatory List", a: "Not referenced", b: "Not provided", conflict: true },
    ],
  },
};

const getSla = (title: string, recommended?: boolean): string => {
  const t = title.toLowerCase();
  if (t.includes("escalate")) return "24 hours";
  if (t.includes("request") || t.includes("outreach")) return "7 business days";
  if (t.includes("defer")) return "Until evidence received";
  if (recommended) return "2 business days";
  return "5 business days";
};

const severityFromConfidence = (c: number): { label: "High" | "Medium" | "Low"; ring: string; text: string } => {
  if (c >= 90) return { label: "High", ring: "stroke-alert", text: "text-alert" };
  if (c >= 85) return { label: "Medium", ring: "stroke-warning", text: "text-warning" };
  return { label: "Low", ring: "stroke-success", text: "text-success" };
};

const buildHeaderMeta = (addressed: number, total: number) => [
  { label: "Exceptions", value: `${addressed}/${total}`, suffix: "addressed" },
  { label: "Due Date", value: "Apr 25, 2026" },
  { label: "Risk", value: "Elevated", tone: "alert" as const },
  { label: "Priority", value: "High" },
];

const DEFAULT_SELECTED_ENTITIES: { name: string; kyc: string; drg?: string }[] = [];

// KYC refs that have fully-curated hardcoded exceptions (used as fallback only)
const HARDCODED_KYCS = new Set(exceptions.map((e) => e.kyc));

// ─── DB exception types ───────────────────────────────────────────────────────

type DbExcRow = {
  id: string;
  kyc_ref: string;
  exception_number: number;
  field_name: string | null;
  title: string;
  sources: {
    source_a: string;
    source_b: string;
    rows: { field: string; source_a: string; source_b: string }[];
  } | null;
  reasoning: string[];
  recommended_actions: { option: number; description: string }[];
  status: string;
};

function dbRowToExc(row: DbExcRow, entityName: string): Exc {
  return {
    id: `db-${row.kyc_ref}-${row.exception_number}`,
    title: row.title,
    confidence: 82,
    status: row.status === "open" ? "Pending" : "Addressed",
    entity: entityName,
    kyc: row.kyc_ref,
    category: row.field_name ?? "General",
    attrLabel: row.field_name ?? undefined,
    flagText: row.reasoning[0] ?? row.title,
    narrative: row.reasoning.slice(1).join(" "),
    reasoningSteps: row.reasoning,
    evidenceRationale: "Based on source data comparison. Refer to the comparison table for field-level evidence.",
    evidence: [],
    acceptability: "Review the comparison sources and apply the recommended resolution option.",
    resolutions: row.recommended_actions.map((ra) => ({
      id: `r${ra.option}`,
      title: ra.description,
      desc: ra.description,
      recommended: ra.option === 1,
      agents: [] as AgentId[],
      agentLabel: ra.description,
      postRunSummary: `Resolution option ${ra.option} applied.`,
      updates: [],
    })),
  };
}

function dbSourcesToCompare(sources: DbExcRow["sources"]): Compare | null {
  if (!sources?.rows?.length) return null;
  return {
    aLabel: sources.source_a ?? "Source A",
    bLabel: sources.source_b ?? "Source B",
    rows: sources.rows.map((r) => ({
      field: r.field,
      a: r.source_a,
      b: r.source_b,
      conflict: r.source_a !== r.source_b,
    })),
  };
}

type ResolvedInfo = { resolutionId: string; resolutionTitle: string; agentLabel: string };

const ExceptionReview = () => {
  const location = useLocation();
  const { kycRef: urlKycRef } = useParams<{ kycRef: string }>();
  const navState = location.state as { entities?: { name: string; kyc: string; drg?: string }[] } | null;

  const [fetchedEntities, setFetchedEntities] = useState<{ name: string; kyc: string; drg?: string }[] | null>(null);
  useEffect(() => {
    if (navState?.entities?.length || !urlKycRef) { setFetchedEntities(null); return; }
    apiFetch(`${AGENT_API_BASE}/api/entity/${urlKycRef}`)
      .then((r) => r.ok ? r.json() : null)
      .then((ent) => ent && setFetchedEntities([{ name: ent.entity_name, kyc: ent.kyc_ref, drg: ent.drgs?.name }]))
      .catch(() => {});
  }, [urlKycRef, navState]);

  const selectedEntities = useMemo(() => {
    if (navState?.entities?.length) return navState.entities;
    if (fetchedEntities) return fetchedEntities;
    // Use URL kycRef as a placeholder to prevent fallback to hardcoded Brevan Howard exceptions
    if (urlKycRef) return [{ name: '…', kyc: urlKycRef }];
    return DEFAULT_SELECTED_ENTITIES;
  }, [navState, fetchedEntities, urlKycRef]);
  const selectedKycSet = useMemo(() => new Set(selectedEntities.map((e) => e.kyc)), [selectedEntities]);
  const selectedNameSet = useMemo(() => new Set(selectedEntities.map((e) => e.name)), [selectedEntities]);
  const filteredExceptions = useMemo(
    () => exceptions.filter((e) => selectedKycSet.has(e.kyc) || selectedNameSet.has(e.entity)),
    [selectedKycSet, selectedNameSet],
  );

  // Build a placeholder exception for a selected entity that has no curated exceptions
  const buildStubException = (ent: { name: string; kyc: string }): Exc => ({
    id: `stub-${ent.kyc || ent.name}`,
    title: "No open exceptions",
    category: "Review",
    confidence: 100,
    status: "Addressed",
    entity: ent.name,
    kyc: ent.kyc,
    flagText: `No outstanding exceptions are currently flagged for ${ent.name}. Review attributes and documents in the right pane.`,
    narrative: `${ent.name} (${ent.kyc}) has no open exception items in this case. All curated checks have either been resolved or are not applicable. Use the Attributes and Document Locker panels to inspect the underlying data.`,
    reasoningSteps: [
      `Loaded entity profile for ${ent.name}.`,
      "No exception rows matched the selection in the curated exception set.",
      "Rendering an informational placeholder so the detail view reflects the selected case.",
    ],
    evidenceRationale: "No evidence required — informational placeholder.",
    evidence: [],
    acceptability: "Acceptable — no action required.",
    resolutions: [],
  });

  // DB-fetched exceptions for entities not in the hardcoded set
  const [dbExceptions, setDbExceptions] = useState<Exc[]>([]);
  const [dynamicComparisons, setDynamicComparisons] = useState<Record<string, Compare>>({});

  useEffect(() => {
    // M1: Always fetch from DB for all selected entities.
    // Hardcoded exceptions remain as fallback when DB returns empty (effectiveExceptions below).
    if (selectedEntities.length === 0) { setDbExceptions([]); return; }

    Promise.all(
      selectedEntities.map((ent) =>
        apiFetch(`${AGENT_API_BASE}/api/entity/${ent.kyc}/exceptions`)
          .then((r) => (r.ok ? r.json() : Promise.resolve([])) as Promise<DbExcRow[]>)
          .then((rows) => rows.map((row) => ({ exc: dbRowToExc(row, ent.name), cmp: dbSourcesToCompare(row.sources), excId: `db-${row.kyc_ref}-${row.exception_number}` })))
          .catch(() => [])
      )
    ).then((results) => {
      const flat = results.flat();
      setDbExceptions(flat.map((r) => r.exc));
      const comps: Record<string, Compare> = {};
      for (const { excId, cmp } of flat) {
        if (cmp) comps[excId] = cmp;
      }
      setDynamicComparisons(comps);
    });
  }, [selectedEntities]);

  const effectiveExceptions = useMemo(() => {
    // DB exceptions take precedence; for entities with no DB data, fall back to
    // hardcoded curated exceptions (Brevan Howard / Marshall Wace demo data).
    const dbKycs = new Set(dbExceptions.map((e) => e.kyc));
    const hardcodedFallback = filteredExceptions.filter((e) => !dbKycs.has(e.kyc));
    const all = [...dbExceptions, ...hardcodedFallback];
    if (all.length > 0) return all;
    return selectedEntities.map(buildStubException);
  }, [filteredExceptions, dbExceptions, selectedEntities]);
  const initialActiveId = effectiveExceptions[0]?.id;

  const [activeId, setActiveId] = useState(initialActiveId);
  const [openAgent, setOpenAgent] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedInfo>>({});
  const [showReasoning, setShowReasoning] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceDoc, setEvidenceDoc] = useState<{ doc: AttrDoc; attr: EntityAttr; entity: string } | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"locker" | "collab" | "files">("locker");
  const [attrViewMode, setAttrViewMode] = useState<"exception" | "attributes">("exception");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalation, setEscalation] = useState<null | "fcc" | "business">(null);
  const [reachOutOpen, setReachOutOpen] = useState(false);
  const [reachOutModal, setReachOutModal] = useState<null | "email" | "zoom">(null);
  const [reachOutCount, setReachOutCount] = useState(0);
  const [outreachEmail, setOutreachEmail] = useState("");
  const [zoomDuration, setZoomDuration] = useState("30 min");
  const [zoomDate, setZoomDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [zoomTime, setZoomTime] = useState("10:00");
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomMeeting, setZoomMeeting] = useState<{
    id: number; join_url: string; start_url: string; password: string; topic: string;
  } | null>(null);
  const [zoomError, setZoomError] = useState<string | null>(null);
  
  
  const { runAgents, isRunning, currentLabel, runs, setEntityContext, setQaReviewCallback } = useAgents();

  useEffect(() => {
    setQaReviewCallback(() => () => setOpenAgent(true));
    return () => setQaReviewCallback(null);
  }, [setQaReviewCallback]);

  // If selection changes and current active is no longer in the effective set, reset
  useEffect(() => {
    if (!effectiveExceptions.find((e) => e.id === activeId)) {
      setActiveId(effectiveExceptions[0]?.id ?? exceptions[0].id);
    }
  }, [effectiveExceptions, activeId]);

  const active = (effectiveExceptions.find((e) => e.id === activeId) ?? effectiveExceptions[0] ?? exceptions[0])!;

  const activeDrg = selectedEntities.find((e) => e.kyc === active.kyc)?.drg ?? null;
  const drgEntities = activeDrg
    ? selectedEntities.filter((e) => e.drg === activeDrg)
    : [];

  // Keep agent context in sync with the currently viewed entity so "Run Agent" dropdown knows what to search
  useEffect(() => {
    setEntityContext({ name: active.entity, kyc: active.kyc });
    return () => setEntityContext(null);
  }, [active.entity, active.kyc, setEntityContext]);

  const openEvidence = (ev: Evidence) => {
    const lower = ev.name.toLowerCase();
    const kind: AttrDocKind =
      lower.includes("passport") ? "passport"
      : lower.includes("letter") ? "letter"
      : lower.includes("register") || lower.includes("fca") ? "register"
      : lower.includes("screenshot") || lower.includes("crm") ? "screenshot"
      : "filing";
    const doc: AttrDoc = {
      id: `${active.id}-${ev.name}`,

      title: ev.name,
      source: ev.sub.split("·")[0]?.trim() || ev.sub,
      date: new Date().toISOString().slice(0, 10),
      kind,
      pages: 1,
      fields: [
        { label: "Document", value: ev.name },
        { label: "Reference", value: ev.sub, highlight: true },
        { label: "Entity", value: active.entity },
        { label: "Case", value: active.kyc },
      ],
      body: [
        `This document is cited as supporting evidence for the exception "%%${active.title}%%".`,
        ``,
        active.evidenceRationale,
        ``,
        `Flagged finding: ${active.flagText}`,
      ],
    };
    const attr: EntityAttr = { label: active.category, value: ev.sub, source: "Forge", status: "warn" };
    setEvidenceDoc({ doc, attr, entity: active.entity });
  };

  // Reset disclosures when switching exception
  useEffect(() => {
    setShowReasoning(false);
    setShowEvidence(false);
  }, [activeId]);



  const isResolved = !!resolvedMap[active.id];

  const handleResolutionClick = (id: string) => {
    if (isResolved || isRunning) return;
    setSelectedResolution(selectedResolution === id ? null : id);
  };

  const handleConfirmRun = () => {
    if (!selectedResolution || isResolved || isRunning) return;
    const cfg = active.resolutions.find((r) => r.id === selectedResolution);
    if (cfg) runAgents(cfg.agents, cfg.agentLabel);
  };

  // When an agent run for the selected resolution completes, mark this exception resolved.
  const lastMarkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedResolution) return;
    const cfg = active.resolutions.find((r) => r.id === selectedResolution);
    if (!cfg) return;
    const key = `${active.id}:${cfg.id}:${currentLabel}`;
    const done = currentLabel === cfg.agentLabel && !isRunning && runs.length > 0 && runs.every((r) => r.state === "done");
    if (done && lastMarkedRef.current !== key) {
      lastMarkedRef.current = key;
      setResolvedMap((prev) => ({
        ...prev,
        [active.id]: { resolutionId: cfg.id, resolutionTitle: cfg.title, agentLabel: cfg.agentLabel },
      }));
    }
  }, [isRunning, runs, currentLabel, selectedResolution, active]);

  const addressedCount = Object.keys(resolvedMap).filter((id) => effectiveExceptions.find((e) => e.id === id)).length;
  const headerMeta = buildHeaderMeta(addressedCount, effectiveExceptions.length);





  return (
    <>
    {graphOpen && (
      <GraphView
        kycId={active.kyc}
        entityName={active.entity}
        onClose={() => setGraphOpen(false)}
      />
    )}
    <div className="px-6 py-2 max-w-[1480px] mx-auto">
      {/* ── Exception / Attributes view toggle ──────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        {/* Segmented pill */}
        <div className="inline-flex items-center bg-secondary rounded-lg p-1 gap-1">
          <button
            onClick={() => setAttrViewMode("exception")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all",
              attrViewMode === "exception"
                ? "bg-card shadow-sm border border-border text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldAlert className={cn("size-4", attrViewMode === "exception" ? "text-warning" : "text-muted-foreground")} />
            Exception
            {(() => {
              const n = effectiveExceptions.filter(e => e.status === "Pending").length;
              return n > 0 ? (
                <span className="bg-alert-soft text-alert text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-alert-soft-border">{n}</span>
              ) : null;
            })()}
          </button>
          <button
            onClick={() => setAttrViewMode("attributes")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all",
              attrViewMode === "attributes"
                ? "bg-card shadow-sm border border-border text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Database className={cn("size-4", attrViewMode === "attributes" ? "text-primary" : "text-muted-foreground")} />
            Attributes
            {(() => {
              const n = selectedEntities.reduce((sum, e) => sum + (ENTITY_PROFILES[e.name]?.attrs.length ?? 0), 0);
              return n > 0 ? (
                <span className="bg-secondary text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-border">{n}</span>
              ) : null;
            })()}
          </button>
        </div>
        {attrViewMode === "attributes" && (
          <button
            onClick={() => runAgents(["document", "audit"], "Re-run all attributes")}
            className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            <RotateCw className="size-3" /> Re-run Agents
          </button>
        )}
      </div>

      {/* Top header — entity ribbon shown in both modes */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 gap-y-2 flex-1 flex-wrap min-w-[380px]">
            <div className="w-full">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">DRG</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 hover:text-primary transition-colors group">
                    <h1 className="text-[15px] font-semibold group-hover:underline underline-offset-2">
                      {activeDrg ?? "No DRG Assigned"}
                    </h1>
                    <Info className="size-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">DRG Details</p>
                  {activeDrg ? (
                    <>
                      <div className="space-y-2 text-sm mb-3">
                        <div className="flex justify-between"><span className="text-muted-foreground">DRG Name</span><span className="font-medium">{activeDrg}</span></div>
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Entities in DRG ({drgEntities.length})
                      </p>
                      <ul className="space-y-1 text-[12px]">
                        {drgEntities.map((r) => (
                          <li key={r.kyc} className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="size-3 shrink-0" />
                            {r.name} · {r.kyc}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">This entity is not assigned to a DRG.</p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            {headerMeta.map((m) => (
              <div key={m.label}>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{m.label}</p>
                <p className={cn("text-[14px] font-medium", m.tone === "alert" && "text-alert")}>
                  {m.value} {m.suffix && <span className="text-muted-foreground font-normal">{m.suffix}</span>}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setGraphOpen(true)}
              className="text-sm px-4 py-2 rounded-full border border-border flex items-center gap-2 hover:bg-secondary transition-colors"
            >
              <Network className="size-4" /> Graph View
            </button>
            <Popover open={reachOutOpen} onOpenChange={setReachOutOpen}>
              <PopoverTrigger asChild>
                <button className="text-sm px-4 py-2 rounded-full border border-border flex items-center gap-2 hover:bg-secondary transition-colors">
                  <Mail className="size-4" /> Initiate Outreach
                  {reachOutCount > 0 && (
                    <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center font-semibold">
                      {reachOutCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-1">
                <div className="px-3 pt-2 pb-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Choose outreach method</p>
                </div>
                <button
                  onClick={() => { setReachOutModal("email"); setReachOutOpen(false); }}
                  className="w-full text-left p-3 rounded-md hover:bg-secondary flex gap-3 items-start transition-colors"
                >
                  <Mail className="size-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Send Email</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Compose a templated outreach to the client's compliance team.</p>
                  </div>
                </button>
                <button
                  onClick={() => { setReachOutModal("zoom"); setReachOutOpen(false); }}
                  className="w-full text-left p-3 rounded-md hover:bg-secondary flex gap-3 items-start transition-colors"
                >
                  <Video className="size-4 mt-0.5 shrink-0 text-[#2D8CFF]" />
                  <div>
                    <p className="text-sm font-medium">Schedule Zoom Call</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Book a video call with the client to discuss outstanding items.</p>
                  </div>
                </button>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1 border border-border rounded-full overflow-hidden">
              <Link to="/work-queue" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 hover:bg-secondary transition-colors">Cancel</Link>
              <span className="w-px h-6 bg-border" />
            <Popover open={escalateOpen} onOpenChange={setEscalateOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "text-sm px-4 py-2 flex items-center gap-2 transition-colors",
                    escalation
                      ? "bg-warning-soft text-warning-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <AlertTriangle className="size-4" />
                  {escalation === "fcc" ? "Escalated · FCC" : escalation === "business" ? "Escalated · Business" : "Escalate"}
                  <ChevronDown className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-1">
                <button
                  onClick={() => { setEscalation("fcc"); setEscalateOpen(false); }}
                  className="w-full text-left p-3 rounded-md hover:bg-secondary flex gap-3 items-start"
                >
                  <ShieldAlert className="size-4 mt-0.5 text-alert" />
                  <div>
                    <p className="text-sm font-medium">Escalate to FCC</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Financial Crime Compliance review — SAR triage & MLRO oversight.</p>
                  </div>
                </button>
                <button
                  onClick={() => { setEscalation("business"); setEscalateOpen(false); }}
                  className="w-full text-left p-3 rounded-md hover:bg-secondary flex gap-3 items-start"
                >
                  <Briefcase className="size-4 mt-0.5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Escalate to Business</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Relationship Manager outreach for client clarification & documents.</p>
                  </div>
                </button>
              </PopoverContent>
            </Popover>
              <span className="w-px h-6 bg-border" />
              <button className="text-sm px-4 py-2 bg-primary text-primary-foreground flex items-center gap-2 hover:opacity-95 transition-opacity">
                <Send className="size-4" /> Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selected entities */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-xs text-muted-foreground">Selected Entities <span className="text-foreground font-medium">({selectedEntities.length})</span></span>
        {selectedEntities.map((e) => (
          <span key={e.kyc} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs shadow-sm">
            <Building2 className="size-3 text-muted-foreground" />
            <span className="font-medium">{e.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">{e.kyc}</span>
            <button className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
          </span>
        ))}
      </div>

      {attrViewMode === "exception" && (
      <>
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `260px ${rightPaneOpen ? "44px" : "minmax(0,1fr)"} ${rightPaneOpen ? "minmax(0,1fr)" : "44px"}`,
        }}
      >
        {/* Exceptions list */}
        <aside className="border-r border-border pr-6">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Exceptions ({effectiveExceptions.length})</span>
          </div>
          <ul className="space-y-2">
            {effectiveExceptions.map((e) => {
              const isActive = e.id === activeId;
              const resolved = resolvedMap[e.id];
              const isResolved = Boolean(resolved);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => { setActiveId(e.id); setSelectedResolution(resolvedMap[e.id]?.resolutionId ?? null); }}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-all relative",
                      isActive && !isResolved && "border-primary bg-info-soft shadow-sm",
                      isActive && isResolved && "border-success bg-success-soft/40 shadow-sm",
                      !isActive && isResolved && "border-success-soft-border bg-success-soft/20 hover:bg-success-soft/30",
                      !isActive && !isResolved && "border-border bg-card hover:bg-secondary/50 hover:border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-tight">{e.title}</span>
                      {isResolved ? (
                        <CheckCircle2 className="size-4 text-success shrink-0" />
                      ) : (() => {
                        const sev = severityFromConfidence(e.confidence);
                        return (
                          <span
                            className="relative size-7 shrink-0"
                            title={`${sev.label} severity · ${e.confidence}% confidence`}
                          >
                            <svg viewBox="0 0 36 36" className="size-7 -rotate-90">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="4" />
                              <circle
                                cx="18" cy="18" r="15.9" fill="none"
                                className={sev.ring}
                                strokeWidth="4"
                                strokeDasharray={`${e.confidence} 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className={cn("absolute inset-0 grid place-items-center text-[8px] font-semibold tabular-nums", sev.text)}>
                              {e.confidence}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{e.category}</p>
                    <p className="text-[11px] mt-1 flex items-center gap-1">
                      <span className={cn("size-1.5 rounded-full", isResolved ? "bg-success" : "bg-warning animate-pulse-dot")} />
                      <span className={cn(isResolved ? "text-success font-medium" : "text-muted-foreground")}>
                        {isResolved ? "Resolved" : "Pending"}
                      </span>
                    </p>
                    {isResolved && (
                      <div className="mt-2 rounded-md border border-success-soft-border bg-card/60 px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-wide text-success font-medium mb-0.5">Resolution applied</p>
                        <p className="text-[11px] leading-snug">{resolved!.resolutionTitle}</p>
                      </div>
                    )}
                    <div className="mt-2 text-[10px]">
                      <div className="flex items-start gap-1">
                        <Building2 className="size-2.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug line-clamp-2">{e.entity}</span>
                      </div>
                      <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{e.kyc}</span>
                    </div>

                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: Exception summary — auto-collapses when right pane opens */}
        {rightPaneOpen ? (
          <aside className="rounded-xl border border-border bg-card shadow-sm flex flex-col items-center py-3 gap-2">
            <button
              onClick={() => setRightPaneOpen(false)}
              className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"
              title="Expand exception summary"
            >
              <ChevronDown className="size-3.5 -rotate-90" />
            </button>
            <button
              onClick={() => setRightPaneOpen(false)}
              className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground [writing-mode:vertical-rl] rotate-180 flex items-center gap-1.5"
            >
              <Settings2 className="size-3" /> Exception Summary
            </button>
          </aside>
        ) : (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <header className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <Settings2 className="size-3.5 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wide">Exception Summary</h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="size-3" /> {active.entity}
                <span className="px-1.5 py-0.5 rounded bg-secondary">{active.kyc}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-soft-border text-[11px] font-medium">
                {active.confidence}% Confidence
              </span>
              <span className="text-xs text-muted-foreground">Reasoned in {active.reasoningSteps.length} steps</span>
            </div>
          </header>

          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Why this exception exists</p>
              <div className="rounded-lg border border-warning-soft-border bg-warning-soft/50 p-3 flex items-start gap-2 mb-3">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <p className="text-[13px]">{active.flagText}</p>
              </div>
              {(() => {
                const cmp = COMPARISONS[active.id] ?? dynamicComparisons[active.id];
                if (!cmp) {
                  return (
                    <p className={cn("text-[13px] text-muted-foreground leading-relaxed", !showReasoning && "line-clamp-2")}>
                      {active.narrative}
                    </p>
                  );
                }
                return (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-[160px_1fr_1fr] text-[10px] font-medium uppercase tracking-wide bg-secondary/60">
                      <div className="px-3 py-2 text-muted-foreground">Field</div>
                      <div className="px-3 py-2 border-l border-border">
                        <span className="text-muted-foreground">Source A · </span>
                        <span className="text-foreground normal-case font-semibold tracking-normal">{cmp.aLabel}</span>
                      </div>
                      <div className="px-3 py-2 border-l border-border">
                        <span className="text-muted-foreground">Source B · </span>
                        <span className="text-foreground normal-case font-semibold tracking-normal">{cmp.bLabel}</span>
                      </div>
                    </div>
                    {cmp.rows.map((r) => (
                      <div
                        key={r.field}
                        className={cn(
                          "grid grid-cols-[160px_1fr_1fr] text-[12px] border-t border-border",
                          r.conflict && "bg-warning-soft/40"
                        )}
                      >
                        <div className="px-3 py-2 text-muted-foreground flex items-center gap-1.5">
                          {r.conflict && <AlertTriangle className="size-3 text-warning shrink-0" />}
                          <span>{r.field}</span>
                        </div>
                        <div className={cn("px-3 py-2 border-l border-border", r.conflict && "font-bold text-foreground")}>{r.a}</div>
                        <div className={cn("px-3 py-2 border-l border-border", r.conflict && "font-bold text-foreground")}>{r.b}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {showReasoning && (
                <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed italic">
                  {active.narrative}
                </p>
              )}

              {showReasoning && (
                <ol className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                  {active.reasoningSteps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="size-5 rounded-full bg-secondary text-foreground grid place-items-center text-[11px] font-medium shrink-0">{i+1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}

              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="mt-2 text-[12px] font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                {showReasoning ? "Show less" : `Show full reasoning (${active.reasoningSteps.length} steps)`}
                <ChevronDown className={cn("size-3.5 transition-transform", showReasoning && "rotate-180")} />
              </button>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supporting Evidence</p>
                <button
                  onClick={() => setShowEvidence((v) => !v)}
                  className="text-[12px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  {showEvidence ? "Hide" : `Show ${active.evidence.length} document${active.evidence.length === 1 ? "" : "s"}`}
                  <ChevronDown className={cn("size-3.5 transition-transform", showEvidence && "rotate-180")} />
                </button>
              </div>
              {showEvidence && (
                <>
                  <p className="text-[12px] text-muted-foreground italic leading-relaxed mb-3">
                    {active.evidenceRationale}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {active.evidence.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => openEvidence(d)}
                        className="text-left rounded-lg border border-border p-3 flex items-center justify-between hover:border-primary hover:bg-info-soft/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium truncate">{d.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{d.sub}</p>
                          </div>
                        </div>
                        <span className="text-[11px] px-3 py-1 rounded-full border border-primary text-primary shrink-0">View</span>
                      </button>
                    ))}

                  </div>
                </>
              )}
            </div>


            <div className="pt-4 border-t border-border">
              <p className="text-[13px] font-semibold mb-1">Resolution &amp; Next Actions</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-1">
                <span className="font-semibold text-foreground">Why this may be acceptable:</span> {active.acceptability}
              </p>
              <p className="text-[12px] italic text-muted-foreground mb-3">Choose one of the items below to continue</p>
              <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-3", isResolved && "opacity-60")}>
                {active.resolutions.map((opt) => {
                  const sel = selectedResolution === opt.id;
                  const sla = getSla(opt.title, opt.recommended);
                  const disabled = isResolved || isRunning;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleResolutionClick(opt.id)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      className={cn(
                        "text-left rounded-xl p-4 flex flex-col gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                        !disabled && "hover:shadow-md",
                        disabled && "cursor-not-allowed",
                        opt.recommended && !sel && "border-2 border-success bg-gradient-to-br from-success-soft to-card shadow-sm",
                        sel && "border-2 border-primary bg-info-soft shadow-md",
                        !opt.recommended && !sel && "border border-border bg-card",
                        !opt.recommended && !sel && !disabled && "hover:bg-secondary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {opt.recommended ? (
                            <Sparkles className={cn("size-4 shrink-0", sel ? "text-primary" : "text-success")} />
                          ) : sel ? (
                            <CheckCircle2 className="size-4 text-primary shrink-0" />
                          ) : (
                            <span className="size-4 rounded-full border border-border shrink-0" />
                          )}
                          <p className="text-[13px] font-bold leading-tight">{opt.title}</p>
                        </div>
                        {isResolved && sel ? (
                          <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground text-[10px] font-semibold uppercase tracking-wide shrink-0 inline-flex items-center gap-1">
                            <CheckCircle2 className="size-2.5" /> Resolved
                          </span>
                        ) : opt.recommended && !sel ? (
                          <span className="px-2 py-0.5 rounded-full bg-success text-success-foreground text-[10px] font-semibold uppercase tracking-wide shrink-0">Best</span>
                        ) : sel ? (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide shrink-0">Selected</span>
                        ) : null}
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-snug">{opt.desc}</p>
                      <div className="mt-auto pt-2 flex items-center gap-3 text-[11px] border-t border-border/60">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3" /> SLA: <span className="font-medium text-foreground">{sla}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Sparkles className="size-3" /> {opt.agents.length} agents
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedResolution && !isResolved && (() => {
                const sel = active.resolutions.find((o) => o.id === selectedResolution)!;
                return (
                  <div className="mt-3 rounded-lg border border-primary/30 bg-info-soft/60 p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[12px] text-foreground min-w-0">
                      <span className="font-semibold">Ready to run:</span>{" "}
                      <span className="text-muted-foreground">{sel.title}</span>
                      <span className="text-muted-foreground"> · {sel.agents.length} agents · SLA {getSla(sel.title, sel.recommended)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setSelectedResolution(null)} disabled={isRunning} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary disabled:opacity-50">Cancel</button>
                      <button onClick={handleConfirmRun} disabled={isRunning} className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-1.5">
                        <Play className="size-3" />
                        {isRunning ? "Running agents…" : "Confirm & run agents"}
                      </button>
                    </div>
                  </div>
                );
              })()}
              {isResolved && (
                <div className="mt-3 rounded-lg border border-success/40 bg-success-soft/60 p-3 text-[12px] flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                  <span><span className="font-semibold">Resolved.</span> Agents have completed this resolution — actions are locked.</span>
                </div>
              )}
              {active.resolutions.filter((o) => selectedResolution === o.id).map((opt) => (
                <div key={opt.id} className="mt-3">
                  <AgentReasoningBlock exception={active} resolution={opt} />
                </div>
              ))}
              <div className="mt-3 rounded-lg border border-border p-3">
                <input className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none" placeholder="Or enter a custom resolution note…" />
                <div className="flex items-center justify-end mt-2">
                  <button className="text-xs px-4 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-secondary flex items-center gap-2">
                    <Send className="size-3.5" /> Submit Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Right: Document Locker / Collaboration — collapsible */}
        {rightPaneOpen ? (
          <aside className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-border">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setRightTab("locker")}
                  className={cn(
                    "pb-2 text-sm flex items-center gap-1.5 -mb-px transition-colors",
                    rightTab === "locker"
                      ? "font-medium border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="size-4" /> Document Locker
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{CASE_DOCUMENTS.filter((d) => selectedEntities.some((e) => e.name === d.entity)).length}</span>
                </button>
                <button
                  onClick={() => setRightTab("collab")}
                  className={cn(
                    "pb-2 text-sm flex items-center gap-1.5 -mb-px transition-colors",
                    rightTab === "collab"
                      ? "font-medium border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="size-3.5" /> Collaboration
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{(COMMENTS_BY_KYC[active.kyc]?.length ?? 0)}</span>
                </button>
                <button
                  onClick={() => setRightTab("files")}
                  className={cn(
                    "pb-2 text-sm flex items-center gap-1.5 -mb-px transition-colors",
                    rightTab === "files"
                      ? "font-medium border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Folder className="size-3.5" /> Files
                </button>
              </div>
              <button
                onClick={() => setRightPaneOpen(false)}
                className="ml-2 size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"
                title="Collapse pane"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            {rightTab === "locker" && <DocumentLocker selectedEntityNames={selectedEntities.map((e) => e.name)} />}
            {rightTab === "collab" && <CollabPanel entity={active.entity} kyc={active.kyc} />}
            {rightTab === "files"  && <div className="h-full overflow-hidden flex flex-col"><EntityFiles kycRef={active.kyc} /></div>}
          </aside>
        ) : (
          <aside className="rounded-xl border border-border bg-card shadow-sm flex flex-col items-center py-4">
            <button
              onClick={() => setRightPaneOpen(true)}
              className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors shrink-0"
              title="Expand right pane"
            >
              <ChevronDown className="size-3.5 rotate-90" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-evenly w-full pt-3">
              <div className="relative">
                <button
                  onClick={() => { setRightPaneOpen(true); setRightTab("locker"); }}
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary/60 [writing-mode:vertical-rl] rotate-180 flex items-center gap-1.5 py-3 px-1.5 rounded-md transition-colors"
                  title="Document Locker"
                >
                  <FileText className="size-3" /> Documents
                </button>
                {CASE_DOCUMENTS.filter((d) => selectedEntities.some((e) => e.name === d.entity)).length > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[8px] grid place-items-center font-semibold leading-none">
                    {CASE_DOCUMENTS.filter((d) => selectedEntities.some((e) => e.name === d.entity)).length}
                  </span>
                )}
              </div>
              <div className="w-5 h-px bg-border/60" />
              <div className="relative">
                <button
                  onClick={() => { setRightPaneOpen(true); setRightTab("collab"); }}
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary/60 [writing-mode:vertical-rl] rotate-180 flex items-center gap-1.5 py-3 px-1.5 rounded-md transition-colors"
                  title="Collaboration"
                >
                  <MessageSquare className="size-3" /> Collaboration
                </button>
                {(COMMENTS_BY_KYC[active.kyc]?.length ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[8px] grid place-items-center font-semibold leading-none">
                    {COMMENTS_BY_KYC[active.kyc]?.length}
                  </span>
                )}
              </div>
              <div className="w-5 h-px bg-border/60" />
              <div className="relative">
                <button
                  onClick={() => { setRightPaneOpen(true); setRightTab("files"); }}
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-secondary/60 [writing-mode:vertical-rl] rotate-180 flex items-center gap-1.5 py-3 px-1.5 rounded-md transition-colors"
                  title="Files"
                >
                  <Folder className="size-3" /> Files
                </button>
              </div>
            </div>
          </aside>
        )}

      </div>
      </>
      )}
      {attrViewMode === "attributes" && (
        <ErrorBoundary label="AttributeFormView">
        <AttributeFormView
          selectedEntities={selectedEntities}
          exceptions={effectiveExceptions}
        />
        </ErrorBoundary>
      )}


      {openAgent && <AgentReviewModal onClose={() => setOpenAgent(false)} />}
      {evidenceDoc && (
        <DocumentViewerModal
          doc={evidenceDoc.doc}
          attr={evidenceDoc.attr}
          entity={evidenceDoc.entity}
          onClose={() => setEvidenceDoc(null)}
        />
      )}

      <EscalationDialog
        kind={escalation}
        active={active}
        onClose={() => setEscalation(null)}
      />

      {/* Email Outreach Modal */}
      {reachOutModal === "email" && (
        <Dialog open onOpenChange={() => setReachOutModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-4 text-primary" /> Compose Outreach Email
              </DialogTitle>
              <DialogDescription>
                Sending to <span className="font-medium text-foreground">{active.entity}</span> regarding <span className="font-medium text-foreground">{active.title}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">To</p>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-secondary/30">
                  <UserCircle2 className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="email"
                    value={outreachEmail}
                    onChange={(e) => setOutreachEmail(e.target.value)}
                    placeholder={`compliance@${active.entity.split(' ')[0].toLowerCase()}.com`}
                    className="text-sm flex-1 bg-transparent outline-none min-w-0"
                  />
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-info-soft text-primary border border-primary/20 shrink-0">Compliance Team</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">CC</p>
                <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  rm.anderson@kpmg.com
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Subject</p>
                <div className="rounded-lg border border-border px-3 py-2 text-sm">
                  [{active.kyc}] Outstanding KYC Item — {active.title}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Message</p>
                <textarea
                  defaultValue={`Dear ${active.entity} Compliance Team,\n\nI hope this message finds you well. I am writing regarding a KYC review item for ${active.kyc} that requires your attention.\n\n${active.flagText}\n\nCould you please provide the relevant documentation or clarification at your earliest convenience? Our SLA for this item closes on Apr 25, 2026.\n\nKind regards,\nKYC Analyst — KPMG`}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-transparent resize-none outline-none focus:ring-2 focus:ring-ring/30 min-h-[148px]"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Paperclip className="size-3.5" /> Attach document
                </button>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-[11px] text-muted-foreground">SLA: 7 business days</span>
              </div>
            </div>
            <DialogFooter>
              <button onClick={() => setReachOutModal(null)} className="text-sm px-4 py-2 rounded-full border border-border hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => { setReachOutCount((c) => c + 1); setReachOutModal(null); }}
                className="text-sm px-5 py-2 rounded-full bg-primary text-primary-foreground flex items-center gap-2 hover:opacity-95 transition-opacity shadow-sm"
              >
                <Send className="size-3.5" /> Send Email
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Zoom Scheduling Modal */}
      {reachOutModal === "zoom" && (
        <Dialog open onOpenChange={() => { setReachOutModal(null); setZoomMeeting(null); setZoomError(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="size-4 text-[#2D8CFF]" /> Schedule Zoom Call
              </DialogTitle>
              <DialogDescription>
                Book a video call with <span className="font-medium text-foreground">{active.entity}</span> to discuss outstanding items
              </DialogDescription>
            </DialogHeader>

            {/* ── Success state ── */}
            {zoomMeeting ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-success/40 bg-success-soft/50 p-4 flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-success">Meeting created</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{zoomMeeting.topic}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Meeting ID", value: String(zoomMeeting.id) },
                    { label: "Passcode", value: zoomMeeting.password },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{r.label}</span>
                      <span className="text-sm font-mono font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(zoomMeeting.join_url, "_blank")}
                    className="flex-1 text-sm py-2 rounded-full border border-[#2D8CFF] text-[#2D8CFF] hover:bg-[#2D8CFF]/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Video className="size-3.5" /> Join via Browser
                  </button>
                  <button
                    onClick={() => {
                      const zoommtg = `zoommtg://zoom.us/join?action=join&confno=${zoomMeeting.id}&pwd=${zoomMeeting.password}&zc=0`;
                      window.location.href = zoommtg;
                    }}
                    className="flex-1 text-sm py-2 rounded-full bg-[#2D8CFF] text-white hover:opacity-95 transition-opacity shadow-sm flex items-center justify-center gap-2"
                  >
                    <Video className="size-3.5" /> Open Desktop App
                  </button>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(zoomMeeting.join_url)}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Copy invite link
                </button>
              </div>
            ) : (
            /* ── Form state ── */
            <div className="space-y-3 py-1">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Meeting Title</p>
                <div className="rounded-lg border border-border px-3 py-2 text-sm bg-secondary/30">
                  [{active.kyc}] KYC Review — {active.title}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Attendees</p>
                <div className="space-y-1.5">
                  {[
                    { name: "KYC Analyst", email: "analyst@kpmg.com", you: true },
                    { name: "Compliance Team", email: outreachEmail || `compliance@${active.entity.split(' ')[0].toLowerCase()}.com` },
                    { name: "RM Anderson", email: "rm.anderson@kpmg.com" },
                  ].map((a) => (
                    <div key={a.email} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 bg-secondary/20">
                      <UserCircle2 className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[12px] font-medium flex-1">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground">{a.email}</span>
                      {a.you && <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">You</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Date</p>
                  <div className="rounded-lg border border-border px-3 py-2 flex items-center gap-2 text-sm">
                    <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="date"
                      value={zoomDate}
                      onChange={(e) => setZoomDate(e.target.value)}
                      className="bg-transparent outline-none flex-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Time (UTC)</p>
                  <div className="rounded-lg border border-border px-3 py-2 flex items-center gap-2 text-sm">
                    <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="time"
                      value={zoomTime}
                      onChange={(e) => setZoomTime(e.target.value)}
                      className="bg-transparent outline-none flex-1 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Duration</p>
                <div className="flex gap-2">
                  {["30 min", "45 min", "60 min"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setZoomDuration(d)}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-full border transition-colors",
                        zoomDuration === d
                          ? "border-[#2D8CFF] bg-[#2D8CFF]/10 text-[#2D8CFF] font-medium"
                          : "border-border hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Agenda</p>
                <textarea
                  id="zoom-agenda"
                  defaultValue={`1. Review outstanding KYC exception: ${active.title}\n2. Discuss required documentation\n3. Agree remediation timeline\n4. Q&A`}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-transparent resize-none outline-none focus:ring-2 focus:ring-ring/30 min-h-[80px]"
                />
              </div>
              {zoomError && (
                <div className="rounded-lg border border-alert/30 bg-alert-soft/50 px-3 py-2 text-[12px] text-alert flex items-center gap-2">
                  <AlertTriangle className="size-3.5 shrink-0" /> {zoomError}
                </div>
              )}
            </div>
            )}

            <DialogFooter>
              <button
                onClick={() => { setReachOutModal(null); setZoomMeeting(null); setZoomError(null); }}
                className="text-sm px-4 py-2 rounded-full border border-border hover:bg-secondary transition-colors"
              >
                {zoomMeeting ? "Close" : "Cancel"}
              </button>
              {!zoomMeeting && (
                <button
                  disabled={zoomLoading}
                  onClick={async () => {
                    setZoomLoading(true);
                    setZoomError(null);
                    try {
                      const agenda = (document.getElementById("zoom-agenda") as HTMLTextAreaElement)?.value ?? "";
                      const durationMins = parseInt(zoomDuration);
                      const startTime = new Date(`${zoomDate}T${zoomTime}:00Z`).toISOString();
                      const res = await fetch(`${AGENT_API_BASE}/api/zoom/create-meeting`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          topic: `[${active.kyc}] KYC Review — ${active.title}`,
                          agenda,
                          start_time: startTime,
                          duration: durationMins,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? "Failed to create meeting");
                      setZoomMeeting(data);
                      setReachOutCount((c) => c + 1);
                    } catch (err: unknown) {
                      setZoomError(err instanceof Error ? err.message : "Could not reach the local Zoom server. Is it running? (npm run server)");
                    } finally {
                      setZoomLoading(false);
                    }
                  }}
                  className="text-sm px-5 py-2 rounded-full bg-[#2D8CFF] text-white flex items-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity shadow-sm"
                >
                  {zoomLoading ? (
                    <><span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating…</>
                  ) : (
                    <><Video className="size-3.5" /> Schedule Meeting</>
                  )}
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
    </>
  );
};

// ---------- Attribute Tree with Agent Tracing ----------

const DocumentLocker = ({ selectedEntityNames }: { selectedEntityNames: string[] }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AttrDocKind>("all");
  const [preview, setPreview] = useState<CaseDoc | null>(null);

  const scoped = selectedEntityNames.length > 0
    ? CASE_DOCUMENTS.filter((d) => selectedEntityNames.includes(d.entity))
    : CASE_DOCUMENTS;

  const grouped = scoped
    .filter((d) => (filter === "all" || d.kind === filter))
    .filter((d) => !query || (d.title + d.source + d.entity).toLowerCase().includes(query.toLowerCase()))
    .reduce<Record<string, CaseDoc[]>>((acc, d) => {
      (acc[d.entity] ??= []).push(d);
      return acc;
    }, {});

  const kinds: ("all" | AttrDocKind)[] = ["all", "filing", "register", "passport", "letter", "screenshot"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-secondary/40 outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {kinds.map((k) => {
          const label = k === "all" ? "All" : DOC_KIND_META[k].label;
          const active = filter === k;
          const count = k === "all" ? CASE_DOCUMENTS.length : CASE_DOCUMENTS.filter((d) => d.kind === k).length;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-full border transition-colors",
                active
                  ? "border-primary bg-info-soft text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {label} <span className="opacity-60">· {count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([entity, docs]) => (
          <div key={entity}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold">{entity}</span>
              <span className="text-[10px] text-muted-foreground">· {docs.length} doc{docs.length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-1.5">
              {docs.map((d) => {
                const meta = DOC_KIND_META[d.kind];
                return (
                  <div
                    key={d.id}
                    className="group flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary hover:bg-info-soft/30 transition-colors"
                  >
                    <div className="size-9 rounded-md bg-secondary border border-border grid place-items-center shrink-0">
                      <FileText className="size-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium truncate">{d.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {d.source} · {d.date} · {d.size}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide", meta.tone)}>
                          {meta.label}
                        </span>
                        {d.linkedAttrs.slice(0, 2).map((a) => (
                          <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setPreview(d)}
                        className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-secondary"
                        title="Preview"
                      >
                        Preview
                      </button>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded-md border border-primary text-primary hover:bg-info-soft"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No documents match this filter.</p>
        )}
      </div>

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden">
            <DialogHeader className="px-5 py-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-sm truncate">{preview.title}</DialogTitle>
                  <DialogDescription className="text-[11px]">
                    {preview.entity} · {preview.source} · {preview.date}
                  </DialogDescription>
                </div>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-info-soft"
                >
                  Open in new tab
                </a>
              </div>
            </DialogHeader>
            <iframe src={preview.url} title={preview.title} className="flex-1 w-full bg-secondary/30" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};


// Attribute category taxonomy — ordered; first category is expanded by default
const ATTR_CATEGORY_ORDER = [
  "Entity Identification",
  "Registration & Regulatory",
  "Address & Operations",
  "Classification & Risk",
  "Financial Profile",
  "Officers & Signatories",
  "Ownership & Control",
] as const;
type AttrCategory = (typeof ATTR_CATEGORY_ORDER)[number];

const ATTR_CATEGORY_MAP: Record<string, AttrCategory> = {
  // Entity Identification
  "Entity Name": "Entity Identification",
  "Legal Form": "Entity Identification",
  "Legal Entity Type": "Entity Identification",
  "Company Number": "Entity Identification",
  "US Registration Number": "Entity Identification",
  "UK Registration Number": "Entity Identification",
  "Country of Incorporation": "Entity Identification",
  "Incorporated On": "Entity Identification",
  "Date of Incorporation": "Entity Identification",
  "Company Status": "Entity Identification",
  "Trading Names": "Entity Identification",
  "Previous Names": "Entity Identification",
  "Previous Company Names": "Entity Identification",
  "LEI Code": "Entity Identification",
  "Entity GIIN": "Entity Identification",
  "US Tax ID": "Entity Identification",
  "UK Tax ID": "Entity Identification",
  "EIN / TIN Verified": "Entity Identification",
  "Verification of Existence": "Entity Identification",
  "Constituent Entities": "Entity Identification",
  "Entity Count": "Entity Identification",
  "Jurisdiction": "Entity Identification",
  // Registration & Regulatory
  "Primary Regulator": "Registration & Regulatory",
  "Regulator": "Registration & Regulatory",
  "FCA Permissions": "Registration & Regulatory",
  "FCA Regulatory Permissions": "Registration & Regulatory",
  "Listing Status": "Registration & Regulatory",
  "Section 13 / 15d Indicator": "Registration & Regulatory",
  "CFTC Registered": "Registration & Regulatory",
  "AML Policy Version": "Registration & Regulatory",
  "KYC Refresh Cycle": "Registration & Regulatory",
  "Last KYC Refresh": "Registration & Regulatory",
  "Next KYC Refresh Due": "Registration & Regulatory",
  "Wolfsberg Questionnaire": "Registration & Regulatory",
  "CIP Status": "Registration & Regulatory",
  "Compliance Officer Attestation": "Registration & Regulatory",
  "MLRO / Equivalent": "Registration & Regulatory",
  // Address & Operations
  "Registered Office": "Address & Operations",
  "Legal Registered Address": "Address & Operations",
  "Principal Place of Business": "Address & Operations",
  "Foreign Branches": "Address & Operations",
  "Sub-Advisor Address": "Address & Operations",
  "Nature of Business": "Address & Operations",
  "Other Business Activity": "Address & Operations",
  "Sole Proprietorship": "Address & Operations",
  "Parent Listed on US Exchange": "Address & Operations",
  "List of Subsidiaries": "Address & Operations",
  // Classification & Risk
  "Entity Classification": "Classification & Risk",
  "Entity Risk Rating": "Classification & Risk",
  "CIP Classification": "Classification & Risk",
  "Customer Type": "Classification & Risk",
  "Risk Tier": "Classification & Risk",
  "Cross-Border Exposure": "Classification & Risk",
  "Open Exceptions": "Classification & Risk",
  "Sanctions Screening": "Classification & Risk",
  "PEP Screening": "Classification & Risk",
  "PEP Exposure": "Classification & Risk",
  "Adverse Media Screening": "Classification & Risk",
  "Tax Residency": "Classification & Risk",
  "FATCA Classification": "Classification & Risk",
  "CRS Classification": "Classification & Risk",
  // Financial Profile
  "AUM Disclosed": "Financial Profile",
  "Assets Under Management": "Financial Profile",
  "Source of Funds": "Financial Profile",
  "Source of Funds Verified": "Financial Profile",
  "Source of Wealth": "Financial Profile",
  "Transacting With": "Financial Profile",
  // Officers & Signatories
  "Corporate Officer": "Officers & Signatories",
  "Board Directors": "Officers & Signatories",
  "Designated Members": "Officers & Signatories",
  "Authorized Signatory": "Officers & Signatories",
  "Power of Attorney": "Officers & Signatories",
  "PSC Date of Birth": "Officers & Signatories",
  "PSC Nationality": "Officers & Signatories",
  // Ownership & Control
  "Controllers": "Ownership & Control",
  "Persons of Significant Control": "Ownership & Control",
  "Persons with Significant Control": "Ownership & Control",
  "Key Controller": "Ownership & Control",
  "Beneficial Owner (25%+)": "Ownership & Control",
  "Trustee": "Ownership & Control",
};

const categoryOf = (label: string): AttrCategory =>
  ATTR_CATEGORY_MAP[label] ?? "Entity Identification";

// M3: Shared categorization helper — replaces the duplicate implementations in
// AttributeTree and AttributeFormView.  Pass pendingOnly=true to filter unflagged attrs.
function buildAttrCategories(
  entity: string,
  attrs: string[],
  excs: Exc[],
  options: { pendingOnly?: boolean } = {},
): { category: AttrCategory; items: { label: string; flagged: boolean }[] }[] {
  const profile = ENTITY_PROFILES[entity];
  const isFlagged = (label: string) => {
    const traceFlagged = ATTRIBUTE_TRACES[label]?.status === "flagged";
    const pa = profile?.attrs.find((x) => x.label === label);
    const excFlagged = excs.some(
      (exc) => exc.entity === entity && exc.status === "Pending" &&
        (exc.attrLabel ? exc.attrLabel === label : exc.title === label)
    );
    return traceFlagged || pa?.status === "alert" || pa?.status === "warn" || excFlagged;
  };
  const visible = options.pendingOnly ? attrs.filter(isFlagged) : attrs;
  const buckets: Record<AttrCategory, { label: string; flagged: boolean }[]> = {
    "Entity Identification": [], "Registration & Regulatory": [], "Address & Operations": [],
    "Classification & Risk": [], "Financial Profile": [], "Officers & Signatories": [], "Ownership & Control": [],
  };
  for (const label of visible) buckets[categoryOf(label)].push({ label, flagged: !!isFlagged(label) });
  return ATTR_CATEGORY_ORDER
    .map((c) => ({ category: c, items: buckets[c] }))
    .filter((g) => g.items.length > 0);
}

type SelectedAttr = { label: string; entity: string };

const AttributeTree = ({ selectedEntities, exceptions: excs }: { selectedEntities: { name: string; kyc: string; drg?: string }[]; exceptions: Exc[] }) => {
  const [selected, setSelected] = useState<SelectedAttr | null>(null);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<{ doc: AttrDoc; attr: EntityAttr; entity: string } | null>(null);
  const [traceStepsOpen, setTraceStepsOpen] = useState(false);
  const [traceDocsOpen, setTraceDocsOpen] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  // entity::category -> open
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"cards" | "tree">("cards");
  // Reset disclosures when switching attribute
  useEffect(() => { setTraceStepsOpen(false); setTraceDocsOpen(false); }, [selected]);


  const { runAgents } = useAgents();

  // Resolve trace — preferring the curated ATTRIBUTE_TRACES, falling back to a
  // synthesized trace from the entity profile so every clicked attribute shows
  // provenance information.
  const trace = useMemo(() => {
    if (!selected) return null;
    const curated = ATTRIBUTE_TRACES[selected.label];
    if (curated) return curated;
    const pa = ENTITY_PROFILES[selected.entity]?.attrs.find((x) => x.label === selected.label);
    if (!pa) return null;
    const agent = SOURCE_AGENT[pa.source];
    const status: "verified" | "flagged" = pa.status === "ok" ? "verified" : "flagged";
    return {
      value: pa.value,
      status,
      confidence: pa.status === "ok" ? 96 : pa.status === "warn" ? 82 : 64,
      agents: [
        { id: "document" as AgentId, name: agent.name, action: "Resolved attribute value", thought: `Returned "${pa.value}" from ${agent.system} for ${selected.entity}.`, source: agent.system },
        { id: "audit" as AgentId, name: "Audit Agent", action: "Stamped provenance entry", thought: "Wrote retrieval snapshot and source citation to the immutable audit log.", source: `Audit Log · ${selected.entity}` },
      ],
      conclusion:
        pa.status === "ok"
          ? "Attribute resolved cleanly against record-of-truth; no divergence detected."
          : pa.status === "warn"
          ? "Attribute resolved but a deviation was detected against linked sources — analyst review queued."
          : "Attribute violates policy threshold or required check — routed to exception queue for analyst action.",
    } as AttrTrace;
  }, [selected]);

  const traceDocs = useMemo(() => {
    if (!selected) return [] as { entity: string; attr: EntityAttr; doc: AttrDoc }[];
    const pa = ENTITY_PROFILES[selected.entity]?.attrs.find((x) => x.label === selected.label);
    if (pa?.docs?.length) return pa.docs.map((d) => ({ entity: selected.entity, attr: pa, doc: d }));
    return (TRACE_DOCS[selected.label] ?? []).filter((d) => d.entity === selected.entity);
  }, [selected]);


  const attrNode = (label: string, entity: string, flagged: boolean) => {
    const isSel = selected?.label === label && selected?.entity === entity;
    return (
      <Popover open={isSel} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <PopoverTrigger asChild>
          <button
            onClick={() => setSelected(isSel ? null : { label, entity })}
            className={cn(
              "w-full rounded-lg border px-3 py-2 flex items-center justify-between text-left transition-colors",
              isSel ? "border-primary bg-info-soft shadow-sm" : flagged ? "border-alert hover:bg-alert-soft/30" : "border-border hover:bg-secondary/40"
            )}
          >
            <span className="text-[12px] font-medium truncate">{label}</span>
            {flagged ? <AlertTriangle className="size-4 text-alert shrink-0" /> : <CheckCircle2 className="size-4 text-success shrink-0" />}
          </button>
        </PopoverTrigger>
        {trace && (
          <PopoverContent side="left" align="start" sideOffset={8} className="w-[360px] p-0 max-h-[72vh] overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-primary" /> Agent Trace
                  </p>
                  <p className="text-[13px] font-semibold leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{trace.value}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 mt-0.5",
                  trace.status === "verified"
                    ? "bg-success-soft text-success border-success-soft-border"
                    : "bg-alert-soft text-alert border-alert-soft-border"
                )}>
                  {trace.status === "verified" ? "Verified" : "Flagged"} · {trace.confidence}%
                </span>
              </div>

              {/* Conclusion */}
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <ShieldCheck className="size-3 text-success" /> Conclusion
                </p>
                <p className="text-[12px] leading-snug">{trace.conclusion}</p>
              </div>

              {/* Reasoning steps */}
              <button
                onClick={() => setTraceStepsOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 hover:bg-secondary/40 transition-colors"
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" /> Reasoning steps ({trace.agents.length})
                </span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", traceStepsOpen && "rotate-180")} />
              </button>
              {traceStepsOpen && (
                <ol className="space-y-2.5 px-1">
                  {trace.agents.map((a, i) => (
                    <li key={a.id} className="relative pl-7">
                      <span className="absolute left-0 top-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-medium">{i + 1}</span>
                      {i < trace.agents.length - 1 && <span className="absolute left-[9px] top-6 bottom-[-10px] w-px bg-border" />}
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-[12px] font-medium">{a.name}</p>
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <p className="text-[12px] text-muted-foreground">{a.action}</p>
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-snug italic">"{a.thought}"</p>
                      <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                        <Database className="size-2.5" /> {a.source}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {/* Source documents */}
              {traceDocs.length > 0 && (
                <>
                  <button
                    onClick={() => setTraceDocsOpen((v) => !v)}
                    className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 hover:bg-secondary/40 transition-colors"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="size-3 text-primary" /> Source documents ({traceDocs.length})
                    </span>
                    <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", traceDocsOpen && "rotate-180")} />
                  </button>
                  {traceDocsOpen && (
                    <div className="space-y-1.5">
                      {traceDocs.map(({ doc, attr: docAttr, entity: docEntity }) => {
                        const meta = DOC_KIND_META[doc.kind];
                        return (
                          <button
                            key={`${docEntity}-${doc.id}`}
                            onClick={() => setViewDoc({ doc, attr: docAttr, entity: docEntity })}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:border-primary hover:bg-info-soft/40 text-left transition-colors group"
                          >
                            <FileText className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-medium truncate">{doc.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{docEntity} · {doc.source}</p>
                            </div>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide shrink-0", meta.tone)}>
                              {meta.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <div className="flex items-center gap-2">
                  <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsUp className="size-3.5" /></button>
                  <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsDown className="size-3.5" /></button>
                </div>
                <button
                  onClick={() => runAgents(trace.agents.map((a) => a.id), `Re-verify: ${label}`)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1.5"
                >
                  <Play className="size-3" /> Re-run
                </button>
              </div>
            </div>
          </PopoverContent>
        )}
      </Popover>
    );
  };

  const entityNode = (name: string, displayName?: string) => (
    <button
      onClick={() => setOpenEntity(name)}
      className="w-full rounded-lg border border-border bg-card hover:border-primary hover:bg-info-soft/40 px-3 py-2 flex items-center justify-between text-left transition-colors group"
    >
      <span className="text-[12px] font-semibold truncate">{displayName ?? name}</span>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
    </button>
  );

  // Build tree entries from the live selectedEntities, falling back to exception
  // titles for Supabase-backed entities that have no curated profile.
  const entitiesForTree = selectedEntities.map((e) => {
    const profile = ENTITY_PROFILES[e.name];
    const profileLabels = profile?.attrs.map((a) => a.label) ?? [];
    // For entities with no curated profile, fall back to exception titles as attr labels
    const excTitleLabels = profileLabels.length === 0
      ? excs.filter((exc) => exc.kyc === e.kyc && !exc.id.startsWith('stub-') && !exc.attrLabel).map((exc) => exc.title)
      : [];
    // Always surface DB exception field_names as attrs, regardless of whether a profile exists
    const dbAttrLabels = excs
      .filter((exc) => exc.kyc === e.kyc && exc.attrLabel)
      .map((exc) => exc.attrLabel!);
    return {
      entity: e.name,
      kyc: e.kyc,
      drg: e.drg ?? 'No DRG Assigned',
      attrs: Array.from(new Set([...profileLabels, ...excTitleLabels, ...dbAttrLabels])),
    };
  });

  // Group by DRG parent
  const drgGroups = entitiesForTree.reduce<Record<string, typeof entitiesForTree>>((acc, e) => {
    (acc[e.drg] ??= []).push(e);
    return acc;
  }, {});
  const drgEntries = Object.entries(drgGroups);

  // Helper: per entity, return ordered [category, labels[]] for those categories that have at least one (visible) attribute
  const categorize = (entity: string, attrs: string[]) =>
    buildAttrCategories(entity, attrs, excs, { pendingOnly: showOnlyPending });

  const isCatOpen = (entity: string, cat: AttrCategory, idx: number) => {
    const key = `${entity}::${cat}`;
    if (key in openCats) return openCats[key];
    return idx === 0; // first non-empty category expanded by default
  };

  // ── Cards view data ──────────────────────────────────────────────────────────
  const allItems = entitiesForTree.flatMap(({ entity, attrs }) =>
    categorize(entity, attrs).flatMap(({ category, items }) =>
      items.map(item => ({ ...item, entity, category }))
    )
  );
  const categoryCards = ATTR_CATEGORY_ORDER
    .map(cat => ({
      category: cat,
      items: allItems.filter(i => i.category === cat),
      pending: allItems.filter(i => i.category === cat && i.flagged).length,
    }))
    .filter(c => c.items.length > 0);
  const multiEntity = entitiesForTree.length > 1;

  // ── Shared controls ───────────────────────────────────────────────────────────
  const controls = (
    <div className="flex items-center justify-between text-[11px]">
      <div className="inline-flex rounded-md border border-border overflow-hidden font-medium">
        <button
          onClick={() => setViewMode("cards")}
          className={cn("px-2.5 py-1 transition-colors", viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60")}
        >Cards</button>
        <button
          onClick={() => setViewMode("tree")}
          className={cn("px-2.5 py-1 border-l border-border transition-colors", viewMode === "tree" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60")}
        >Tree</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Show only pending</span>
        <button
          onClick={() => setShowOnlyPending((v) => !v)}
          className={cn("relative h-5 w-9 rounded-full transition-colors", showOnlyPending ? "bg-primary" : "bg-muted")}
          aria-pressed={showOnlyPending}
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-background shadow transition-all", showOnlyPending ? "left-[18px]" : "left-0.5")} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative pt-2 space-y-3">
      {controls}

      {/* ── Cards view ────────────────────────────────────────────────────── */}
      {viewMode === "cards" && (
        <div className="space-y-3">
          {categoryCards.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No attributes to display.</p>
          )}
          <div className="columns-2 gap-3">
            {categoryCards.map(({ category, items, pending }) => {
              const sorted = [...items].sort((a, b) => Number(b.flagged) - Number(a.flagged));
              return (
                <div key={category} className="rounded-xl border border-border bg-card p-3 mb-3 break-inside-avoid">
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{category}</span>
                    {pending > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-medium shrink-0">{pending}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {multiEntity
                      ? entitiesForTree.map(({ entity }) => {
                          const ei = sorted.filter(i => i.entity === entity);
                          if (!ei.length) return null;
                          return (
                            <div key={entity}>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium mb-1 truncate">{entity.split(" ")[0]}</p>
                              {ei.map(item => <div key={item.label} className="mb-1">{attrNode(item.label, entity, item.flagged)}</div>)}
                            </div>
                          );
                        })
                      : sorted.map(item => <div key={item.label}>{attrNode(item.label, item.entity, item.flagged)}</div>)
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tree view ─────────────────────────────────────────────────────── */}
      {viewMode === "tree" && (
        <div className="space-y-6">
      {drgEntries.map(([drgName, group]) => (
        <div key={drgName}>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">DRG Parent</span>
            <div className="w-full max-w-[320px]">{entityNode(drgName)}</div>
          </div>

          <div className="mx-auto w-px h-5 bg-border" />

          <div className={cn("relative grid gap-6", group.length === 1 ? "grid-cols-1 max-w-[320px] mx-auto" : "grid-cols-2")}>
            {group.length > 1 && <div className="absolute top-0 left-[25%] right-[25%] h-px bg-border" />}

            {group.map(({ entity, attrs }) => {
              const groups = categorize(entity, attrs);
              return (
                <div key={entity} className="relative">
                  {group.length > 1 && <div className="absolute left-1/2 -top-0 -translate-x-1/2 w-px h-3 bg-border" />}
                  <div className="pt-3">{entityNode(entity)}</div>

                  <div className="relative pl-5 mt-2 space-y-2">
                    <div className="absolute left-2 top-0 bottom-2 w-px bg-border" />
                    {groups.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic px-1 py-2">No pending actions.</p>
                    )}
                    {groups.map(({ category, items }, idx) => {
                      const open = isCatOpen(entity, category, idx);
                      const pending = items.filter((i) => i.flagged).length;
                      return (
                        <div key={category} className="relative">
                          <div className="absolute -left-3 top-4 w-3 h-px bg-border" />
                          <button
                            onClick={() => setOpenCats((s) => ({ ...s, [`${entity}::${category}`]: !open }))}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/40 text-left"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <ChevronDown className={cn("size-3 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{category}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">· {items.length}</span>
                            </span>
                            {pending > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-medium shrink-0">
                                {pending}
                              </span>
                            )}
                          </button>
                          {open && (
                            <div className="mt-1 space-y-1.5 pl-4">
                              {items.map((it) => (
                                <div key={it.label}>{attrNode(it.label, entity, it.flagged)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {entitiesForTree.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">No entities selected.</p>
      )}

      <p className="text-[10px] text-muted-foreground italic">Tip: click an entity name to drill into its full profile. Click an attribute to see its agent trace.</p>
        </div>
      )}

      {openEntity && (
        <EntityDetailPanel
          profile={ENTITY_PROFILES[openEntity]}
          onClose={() => setOpenEntity(null)}
        />
      )}

      {viewDoc && (
        <DocumentViewerModal
          doc={viewDoc.doc}
          attr={viewDoc.attr}
          entity={viewDoc.entity}
          onClose={() => setViewDoc(null)}
        />
      )}

    </div>
  );
};

// ── Attribute Form View ──────────────────────────────────────────────────────

const AttributeFormView = ({
  selectedEntities,
  exceptions: excs,
}: {
  selectedEntities: { name: string; kyc: string; drg?: string }[];
  exceptions: Exc[];
}) => {
  const [openTraceFor, setOpenTraceFor] = useState<{ label: string; entity: string } | null>(null);
  const [openOverrideFor, setOpenOverrideFor] = useState<{ label: string; entity: string } | null>(null);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [savedOverrides, setSavedOverrides] = useState<Record<string, { value: string; actor: string; timestamp: string; note?: string }>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  // Forge live data
  const [forgeAttrs, setForgeAttrs] = useState<Record<string, ForgeAttrRow>>({});
  const [forgePersons, setForgePersons] = useState<Record<string, ForgePersonRow[]>>({});
  const [forgeTrace, setForgeTrace] = useState<ForgeTraceRow | null>(null);
  const [attrTab, setAttrTab] = useState<'core' | 'wgq'>('core');

  const { runAgents } = useAgents();

  // Stable key so the effect only re-runs when the set of selected entities changes
  const entityKycKey = selectedEntities.map(e => e.kyc).join(',');

  // Fetch Forge attributes + persons for ALL selected entities in parallel
  useEffect(() => {
    if (selectedEntities.length === 0) { setForgeAttrs({}); setForgePersons({}); return; }
    let cancelled = false;
    Promise.all(selectedEntities.map(e => Promise.all([
      apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(e.kyc)}/attributes`).then(r => r.ok ? r.json() : []),
      apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(e.kyc)}/persons`).then(r => r.ok ? r.json() : {}),
    ]))).then(results => {
      if (cancelled) return;
      const attrMap: Record<string, ForgeAttrRow> = {};
      const personMap: Record<string, ForgePersonRow[]> = {};
      for (const [attrs, persons] of results) {
        for (const a of (attrs as ForgeAttrRow[])) attrMap[a.attribute_name] = a;
        Object.assign(personMap, persons as Record<string, ForgePersonRow[]>);
      }
      setForgeAttrs(attrMap);
      setForgePersons(personMap);
      const hasWgq = Object.values(attrMap).some(a => a.attribute_group === 'wgq' && a.display_value);
      const hasCore = Object.values(attrMap).some(a => a.attribute_group === 'core' && a.display_value);
      if (hasWgq && !hasCore) setAttrTab('wgq');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entityKycKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch full lineage trace when user opens trace for a Forge attribute
  useEffect(() => {
    if (!openTraceFor) { setForgeTrace(null); return; }
    const kycRef = selectedEntities.find(e => e.name === openTraceFor.entity)?.kyc;
    if (!kycRef || !forgeAttrs[openTraceFor.label]) { setForgeTrace(null); return; }
    let cancelled = false;
    apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/attributes/trace/${encodeURIComponent(openTraceFor.label)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setForgeTrace(data as ForgeTraceRow | null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [openTraceFor?.label, openTraceFor?.entity]);

  // Close override form when trace changes
  useEffect(() => { setOpenOverrideFor(null); setOverrideDraft(""); setOverrideNote(""); }, [openTraceFor]);

  // Resolve trace for the currently open field (same logic as AttributeTree)
  const trace = useMemo(() => {
    if (!openTraceFor) return null;
    const curated = ATTRIBUTE_TRACES[openTraceFor.label];
    if (curated) return curated;
    const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(x => x.label === openTraceFor.label);
    if (!pa) return null;
    const agent = SOURCE_AGENT[pa.source];
    const status: "verified" | "flagged" = pa.status === "ok" ? "verified" : "flagged";
    return {
      value: pa.value,
      status,
      confidence: pa.status === "ok" ? 96 : pa.status === "warn" ? 82 : 64,
      agents: [
        { id: "document" as AgentId, name: agent.name, action: "Resolved attribute value", thought: `Returned "${pa.value}" from ${agent.system} for ${openTraceFor.entity}.`, source: agent.system },
        { id: "audit" as AgentId, name: "Audit Agent", action: "Stamped provenance entry", thought: "Wrote retrieval snapshot and source citation to the immutable audit log.", source: `Audit Log · ${openTraceFor.entity}` },
      ],
      conclusion: pa.status === "ok"
        ? "Attribute resolved cleanly against record-of-truth; no divergence detected."
        : pa.status === "warn"
        ? "Attribute resolved but a deviation was detected against linked sources — analyst review queued."
        : "Attribute violates policy threshold or required check — routed to exception queue for analyst action.",
    } as AttrTrace;
  }, [openTraceFor]);

  const traceDocs = useMemo(() => {
    if (!openTraceFor) return [] as { entity: string; attr: EntityAttr; doc: AttrDoc }[];
    const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(x => x.label === openTraceFor.label);
    if (pa?.docs?.length) return pa.docs.map(d => ({ entity: openTraceFor.entity, attr: pa, doc: d }));
    return (TRACE_DOCS[openTraceFor.label] ?? []).filter(d => d.entity === openTraceFor.entity);
  }, [openTraceFor]);

  const categorize = (entity: string, attrs: string[]) =>
    buildAttrCategories(entity, attrs, excs);

  const isCatOpen = (key: string, idx: number) => {
    if (key in openCats) return openCats[key];
    return idx < 2; // first two sections open by default
  };

  // Build entitiesForTree (same shape as AttributeTree uses)
  const entitiesForTree = selectedEntities.map(e => {
    const profile = ENTITY_PROFILES[e.name];
    const profileLabels = profile?.attrs.map(a => a.label) ?? [];
    // When no curated profile, use all 'core' attribute names from the API.
    // All runners must use 'core' or 'wgq' as attribute_group — see CLAUDE.md.
    const forgeLabels = profileLabels.length === 0
      ? Object.values(forgeAttrs).filter(a => a.attribute_group === 'core').map(a => a.attribute_name)
      : [];
    const excTitleLabels = profileLabels.length === 0 && forgeLabels.length === 0
      ? excs.filter(exc => exc.kyc === e.kyc && !exc.id.startsWith("stub-") && !exc.attrLabel).map(exc => exc.title)
      : [];
    const dbAttrLabels = excs.filter(exc => exc.kyc === e.kyc && exc.attrLabel).map(exc => exc.attrLabel!);
    return {
      entity: e.name,
      kyc: e.kyc,
      attrs: Array.from(new Set([...profileLabels, ...forgeLabels, ...excTitleLabels, ...dbAttrLabels])),
    };
  });

  // Status strip — aggregate across all attributes
  const allAttrs = entitiesForTree.flatMap(e => ENTITY_PROFILES[e.entity]?.attrs ?? []);
  const idPendingCount = allAttrs.filter(a => a.status === "alert").length;
  const vPendingCount  = allAttrs.filter(a => a.status === "warn" || a.status === "alert").length;

  const handleSaveOverride = (draftKey: string) => {
    const d = new Date();
    const now = `${d.toISOString().slice(0, 10)} · ${d.toISOString().slice(11, 16)} UTC`;
    setSavedOverrides(prev => ({ ...prev, [draftKey]: { value: overrideDraft, actor: "You", timestamp: now, note: overrideNote || undefined } }));
    setOpenOverrideFor(null);
    setOverrideDraft("");
    setOverrideNote("");
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: openTraceFor ? "minmax(0,1fr) 360px" : "1fr" }}>
    <div className="space-y-0 min-w-0">
      {/* Status strip */}
      <div className="flex items-center gap-2 px-1 pb-3 flex-wrap">
        <span className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold",
          idPendingCount === 0
            ? "bg-success-soft text-success border border-success-soft-border"
            : "bg-warning-soft text-warning border border-warning-soft-border"
        )}>
          {idPendingCount === 0 ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {idPendingCount === 0 ? "ID Complete" : "ID Pending"}
          {idPendingCount > 0 && (
            <span className="bg-warning/20 text-warning font-bold text-[10px] px-1.5 py-0.5 rounded-full ml-1 border border-warning/30">
              {idPendingCount} attr{idPendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold",
          vPendingCount === 0
            ? "bg-success-soft text-success border border-success-soft-border"
            : "bg-warning-soft text-warning border border-warning-soft-border"
        )}>
          {vPendingCount === 0 ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {vPendingCount === 0 ? "V Complete" : "V Pending"}
          {vPendingCount > 0 && (
            <span className="bg-warning/20 text-warning font-bold text-[10px] px-1.5 py-0.5 rounded-full ml-1 border border-warning/30">
              {vPendingCount} attr{vPendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        {entitiesForTree.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground font-medium truncate">
            {entitiesForTree.map(e => e.entity).join(" · ")}
          </span>
        )}
      </div>

      {/* Attributes / Questionnaire tab control */}
      {(() => {
        const hasWgq = Object.values(forgeAttrs).some(a => a.attribute_group === 'wgq');
        if (!hasWgq) return null;
        return (
          <div className="flex items-center gap-1 mb-3 border-b border-border pb-0">
            <button
              onClick={() => setAttrTab('core')}
              className={cn(
                "px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
                attrTab === 'core' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >Attributes</button>
            <button
              onClick={() => setAttrTab('wgq')}
              className={cn(
                "px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
                attrTab === 'wgq' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >Questionnaire</button>
          </div>
        );
      })()}

      {/* ── Core attribute sections ─────────────────────────────────────── */}
      {attrTab === 'core' && (
        <>
          {entitiesForTree.map(({ entity, attrs }) => {
            const groups = categorize(entity, attrs);
            return (
              <div key={entity}>
                {entitiesForTree.length > 1 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 py-2">{entity}</p>
                )}
                {groups.map(({ category, items }, idx) => {
                  const catKey = `${entity}::${category}`;
                  const open = isCatOpen(catKey, idx);
                  const pendingInCat = items.filter(i => i.flagged).length;
                  return (
                    <div key={category} className="rounded-xl border border-border bg-card mb-3 overflow-hidden">
                      <button
                        onClick={() => setOpenCats(prev => ({ ...prev, [catKey]: !open }))}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left border-b border-border"
                      >
                        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")} />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground flex-1">{category}</span>
                        <span className="text-[10px] text-muted-foreground">{items.length} attr{items.length !== 1 ? "s" : ""}</span>
                        {pendingInCat > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-semibold">{pendingInCat}</span>
                        )}
                      </button>
                      {open && (
                        <div className="grid grid-cols-2 [&>*]:border-b [&>*]:border-border/60">
                          {items.map(({ label }) =>
                            NESTED_ATTR_PROFILES[label] ? (
                              <div key={label} className="col-span-2 p-3">
                                <NestedObjectBlock
                                  label={label}
                                  entity={entity}
                                  openTraceFor={openTraceFor}
                                  setOpenTraceFor={setOpenTraceFor}
                                  savedOverrides={savedOverrides}
                                  trace={trace}
                                  traceDocs={traceDocs}
                                  runAgents={runAgents}
                                  openOverrideFor={openOverrideFor}
                                  setOpenOverrideFor={setOpenOverrideFor}
                                  overrideDraft={overrideDraft}
                                  setOverrideDraft={setOverrideDraft}
                                  setOverrideNote={setOverrideNote}
                                />
                              </div>
                            ) : (
                              <SimpleFieldRow
                                key={label}
                                label={label}
                                entity={entity}
                                forgeAttr={forgeAttrs[label] ?? null}
                                savedOverrides={savedOverrides}
                                openTraceFor={openTraceFor}
                                setOpenTraceFor={setOpenTraceFor}
                                openOverrideFor={openOverrideFor}
                                setOpenOverrideFor={setOpenOverrideFor}
                                overrideDraft={overrideDraft}
                                setOverrideDraft={setOverrideDraft}
                                overrideNote={overrideNote}
                                setOverrideNote={setOverrideNote}
                                handleSaveOverride={handleSaveOverride}
                                trace={trace}
                                traceDocs={traceDocs}
                                runAgents={runAgents}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── Person role sections ──────────────────────────────────────── */}
          {PERSON_ROLE_LABELS.map(({ role, label: roleLabel }) => {
            const persons = forgePersons[role];
            if (!persons?.length) return null;
            const catKey = `persons::${role}`;
            const open = catKey in openCats ? openCats[catKey] : true;
            const excCount = persons.reduce((n, p) =>
              n + Object.values(p.attributes).filter((a: { exception_flag?: boolean }) => a.exception_flag).length, 0);
            return (
              <div key={role} className="rounded-xl border border-border bg-card mb-3 overflow-hidden">
                <button
                  onClick={() => setOpenCats(prev => ({ ...prev, [catKey]: !open }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left border-b border-border"
                >
                  <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")} />
                  <UserCircle2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-foreground flex-1">{roleLabel}</span>
                  <span className="text-[10px] text-muted-foreground">{persons.length} record{persons.length !== 1 ? "s" : ""}</span>
                  {excCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-semibold">{excCount}</span>
                  )}
                </button>
                {open && (
                  <div className="divide-y divide-border/60">
                    {persons.map((p, i) => (
                      <ForgePersonCard key={i} person={p} role={role} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── WGQ Questionnaire tab ─────────────────────────────────────────── */}
      {attrTab === 'wgq' && (
        <WgqTabContent forgeAttrs={forgeAttrs} openCats={openCats} setOpenCats={setOpenCats} />
      )}

      {entitiesForTree.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No entities selected.</p>
      )}
    </div>

    {/* Trace / Audit right pane */}
    {openTraceFor && (
      <aside className="rounded-xl border border-border bg-card shadow-sm flex flex-col overflow-hidden self-start sticky top-4">
        {/* Pane header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
              {(() => {
                const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(a => a.label === openTraceFor.label);
                const isOverridden = !!savedOverrides[`${openTraceFor.entity}::${openTraceFor.label}`];
                return (pa?.source === "CRM" || isOverridden) ? "Audit Trail" : "Agent Trace";
              })()}
            </p>
            <p className="text-[13px] font-semibold truncate">{openTraceFor.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{openTraceFor.entity}</p>
          </div>
          <button
            onClick={() => setOpenTraceFor(null)}
            className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors shrink-0 ml-3"
            title="Close trace pane"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {/* Trace content */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: "calc(100vh - 260px)" }}>
          {/* Forge lineage section — shown when live data is available */}
          {forgeTrace && (
            <ForgeLineagePanel trace={forgeTrace} />
          )}
          <InlineTraceDrawer
            label={openTraceFor.label}
            entity={openTraceFor.entity}
            isAuditOnly={(() => {
              const pa = ENTITY_PROFILES[openTraceFor.entity]?.attrs.find(a => a.label === openTraceFor.label);
              const isOverridden = !!savedOverrides[`${openTraceFor.entity}::${openTraceFor.label}`];
              return (pa?.source === "CRM") || isOverridden;
            })()}
            savedOverrides={savedOverrides}
            trace={trace}
            traceDocs={traceDocs}
            runAgents={runAgents}
            setOpenTraceFor={setOpenTraceFor}
            openOverrideFor={openOverrideFor}
            setOpenOverrideFor={setOpenOverrideFor}
            overrideDraft={overrideDraft}
            setOverrideDraft={setOverrideDraft}
            setOverrideNote={setOverrideNote}
          />
        </div>
      </aside>
    )}
    </div>
  );
};


const EntityDetailPanel = ({ profile, onClose }: { profile: EntityProfile; onClose: () => void }) => {
  const [tab, setTab] = useState<"attrs" | "case">("attrs");
  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Entity</p>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold">{profile.name}</h3>
                {profile.kyc && (
                  <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">{profile.kyc}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="size-7 rounded border border-border grid place-items-center hover:bg-secondary">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex gap-5 text-xs">
            <button
              onClick={() => setTab("attrs")}
              className={cn("pb-2 -mb-px border-b-2", tab === "attrs" ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
            >
              Attributes ({profile.attrs.length})
            </button>
            <button
              onClick={() => setTab("case")}
              className={cn("pb-2 -mb-px border-b-2 flex items-center gap-1", tab === "case" ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
            >
              <FileText className="size-3.5" /> Case File (Markdown)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "attrs" ? (
            <div className="p-3">
              {(() => {
                const total = profile.attrs.length;
                const incomplete = profile.attrs.filter((a) => a.status === "alert").length;
                const review = profile.attrs.filter((a) => a.status === "warn").length;
                const complete = total - incomplete - review;
                const pct = total ? Math.round((complete / total) * 100) : 0;
                return (
                  <div className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Attribute Completeness</p>
                      <span className="text-[11px] font-semibold">{pct}% complete</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden flex">
                      <div className="h-full bg-success" style={{ width: `${(complete / total) * 100}%` }} />
                      <div className="h-full bg-warning" style={{ width: `${(review / total) * 100}%` }} />
                      <div className="h-full bg-alert" style={{ width: `${(incomplete / total) * 100}%` }} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px]">
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /><span className="text-success font-medium">{complete}</span><span className="text-muted-foreground">Complete</span></span>
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" /><span className="text-warning font-medium">{review}</span><span className="text-muted-foreground">Review</span></span>
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-alert" /><span className="text-alert font-medium">{incomplete}</span><span className="text-muted-foreground">Incomplete</span></span>
                    </div>
                    {incomplete > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                        Incomplete attributes have open exceptions on the left rail and block case closure.
                      </p>
                    )}
                  </div>
                );
              })()}
              {profile.attrs.map((a) => (
                <AttributeRow key={a.label} attr={a} entity={profile.name} />
              ))}
            </div>
          ) : (
            <CaseFileView markdown={profile.caseFile} profile={profile} />
          )}
        </div>


        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-success" /> Verified</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-warning" /> Review</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-alert" /> Action</span>
          </span>
          <span>Sources: <span className="text-primary">CRM</span> · <span className="text-warning">3rd-party</span> · Forge (internal)</span>
        </div>
      </div>
    </div>
  );
};

const AttributeRow = ({ attr, entity }: { attr: EntityAttr; entity: string }) => {
  const [open, setOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<AttrDoc | null>(null);
  const agent = SOURCE_AGENT[attr.source];
  const docs = attr.docs ?? [];

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-2 py-3 hover:bg-secondary/40 rounded-md text-left"
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className={cn("size-2 rounded-full mt-1.5 shrink-0", DOT_STYLE[attr.status])} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              {attr.label}
              {docs.length > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-primary/10 text-primary text-[9px] font-semibold normal-case tracking-normal">
                  <Paperclip className="size-2.5" /> {docs.length}
                </span>
              )}
            </p>
            <p className="text-[12px] truncate">{attr.value}</p>
          </div>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", COMPLETENESS_STYLE[attr.status])}>
          {COMPLETENESS_LABEL[attr.status]}
        </span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", SOURCE_STYLE[attr.source])}>
          {attr.source}
        </span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="ml-4 mb-3 mr-2 rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">{agent.icon}</span>
            <p className="text-[11px] font-medium flex-1">{agent.name}</p>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border font-medium",
              attr.status === "ok" ? "bg-success-soft text-success border-success-soft-border"
                : attr.status === "warn" ? "bg-warning-soft text-warning border-warning-soft-border"
                : "bg-alert-soft text-alert border-alert-soft-border"
            )}>{STATUS_LABEL[attr.status]}</span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Fetched</span>
              <span className="flex-1"><span className="text-primary">{agent.system}</span></span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Query</span>
              <code className="flex-1 text-[10px] bg-card border border-border rounded px-1.5 py-0.5 font-mono">
                resolve("{attr.label}") WHERE entity="{entity}"
              </code>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Returned</span>
              <span className="flex-1 font-medium">{attr.value}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Reasoning</span>
              <span className="flex-1 text-muted-foreground italic">
                {attr.status === "ok"
                  ? `Single authoritative answer returned from ${attr.source === "CRM" ? "CRM record-of-truth" : attr.source === "3rd" ? "external regulator/registry" : "internal policy graph"}. No conflicting values across linked sources — auto-verified.`
                  : attr.status === "warn"
                  ? `Value retrieved but with a deviation against linked sources. Manual review queued.`
                  : `Value violates policy threshold or required check. Routed to exception queue for analyst action.`}
              </span>
            </div>
          </div>

          {docs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3" /> Source Documents ({docs.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {docs.map((d) => {
                  const meta = DOC_KIND_META[d.kind];
                  return (
                    <button
                      key={d.id}
                      onClick={() => setViewDoc(d)}
                      className="group flex items-center gap-3 p-2 rounded-lg border border-border bg-card hover:border-primary hover:shadow-sm transition-all text-left"
                    >
                      <div className="size-10 rounded bg-secondary border border-border grid place-items-center text-muted-foreground shrink-0 group-hover:bg-info-soft group-hover:text-primary transition-colors">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{d.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {d.source} · {d.date}{d.pages ? ` · ${d.pages}p` : ""}
                        </p>
                      </div>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0 uppercase tracking-wide", meta.tone)}>
                        {meta.label}
                      </span>
                      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Last refresh: 2026-04-19 · Confidence: {attr.status === "ok" ? "98%" : attr.status === "warn" ? "82%" : "65%"}</p>
            <button className="text-[10px] px-2 py-1 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1">
              <RotateCw className="size-2.5" /> Re-fetch
            </button>
          </div>
        </div>
      )}

      {viewDoc && (
        <DocumentViewerModal doc={viewDoc} attr={attr} entity={entity} onClose={() => setViewDoc(null)} />
      )}
    </div>
  );
};

// ---------- Document viewer ----------

const renderHighlightedLine = (line: string, key: number) => {
  const parts = line.split(/(%%[^%]+%%)/g);
  return (
    <p key={key} className="text-[12px] leading-relaxed mb-2 last:mb-0">
      {parts.map((p, i) => {
        if (p.startsWith("%%") && p.endsWith("%%")) {
          return <mark key={i} className="bg-warning-soft text-foreground rounded px-1 py-0.5 font-medium border border-warning-soft-border">{p.slice(2, -2)}</mark>;
        }
        // honour **bold**
        const boldParts = p.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bp, j) =>
          bp.startsWith("**") && bp.endsWith("**")
            ? <strong key={`${i}-${j}`} className="font-semibold">{bp.slice(2, -2)}</strong>
            : <span key={`${i}-${j}`}>{bp}</span>
        );
      })}
    </p>
  );
};

const DocumentViewerModal = ({ doc, attr, entity, onClose }: { doc: AttrDoc; attr: EntityAttr; entity: string; onClose: () => void }) => {
  const meta = DOC_KIND_META[doc.kind];
  return (
    <div className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[88vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide", meta.tone)}>
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{doc.source} · {doc.date}</span>
            </div>
            <h3 className="text-[15px] font-semibold leading-tight">{doc.title}</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Linked attribute: <span className="font-medium text-foreground">{attr.label}</span> · {entity}
            </p>
          </div>
          <button onClick={onClose} className="size-7 rounded border border-border grid place-items-center hover:bg-secondary shrink-0">
            <X className="size-3.5" />
          </button>
        </div>

        {/* Document body — styled as a scanned page */}
        <div className="flex-1 overflow-y-auto bg-secondary/40 p-5">
          <div className="mx-auto max-w-[560px] bg-white text-foreground rounded-md shadow-md border border-border">
            {/* Letterhead */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">{doc.source}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Document captured {doc.date}</p>
              </div>
              <div className="size-9 rounded border border-border bg-card grid place-items-center text-muted-foreground">
                {doc.kind === "passport" ? <ShieldCheck className="size-4" /> : <FileText className="size-4" />}
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {doc.fields && doc.fields.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="px-3 py-1.5 bg-secondary/60 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Record Fields
                  </div>
                  <dl className="divide-y divide-border">
                    {doc.fields.map((f) => (
                      <div key={f.label} className={cn("grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-[12px]", f.highlight && "bg-warning-soft/40")}>
                        <dt className="text-muted-foreground">{f.label}</dt>
                        <dd className={cn("font-medium", f.highlight && "text-foreground")}>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {doc.body.length > 0 && (
                <div className="text-[12px] leading-relaxed">
                  {doc.body.map((line, i) => renderHighlightedLine(line, i))}
                </div>
              )}
            </div>

            {/* Footer stamp */}
            <div className="px-6 py-3 border-t border-border bg-secondary/30 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Page 1{doc.pages ? ` of ${doc.pages}` : ""}</span>
              <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-success" /> Evidence Locker · verified hash</span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Doc ID: <code className="font-mono">{doc.id}</code></p>
          <div className="flex items-center gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-full border border-border hover:bg-secondary flex items-center gap-1.5">
              <Paperclip className="size-3" /> Attach to case
            </button>
            <a
              href={`/sample-docs/${
                doc.kind === "passport" ? "passport-scan" :
                doc.kind === "register" ? "fca-register" :
                doc.kind === "screenshot" ? "crm-screenshot" :
                doc.kind === "letter" ? "fca-name-change-letter" :
                "companies-house-psc"
              }.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1.5"
            >
              <FileText className="size-3" /> Open original
            </a>

          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Case file view ----------

const CaseFileView = ({ markdown, profile }: { markdown: string; profile: EntityProfile }) => {
  const flagged = profile.attrs.filter((a) => a.status !== "ok").length;
  const verified = profile.attrs.length - flagged;
  return (
    <div className="p-5">
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: "Attributes", value: profile.attrs.length },
          { label: "Verified", value: verified, tone: "success" as const },
          { label: "Needs Review", value: flagged, tone: "warning" as const },
          { label: "Sources", value: new Set(profile.attrs.map((a) => a.source)).size },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn("text-lg font-semibold mt-0.5",
              s.tone === "success" && "text-success",
              s.tone === "warning" && "text-warning",
            )}>{s.value}</p>
          </div>
        ))}
      </div>

      <article className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-[18px] prose-h1:mb-3 prose-h1:mt-0 prose-h2:text-[14px] prose-h2:mt-5 prose-h2:mb-2 prose-p:text-[12px] prose-p:leading-relaxed prose-li:text-[12px] prose-li:my-0.5 prose-strong:text-foreground prose-table:text-[11px] prose-th:text-foreground prose-th:bg-secondary prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border-border prose-hr:my-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>

      <div className="mt-6 flex items-center justify-between pt-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground">Auto-generated from agent runs · Last refreshed 2026-04-19</p>
        <div className="flex items-center gap-2">
          <button className="text-[11px] px-3 py-1.5 rounded-full border border-border hover:bg-secondary flex items-center gap-1.5">
            <FileText className="size-3" /> Export .md
          </button>
          <button className="text-[11px] px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1.5">
            <RotateCw className="size-3" /> Regenerate
          </button>
        </div>
      </div>
    </div>
  );
};


const AgentReasoningBlock = ({ exception, resolution }: { exception: Exc; resolution: Resolution }) => {
  const { runAgents, isRunning, currentLabel, runs } = useAgents();
  const isThisRun = currentLabel === resolution.agentLabel;
  const completedHere = isThisRun && !isRunning && runs.length > 0 && runs.every((r) => r.state === "done");

  if (isThisRun && isRunning) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-primary/40 bg-info-soft/30 p-4 flex items-center gap-3">
        <span className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <div className="min-w-0">
          <p className="text-[12px] font-medium">Agents running · {resolution.agentLabel}</p>
          <p className="text-[11px] text-muted-foreground">Record update will appear once all {resolution.agents.length} agents complete.</p>
        </div>
      </div>
    );
  }

  if (!completedHere) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-[12px] text-muted-foreground">
        Run this resolution to generate the record update.
        <button
          onClick={() => runAgents(resolution.agents, resolution.agentLabel)}
          className="ml-2 text-primary hover:underline"
        >
          Run agents
        </button>
      </div>
    );
  }

  const rows = resolution.updates;
  return (
    <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium uppercase tracking-wide flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-primary/15 grid place-items-center text-primary text-[9px]">⚙</span>
          Agent Reasoning — Post Action · {resolution.agentLabel}
        </p>
        <button
          onClick={() => runAgents(resolution.agents, resolution.agentLabel)}
          className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground"
        >
          <RotateCw className="size-3" /> Re-run
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
        {resolution.postRunSummary}
      </p>

      <p className="text-[11px] font-medium uppercase tracking-wide mb-2 flex items-center gap-1.5">
        📋 {rows.length} Record{rows.length === 1 ? "" : "s"} Updated · {exception.entity}
      </p>
      <div className="rounded-lg border border-border bg-card overflow-hidden text-[12px]">
        <div className="grid grid-cols-3 px-3 py-2 bg-secondary/60 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Entity / Case</span><span>Attribute</span><span>Before → After</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-3 px-3 py-2 border-t border-border items-start">
            <div>
              <p className="font-medium">{exception.entity}</p>
              <p className="text-[10px] text-muted-foreground">{exception.kyc}</p>
            </div>
            <p>{r.attr}</p>
            <div className="space-y-1">
              <p className="text-[11px] line-through text-muted-foreground bg-secondary/70 px-2 py-0.5 rounded">Before: {r.before}</p>
              <p className="text-[11px] text-success bg-success-soft border border-success-soft-border px-2 py-0.5 rounded">→ {r.after}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-[11px] text-muted-foreground">
          Driven by: {resolution.agents.length} agent{resolution.agents.length === 1 ? "" : "s"} · {resolution.agents.join(" · ")}
        </p>
        <div className="flex items-center gap-2">
          <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsUp className="size-3.5" /></button>
          <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsDown className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
};


const AgentReviewModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
    <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">🧳</span>
            <div>
              <h3 className="text-[15px] font-semibold">QA Review</h3>
              <p className="text-xs text-muted-foreground">London Alternatives DRG · 4 attributes checked</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs mb-1">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-alert" /> 2 AI suggested corrections</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" /> 1 for review</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> 1 confirmed</span>
          <span className="ml-auto text-muted-foreground">0/3 resolved</span>
        </div>

        <div className="border-b border-border flex gap-5 text-xs mt-3">
          <button className="pb-2 border-b-2 border-primary -mb-px font-medium">All (4)</button>
          <button className="pb-2 text-muted-foreground">AI Suggested Corrections (3)</button>
          <button className="pb-2 text-muted-foreground">Confirmed (1)</button>
        </div>
      </div>

      <div className="px-5 pb-3 space-y-2 max-h-[55vh] overflow-y-auto">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border text-[10px] font-medium uppercase">Correction</span>
            <span className="text-[13px] font-medium">Legal Entity Name</span>
            <span className="ml-auto text-xs text-muted-foreground">Brevan Howard Asset Management LLP</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Analyst Decision</p>
              <p className="text-[12px]">Accepted 'Brevan Howard Asset Mgmt LLP' based on email confirmation.</p>
            </div>
            <div className="rounded-md border border-alert-soft-border bg-alert-soft/40 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-alert mb-1">Agent Assessment</p>
              <p className="text-[12px]">Email is not authoritative for legal name. Companies House registry should be used. Recommend reverting to registered name on filing.</p>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3 text-[12px]">
            <span className="text-muted-foreground">🔄 </span>
            Replace source with Companies House (Company No. OC302636). Update legal name to 'Brevan Howard Asset Management LLP'.
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button className="text-xs px-4 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft">Accept correction</button>
            <button className="text-xs px-4 py-1.5 text-primary">Override</button>
          </div>
        </div>

        {[
          { tone: "alert", label: "Correction", title: "FCA Permission Scope", sub: "Brevan Howard Asset Management LLP" },
          { tone: "warning", label: "Review", title: "PSC Address Drift", sub: "Principal: Aron Landy" },
          { tone: "success", label: "Confirmed", title: "Sanctions Screening — A. Marshall", sub: "Marshall Wace LLP" },
        ].map((r) => (
          <div key={r.title} className="rounded-lg border border-border p-3 flex items-center gap-3">
            <span className={cn(
              "px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase",
              r.tone === "alert" && "bg-alert-soft text-alert border-alert-soft-border",
              r.tone === "warning" && "bg-warning-soft text-[hsl(30_70%_40%)] border-warning-soft-border",
              r.tone === "success" && "bg-success-soft text-success border-success-soft-border"
            )}>{r.label}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{r.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{r.sub}</p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">KYC Agent v2.1</p>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-full border border-border hover:bg-secondary">Dismiss</button>
          <button className="text-sm px-4 py-2 rounded-full bg-primary text-primary-foreground flex items-center gap-2 hover:opacity-95">
            <CheckCircle2 className="size-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ---------- Escalation Dialog (simulated downstream screen) ----------

type EscalationKind = "fcc" | "business" | null;

const ESCALATION_CONFIG = {
  fcc: {
    title: "Escalate to Financial Crime Compliance",
    badge: "FCC Queue",
    badgeTone: "bg-alert/10 text-alert border-alert/30",
    icon: ShieldAlert,
    iconTone: "text-alert",
    summary: "Routed to the FCC team for MLRO oversight. Case is now read-only for the analyst and tracked under the SAR triage workflow.",
    assignee: { name: "Priya Raman", role: "MLRO · Financial Crime Compliance", avatar: "PR" },
    sla: "24 hours · SAR triage SLA",
    priority: "Critical",
    priorityTone: "text-alert",
    nextSteps: [
      "MLRO reviews PSC integrity & sanctions cross-checks",
      "Decision: file internal SAR or return to analyst with guidance",
      "Risk tier automatically bumped to Elevated pending review",
      "All downstream periodic refresh actions paused on this entity",
    ],
    notifyChips: ["MLRO Group", "Risk Committee", "Audit Trail"],
    sideTitle: "FCC Case View",
    sideRows: [
      { k: "Case Status", v: "Escalated → MLRO Review", tone: "alert" },
      { k: "Workflow", v: "Financial Crime Compliance · SAR Triage" },
      { k: "Risk Tier", v: "Elevated (auto-bumped)", tone: "alert" },
      { k: "Periodic Refresh", v: "Paused", tone: "warn" },
      { k: "Lock", v: "Analyst read-only", tone: "warn" },
    ],
  },
  business: {
    title: "Escalate to Business",
    badge: "RM Outreach",
    badgeTone: "bg-info-soft text-primary border-primary/30",
    icon: Briefcase,
    iconTone: "text-primary",
    summary: "Routed to the covering Relationship Manager to obtain client confirmation and supporting documents before resolution.",
    assignee: { name: "James Holloway", role: "Relationship Manager · EMEA Alternatives", avatar: "JH" },
    sla: "5 business days · Client response SLA",
    priority: "High",
    priorityTone: "text-warning",
    nextSteps: [
      "RM contacts client to confirm registered office change",
      "Client provides updated PSC filing & address evidence",
      "Documents returned to analyst for verification",
      "Case resumes resolution workflow once evidence received",
    ],
    notifyChips: ["Coverage Team", "KYC Analyst", "Client Portal"],
    sideTitle: "Business Outreach View",
    sideRows: [
      { k: "Case Status", v: "Escalated → Awaiting Client", tone: "warn" },
      { k: "Workflow", v: "RM Outreach · Client Confirmation" },
      { k: "Risk Tier", v: "Moderate (unchanged)" },
      { k: "Periodic Refresh", v: "On hold pending response", tone: "warn" },
      { k: "Lock", v: "Analyst can amend after response", tone: "warn" },
    ],
  },
} as const;

const EscalationDialog = ({
  kind, active, onClose,
}: { kind: EscalationKind; active: Exc; onClose: () => void }) => {
  if (!kind) return null;
  const cfg = ESCALATION_CONFIG[kind];
  const Icon = cfg.icon;
  const toneClass = (t?: string) =>
    t === "alert" ? "text-alert" : t === "warn" ? "text-warning" : "text-foreground";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/40">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className={cn("size-10 rounded-full grid place-items-center border", cfg.badgeTone)}>
                <Icon className={cn("size-5", cfg.iconTone)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border", cfg.badgeTone)}>
                    {cfg.badge}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Case {active.kyc} · {active.entity}</span>
                </div>
                <DialogTitle className="text-[17px]">{cfg.title}</DialogTitle>
                <DialogDescription className="mt-1">{cfg.summary}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-2 gap-0 divide-x divide-border">
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Assigned To</p>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                  {cfg.assignee.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{cfg.assignee.name}</p>
                  <p className="text-[11px] text-muted-foreground">{cfg.assignee.role}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">SLA</p>
                <p className="text-sm flex items-center gap-1.5"><Clock className="size-3.5 text-muted-foreground" />{cfg.sla}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Priority</p>
                <p className={cn("text-sm font-medium", cfg.priorityTone)}>{cfg.priority}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Next Steps</p>
              <ol className="space-y-2">
                {cfg.nextSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="size-4 mt-0.5 rounded-full bg-secondary text-[10px] grid place-items-center font-medium">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Notified</p>
              <div className="flex flex-wrap gap-1.5">
                {cfg.notifyChips.map((c) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 bg-secondary/20">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <ArrowRight className="size-3" /> Simulated screen · {cfg.sideTitle}
            </p>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">{active.entity}</p>
                    <p className="text-[10px] text-muted-foreground">{active.kyc} · {active.title}</p>
                  </div>
                </div>
                <Lock className="size-3.5 text-muted-foreground" />
              </div>
              <div className="divide-y divide-border">
                {cfg.sideRows.map((r) => (
                  <div key={r.k} className="px-4 py-2.5 flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{r.k}</span>
                    <span className={cn("font-medium", toneClass((r as any).tone))}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border bg-secondary/30 flex items-center gap-2">
                <UserCircle2 className="size-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Owner reassigned to <span className="text-foreground font-medium">{cfg.assignee.name}</span></span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-full border border-border hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={onClose}
            className={cn(
              "text-sm px-5 py-2 rounded-full text-primary-foreground flex items-center gap-2 shadow-sm",
              kind === "fcc" ? "bg-alert hover:bg-alert/90" : "bg-primary hover:opacity-95"
            )}
          >
            <Send className="size-4" /> Confirm escalation
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExceptionReview;

// ── Merge entities from entities.md (auto-generated at build time) ─────────────
// Static data takes precedence; generated data only adds entities not already here.
{
  const _staticKycs = new Set(exceptions.map(e => e.kyc));
  const _genExcToKyc = Object.fromEntries(GENERATED_EXCEPTIONS.map(e => [e.id, e.kyc]));
  for (const e of GENERATED_EXCEPTIONS) {
    if (!_staticKycs.has(e.kyc)) (exceptions as unknown[]).push(e);
  }
  for (const [k, v] of Object.entries(GENERATED_COMPARISONS)) {
    const kyc = _genExcToKyc[k];
    if (kyc && !_staticKycs.has(kyc) && !COMPARISONS[k]) (COMPARISONS as Record<string, typeof v>)[k] = v;
  }
  const _staticProfiles = new Set(Object.keys(ENTITY_PROFILES));
  for (const [k, v] of Object.entries(GENERATED_ENTITY_PROFILES)) {
    if (!_staticProfiles.has(k)) (ENTITY_PROFILES as Record<string, typeof v>)[k] = v;
  }
  for (const [k, v] of Object.entries(GENERATED_COMMENTS))  { if (!COMMENTS_BY_KYC[k])  (COMMENTS_BY_KYC as Record<string, typeof v>)[k]  = v; }
  for (const [k, v] of Object.entries(GENERATED_WATCHERS))  { if (!WATCHERS_BY_KYC[k])  (WATCHERS_BY_KYC as Record<string, typeof v>)[k]  = v; }
  for (const [k, v] of Object.entries(GENERATED_ACTIVITY))  { if (!ACTIVITY_BY_KYC[k])  (ACTIVITY_BY_KYC as Record<string, typeof v>)[k]  = v; }
}


import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Info, X, AlertTriangle, FileText, ChevronDown, CheckCircle2,
  Send, Mail, Plus, Minus, Maximize2, ThumbsUp, ThumbsDown, RotateCw, Paperclip,
  ShieldCheck, Database, Search, Sparkles, ChevronRight, Play, Lock, Settings2, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgents, type AgentId } from "@/components/AgentSystem";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";




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
};

const exceptions: Exc[] = [
  {
    id: "e1",
    title: "Undisclosed PSC Address Change",
    category: "Beneficial Ownership",
    confidence: 88,
    status: "Pending",
    entity: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30214",
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
    kyc: "KYC-30214",
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
    kyc: "KYC-30214",
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
];

const buildHeaderMeta = (addressed: number, total: number) => [
  { label: "Exceptions", value: `${addressed}/${total}`, suffix: "addressed" },
  { label: "Due Date", value: "Apr 25, 2026" },
  { label: "Risk", value: "Elevated", tone: "alert" as const },
  { label: "Priority", value: "High" },
  { label: "Reach Outs", value: "0", suffix: "pending" },
];

const selectedEntities = [
  { name: "Brevan Howard Asset Management LLP", kyc: "KYC-30214" },
  { name: "Marshall Wace LLP", kyc: "KYC-30188" },
];


type ResolvedInfo = { resolutionId: string; resolutionTitle: string; agentLabel: string };

const ExceptionReview = () => {
  const [activeId, setActiveId] = useState("e1");
  const [openAgent, setOpenAgent] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedInfo>>({});
  const { runAgents, isRunning, currentLabel, runs } = useAgents();

  const active = exceptions.find((e) => e.id === activeId)!;

  const handleResolutionClick = (id: string) => {
    if (selectedResolution === id) {
      setSelectedResolution(null);
      return;
    }
    setSelectedResolution(id);
    const cfg = active.resolutions.find((r) => r.id === id);
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

  const addressedCount = Object.keys(resolvedMap).length;
  const headerMeta = buildHeaderMeta(addressedCount, exceptions.length);





  return (
    <div className="px-6 py-6 max-w-[1480px] mx-auto">
      {/* Top header */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-8 flex-1 flex-wrap">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">DRG</p>
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold">London Alternatives DRG</h1>
                <Info className="size-3.5 text-muted-foreground" />
                <button className="px-2 py-0.5 rounded border border-border text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <Lock className="size-2.5" /> Why?
                </button>
              </div>
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

          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/work-queue" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Cancel</Link>
            <button className="text-sm text-primary hover:underline px-3 py-2">Audit Log</button>
            <button className="text-sm px-4 py-2 rounded-full border border-border flex items-center gap-2 hover:bg-secondary transition-colors">
              <Mail className="size-4" /> Reach Outs
            </button>
            <button
              onClick={() => setOpenAgent(true)}
              className="text-sm px-4 py-2 rounded-full border border-primary text-primary flex items-center gap-2 hover:bg-info-soft transition-colors"
            >
              <Sparkles className="size-4" /> Agent Review
            </button>
            <button className="text-sm px-4 py-2 rounded-full border border-border text-muted-foreground flex items-center gap-2 hover:bg-secondary transition-colors">
              <AlertTriangle className="size-4" /> Escalate
            </button>
            <button className="text-sm px-5 py-2 rounded-full bg-primary text-primary-foreground flex items-center gap-2 shadow-sm hover:opacity-95 transition-opacity">
              <Send className="size-4" /> Submit
            </button>
          </div>
        </div>
      </div>

      {/* Selected entities */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-xs text-muted-foreground">Selected Entities <span className="text-foreground font-medium">(3)</span></span>
        {selectedEntities.map((e) => (
          <span key={e.kyc} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs shadow-sm">
            <Building2 className="size-3 text-muted-foreground" />
            <span className="font-medium">{e.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">{e.kyc}</span>
            <button className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[260px_1fr_420px] gap-5">
        {/* Exceptions list */}
        <aside>
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Exceptions ({exceptions.length})</span>
          </div>
          <ul className="space-y-2">
            {exceptions.map((e) => {
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
                      ) : (
                        <span className="text-[11px] text-success font-medium shrink-0 tabular-nums">{e.confidence}%</span>
                      )}
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
                    <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                      <Building2 className="size-2.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{e.entity}</span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">{e.kyc}</span>
                    </div>

                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: Exception summary */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
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

          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Why this exception exists</p>
              <div className="rounded-lg border border-warning-soft-border bg-warning-soft/50 p-3 flex items-start gap-2 mb-3">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <p className="text-[13px]">{active.flagText}</p>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {active.narrative}
              </p>
              <ol className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                {active.reasoningSteps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="size-5 rounded-full bg-secondary text-foreground grid place-items-center text-[11px] font-medium shrink-0">{i+1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>

            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Why this evidence was selected</p>
              <p className="text-[12px] text-muted-foreground italic leading-relaxed mb-3">
                {active.evidenceRationale}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {active.evidence.map((d) => (
                  <div key={d.name} className="rounded-lg border border-border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{d.sub}</p>
                      </div>
                    </div>
                    <button className="text-[11px] px-3 py-1 rounded-full border border-primary text-primary hover:bg-info-soft">View</button>
                  </div>
                ))}
              </div>
            </div>


            <div className="pt-2 border-t border-border">
              <p className="text-[13px] font-semibold mb-1">Resolution &amp; Next Actions</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-1">
                <span className="font-semibold text-foreground">Why this may be acceptable:</span> {active.acceptability}
              </p>
              <p className="text-[12px] italic text-muted-foreground mb-3">Choose one of the items below to continue</p>

              <div className="space-y-2">
                {active.resolutions.map((opt) => {

                  const sel = selectedResolution === opt.id;
                  return (
                    <div key={opt.id}>
                      <button
                        onClick={() => handleResolutionClick(opt.id)}

                        className={cn(
                          "w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors",
                          sel ? "border-primary bg-info-soft/40" : "border-border hover:bg-secondary/40"
                        )}
                      >
                        {sel ? (
                          <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                        ) : (
                          <span className="size-4 rounded-full border border-border mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium">{opt.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-1">{opt.desc}</p>
                        </div>
                        {opt.recommended && !sel && (
                          <span className="px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-soft-border text-[11px] font-medium shrink-0">Recommended</span>
                        )}
                        {sel && (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium shrink-0">Selected</span>
                        )}
                      </button>

                      {sel && <AgentReasoningBlock exception={active} resolution={opt} />}
                    </div>
                  );
                })}
              </div>


              <div className="mt-3 rounded-lg border border-border p-3">
                <input className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none" placeholder="Or enter a custom resolution note…" />
                <div className="flex items-center justify-end mt-8">
                  <button className="text-xs px-4 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-secondary flex items-center gap-2">
                    <Send className="size-3.5" /> Submit Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Attributes / Tree */}
        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border">
            <div className="flex items-center gap-4">
              <button className="pb-2 text-sm font-medium border-b-2 border-primary -mb-px flex items-center gap-1.5"><Settings2 className="size-3.5" /> Attributes</button>
              <button className="pb-2 text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"><FileText className="size-4" /> Document View</button>
            </div>
            <div className="flex items-center gap-1">
              <button className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"><Plus className="size-3.5" /></button>
              <button className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"><Minus className="size-3.5" /></button>
              <button className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"><Maximize2 className="size-3" /></button>
              <span className="text-xs text-muted-foreground ml-1 tabular-nums">84%</span>
            </div>
          </div>

          <AttributeTree />
        </aside>
      </div>

      {openAgent && <AgentReviewModal onClose={() => setOpenAgent(false)} />}
    </div>
  );
};

// ---------- Attribute Tree with Agent Tracing ----------

type AttrTrace = {
  value: string;
  status: "verified" | "flagged";
  confidence: number;
  agents: { id: AgentId; name: string; action: string; thought: string; source: string }[];
  conclusion: string;
};

const ATTRIBUTE_TRACES: Record<string, AttrTrace> = {
  "Persons of Significant Control": {
    value: "Mr Alan Eldad Howard · 75–100% voting rights (PSC address drift)",
    status: "flagged",
    confidence: 88,
    agents: [
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Pulled live PSC register", thought: "Companies House returns 1 PSC: Mr Alan Eldad Howard, b. 1963-09, British, voting-rights 75–100% and right-to-share-surplus-assets 25–50%.", source: "Companies House PSC API · OC302636" },
      { id: "document", name: "Document Intelligence", action: "Cross-checked CS01 filing", thought: "Latest CS01 (03/14/2026) lists a different correspondence address than the live PSC record. 14-day notification window has lapsed.", source: "Form CS01 · 03/14/2026" },
      { id: "regulatory", name: "Regulatory Agent", action: "Assessed Schedule 1A CA 2006", thought: "PSC address change must be filed via PSC02 within 14 days. Failure is a technical breach, not an AML event.", source: "Companies Act 2006 Sch. 1A" },
      { id: "audit", name: "Audit Agent", action: "Logged trace for review", thought: "Wrote provenance entry to immutable audit log with all 3 source citations.", source: "Audit Log #30214-A14" },
    ],
    conclusion: "PSC identity confirmed; address drift flagged for client PSC02 correction filing.",
  },
  "Designated Members": {
    value: "2 corporate members · 1 Jersey-domiciled (EDD required)",
    status: "flagged",
    confidence: 92,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Enumerated designated members", thought: "Found 2 corporate-llp-designated-members: BH Partnership Holdings Limited (Jersey 106333) and Brevan Howard Asset Management Services Limited (UK 11117501).", source: "Companies House Officers · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Applied EDD jurisdiction matrix", thought: "Jersey is listed on internal EDD policy POL-EDD-23. UK member is in-scope but standard tier.", source: "EDD Policy POL-EDD-23" },
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Attempted UBO traversal on Jersey leg", thought: "JFSC registry returned active entity but no on-file natural-person UBO map. EDD pack required.", source: "JFSC Registry Lookup" },
    ],
    conclusion: "Two designated members verified; Jersey corporate member triggers EDD workflow.",
  },
  "Registered Office": {
    value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB",
    status: "verified",
    confidence: 99,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Extracted from Companies House primary record", thought: "entity_registered_address returns '4th Floor Phoenix House, 1 Station Hill, Reading, Berkshire, RG1 1NB, United Kingdom' for OC302636.", source: "Companies House · OC302636" },
      { id: "identity", name: "Identity Agent", action: "Cross-verified with FCA register", thought: "FCA Register principal place of business matches the Companies House registered office. No divergence.", source: "FCA Register FRN lookup" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed RG postcode jurisdiction", thought: "Reading, Berkshire — UK jurisdiction, FCA-supervised. Active and in good standing.", source: "Royal Mail PAF · UK gov" },
    ],
    conclusion: "Registered office is confirmed across Companies House and FCA register with no divergence.",
  },
  "Company Number": {
    value: "OC302636 · LLP, incorporated 2002-07-16",
    status: "verified",
    confidence: 100,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Pulled Companies House primary record", thought: "OC302636 returns entity_company_type='llp', entity_company_status='active', entity_incorporated_on='2002-07-16'.", source: "Companies House · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed LLP status under LLP Act 2000", thought: "Active limited liability partnership under the Limited Liability Partnerships Act 2000.", source: "LLP Act 2000" },
      { id: "audit", name: "Audit Agent", action: "Stamped immutable record reference", thought: "Pinned snapshot of Companies House response with retrieval timestamp.", source: "Audit Log #30214-CN01" },
    ],
    conclusion: "Company number, type, status, and incorporation date verified directly from the statutory register.",
  },
  "Previous Names": {
    value: "Rivage Capital Management LLP (until 2007)",
    status: "flagged",
    confidence: 95,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Read previous name history", thought: "entity_previous_company_names contains 'RIVAGE CAPITAL MANAGEMENT LLP'. Same company number preserved through name change.", source: "Companies House Name History" },
      { id: "regulatory", name: "Regulatory Agent", action: "Verified FCA permission continuity", thought: "FCA Register shows FRN unchanged through the name change — regulatory continuity confirmed.", source: "FCA Register FRN history" },
      { id: "document", name: "Document Intelligence", action: "Flagged CRM gap", thought: "Internal CRM does not store the prior name. Lineage view will break for analysts on legacy contracts.", source: "CRM Entity Record" },
    ],
    conclusion: "Name change is lawful and regulator-attested; CRM backfill of prior name is recommended.",
  },
  "FCA Permissions": {
    value: "Investment management + Managing an AIF (added 2026-02-11)",
    status: "flagged",
    confidence: 79,
    agents: [
      { id: "regulatory", name: "Regulatory Agent", action: "Polled FCA Register live", thought: "FRN 211088 shows newly added 'Managing an AIF' permission effective 02/11/2026.", source: "FCA Register · FRN 211088" },
      { id: "document", name: "Document Intelligence", action: "Compared with CRM snapshot", thought: "CRM permission set last refreshed 11/02/2025 — does not include the new AIF permission. Drift confirmed.", source: "CRM Permission Set" },
      { id: "risk-scoring", name: "Risk Scoring Agent", action: "Computed risk-model impact", thought: "AIFMD scope adds Article 23 disclosure obligations. Tier may need recomputation post-sync.", source: "Risk Model v4.1 · AIFMD SI 2013/1773" },
    ],
    conclusion: "FCA permission scope has drifted from internal record; sync and re-score required.",
  },
  "Sanctions Screening": {
    value: "1 fuzzy false-positive cleared (PSC name)",
    status: "verified",
    confidence: 97,
    agents: [
      { id: "sanctions", name: "Sanctions Agent", action: "Screened all PSCs and officers", thought: "Ran HMT, OFAC, EU CFSP, UN 1267. One 84% fuzzy hit on PSC name; identity divergence on DOB and nationality.", source: "HMT · OFAC SDN · EU CFSP · UN 1267" },
      { id: "identity", name: "Identity Agent", action: "Confirmed identity divergence", thought: "HMRC-verified passport and Companies House DOB confirm a different individual from the listed namesake.", source: "Passport · Companies House DOB" },
      { id: "audit", name: "Audit Agent", action: "Logged false-positive clearance", thought: "Cleared identity pair added to screening allowlist with full evidence chain.", source: "Audit Log #30188-S03" },
    ],
    conclusion: "Sanctions name-match is a confirmed false positive; cleared with retained evidence.",
  },
  "Controllers": {
    value: "2 controllers identified (LLP designated members + 25%+ PSCs)",
    status: "verified",
    confidence: 94,
    agents: [
      { id: "identity", name: "Identity Agent", action: "Resolved controller set under FCA SUP 11", thought: "Aggregated designated members + PSCs holding ≥25% voting or capital rights. Returned 2 controllers with shareholding bands.", source: "FCA SUP 11.2 · Companies House" },
      { id: "beneficial-owner", name: "Beneficial Owner Agent", action: "Verified upstream ownership chain", thought: "Traversed corporate-member upstream to ultimate natural persons. No undisclosed holders above the 25% threshold.", source: "Companies House PSC · JFSC Registry" },
      { id: "regulatory", name: "Regulatory Agent", action: "Cross-checked FCA Form A history", thought: "All current controllers have approved Form A submissions on file with the FCA. No notification gaps.", source: "FCA Form A archive" },
      { id: "audit", name: "Audit Agent", action: "Pinned controller snapshot", thought: "Immutable snapshot of resolved controller graph stamped to audit log.", source: "Audit Log #30214-CTL" },
    ],
    conclusion: "Controller set reconciled across Companies House, FCA, and upstream registries with no gaps.",
  },
  "Principal Place of Business": {
    value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB",
    status: "verified",
    confidence: 99,
    agents: [
      { id: "document", name: "Document Intelligence", action: "Extracted PPoB from FCA register", thought: "FCA Register principal-place-of-business field returns the Reading address for FRN 209517.", source: "FCA Register · FRN 209517" },
      { id: "identity", name: "Identity Agent", action: "Reconciled with Companies House registered office", thought: "Companies House registered office matches FCA PPoB exactly — no divergence.", source: "Companies House · OC302636" },
      { id: "regulatory", name: "Regulatory Agent", action: "Confirmed UK supervision footprint", thought: "PPoB sits inside FCA jurisdictional perimeter; no cross-border passporting impact.", source: "FCA Handbook · PERG 2" },
    ],
    conclusion: "Principal place of business confirmed and synchronised between FCA and Companies House.",
  },
};

// Aliases so tree labels resolve to existing traces
ATTRIBUTE_TRACES["Persons with Significant Control"] = ATTRIBUTE_TRACES["Persons of Significant Control"];
ATTRIBUTE_TRACES["FCA Regulatory Permissions"] = ATTRIBUTE_TRACES["FCA Permissions"];
ATTRIBUTE_TRACES["Previous Company Names"] = ATTRIBUTE_TRACES["Previous Names"];


type AttrDocKind = "filing" | "screenshot" | "register" | "passport" | "letter";
type AttrDoc = {
  id: string;
  title: string;
  source: string;
  date: string;
  kind: AttrDocKind;
  pages?: number;
  // Body content: paragraphs with optional highlight markers (surround with %% ... %%)
  body: string[];
  // Optional pseudo-screenshot fields (rendered as a styled register screenshot)
  fields?: { label: string; value: string; highlight?: boolean }[];
};
type EntityAttr = { label: string; value: string; source: "CRM" | "3rd" | "Forge"; status: "ok" | "warn" | "alert"; docs?: AttrDoc[] };
type EntityProfile = { name: string; kyc?: string; attrs: EntityAttr[]; caseFile: string };

const SOURCE_STYLE: Record<EntityAttr["source"], string> = {
  CRM: "bg-info-soft text-primary border-primary/30",
  "3rd": "bg-warning-soft text-warning border-warning-soft-border",
  Forge: "bg-secondary text-foreground border-border",
};
const DOT_STYLE: Record<EntityAttr["status"], string> = {
  ok: "bg-success", warn: "bg-warning", alert: "bg-alert",
};

const ENTITY_PROFILES: Record<string, EntityProfile> = {
  "London Alternatives DRG": {
    name: "London Alternatives DRG",
    attrs: [
      { label: "Jurisdiction", value: "United Kingdom", source: "CRM", status: "ok" },
      { label: "Entity Count", value: "2 in-scope RIAs", source: "Forge", status: "ok" },
      { label: "Constituent Entities", value: "Brevan Howard AM LLP · Marshall Wace LLP", source: "Forge", status: "ok" },
      { label: "Primary Regulator", value: "Financial Conduct Authority (UK)", source: "3rd", status: "ok" },
      { label: "Customer Type", value: "Registered Investment Advisers (LLP)", source: "CRM", status: "ok" },
      { label: "KYC Refresh Cycle", value: "Annual", source: "Forge", status: "ok" },
      { label: "CIP Status", value: "In Progress — 2 attributes pending", source: "Forge", status: "warn" },
      { label: "AML Policy Version", value: "AML-POL-UK-2025-v2", source: "Forge", status: "ok" },
      { label: "Open Exceptions", value: "5 (under review)", source: "Forge", status: "warn" },
      { label: "Sanctions Screening", value: "Cleared — 2026-04-19", source: "3rd", status: "ok" },
      { label: "PEP Exposure", value: "None Identified", source: "3rd", status: "ok" },
      { label: "Cross-Border Exposure", value: "Jersey (BH corporate member) — EDD active", source: "Forge", status: "warn" },
    ],
    caseFile: `# London Alternatives DRG — Case File\n\n**Case ID:** DRG-LON-ALT-2026-001  \n**Risk Tier:** Elevated  \n**Last Refresh:** 2026-04-19\n\n## Group Overview\nThe London Alternatives DRG consolidates 2 UK-domiciled limited liability partnerships operating as FCA-authorised Registered Investment Advisers running alternative-investment / hedge-fund strategies.\n\n## Constituent Entities\n| Entity | CH # | FCA FRN | Status |\n|--------|------|---------|--------|\n| Brevan Howard Asset Management LLP | OC302636 | 209517 | Active |\n| Marshall Wace LLP | OC302228 | 211088 | Active |\n\n## Regulatory Footprint\n- **FCA** — both entities authorised as investment managers\n- **AIFMD** — Marshall Wace recently added 'Managing an AIF' permission\n- **HMT / OFSI** — sanctions regime applicable\n\n## Open Exceptions (5)\n1. Undisclosed PSC Address Change — *Brevan Howard*\n2. Cross-Jurisdiction Corporate Member (Jersey) — *Brevan Howard*\n3. Previous Company Name Continuity — *Brevan Howard*\n4. FCA Permission Scope Drift — *Marshall Wace*\n5. Sanctions Screening — PSC Name Hit — *Marshall Wace*\n\n## Risk Notes\n- Jersey-domiciled corporate member triggers EDD on the Brevan Howard leg.\n- Sanctions name hit on Marshall Wace PSC is a confirmed false positive.\n\n## Next Actions\n- Resolve 5 open exceptions before **2026-04-25** SLA.\n- Complete EDD pack on BH Partnership Holdings Limited (Jersey).\n- Sync Marshall Wace permission set with FCA register.`,
  },
  "Brevan Howard Asset Management LLP": {
    name: "Brevan Howard Asset Management LLP",
    kyc: "KYC-30214",
    attrs: [
      { label: "Legal Form", value: "Limited Liability Partnership (LLP)", source: "3rd", status: "ok" },
      { label: "Company Number", value: "OC302636", source: "3rd", status: "ok",
        docs: [{
          id: "ch-cert-bh", title: "Certificate of Incorporation on Change of Name",
          source: "Companies House", date: "2007-04-16", kind: "filing", pages: 1,
          body: [
            "I HEREBY CERTIFY that **RIVAGE CAPITAL MANAGEMENT LLP**, having by special resolution changed its name, is now incorporated under the name of",
            "%%BREVAN HOWARD ASSET MANAGEMENT LLP%%",
            "Given at Companies House, Cardiff, the 16th day of April 2007.",
          ],
          fields: [
            { label: "Company Number", value: "OC302636", highlight: true },
            { label: "Type", value: "Limited Liability Partnership" },
            { label: "Effective Date", value: "16 April 2007" },
          ],
        }],
      },
      { label: "Incorporated On", value: "2002-07-16", source: "3rd", status: "ok" },
      { label: "Company Status", value: "Active", source: "3rd", status: "ok" },
      { label: "Registered Office", value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB", source: "3rd", status: "ok",
        docs: [{
          id: "ch-ad01-bh", title: "Form AD01 — Change of Registered Office",
          source: "Companies House", date: "2019-08-22", kind: "filing", pages: 2,
          body: [
            "Form AD01 — Notice of change of registered office address, filed under section 87 of the Companies Act 2006.",
            "The registered office of the company has been changed to:",
            "%%4th Floor Phoenix House, 1 Station Hill, Reading, Berkshire, RG1 1NB, United Kingdom%%",
            "Signed by a designated member of the LLP on 22 August 2019. Accepted and registered by the Registrar of Companies for England and Wales.",
          ],
          fields: [
            { label: "Company Name", value: "Brevan Howard Asset Management LLP" },
            { label: "Company Number", value: "OC302636" },
            { label: "New Office", value: "4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB", highlight: true },
          ],
        }],
      },
      { label: "Previous Names", value: "Rivage Capital Management LLP (until 2007)", source: "3rd", status: "warn",
        docs: [{
          id: "ch-prevnames-bh", title: "Companies House — Previous Names Snapshot",
          source: "Companies House Public Data API", date: "2026-04-19", kind: "screenshot",
          body: [
            "Snapshot captured from the Companies House web service for company OC302636.",
            "Previous company names recorded against the same registration number:",
          ],
          fields: [
            { label: "Current Name", value: "Brevan Howard Asset Management LLP" },
            { label: "Previous Name", value: "Rivage Capital Management LLP", highlight: true },
            { label: "Effective From", value: "2002-07-16" },
            { label: "Effective To", value: "2007-04-16", highlight: true },
          ],
        }],
      },
      { label: "Primary Regulator", value: "FCA · FRN 209517", source: "3rd", status: "ok" },
      { label: "FCA Permissions", value: "Investment management, MiFID II", source: "3rd", status: "ok",
        docs: [{
          id: "fca-perms-bh", title: "FCA Register — Permissions Snapshot",
          source: "FCA Register · FRN 209517", date: "2026-04-19", kind: "screenshot",
          body: [
            "Snapshot of the regulatory permissions held by Brevan Howard Asset Management LLP as recorded on the FCA Register.",
          ],
          fields: [
            { label: "FRN", value: "209517" },
            { label: "Status", value: "Authorised" },
            { label: "Permissions", value: "Arranging deals in investments · Managing investments · Advising on investments (except Pension Transfers)", highlight: true },
            { label: "Last Updated", value: "2026-04-19" },
          ],
        }],
      },
      { label: "Designated Members", value: "2 corporate (1 UK, 1 Jersey)", source: "Forge", status: "alert" },
      { label: "Persons of Significant Control", value: "Mr Alan Eldad Howard (75–100% voting)", source: "3rd", status: "warn",
        docs: [
          {
            id: "ch-psc-bh", title: "PSC Register Extract — Mr A E Howard",
            source: "Companies House PSC API", date: "2026-04-19", kind: "screenshot",
            body: [
              "Live extract from the Persons with Significant Control register for OC302636.",
            ],
            fields: [
              { label: "Name", value: "Mr Alan Eldad Howard" },
              { label: "Date of Birth", value: "September 1963" },
              { label: "Nationality", value: "British" },
              { label: "Country of Residence", value: "United Kingdom" },
              { label: "Voting Rights", value: "75% to 100%", highlight: true },
              { label: "Correspondence Address", value: "82 Baker Street, London, W1U 6AE", highlight: true },
            ],
          },
          {
            id: "ch-cs01-bh", title: "Form CS01 — Confirmation Statement (excerpt)",
            source: "Companies House Filing", date: "2026-03-14", kind: "filing", pages: 6,
            body: [
              "Confirmation statement filed under section 853A of the Companies Act 2006 on behalf of Brevan Howard Asset Management LLP.",
              "Part 4 — Persons with Significant Control. The following information is confirmed as accurate at the confirmation date:",
              "Mr Alan Eldad Howard, correspondence address: %%27 Hill Street, London, W1J 5LP%%.",
              "Note: address differs from the live PSC register entry — PSC02 amendment outstanding.",
            ],
          },
        ],
      },
      { label: "PSC Date of Birth", value: "1963-09", source: "3rd", status: "ok" },
      { label: "PSC Nationality", value: "British", source: "3rd", status: "ok",
        docs: [{
          id: "passport-aeh", title: "Passport — Mr A E Howard (redacted)",
          source: "HMRC-verified identity document", date: "2024-11-02", kind: "passport",
          body: [
            "HMRC-verified passport scan retained in the Evidence Locker for identity verification purposes.",
          ],
          fields: [
            { label: "Surname", value: "HOWARD" },
            { label: "Given Names", value: "ALAN ELDAD" },
            { label: "Nationality", value: "BRITISH CITIZEN", highlight: true },
            { label: "Date of Birth", value: "•• SEP 1963" },
            { label: "Passport No.", value: "•••••••42" },
            { label: "Issuing Authority", value: "HMPO" },
          ],
        }],
      },
      { label: "Sanctions Screening", value: "Cleared — 2026-04-19", source: "3rd", status: "ok" },
      { label: "Last KYC Refresh", value: "2025-11-02", source: "Forge", status: "ok" },
      { label: "Risk Tier", value: "Elevated (Jersey EDD active)", source: "Forge", status: "alert" },
    ],
    caseFile: `# Brevan Howard Asset Management LLP\n\n**KYC ID:** KYC-30214  \n**Companies House #:** OC302636  \n**FCA FRN:** 209517\n\n## Entity Summary\nUK-domiciled limited liability partnership and FCA-authorised investment manager. Founded in 2002 as **Rivage Capital Management LLP**; renamed to Brevan Howard Asset Management LLP in 2007. Runs global macro and multi-strategy hedge funds for institutional clients.\n\n## Registered Particulars (Companies House)\n- **Number:** OC302636  \n- **Type:** LLP  \n- **Status:** Active  \n- **Incorporated:** 2002-07-16  \n- **Office:** 4th Floor Phoenix House, 1 Station Hill, Reading, RG1 1NB, United Kingdom\n\n## Designated Members\n| Name | Domicile | Reg. # |\n|------|----------|--------|\n| BH Partnership Holdings Limited | Jersey | 106333 |\n| Brevan Howard Asset Management Services Limited | United Kingdom | 11117501 |\n\n## Persons of Significant Control\n- **Mr Alan Eldad Howard** — b. 1963-09, British  \n  Voting rights: 75–100% (LLP)  \n  Right to share of surplus assets: 25–50%  \n  Correspondence: 82 Baker Street, London W1U 6AE *(address drift flagged)*\n\n## Active Exceptions\n- **Undisclosed PSC Address Change** — PSC02 correction requested\n- **Cross-Jurisdiction Corporate Member (Jersey)** — EDD pack pending\n- **Previous Company Name Continuity** — CRM backfill recommended\n\n## Next Actions\n1. Run EDD on BH Partnership Holdings Limited (Jersey).\n2. Request PSC02 correction filing from client.\n3. Backfill 'Rivage Capital Management LLP' alias into CRM.`,
  },
  "Marshall Wace LLP": {
    name: "Marshall Wace LLP",
    kyc: "KYC-30188",
    attrs: [
      { label: "Legal Form", value: "Limited Liability Partnership (LLP)", source: "3rd", status: "ok" },
      { label: "Company Number", value: "OC302228", source: "3rd", status: "ok" },
      { label: "Incorporated On", value: "2003-04-02", source: "3rd", status: "ok" },
      { label: "Company Status", value: "Active", source: "3rd", status: "ok" },
      { label: "Registered Office", value: "George House, 131 Sloane Street, London, SW1X 9AT", source: "3rd", status: "ok",
        docs: [{
          id: "ch-office-mw", title: "Companies House Register — Registered Office",
          source: "Companies House", date: "2026-04-19", kind: "screenshot",
          body: ["Live extract of the registered office on file for OC302228."],
          fields: [
            { label: "Company Name", value: "Marshall Wace LLP" },
            { label: "Office Address", value: "George House, 131 Sloane Street, London, SW1X 9AT", highlight: true },
            { label: "Country", value: "United Kingdom" },
          ],
        }],
      },
      { label: "Primary Regulator", value: "FCA · FRN 211088", source: "3rd", status: "ok" },
      { label: "FCA Permissions", value: "Investment management + Managing an AIF (drift)", source: "3rd", status: "alert",
        docs: [{
          id: "fca-perms-mw", title: "FCA Register — Permissions Snapshot",
          source: "FCA Register · FRN 211088", date: "2026-04-19", kind: "screenshot",
          body: [
            "Snapshot of the regulatory permissions held by Marshall Wace LLP. A new permission was activated on 2026-02-11 and has not yet been mirrored into the internal CRM permission set.",
          ],
          fields: [
            { label: "FRN", value: "211088" },
            { label: "Status", value: "Authorised" },
            { label: "Existing Permissions", value: "Arranging deals in investments · Managing investments" },
            { label: "New Permission", value: "Managing an AIF (effective 2026-02-11)", highlight: true },
          ],
        }],
      },
      { label: "Designated Members", value: "4 individuals + 1 corporate", source: "3rd", status: "ok" },
      { label: "Persons of Significant Control", value: "Sir Paul Marshall, Ian Wace (each 25–50% voting)", source: "3rd", status: "ok",
        docs: [{
          id: "ch-psc-mw", title: "PSC Register Extract — Marshall Wace LLP",
          source: "Companies House PSC API", date: "2026-04-19", kind: "screenshot",
          body: ["Live extract of all Persons with Significant Control associated with OC302228."],
          fields: [
            { label: "PSC 1", value: "Sir Paul Marshall · b. Aug 1959 · British", highlight: true },
            { label: "Voting Rights (1)", value: "25% to 50%" },
            { label: "PSC 2", value: "Ian Wace · b. Dec 1963 · British", highlight: true },
            { label: "Voting Rights (2)", value: "25% to 50%" },
          ],
        }],
      },
      { label: "Sanctions Screening", value: "1 fuzzy hit cleared (false positive)", source: "3rd", status: "warn",
        docs: [
          {
            id: "hmt-screening-mw", title: "HMT Consolidated List — Match Detail",
            source: "HMT / OFSI Consolidated List", date: "2026-04-01", kind: "register",
            body: ["The matched record on the HMT consolidated list (designation has since been lifted)."],
            fields: [
              { label: "Listed Name", value: "Paul Marshall", highlight: true },
              { label: "Date of Birth", value: "1971", highlight: true },
              { label: "Nationality", value: "Zimbabwean", highlight: true },
              { label: "Regime", value: "Zimbabwe (de-listed 2014)" },
              { label: "Match Score", value: "84% (fuzzy name only)" },
            ],
          },
          {
            id: "wc-log-mw", title: "World-Check Screening Log",
            source: "Refinitiv World-Check One", date: "2026-04-19", kind: "screenshot",
            body: [
              "Screening run executed against all PSCs and officers of Marshall Wace LLP. One fuzzy match returned and cleared with documented identity divergence.",
              "%%Cleared as confirmed false positive — DOB and nationality differ from listed namesake.%%",
            ],
          },
        ],
      },
      { label: "PEP Exposure", value: "None Identified", source: "3rd", status: "ok" },
      { label: "AUM Disclosed", value: "≈ USD 70bn (2025)", source: "CRM", status: "ok" },
      { label: "Last KYC Refresh", value: "2025-11-02", source: "Forge", status: "ok" },
      { label: "Risk Tier", value: "Elevated (FCA scope drift)", source: "Forge", status: "alert" },
    ],
    caseFile: `# Marshall Wace LLP\n\n**KYC ID:** KYC-30188  \n**Companies House #:** OC302228  \n**FCA FRN:** 211088\n\n## Entity Summary\nUK-domiciled limited liability partnership and FCA-authorised investment manager. Co-founded in 1997 by Sir Paul Marshall and Ian Wace; LLP registered in 2003. Runs long/short equity and quantitative TOPS strategies for global institutions.\n\n## Registered Particulars (Companies House)\n- **Number:** OC302228  \n- **Type:** LLP  \n- **Status:** Active  \n- **Incorporated:** 2003-04-02  \n- **Office:** George House, 131 Sloane Street, London, SW1X 9AT, United Kingdom\n\n## Persons of Significant Control\n| Name | DOB | Nationality | Voting Rights |\n|------|-----|-------------|---------------|\n| Sir Paul Marshall | 1959-08 | British | 25–50% |\n| Ian Wace | 1963-12 | British | 25–50% |\n\n## FCA Permissions\n- Arranging deals in investments\n- Managing investments\n- **Managing an AIF** *(added 2026-02-11 — CRM sync pending)*\n\n## Active Exceptions\n- **FCA Permission Scope Drift** — sync CRM with FCA register\n- **Sanctions Screening — PSC Name Hit** — confirmed false positive on 'Paul Marshall' (different DOB & nationality)\n\n## Next Actions\n1. Sync CRM permission set with FCA register.\n2. Request AIFMD Article 23 disclosure pack from client.\n3. Add cleared name pair to sanctions allowlist.`,
  },
};


const TRACE_ALIAS: Record<string, string[]> = {
  "Persons of Significant Control": ["Persons with Significant Control"],
  "FCA Permissions": ["FCA Regulatory Permissions"],
  "Previous Names": ["Previous Company Names"],
  "Registered Office": ["Principal Place of Business"],
};

const TRACE_DOCS: Record<string, { entity: string; attr: EntityAttr; doc: AttrDoc }[]> = (() => {
  const out: Record<string, { entity: string; attr: EntityAttr; doc: AttrDoc }[]> = {};
  for (const [entityName, profile] of Object.entries(ENTITY_PROFILES)) {
    for (const a of profile.attrs) {
      if (!a.docs?.length) continue;
      const keys = [a.label, ...(TRACE_ALIAS[a.label] ?? [])];
      for (const k of keys) {
        (out[k] ??= []).push(...a.docs.map((d) => ({ entity: entityName, attr: a, doc: d })));
      }
    }
  }
  return out;
})();

// Controllers trace reuses PSC + Designated Members evidence
TRACE_DOCS["Controllers"] = [
  ...(TRACE_DOCS["Persons of Significant Control"] ?? []),
];
TRACE_DOCS["Designated Members"] = [
  ...(TRACE_DOCS["Persons of Significant Control"] ?? []).slice(0, 1),
];


const AttributeTree = () => {
  const [selected, setSelected] = useState<string | null>("Persons with Significant Control");
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<{ doc: AttrDoc; attr: EntityAttr; entity: string } | null>(null);
  const { runAgents } = useAgents();

  const trace = selected ? ATTRIBUTE_TRACES[selected] : null;
  const traceDocs = selected ? TRACE_DOCS[selected] ?? [] : [];


  const attrNode = (name: string, flagged = false) => {
    const isSel = selected === name;
    return (
      <button
        onClick={() => setSelected(isSel ? null : name)}
        className={cn(
          "w-full rounded-lg border px-3 py-2 flex items-center justify-between text-left transition-colors",
          isSel ? "border-primary bg-info-soft" : flagged ? "border-alert hover:bg-alert-soft/30" : "border-border hover:bg-secondary/40"
        )}
      >
        <span className="text-[12px] font-medium truncate">{name}</span>
        {flagged ? <AlertTriangle className="size-4 text-alert shrink-0" /> : <CheckCircle2 className="size-4 text-success shrink-0" />}
      </button>
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

  return (
    <div className="relative pt-2">
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">DRG Parent</span>
        <div className="w-full">{entityNode("London Alternatives DRG")}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {([
          { entity: "Brevan Howard Asset Management LLP", attrs: ["Controllers", "Persons with Significant Control", "Principal Place of Business", "FCA Regulatory Permissions"] as const },
          { entity: "Marshall Wace LLP", attrs: ["Controllers", "Previous Company Names", "Principal Place of Business", "Sanctions Screening"] as const },
        ]).map(({ entity, attrs }) => (
          <div key={entity} className="space-y-2">
            {entityNode(entity)}
            {attrs.map((a) => {
              const flagged = ATTRIBUTE_TRACES[a]?.status === "flagged";
              return <div key={a}>{attrNode(a, flagged)}</div>;
            })}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3 italic">Tip: click an entity name to view its full attribute set & case file.</p>

      {trace && (
        <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" /> Agent Trace · How this was determined
              </p>
              <p className="text-[13px] font-semibold leading-tight">{selected}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">{trace.value}</p>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
              trace.status === "verified"
                ? "bg-success-soft text-success border-success-soft-border"
                : "bg-alert-soft text-alert border-alert-soft-border"
            )}>
              {trace.status === "verified" ? "ID & Verified" : "Flagged"} · {trace.confidence}%
            </span>
          </div>

          <ol className="space-y-2.5 mb-3">
            {trace.agents.map((a, i) => (
              <li key={a.id} className="relative pl-7">
                <span className="absolute left-0 top-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-medium">{i + 1}</span>
                {i < trace.agents.length - 1 && <span className="absolute left-[9px] top-6 bottom-[-10px] w-px bg-border" />}
                <div className="flex items-center gap-1.5 mb-0.5">
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

          <div className="rounded-lg border border-border bg-card p-3 mb-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <ShieldCheck className="size-3 text-success" /> Verification Conclusion
            </p>
            <p className="text-[12px] leading-snug">{trace.conclusion}</p>
          </div>

          {traceDocs.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3 mb-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Paperclip className="size-3 text-primary" /> Source Documents ({traceDocs.length})
              </p>
              <div className="space-y-1.5">
                {traceDocs.map(({ doc, attr, entity }) => {
                  const meta = DOC_KIND_META[doc.kind];
                  return (
                    <button
                      key={`${entity}-${doc.id}`}
                      onClick={() => setViewDoc({ doc, attr, entity })}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:border-primary hover:bg-info-soft/40 text-left transition-colors group"
                    >
                      <FileText className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{doc.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{entity} · {doc.source} · {doc.date}</p>
                      </div>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide shrink-0", meta.tone)}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsUp className="size-3.5" /></button>
              <button className="size-7 rounded-full border border-border grid place-items-center text-muted-foreground hover:text-foreground"><ThumbsDown className="size-3.5" /></button>
            </div>
            <button
              onClick={() => runAgents(trace.agents.map((a) => a.id), `Re-verify: ${selected}`)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1.5"
            >
              <Play className="size-3" /> Re-run agent trace
            </button>
          </div>
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

// ---------- Per-attribute mini trace ----------

const SOURCE_AGENT: Record<EntityAttr["source"], { name: string; system: string; icon: string }> = {
  CRM: { name: "CRM Sync Agent", system: "Salesforce CRM (Customer 360)", icon: "🗂" },
  "3rd": { name: "External Data Agent", system: "GLEIF / SEC EDGAR / OFAC / Refinitiv", icon: "🌐" },
  Forge: { name: "Forge Policy Agent", system: "Internal Forge Knowledge Graph", icon: "⚙" },
};

const STATUS_LABEL: Record<EntityAttr["status"], string> = {
  ok: "Verified", warn: "Review", alert: "Action Required",
};

const DOC_KIND_META: Record<AttrDocKind, { label: string; tone: string }> = {
  filing:     { label: "Filing",         tone: "bg-info-soft text-primary border-primary/30" },
  screenshot: { label: "Screenshot",     tone: "bg-secondary text-foreground border-border" },
  register:   { label: "Register Entry", tone: "bg-warning-soft text-[hsl(30_70%_40%)] border-warning-soft-border" },
  passport:   { label: "Identity Doc",   tone: "bg-success-soft text-success border-success-soft-border" },
  letter:     { label: "Letter",         tone: "bg-info-soft text-primary border-primary/30" },
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
            <button className="text-[11px] px-3 py-1.5 rounded-full border border-primary text-primary hover:bg-info-soft flex items-center gap-1.5">
              <FileText className="size-3" /> Open original
            </button>
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
              <h3 className="text-[15px] font-semibold">Agent Review</h3>
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

export default ExceptionReview;



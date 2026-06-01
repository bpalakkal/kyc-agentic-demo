import { useEffect, useRef, useState, useCallback } from "react";
import cytoscape from "cytoscape";
// @ts-ignore — no types shipped with cytoscape-dagre
import dagre from "cytoscape-dagre";
import { X, ZoomIn, ZoomOut, Maximize2, RefreshCw, Expand } from "lucide-react";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { cn } from "@/lib/utils";

cytoscape.use(dagre);

type CyNode = { id: string; label: string; _elementId?: string; [k: string]: unknown };
type CyEdge = { id: string; source: string; target: string; label: string; [k: string]: unknown };

function riskColor(node: CyNode): string {
  const risk = (node.clientRiskRating ?? node.riskRating ?? node.risk ?? "").toString().toLowerCase();
  if (risk.includes("high")) return "#ef4444";
  if (risk.includes("medium") || risk.includes("elevated")) return "#f97316";
  if (risk.includes("low")) return "#22c55e";
  const lbl = (node.label ?? "").toString().toLowerCase();
  if (lbl === "entity") return "#6366f1";
  if (lbl === "person") return "#0ea5e9";
  if (lbl === "address") return "#8b5cf6";
  if (lbl === "jurisdiction") return "#14b8a6";
  return "#64748b";
}

function nodeLabel(node: CyNode): string {
  return String(node.name ?? node.description ?? node.id ?? "");
}

const DAGRE_LAYOUT: cytoscape.LayoutOptions = {
  name: "dagre",
  rankDir: "LR",
  nodeSep: 60,
  rankSep: 120,
  padding: 40,
  animate: true,
  animationDuration: 400,
} as cytoscape.LayoutOptions;

const CY_STYLE: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      "label": "data(displayLabel)",
      "color": "#fff",
      "font-size": "6px",
      "text-valign": "center",
      "text-halign": "center",
      "width": 80,
      "height": 80,
      "text-wrap": "wrap",
      "text-max-width": "72px",
      "border-width": 2,
      "border-color": "#ffffff30",
    },
  },
  {
    selector: "node[?isCentre]",
    style: {
      "width": 100,
      "height": 100,
      "border-width": 4,
      "border-color": "#fff",
      "font-size": "6px",
      "font-weight": "bold",
    },
  },
  {
    selector: "node[?expanded]",
    style: {
      "border-width": 3,
      "border-color": "#fbbf24",
      "border-style": "dashed",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#fbbf24",
    },
  },
  {
    selector: "edge",
    style: {
      "width": 1.5,
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "label": "data(label)",
      "font-size": "5px",
      "color": "#94a3b8",
      "text-background-color": "#0f172a",
      "text-background-opacity": 1,
      "text-background-padding": "2px",
    },
  },
  {
    selector: "edge:selected",
    style: { "line-color": "#fbbf24", "target-arrow-color": "#fbbf24" },
  },
  {
    selector: "edge[?isNew]",
    style: { "line-color": "#fbbf24", "target-arrow-color": "#fbbf24", "width": 2 },
  },
];

interface Props {
  kycId: string;
  entityName: string;
  onClose: () => void;
}

export function GraphView({ kycId, entityName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const expandedRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CyNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  function safeElements(nodes: CyNode[], edges: CyEdge[]) {
    const nodeIds = new Set(nodes.map(n => String(n.id)));
    const safeEdges = edges.filter(e => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)));
    return { nodes, edges: safeEdges };
  }

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    expandedRef.current.clear();
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/neo4j/entity/${encodeURIComponent(kycId)}/graph`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const { nodes, edges } = safeElements(body.nodes as CyNode[], body.edges as CyEdge[]);
      setNodeCount(nodes.length);
      setEdgeCount(edges.length);
      mountGraph(nodes, edges);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [kycId]);

  function mountGraph(nodes: CyNode[], edges: CyEdge[]) {
    if (!containerRef.current) return;
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => ({
          data: { ...n, color: riskColor(n), displayLabel: nodeLabel(n), isCentre: n.id === kycId, expanded: false },
        })),
        ...edges.map(e => ({ data: { ...e } })),
      ],
      layout: DAGRE_LAYOUT,
      style: CY_STYLE,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt) => {
      setSelected(evt.target.data() as CyNode);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    cyRef.current = cy;
  }

  async function expandNode(node: CyNode) {
    const elementId = node._elementId;
    if (!elementId || !cyRef.current) return;
    if (expandedRef.current.has(elementId)) return;
    expandedRef.current.add(elementId);

    setExpanding(true);
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/neo4j/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elementId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      const cy = cyRef.current;
      const { nodes, edges } = safeElements(body.nodes as CyNode[], body.edges as CyEdge[]);

      // mark the clicked node as expanded
      cy.getElementById(String(node.id)).data("expanded", true);

      // add only genuinely new nodes/edges
      const existingNodeIds = new Set(cy.nodes().map(n => n.id()));
      const existingEdgeIds = new Set(cy.edges().map(e => e.id()));

      const newElements: cytoscape.ElementDefinition[] = [
        ...nodes
          .filter(n => !existingNodeIds.has(String(n.id)))
          .map(n => ({ data: { ...n, color: riskColor(n), displayLabel: nodeLabel(n), isCentre: false, expanded: false } })),
        ...edges
          .filter(e => !existingEdgeIds.has(String(e.id)))
          .map(e => ({ data: { ...e, isNew: true } })),
      ];

      if (newElements.length > 0) {
        cy.add(newElements);
        cy.layout(DAGRE_LAYOUT).run();
        setNodeCount(cy.nodes().length);
        setEdgeCount(cy.edges().length);
      }
    } catch (e: unknown) {
      expandedRef.current.delete(elementId);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExpanding(false);
    }
  }

  useEffect(() => {
    loadGraph();
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [loadGraph]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isExpanded = selected?._elementId ? expandedRef.current.has(selected._elementId) : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">{entityName}</span>
          <span className="text-white/40 text-xs">KYC {kycId}</span>
          {!loading && !error && (
            <span className="text-white/40 text-xs">{nodeCount} nodes · {edgeCount} edges</span>
          )}
          {expanding && <span className="text-yellow-400/70 text-xs flex items-center gap-1"><RefreshCw className="size-3 animate-spin" /> Expanding…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => cyRef.current?.fit(undefined, 40)} className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Fit to screen"><Maximize2 className="size-4" /></button>
          <button onClick={() => cyRef.current?.zoom((cyRef.current?.zoom() ?? 1) * 1.2)} className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Zoom in"><ZoomIn className="size-4" /></button>
          <button onClick={() => cyRef.current?.zoom((cyRef.current?.zoom() ?? 1) / 1.2)} className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Zoom out"><ZoomOut className="size-4" /></button>
          <button onClick={loadGraph} className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Reset graph"><RefreshCw className="size-4" /></button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button onClick={onClose} className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Close (Esc)"><X className="size-4" /></button>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm gap-2">
            <RefreshCw className="size-4 animate-spin" /> Loading graph…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 max-w-sm text-center">
              <p className="text-red-400 font-medium mb-1">Failed to load graph</p>
              <p className="text-red-300/70 text-sm">{error}</p>
              <button onClick={loadGraph} className="mt-4 text-sm px-4 py-2 rounded-full border border-red-500/40 text-red-300 hover:bg-red-900/40 transition-colors">Retry</button>
            </div>
          </div>
        )}
        {!loading && !error && nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
            No graph data found for this entity.
          </div>
        )}
      </div>

      {/* Selected node detail panel */}
      {selected && (
        <div className="absolute bottom-4 left-4 z-10 w-72 rounded-xl border border-white/20 bg-[#1e293b] shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
              style={{ backgroundColor: riskColor(selected) + "33", color: riskColor(selected) }}
            >
              {selected.label}
            </span>
            <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white"><X className="size-3.5" /></button>
          </div>
          <p className="text-white font-medium text-sm mb-3">{nodeLabel(selected)}</p>
          <div className="space-y-1.5 mb-3">
            {Object.entries(selected)
              .filter(([k]) => !["id", "label", "color", "isCentre", "name", "expanded", "displayLabel", "_elementId", "isNew"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-white/50 capitalize shrink-0">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className={cn(
                    "text-white/80 text-right truncate",
                    k === "clientRiskRating" && String(v).toLowerCase().includes("high") && "text-red-400",
                    k === "clientRiskRating" && (String(v).toLowerCase().includes("medium") || String(v).toLowerCase().includes("elevated")) && "text-orange-400",
                    k === "clientRiskRating" && String(v).toLowerCase().includes("low") && "text-green-400",
                  )}>{String(v ?? "—")}</span>
                </div>
              ))}
          </div>
          {selected._elementId && (
            <button
              onClick={() => expandNode(selected)}
              disabled={isExpanded || expanding}
              className={cn(
                "w-full text-xs px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors",
                isExpanded
                  ? "border-white/10 text-white/30 cursor-default"
                  : "border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/30"
              )}
            >
              <Expand className="size-3" />
              {isExpanded ? "Already expanded" : "Expand relationships"}
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 text-[11px] text-white/50">
        {[
          { color: "#6366f1", label: "Entity" },
          { color: "#0ea5e9", label: "Person" },
          { color: "#ef4444", label: "High Risk" },
          { color: "#f97316", label: "Medium Risk" },
          { color: "#22c55e", label: "Low Risk" },
          { color: "#fbbf24", label: "Expanded" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

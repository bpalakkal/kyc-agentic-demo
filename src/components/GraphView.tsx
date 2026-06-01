import { useEffect, useRef, useState, useCallback } from "react";
import cytoscape from "cytoscape";
// @ts-ignore — no types shipped with cytoscape-dagre
import dagre from "cytoscape-dagre";
import { X, ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { cn } from "@/lib/utils";

cytoscape.use(dagre);

type CyNode = { id: string; label: string; [k: string]: unknown };
type CyEdge = { id: string; source: string; target: string; label: string; [k: string]: unknown };

function riskColor(node: CyNode): string {
  const risk = (node.riskRating ?? node.risk ?? "").toString().toLowerCase();
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

interface Props {
  kycId: string;
  entityName: string;
  onClose: () => void;
}

export function GraphView({ kycId, entityName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CyNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/neo4j/entity/${encodeURIComponent(kycId)}/graph`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const { nodes, edges } = body as { nodes: CyNode[]; edges: CyEdge[] };
      const nodeIds = new Set(nodes.map(n => String(n.id)));
      const safeEdges = edges.filter(e => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)));
      setNodeCount(nodes.length);
      setEdgeCount(safeEdges.length);
      mountGraph(nodes, safeEdges);
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
          data: { ...n, color: riskColor(n), isCentre: n.id === kycId },
        })),
        ...edges.map(e => ({ data: { ...e } })),
      ],
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 60,
        rankSep: 120,
        padding: 40,
        animate: true,
        animationDuration: 400,
      } as cytoscape.LayoutOptions,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "label": "data(name)",
            "color": "#fff",
            "font-size": "11px",
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
            "font-size": "12px",
            "font-weight": "bold",
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
            "font-size": "9px",
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
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt) => {
      const d = evt.target.data() as CyNode;
      setSelected(d);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    cyRef.current = cy;
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">{entityName}</span>
          <span className="text-white/40 text-xs">KYC {kycId}</span>
          {!loading && !error && (
            <span className="text-white/40 text-xs">
              {nodeCount} nodes · {edgeCount} edges
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cyRef.current?.fit(undefined, 40)}
            className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Fit to screen"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
            className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
            className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            onClick={loadGraph}
            className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Reload"
          >
            <RefreshCw className="size-4" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button
            onClick={onClose}
            className="size-8 rounded border border-white/20 grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
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
              <button
                onClick={loadGraph}
                className="mt-4 text-sm px-4 py-2 rounded-full border border-red-500/40 text-red-300 hover:bg-red-900/40 transition-colors"
              >
                Retry
              </button>
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
            <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-white font-medium text-sm mb-3">{String(selected.name ?? selected.id)}</p>
          <div className="space-y-1.5">
            {Object.entries(selected)
              .filter(([k]) => !["id", "label", "color", "isCentre", "name"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-white/50 capitalize shrink-0">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className={cn(
                    "text-white/80 text-right truncate",
                    k === "riskRating" && String(v).toLowerCase().includes("high") && "text-red-400",
                    k === "riskRating" && (String(v).toLowerCase().includes("medium") || String(v).toLowerCase().includes("elevated")) && "text-orange-400",
                    k === "riskRating" && String(v).toLowerCase().includes("low") && "text-green-400",
                  )}>{String(v ?? "—")}</span>
                </div>
              ))}
          </div>
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

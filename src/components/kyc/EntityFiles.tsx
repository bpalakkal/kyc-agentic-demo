import { useState, useEffect } from "react";
import { Loader2, FolderOpen, FileText, ImageIcon } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { FileCard, type CaseFile } from "./FileCard";
import { DocumentViewer } from "./DocumentViewer";
import { cn } from "@/lib/utils";

type Category = "all" | "document" | "screenshot";

interface EntityFilesProps {
  kycRef: string;
  /** If provided, only show files from this agent run */
  agentRunId?: string;
}

export const EntityFiles = ({ kycRef, agentRunId }: EntityFilesProps) => {
  const [files, setFiles]       = useState<CaseFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [viewing, setViewing]   = useState<CaseFile | null>(null);

  useEffect(() => {
    if (!kycRef) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    const url = agentRunId
      ? `${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/files?agentRunId=${agentRunId}`
      : `${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/files`;

    apiFetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (!cancelled) { setFiles(data); setLoading(false); } })
      .catch(e  => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [kycRef, agentRunId]);

  const filtered = files.filter(f =>
    category === "all" ? true : f.file_category === category
  );

  const docCount  = files.filter(f => f.file_category === "document").length;
  const imgCount  = files.filter(f => f.file_category === "screenshot").length;

  const TAB_ITEMS: { id: Category; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "all",        label: "All",         icon: null,                                      count: files.length },
    { id: "document",   label: "Documents",   icon: <FileText  className="size-3" />,          count: docCount },
    { id: "screenshot", label: "Screenshots", icon: <ImageIcon className="size-3" />,          count: imgCount },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-3 pb-3 border-b border-border mb-3">
        {TAB_ITEMS.map(t => (
          <button
            key={t.id}
            onClick={() => setCategory(t.id)}
            className={cn(
              "flex items-center gap-1 text-[11px] pb-1 -mb-px border-b-2 transition-colors",
              category === t.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className="ml-0.5 px-1 py-0.5 rounded text-[9px] bg-secondary text-muted-foreground">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <p className="text-sm">Failed to load files</p>
            <p className="text-[11px]">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <FolderOpen className="size-8 opacity-40" />
            <p className="text-sm">
              {files.length === 0
                ? "No files yet — run an agent to generate documents"
                : `No ${category === "all" ? "" : category + " "}files`}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(f => (
              <FileCard key={f.id} file={f} onView={setViewing} />
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <DocumentViewer file={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
};

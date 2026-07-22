import { useState, useEffect } from "react";
import { Loader2, FolderOpen, FileText, ImageIcon, Upload, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

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
  }, [kycRef, agentRunId, refreshKey]);

  const uploadDocuments = async (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      const files = await Promise.all(Array.from(selectedFiles).map(async (file) => ({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
          reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
          reader.readAsDataURL(file);
        }),
      })));
      const response = await apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/documents/upload`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Upload failed (HTTP ${response.status})`);
      setUploadMessage({ tone: "success", text: `${result.accepted} document${result.accepted === 1 ? "" : "s"} uploaded. Classification and digitization started.` });
      setRefreshKey((key) => key + 1);
      window.setTimeout(() => setRefreshKey((key) => key + 1), 5000);
    } catch (uploadError) {
      setUploadMessage({ tone: "error", text: uploadError instanceof Error ? uploadError.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

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
        {!agentRunId && (
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-95">
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            {uploading ? "Uploading…" : "Upload documents"}
            <input type="file" multiple disabled={uploading} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.html,.json" className="sr-only" onChange={(event) => { void uploadDocuments(event.target.files); event.target.value = ""; }} />
          </label>
        )}
      </div>

      {uploadMessage && (
        <div className={cn("mb-3 flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px]", uploadMessage.tone === "success" ? "border-success/30 bg-success-soft text-success" : "border-alert/30 bg-alert-soft text-alert")}>
          {uploadMessage.tone === "success" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 size-3.5 shrink-0" />}
          {uploadMessage.text}
        </div>
      )}

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
                ? "No files yet — upload customer documents or run a sourcing agent"
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

import { useState, useEffect } from "react";
import { X, Download, ExternalLink, Loader2, FileText, ImageIcon, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { cn } from "@/lib/utils";

interface CaseFile {
  id: string;
  filename: string;
  title?: string;
  mime_type: string;
  file_category: "document" | "screenshot";
  source_url?: string;
  created_at: string;
  agent_runs?: { agent_slug: string; completed_at: string } | null;
}

interface DocumentViewerProps {
  file: CaseFile;
  onClose: () => void;
}

export const DocumentViewer = ({ file, onClose }: DocumentViewerProps) => {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    apiFetch(`${AGENT_API_BASE}/api/file/${file.id}/url`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(({ url }) => { if (!cancelled) { setSignedUrl(url); setState("ready"); } })
      .catch(e => { if (!cancelled) { setErrorMsg(e.message); setState("error"); } });
    return () => { cancelled = true; };
  }, [file.id]);

  const isImage = /^image\//i.test(file.mime_type);
  const isPdf   = file.mime_type === "application/pdf";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isImage
              ? <ImageIcon className="size-4 text-muted-foreground shrink-0" />
              : <FileText  className="size-4 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{file.title ?? file.filename}</p>
              <p className="text-[11px] text-muted-foreground">
                {file.agent_runs?.agent_slug ?? "manual upload"} ·{" "}
                {new Date(file.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {file.source_url && (
              <a
                href={file.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="size-3" /> Source
              </a>
            )}
            {signedUrl && (
              <a
                href={signedUrl}
                download={file.filename}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-border hover:bg-secondary text-[11px] transition-colors"
              >
                <Download className="size-3" /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="size-7 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-secondary/20 relative">
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="size-8 text-alert" />
              <p className="text-sm">Could not load file</p>
              <p className="text-[11px]">{errorMsg}</p>
            </div>
          )}

          {state === "ready" && signedUrl && (
            <div className={cn("w-full h-full", isImage && "flex items-center justify-center p-4")}>
              {isImage ? (
                <img
                  src={signedUrl}
                  alt={file.title ?? file.filename}
                  className="max-w-full max-h-full object-contain rounded shadow"
                />
              ) : isPdf ? (
                <iframe
                  src={signedUrl}
                  className="w-full h-full border-0"
                  title={file.title ?? file.filename}
                />
              ) : (
                /* Unsupported preview — offer download */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <FileText className="size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Preview not available for {file.mime_type}</p>
                  <a
                    href={signedUrl}
                    download={file.filename}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                  >
                    <Download className="size-4" /> Download {file.filename}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

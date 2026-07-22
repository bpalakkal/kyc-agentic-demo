import { FileText, ImageIcon, File, ExternalLink, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CaseFile {
  id: string;
  filename: string;
  title?: string;
  caption?: string;
  mime_type: string;
  file_category: "document" | "screenshot";
  source_url?: string;
  created_at: string;
  agent_runs?: { agent_slug: string; completed_at?: string } | null;
  processing_status?: "pending" | "processing" | "complete" | "failed" | "duplicate" | "not_applicable";
  document_type?: string | null;
  processing_error?: string | null;
}

interface FileCardProps {
  file: CaseFile;
  onView: (file: CaseFile) => void;
  className?: string;
}

export const FileCard = ({ file, onView, className }: FileCardProps) => {
  const isImage = /^image\//i.test(file.mime_type);
  const isPdf   = file.mime_type === "application/pdf";

  const Icon = isImage ? ImageIcon : isPdf ? FileText : File;
  const iconBg = isImage
    ? "bg-info-soft text-info"
    : isPdf
    ? "bg-alert-soft text-alert"
    : "bg-secondary text-muted-foreground";

  const agentLabel = file.agent_runs?.agent_slug
    ? file.agent_runs.agent_slug.replace(/-/g, " ")
    : "manual";

  const dateLabel = new Date(file.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors",
      className
    )}>
      <div className="flex items-start gap-2.5">
        <span className={cn("size-8 rounded-md grid place-items-center shrink-0", iconBg)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium leading-snug truncate" title={file.title ?? file.filename}>
            {file.title ?? file.filename}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            <span className="capitalize">{agentLabel}</span> · {dateLabel}
          </p>
        </div>
      </div>

      {file.caption && (
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 pl-0.5">
          {file.caption}
        </p>
      )}
      {file.file_category === "document" && file.processing_status && (
        <p className={cn("text-[10px]", file.processing_status === "failed" ? "text-alert" : file.processing_status === "complete" ? "text-success" : "text-muted-foreground")} title={file.processing_error ?? undefined}>
          {file.processing_status === "complete" ? `Digitized${file.document_type ? ` · ${file.document_type}` : ""}` : file.processing_status === "processing" ? "Classifying / digitizing…" : file.processing_status === "pending" ? "Queued for processing" : file.processing_status === "duplicate" ? "Duplicate document" : file.processing_status === "failed" ? "Processing failed" : ""}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onView(file)}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded border border-border text-[11px] hover:bg-secondary transition-colors"
        >
          <Eye className="size-3" /> View
        </button>
        {file.source_url && (
          <a
            href={file.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="size-6 rounded border border-border grid place-items-center hover:bg-secondary transition-colors"
            title="Open source"
          >
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>
        )}
      </div>
    </div>
  );
};

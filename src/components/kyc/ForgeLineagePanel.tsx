import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeTraceRow } from "@/types/forgeTypes";

export const ForgeLineagePanel = ({ trace }: { trace: ForgeTraceRow }) => {
  const entries = trace.lineage ?? [];
  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Forge Lineage</p>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className={cn(
          "flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
          trace.id_flag ? "text-success border-success/40 bg-success-soft/30" : "text-muted-foreground border-border bg-muted/30"
        )}>
          {trace.id_flag ? <CheckCircle2 className="size-3" /> : <X className="size-3" />}
          ID {trace.id_flag ? "Complete" : "Pending"}
          {trace.id_source && <span className="font-normal text-muted-foreground ml-1">· {trace.id_source}</span>}
        </span>
        <span className={cn(
          "flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
          trace.verification_flag ? "text-success border-success/40 bg-success-soft/30" : "text-muted-foreground border-border bg-muted/30"
        )}>
          {trace.verification_flag ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
          V {trace.verification_flag ? "Complete" : "Pending"}
        </span>
        {trace.exception_flag && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-warning border-warning/40 bg-warning-soft/30">
            <AlertTriangle className="size-3" />{trace.exception_type ?? "Exception"}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No lineage entries recorded.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <div key={i} className="rounded-md border border-border bg-secondary/30 px-3 py-2">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[11px] font-semibold text-foreground leading-snug break-all">
                  {typeof e.value === 'boolean' ? (e.value ? 'Yes' : 'No') : String(e.value ?? '—')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", e.confidence_score >= 0.9 ? "bg-success" : e.confidence_score >= 0.7 ? "bg-warning" : "bg-alert")}
                        style={{ width: `${Math.round(e.confidence_score * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{Math.round(e.confidence_score * 100)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {e.source && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-muted-foreground font-medium">{e.source}</span>
                )}
                <span className="text-[9px] text-muted-foreground">{new Date(e.timestamp).toLocaleDateString()}</span>
                {e.context && <span className="text-[10px] text-muted-foreground italic truncate max-w-[160px]">{e.context}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

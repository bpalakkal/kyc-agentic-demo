import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeAttrRow } from "@/types/forgeTypes";
import { WGQ_GROUPS } from "@/types/forgeTypes";

export const WgqTabContent = ({
  forgeAttrs,
  openCats,
  setOpenCats,
}: {
  forgeAttrs: Record<string, ForgeAttrRow>;
  openCats: Record<string, boolean>;
  setOpenCats: Dispatch<SetStateAction<Record<string, boolean>>>;
}) => {
  const wgqAttrs = Object.values(forgeAttrs).filter(a => a.attribute_group === 'wgq');
  if (wgqAttrs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No WGQ data in current snapshot.</p>;
  }
  return (
    <div className="space-y-3">
      {WGQ_GROUPS.map(({ label: groupLabel, prefix }) => {
        const items = wgqAttrs.filter(a => prefix.some(p => a.attribute_name.startsWith(p)));
        if (items.length === 0) return null;
        const catKey = `wgq::${groupLabel}`;
        const open = catKey in openCats ? openCats[catKey] : true;
        const excCount = items.filter(a => a.exception_flag).length;
        return (
          <div key={groupLabel} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setOpenCats(prev => ({ ...prev, [catKey]: !open }))}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/60 hover:bg-secondary/80 transition-colors text-left border-b border-border"
            >
              <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !open && "-rotate-90")} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-foreground flex-1">{groupLabel}</span>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
              {excCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-semibold">{excCount}</span>
              )}
            </button>
            {open && (
              <div className="divide-y divide-border/60">
                {items.map(attr => (
                  <div key={attr.attribute_name} className={cn(
                    "flex items-center justify-between px-4 py-2",
                    attr.exception_flag && "bg-warning-soft/10"
                  )}>
                    <span className="text-[11px] text-foreground flex-1 min-w-0 pr-3 truncate">
                      {attr.attribute_name.replace(/^wgq_/, '').replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {attr.display_value ? (
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded border",
                          attr.display_value === 'Yes' ? "text-success border-success/40 bg-success-soft/30"
                            : attr.display_value === 'No' ? "text-muted-foreground border-border bg-muted/30"
                            : "text-foreground border-border bg-muted/30"
                        )}>
                          {attr.display_value}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">—</span>
                      )}
                      {attr.exception_flag && (
                        <AlertTriangle className="size-3.5 text-warning" title={attr.exception_type ?? undefined} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

import { useState } from "react";
import { UserCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgePersonRow } from "@/types/forgeTypes";

export const ForgePersonCard = ({ person, role }: { person: ForgePersonRow; role: string }) => {
  const [expanded, setExpanded] = useState(false);
  const subAttrs = Object.entries(person.attributes).filter(([k]) => k !== `${role}_full_name`);
  const excCount = subAttrs.filter(([, v]) => (v as { exception_flag?: boolean }).exception_flag).length;

  return (
    <div className="px-4 py-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 text-left"
      >
        <UserCircle2 className="size-4 text-muted-foreground shrink-0" />
        <span className="text-[13px] font-semibold flex-1 truncate">{person.full_name ?? "—"}</span>
        {person.ownership_pct != null && (
          <span className="text-[10px] text-muted-foreground font-medium">{person.ownership_pct}%</span>
        )}
        {person.nationality && (
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-muted-foreground">{person.nationality}</span>
        )}
        {excCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-alert-soft text-alert border border-alert-soft-border font-semibold">{excCount}</span>
        )}
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", !expanded && "-rotate-90")} />
      </button>
      {expanded && subAttrs.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {subAttrs.map(([key, attr]) => {
            const a = attr as { display_value?: string; id_flag?: boolean; verification_flag?: boolean; exception_flag?: boolean };
            const shortKey = key.replace(`${role}_`, '').replace(/_/g, ' ');
            return (
              <div key={key} className={cn(
                "rounded border px-2.5 py-1.5",
                a.exception_flag ? "border-warning/40 bg-warning-soft/20" : "border-border bg-secondary/30"
              )}>
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">{shortKey}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold truncate">{a.display_value || "—"}</span>
                  <span className="text-[9px] whitespace-nowrap shrink-0">
                    {a.id_flag ? <span className="text-success font-bold">ID✓</span> : <span className="text-muted-foreground/50">ID–</span>}
                    <span className="text-muted-foreground/30 mx-0.5">/</span>
                    {a.verification_flag ? <span className="text-success font-bold">V✓</span> : <span className="text-muted-foreground/50">V–</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

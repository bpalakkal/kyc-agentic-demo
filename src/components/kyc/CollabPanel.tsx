import { useState, useEffect, useRef } from "react";
import { Bot, Paperclip, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type CaseComment, type Activity, type Watcher,
  kindTone, COMMENTS_BY_KYC, WATCHERS_BY_KYC, ACTIVITY_BY_KYC,
} from "@/data/kycMockData";

type CollabSubTab = "comments" | "watchers" | "activity";

export const CollabPanel = ({ entity, kyc }: { entity: string; kyc: string }) => {
  const [sub, setSub] = useState<CollabSubTab>("comments");
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [localComments, setLocalComments] = useState<CaseComment[]>(
    () => COMMENTS_BY_KYC[kyc] ?? [
      { author: "System", initials: "SY", role: "Auto", time: "Today",
        body: `No collaboration activity yet on ${entity}. Be the first to leave a note.`, kind: "comment" as const },
    ]
  );
  const [localActivity, setLocalActivity] = useState<Activity[]>(
    () => ACTIVITY_BY_KYC[kyc] ?? []
  );

  useEffect(() => {
    setLocalComments(COMMENTS_BY_KYC[kyc] ?? [
      { author: "System", initials: "SY", role: "Auto", time: "Today",
        body: `No collaboration activity yet on ${entity}. Be the first to leave a note.`, kind: "comment" as const },
    ]);
    setLocalActivity(ACTIVITY_BY_KYC[kyc] ?? []);
    setDraft("");
  }, [kyc, entity]);

  const watchers: Watcher[] = WATCHERS_BY_KYC[kyc] ?? [];

  const subTabs: { id: CollabSubTab; label: string; count: number }[] = [
    { id: "comments", label: "Comments", count: localComments.length },
    { id: "watchers", label: "Watchers", count: watchers.length },
    { id: "activity", label: "Activity", count: localActivity.length },
  ];

  const handlePost = () => {
    const text = draft.trim();
    if (!text) return;
    const newComment: CaseComment = {
      author: "You", initials: "YO", role: "Reviewer · L1", time: "Just now", body: text, kind: "comment",
    };
    setLocalComments((prev) => [newComment, ...prev]);
    setLocalActivity((prev) => [{ time: "Just now", text: "You posted a comment" }, ...prev]);
    setDraft("");
  };

  const handleReply = (author: string) => {
    setDraft(`@${author} `);
    setSub("comments");
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = (`@${author} `).length;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  };

  return (
    <section>
      <header className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground truncate">
          <span className="font-medium text-foreground/80">{kyc}</span> · {entity}
        </p>
      </header>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-secondary/60 border border-border">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={cn(
              "flex-1 text-[11px] py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5",
              sub === t.id ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span className={cn(
              "text-[9px] px-1 py-px rounded",
              sub === t.id ? "bg-secondary text-foreground" : "bg-card/60 text-muted-foreground"
            )}>{t.count}</span>
          </button>
        ))}
      </div>

      {sub === "comments" && (
        <>
          <ul className="space-y-3 max-h-[360px] overflow-y-auto pr-1 -mr-1">
            {localComments.map((c, i) => (
              <li key={i} className={cn("flex items-start gap-2.5", i === 0 && c.time === "Just now" && "animate-fade-in")}>
                <span className={cn("size-7 rounded-full grid place-items-center shrink-0 text-[10px] font-semibold", kindTone[c.kind])}>
                  {c.kind === "ai" ? <Bot className="size-3.5" /> : c.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-medium leading-tight">{c.author}</span>
                    <span className="text-[10px] text-muted-foreground">{c.role}</span>
                    {i === 0 && c.time === "Just now" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success-soft text-success border border-success-soft-border">Posted</span>
                    )}
                  </div>
                  <p className="text-[12px] text-foreground/90 mt-0.5 leading-snug">{c.body}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] text-muted-foreground">{c.time}</p>
                    {c.kind !== "ai" && (
                      <button onClick={() => handleReply(c.author)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Reply</button>
                    )}
                    <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Resolve</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-lg border border-border p-2 focus-within:ring-2 focus-within:ring-ring/30 transition-shadow">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost(); }}
              rows={2}
              placeholder="Write a comment… use @ to mention a teammate"
              className="w-full bg-transparent text-[12px] outline-none resize-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <button className="hover:text-foreground" title="Attach"><Paperclip className="size-3.5" /></button>
                <button className="text-[11px] hover:text-foreground" title="Mention" onClick={() => setDraft((d) => d + "@")}>@</button>
                <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">⌘↵ to post</span>
              </div>
              <button
                onClick={handlePost}
                className="text-[11px] px-3 py-1 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-95 disabled:opacity-40 transition-opacity"
                disabled={!draft.trim()}
              >
                Post
              </button>
            </div>
          </div>
        </>
      )}

      {sub === "watchers" && (
        <>
          <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1 -mr-1">
            {watchers.map((w, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-lg border border-border p-2">
                <span className="size-7 rounded-full grid place-items-center bg-info-soft text-primary text-[10px] font-semibold shrink-0">{w.initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-tight truncate">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">{w.role}</p>
                </div>
                <button className="text-[10px] text-muted-foreground hover:text-foreground">Remove</button>
              </li>
            ))}
          </ul>
          <button className="mt-3 w-full text-[12px] py-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors flex items-center justify-center gap-1.5">
            <Plus className="size-3.5" /> Add watcher
          </button>
        </>
      )}

      {sub === "activity" && (
        <ul className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 -mr-1">
          {localActivity.length === 0 && (
            <li className="text-[12px] text-muted-foreground italic text-center py-4">No activity yet for this case.</li>
          )}
          {localActivity.map((a, i) => (
            <li key={i} className={cn("flex items-start gap-2.5", i === 0 && a.time === "Just now" && "animate-fade-in")}>
              <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", i === 0 && a.time === "Just now" ? "bg-success" : "bg-primary/60")} />
              <div className="min-w-0">
                <p className="text-[12px] leading-snug">{a.text}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

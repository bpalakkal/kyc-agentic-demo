import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { Bell, BotMessageSquare, Bot, Send, X, Sparkles, Sun, Moon, LogOut, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { AgentProvider, AgentRecommendationStrip, useAgents, AGENT_API_BASE } from "@/components/AgentSystem";
import { apiFetch } from "@/lib/apiFetch";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const tabs = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/work-queue", label: "Work Queue" },
  { to: "/reports", label: "Reports" },
  { to: "/agents", label: "Agents" },
] as { to: string; label: string; end?: boolean; disabled?: boolean }[];

// ─── AI Chat Floating ─────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; text: string; time: string };

const CHAT_SUGGESTIONS = [
  "Which cases need my attention?",
  "What's overdue?",
  "Tell me about this entity",
  "Show ownership graph",
];

const TOOL_LABELS: Record<string, string> = {
  get_entity:      "Looking up entity…",
  list_entities:   "Scanning work queue…",
  get_exceptions:  "Fetching exceptions…",
  search_entities: "Searching entities…",
  query_graph:     "Querying ownership graph…",
};

const renderMd = (text: string) =>
  text.split("\n").map((line, li) => {
    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    const content  = isBullet ? line.slice(2) : line;
    const parts    = content.split(/\*\*(.*?)\*\*/g);
    const nodes    = parts.map((p, pi) =>
      pi % 2 === 1 ? <strong key={pi} className="font-semibold">{p}</strong> : p
    );
    if (isBullet) {
      return (
        <p key={li} className="flex gap-1.5 items-start leading-snug text-[13px] mt-1">
          <span className="shrink-0 mt-[5px] size-1 rounded-full bg-current opacity-40" />
          <span>{nodes}</span>
        </p>
      );
    }
    return (
      <p key={li} className={cn("leading-snug text-[13px]", li > 0 && line === "" ? "mt-2" : li > 0 ? "mt-1" : "")}>
        {nodes}
      </p>
    );
  });

const AiChatFloating = () => {
  const { dockOpen, dockMinimized, entityContext } = useAgents();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    text: "Hi! I'm connected to your live KYC database and ownership graph. Ask me about any entity, exception, or your work queue.",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSend = async (text: string) => {
    const q = text.trim();
    if (!q || isTyping) return;

    const userMsg: ChatMessage = { role: "user", text: q, time: now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInputValue("");
    setIsTyping(true);
    setToolLabel("Thinking…");

    // Placeholder for streaming assistant reply
    const placeholder: ChatMessage = { role: "assistant", text: "", time: now() };
    setMessages([...history, placeholder]);

    abortRef.current = new AbortController();

    try {
      const res = await apiFetch(`${AGENT_API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, text: m.text })),
          entityContext,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const evt = JSON.parse(line.slice(6)) as { type: string; content?: string; name?: string; message?: string };

          if (evt.type === "text") {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, text: last.text + (evt.content ?? "") };
              return next;
            });
            setToolLabel(null);
          } else if (evt.type === "tool_call") {
            setToolLabel(TOOL_LABELS[evt.name ?? ""] ?? `Querying ${evt.name}…`);
          } else if (evt.type === "error") {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], text: `⚠ ${evt.message}` };
              return next;
            });
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], text: `⚠ Could not reach AI assistant. Is the server running?` };
          return next;
        });
      }
    } finally {
      setIsTyping(false);
      setToolLabel(null);
      abortRef.current = null;
    }
  };

  // Shift left when the agent dock is open so the two panels don't overlap.
  // Dock width: 420px normal, 300px minimised. Both sit at right: 16px (bottom-4).
  const rightPx = dockOpen ? (dockMinimized ? 316 : 436) : 16;

  return (
    <div
      className="fixed z-50 bottom-6"
      style={{ right: rightPx, transition: "right 200ms ease" }}
    >
      {open ? (
        <div
          className="w-[440px] rounded-2xl border border-border bg-card shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
          style={{ maxHeight: 560 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold leading-tight">KYC Assistant</p>
                <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Powered by Claude · Real-time data</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Close AI Assistant"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start items-start")}>
                {m.role === "assistant" && (
                  <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                    <Bot className="size-3.5" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/70 text-foreground rounded-tl-sm"
                )}>
                  <div>{renderMd(m.text)}</div>
                  <p className={cn("text-[10px] mt-1.5 leading-none", m.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground")}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing / tool indicator */}
            {isTyping && messages[messages.length - 1]?.text === "" && (
              <div className="flex gap-2.5 items-start">
                <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                  <Bot className="size-3.5" />
                </div>
                <div className="bg-muted/70 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  {toolLabel ? (
                    <div className="flex items-center gap-2">
                      <span className="flex gap-0.5">
                        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:100ms]" />
                        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:200ms]" />
                      </span>
                      <span className="text-[11px] text-muted-foreground">{toolLabel}</span>
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center h-4">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips — wrapping grid */}
          <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 shrink-0">
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-[11px] px-3 py-1 rounded-full border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] transition-all">
              <input
                className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground outline-none"
                placeholder={entityContext?.name ? `Ask about ${entityContext.name}…` : "Ask anything about your queue…"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(inputValue); }
                }}
                autoFocus
              />
              <button
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || isTyping}
                className={cn(
                  "size-7 rounded-full grid place-items-center transition-all shrink-0",
                  inputValue.trim() && !isTyping
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                )}
              >
                <Send className="size-3" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="size-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          aria-label="Open AI Assistant"
        >
          <BotMessageSquare className="size-6" />
        </button>
      )}
    </div>
  );
};

// ─── AppLayout ────────────────────────────────────────────────────────────────

const AppLayout = () => {
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const fullName: string = user?.user_metadata?.full_name ?? "";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("") || (user?.email?.[0]?.toUpperCase() ?? "?");

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setNameSaving(true);
    await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } });
    setNameSaving(false);
    setNameDialogOpen(false);
  }

  return (
    <AgentProvider>
      <div className="h-full bg-background flex flex-col min-w-0 overflow-x-hidden">
        <header className="bg-nav text-nav-foreground">
          <div className="px-6 h-14 flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-[3px] h-[22px] rounded-full bg-gradient-to-b from-blue-500 to-indigo-500 shrink-0" />
              <div>
                <div className="text-[17px] font-bold text-nav-foreground tracking-tight leading-tight">KYC Sentinel</div>
              </div>
            </Link>

            <nav className="flex-1 flex items-center justify-center gap-8">
              {tabs.map((t) =>
                t.disabled ? (
                  <span
                    key={t.to}
                    title="Coming soon"
                    className="relative text-[14px] py-[18px] text-nav-muted/50 cursor-not-allowed flex items-center gap-1.5"
                  >
                    {t.label}
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 uppercase tracking-wide leading-none">Soon</span>
                  </span>
                ) : (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    end={t.end}
                    className={({ isActive }) =>
                      cn(
                        "relative text-[14px] py-[18px] transition-colors",
                        isActive
                          ? "text-nav-foreground after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-nav-foreground"
                          : "text-nav-muted hover:text-nav-foreground"
                      )
                    }
                  >
                    {t.label}
                  </NavLink>
                )
              )}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="text-nav-muted hover:text-nav-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </button>
              <button className="text-nav-muted hover:text-nav-foreground transition-colors" aria-label="Notifications">
                <Bell className="size-[18px]" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-full" aria-label="Account menu">
                    <Avatar className="size-8 border border-white/15 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      {fullName && <span className="text-[13px] font-medium">{fullName}</span>}
                      <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setNameInput(fullName); setNameDialogOpen(true); }}
                    className="cursor-pointer gap-2"
                  >
                    <Pencil className="size-3.5" />
                    Edit name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive cursor-pointer gap-2"
                  >
                    <LogOut className="size-3.5" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
                <DialogContent className="sm:max-w-xs">
                  <DialogHeader>
                    <DialogTitle>Edit display name</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={saveName} className="space-y-4 pt-1">
                    <Input
                      placeholder="Jane Smith"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      autoFocus
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setNameDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={nameSaving || !nameInput.trim()}>
                        {nameSaving ? "Saving…" : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <AgentRecommendationStrip route={location.pathname} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <ErrorBoundary label="main-outlet">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <AiChatFloating />
    </AgentProvider>
  );
};

export default AppLayout;

import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, User, MessageCircle, Bot, Send, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentProvider, AgentRecommendationStrip, useAgents, AGENT_API_BASE } from "@/components/AgentSystem";
import kpmgLogo from "@/assets/kpmg-logo-white.svg";

const tabs = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/work-queue", label: "Work Queue" },
  { to: "/reports", label: "Reports", disabled: true },
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
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={li} className={cn("leading-snug text-[12px]", li > 0 && line === "" ? "mt-1" : li > 0 ? "mt-0.5" : "")}>
        {parts.map((p, pi) =>
          pi % 2 === 1 ? <strong key={pi} className="font-semibold">{p}</strong> : p
        )}
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
      const res = await fetch(`${AGENT_API_BASE}/api/chat`, {
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
      className="fixed z-50 bottom-4"
      style={{ right: rightPx, transition: "right 200ms ease" }}
    >
      {open ? (
        <div
          className="w-[380px] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-fade-in"
          style={{ maxHeight: 520 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-info-soft/60 to-card shrink-0">
            <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="size-3.5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-tight">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground">KYC Agent Orchestrator</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-success font-medium mr-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse" /> Live
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Close AI Assistant"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                    <Bot className="size-3" />
                  </span>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-secondary text-foreground rounded-bl-none"
                )}>
                  <div className="space-y-0.5">{renderMd(m.text)}</div>
                  <p className={cn("text-[10px] mt-1", m.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && messages[messages.length - 1]?.text === "" && (
              <div className="flex gap-2 justify-start">
                <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                  <Bot className="size-3" />
                </span>
                <div className="bg-secondary rounded-xl rounded-bl-none px-3 py-2.5 flex items-center gap-1.5">
                  {toolLabel ? (
                    <span className="text-[11px] text-muted-foreground italic">{toolLabel}</span>
                  ) : (
                    <>
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-primary/30 bg-info-soft text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <input
                className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground outline-none"
                placeholder="Ask the AI about your queue…"
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
                  "size-7 rounded-md grid place-items-center transition-colors",
                  inputValue.trim() && !isTyping
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="size-3.5" />
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
          <MessageCircle className="size-6" />
        </button>
      )}
    </div>
  );
};

// ─── AppLayout ────────────────────────────────────────────────────────────────

const AppLayout = () => {
  const location = useLocation();
  return (
    <AgentProvider>
      <div className="h-full bg-background flex flex-col min-w-0 overflow-x-hidden">
        <header className="bg-nav text-nav-foreground">
          <div className="px-6 h-14 flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img src={kpmgLogo} alt="KPMG" className="h-5 w-auto" />
              <span className="font-semibold text-[15px]">KYC Platform</span>
            </div>

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
              <button className="text-nav-muted hover:text-nav-foreground transition-colors" aria-label="Notifications">
                <Bell className="size-[18px]" />
              </button>
              <button className="size-8 rounded-full border border-white/15 flex items-center justify-center text-nav-muted hover:text-nav-foreground transition-colors" aria-label="Account">
                <User className="size-[16px]" />
              </button>
            </div>
          </div>
        </header>

        <AgentRecommendationStrip route={location.pathname} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <Outlet />
        </main>
      </div>

      <AiChatFloating />
    </AgentProvider>
  );
};

export default AppLayout;

/**
 * DatastoreDocuments — documents and screenshots associated with the entity.
 *
 * Lists GET /api/entity/:kycRef/artifacts and renders the PDFs / screenshots.
 * Files are fetched through the auth-guarded backend proxy
 * (GET /api/entity/:kycRef/artifact?file=…) as a blob → object URL, so they
 * render inline without copying anything into Supabase and without mixed-content
 * issues and keep private storage access on the authenticated backend.
 */
import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Inbox, Eye } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { AGENT_API_BASE } from "@/components/AgentSystem";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Artifact = {
  fileName: string;
  fileType: string | null;
  category: string;
  description: string | null;
  runId: string | null;
  createdAt: string | null;
  url: string;
};

export function DatastoreDocuments({ kycRef }: { kycRef: string }) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<{ a: Artifact; blobUrl: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    if (!kycRef) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`${AGENT_API_BASE}/api/entity/${encodeURIComponent(kycRef)}/artifacts`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files?: Artifact[] }) => {
        if (!cancelled) setItems((d.files ?? []).filter((f) => f.category === "document" || f.category === "screenshot"));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kycRef]);

  const open = async (a: Artifact) => {
    setOpening(a.fileName);
    try {
      const r = await apiFetch(`${AGENT_API_BASE}${a.url}`);
      if (!r.ok) return;
      const blob = await r.blob();
      setViewing({ a, blobUrl: URL.createObjectURL(blob) });
    } catch { /* ignore */ } finally { setOpening(null); }
  };
  const close = () => { if (viewing) URL.revokeObjectURL(viewing.blobUrl); setViewing(null); };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> <span className="text-sm">Loading documents…</span>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground py-10 text-center px-4">
        <Inbox className="size-6 opacity-40" />
        <p className="text-[12px]">No documents or screenshots yet.</p>
        <p className="text-[10px] text-muted-foreground/70">Agent-produced PDFs and screenshots will appear here.</p>
      </div>
    );
  }

  const docs = items.filter((i) => i.category === "document");
  const shots = items.filter((i) => i.category === "screenshot");

  const Card = ({ a, icon: Icon }: { a: Artifact; icon: typeof FileText }) => (
    <button
      onClick={() => open(a)}
      className="w-full text-left flex items-start gap-2.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-2.5"
    >
      <span className="size-8 rounded-md bg-secondary grid place-items-center shrink-0 text-muted-foreground">
        {opening === a.fileName ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-foreground truncate">{a.fileName}</span>
        {a.description && <span className="block text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{a.description}</span>}
      </span>
      <Eye className="size-3.5 text-muted-foreground shrink-0 mt-1" />
    </button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3 overflow-y-auto">
      {docs.length > 0 && <Section title={`Documents (${docs.length})`}>{docs.map((a) => <Card key={a.fileName} a={a} icon={FileText} />)}</Section>}
      {shots.length > 0 && <Section title={`Screenshots (${shots.length})`}>{shots.map((a) => <Card key={a.fileName} a={a} icon={ImageIcon} />)}</Section>}

      {viewing && (
        <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
            <DialogHeader className="px-4 py-2.5 border-b border-border">
              <DialogTitle className="text-[13px] truncate">{viewing.a.fileName}</DialogTitle>
            </DialogHeader>
            <div className={cn("bg-secondary/20 overflow-auto")} style={{ height: "76vh" }}>
              {viewing.a.category === "screenshot" ? (
                <img src={viewing.blobUrl} alt={viewing.a.fileName} className="max-w-full mx-auto" />
              ) : (
                <iframe src={viewing.blobUrl} title={viewing.a.fileName} className="w-full h-full border-0" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

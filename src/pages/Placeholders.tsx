const Placeholder = ({ title, blurb }: { title: string; blurb: string }) => (
  <div className="px-6 py-12 max-w-3xl">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    <p className="text-sm text-muted-foreground mt-2">{blurb}</p>
    <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 h-64 grid place-items-center text-sm text-muted-foreground">
      Coming soon
    </div>
  </div>
);

export const Reports = () => <Placeholder title="Reports" blurb="Compliance reporting and exports across DRGs, entities, and exceptions." />;
export const EvidenceLocker = () => <Placeholder title="Evidence Locker" blurb="Source documents, regulatory filings, and audit-grade evidence for every case." />;

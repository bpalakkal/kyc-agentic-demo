/**
 * Agent Inventory — live view of the agent registry.
 * Reads from GET /api/agents.
 */
import { useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { isAgentAvailable, useAgentRegistry } from "@/hooks/useAgentRegistry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type PageSize = 10 | 20 | 50 | "all";
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50, "all"];

export default function Agents() {
  const { data: agents = [], isLoading, isError, error, refetch, isFetching } = useAgentRegistry();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(agents.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = pageSize === "all"
    ? agents
    : agents.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function changePageSize(val: PageSize) {
    setPageSize(val);
    setPage(0);
  }

  const start = pageSize === "all" ? 1 : safePage * pageSize + 1;
  const end   = pageSize === "all" ? agents.length : Math.min((safePage + 1) * pageSize, agents.length);
  const readyCount = agents.filter(isAgentAvailable).length;

  return (
    <div className="page-shell space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Agentic workforce</p>
          <h1 className="page-title">Agent Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Live registry · {agents.length} agent{agents.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Registered</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length}</p></div>
        <div className="rounded-2xl border border-success/20 bg-success-soft p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-success">Ready</p><p className="mt-1 text-2xl font-bold tabular-nums text-success">{readyCount}</p></div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Readiness</p><p className="mt-1 text-2xl font-bold tabular-nums">{agents.length ? Math.round((readyCount / agents.length) * 100) : 0}%</p></div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading registry…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load agents: {(error as Error)?.message}
        </p>
      )}
      {!isLoading && !isError && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>CIP Classification</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a) => {
                  const cipValue = a.cip_classification && a.cip_classification !== "all"
                    ? a.cip_classification
                    : null;
                  return (
                    <TableRow key={a.slug}>
                      <TableCell className="font-medium">
                        {a.display_name}
                        {a.description && (
                          <div className="text-xs font-normal text-muted-foreground">{a.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.slug}</TableCell>
                      <TableCell className="text-sm">{a.category ?? "—"}</TableCell>
                      <TableCell className="text-sm max-w-[180px]">
                        {cipValue
                          ? <span title={cipValue} className="block truncate text-xs">{cipValue}</span>
                          : <span className="text-muted-foreground text-xs">All</span>}
                      </TableCell>
                      <TableCell className="text-sm">{a.jurisdiction ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.runner_type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.output_type ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={isAgentAvailable(a) ? "default" : "secondary"}
                          title={a.readiness_error ?? undefined}
                        >
                          {!a.enabled ? "Disabled" : isAgentAvailable(a) ? "Ready" : "Unavailable"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No agents registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => changePageSize(v === "all" ? "all" : Number(v) as PageSize)}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s === "all" ? "All" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              {agents.length > 0 && (
                <span>
                  {start}–{end} of {agents.length}
                </span>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={pageSize === "all" || safePage === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={pageSize === "all" || safePage >= totalPages - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

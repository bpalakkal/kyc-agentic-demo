/**
 * Agent Inventory — live view of the agent registry.
 * Reads from GET /api/agents.
 */
import { useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAgentRegistry } from "@/hooks/useAgentRegistry";
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agent Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Live registry · {agents.length} agent{agents.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading registry...</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load agents: {(error as Error)?.message}
        </p>
      )}
      {!isLoading && !isError && (
        <>
          <div className="rounded-lg border">
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
                        <Badge variant={a.enabled ? "default" : "secondary"}>
                          {a.enabled ? "Enabled" : "Disabled"}
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
                  {start}--{end} of {agents.length}
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

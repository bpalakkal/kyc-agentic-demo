export type WorkQueueSortKey = "name" | "due" | "risk" | "exc" | "status";
export type WorkQueueSortDir = "asc" | "desc";

export type SortableWorkQueueRow = {
  name: string;
  dueTs: number | null;
  risk: "Minimal" | "Moderate" | "Elevated";
  exc: number;
  status: "Complete" | "In Progress" | "Pending Feedback" | "Not Started";
};

const RISK_ORDER = { Elevated: 3, Moderate: 2, Minimal: 1 } as const;
const STATUS_ORDER = { "Not Started": 1, "In Progress": 2, "Pending Feedback": 3, Complete: 4 } as const;

export function sortWorkQueueRows<T extends SortableWorkQueueRow>(
  rows: T[],
  key: WorkQueueSortKey,
  dir: WorkQueueSortDir,
): T[] {
  const compare = (a: T, b: T) => {
    if (key === "due") {
      if (a.dueTs === b.dueTs) return 0;
      if (a.dueTs === null) return 1;
      if (b.dueTs === null) return -1;
      return a.dueTs - b.dueTs;
    }
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "risk") return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
    if (key === "exc") return a.exc - b.exc;
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  };
  const sortable = rows.filter((row) => key !== "due" || row.dueTs !== null).sort(compare);
  if (dir === "desc") sortable.reverse();
  return key === "due" ? [...sortable, ...rows.filter((row) => row.dueTs === null)] : sortable;
}

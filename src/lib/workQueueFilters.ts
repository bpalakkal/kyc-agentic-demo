export type WorkQueueFilters = {
  priority: "all" | "High" | "Medium" | "Low";
  risk: "all" | "Minimal" | "Moderate" | "Elevated";
  status: "all" | "Complete" | "In Progress" | "Pending Feedback" | "Not Started";
  jurisdiction: string;
};

export type WorkQueueFilterableRow = {
  name: string;
  kyc?: string;
  drg?: string;
  customerType: string;
  jurisdiction: string;
  priority: "High" | "Medium" | "Low";
  risk: "Minimal" | "Moderate" | "Elevated";
  status: "Complete" | "In Progress" | "Pending Feedback" | "Not Started";
  action: string;
};

export const EMPTY_WORK_QUEUE_FILTERS: WorkQueueFilters = {
  priority: "all", risk: "all", status: "all", jurisdiction: "all",
};

export function filterWorkQueueRows<T extends WorkQueueFilterableRow>(rows: T[], query: string, filters: WorkQueueFilters): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.risk !== "all" && row.risk !== filters.risk) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.jurisdiction !== "all" && row.jurisdiction !== filters.jurisdiction) return false;
    if (!needle) return true;
    return [row.name, row.kyc, row.drg, row.customerType, row.jurisdiction, row.priority, row.risk, row.status, row.action]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(needle));
  });
}

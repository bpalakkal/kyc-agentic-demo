import { describe, expect, it } from "vitest";
import { sortWorkQueueRows } from "@/lib/workQueueSort";

const row = (name: string, dueTs: number | null, risk: "Minimal" | "Moderate" | "Elevated" = "Minimal") => ({
  id: name,
  name,
  due: dueTs === null ? "—" : new Date(dueTs).toISOString(),
  dueTs,
  customerType: "RIA",
  jurisdiction: "United States",
  priority: "Low" as const,
  risk,
  exc: 0,
  status: "Not Started" as const,
  action: "Periodic Refresh",
});

describe("work queue sorting", () => {
  it("keeps undated cases last in both due-date directions", () => {
    const rows = [row("Undated", null), row("Later", 200), row("Earlier", 100)];
    expect(sortWorkQueueRows(rows, "due", "asc").map((item) => item.name)).toEqual(["Earlier", "Later", "Undated"]);
    expect(sortWorkQueueRows(rows, "due", "desc").map((item) => item.name)).toEqual(["Later", "Earlier", "Undated"]);
  });

  it("uses the defined risk ordinal", () => {
    const rows = [row("Medium", 1, "Moderate"), row("High", 1, "Elevated"), row("Low", 1, "Minimal")];
    expect(sortWorkQueueRows(rows, "risk", "asc").map((item) => item.name)).toEqual(["Low", "Medium", "High"]);
  });
});

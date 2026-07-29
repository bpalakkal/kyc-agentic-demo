import { describe, expect, it } from "vitest";
import { calculateCaseProgress } from "@/lib/caseProgress";

describe("case effort progress", () => {
  it("counts collection, identification, and verification as separate actions", () => {
    const progress = calculateCaseProgress([
      {
        attribute_name: "entity_name",
        attribute_group: "core",
        display_value: "Acme Advisors",
        confidence: 99,
        id_flag: true,
        id_source: "SEC",
        verification_flag: true,
        verification_source: ["SEC"],
        exception_flag: false,
        exception_type: null,
      },
    ], {});

    expect(progress.total).toBeGreaterThan(progress.collection.total);
    expect(progress.completed).toBeGreaterThanOrEqual(3);
    expect(progress.percent).toBeGreaterThan(0);
    expect(progress.percent).toBeLessThan(100);
  });
});

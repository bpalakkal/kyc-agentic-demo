import { describe, expect, it } from "vitest";
import { trackedAgentRuns } from "../../agents/dashboardTracking.js";

describe("dashboard agent tracking", () => {
  it("excludes document-flow wrappers and retains document-specific digitizers", () => {
    const registry = [
      { slug: "document-processing-flow", agent_kind: "document_flow" },
      { slug: "digitize-passport", agent_kind: "document_digitizer" },
      { slug: "companies-house", agent_kind: "standard" },
    ];
    const runs = [
      { id: "parent", agent_slug: "document-processing-flow" },
      { id: "passport", agent_slug: "digitize-passport", parent_run_id: "parent" },
      { id: "source", agent_slug: "companies-house" },
    ];

    expect(trackedAgentRuns(runs, registry).map(run => run.id))
      .toEqual(["passport", "source"]);
  });

  it("retains unknown legacy agents rather than hiding audit data", () => {
    expect(trackedAgentRuns([{ id: "legacy", agent_slug: "legacy-agent" }], []))
      .toHaveLength(1);
  });
});

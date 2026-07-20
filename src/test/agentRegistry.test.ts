import { describe, expect, it } from "vitest";
import { filterRunnableAgentSlugs, type RunnableRegistryEntry } from "@/lib/agentRegistry";

const agent = (overrides: Partial<RunnableRegistryEntry> = {}): RunnableRegistryEntry => ({
  slug: "registered", display_name: "Registered", enabled: true,
  runner_registered: true, available: true, user_triggerable: true,
  ...overrides,
});

describe("registry-authoritative agent dispatch", () => {
  it("rejects absent, disabled, unavailable, and dependency-only slugs", () => {
    const registry = [
      agent(),
      agent({ slug: "disabled", enabled: false }),
      agent({ slug: "unavailable", available: false }),
      agent({ slug: "dependency", user_triggerable: false }),
    ];

    expect(filterRunnableAgentSlugs(
      ["registered", "missing", "disabled", "unavailable", "dependency", "registered"],
      registry,
    )).toEqual(["registered"]);
  });
});

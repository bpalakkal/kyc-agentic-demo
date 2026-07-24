import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/db/supabase.js", () => ({
  getAttributes: vi.fn(),
  getEntity: vi.fn(),
}));
import {
  deterministicAssessments,
  normalizeDecision,
} from "../../agents/runners/api/ExceptionRoutingRunner.js";

const attribute = (overrides: Record<string, unknown> = {}) => ({
  attribute_name: "verification_of_existence",
  display_value: "Yes",
  id_flag: true,
  verification_flag: true,
  lineage: [
    { source: "SEC EDGAR", value: true },
    { source: "IAPD", value: "Yes" },
  ],
  ...overrides,
});

describe("exception routing", () => {
  it("does not treat true and Yes as a source conflict", () => {
    const findings = deterministicAssessments([attribute()]);
    expect(findings.some(item =>
      item.attribute === "verification_of_existence"
      && item.assessments.some(assessment => assessment.exception_type === "Source Conflict"),
    )).toBe(false);
  });

  it("detects a material source conflict", () => {
    const findings = deterministicAssessments([attribute({
      lineage: [
        { source: "SEC EDGAR", value: "Yes" },
        { source: "CRM", value: "No" },
      ],
    })]);
    expect(findings.some(item =>
      item.attribute === "verification_of_existence"
      && item.assessments.some(assessment => assessment.exception_type === "Source Conflict"),
    )).toBe(true);
  });

  it("rejects Pending and ignores No decisions", () => {
    expect(normalizeDecision({
      attribute: "entity_name",
      exception_flag: "No",
      exception_assessments: [],
    })).toBeNull();
    expect(normalizeDecision({
      attribute: "entity_name",
      exception_flag: "Pending",
      exception_assessments: [{
        exception_type: "Requires Manual Review",
        exception_reasoning: "Uncertain.",
      }],
    })).toBeNull();
  });

  it("defaults unknown routing values to Analyst", () => {
    expect(normalizeDecision({
      attribute: "entity_name",
      exception_flag: "Yes",
      exception_assessments: [{
        exception_type: "Requires Manual Review",
        exception_reasoning: "Guidance is incomplete.",
      }],
      exception_queue: "Unknown Queue",
    })?.exception_queue).toBe("Analyst");
  });
});

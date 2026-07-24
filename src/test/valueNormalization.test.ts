import { describe, expect, it } from "vitest";
import { normalizeForAttribute } from "../../agents/dd/enumNormalizer.js";
import { comparableAttributeValue } from "@/lib/valueNormalization";
import { lineageConflict } from "@/lib/attrLabel";

describe("boolean attribute normalization", () => {
  it.each([
    [true, "Yes"],
    ["true", "Yes"],
    ["YES", "Yes"],
    [1, "Yes"],
    [false, "No"],
    ["false", "No"],
    ["NO", "No"],
    [0, "No"],
  ])("normalizes %p for boolean schema attributes", (input, expected) => {
    expect(normalizeForAttribute(input, "verification_of_existence")).toMatchObject({
      matched: true,
      value: expected,
      dataType: "boolean",
    });
  });

  it("does not treat true and Yes as a lineage conflict", () => {
    expect(lineageConflict([
      { source: "SEC EDGAR", value: true },
      { source: "IAPD", value: "Yes" },
    ])).toBeNull();
  });

  it("still distinguishes affirmative and negative values", () => {
    expect(comparableAttributeValue("true")).toBe("yes");
    expect(comparableAttributeValue("No")).toBe("no");
    expect(lineageConflict([
      { source: "SEC EDGAR", value: true },
      { source: "IAPD", value: "No" },
    ])).toHaveLength(2);
  });
});

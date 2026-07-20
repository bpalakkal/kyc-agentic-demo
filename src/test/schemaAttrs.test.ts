import { describe, expect, it } from "vitest";
import { attributeChecks, entityLevelCoreAttrs, optionalCoreAttrs, visibleParties } from "@/lib/schemaAttrs";

describe("RIA Attribute View schema contract", () => {
  it("excludes WGQ, legacy, and not-applicable scalar fields", () => {
    const attrs = entityLevelCoreAttrs();
    expect(attrs.some((name) => name.startsWith("wgq_"))).toBe(false);
    expect(attrs).not.toContain("source_of_funds");
    expect(attrs).not.toContain("public_accounting_firm_indicator");
    expect(attrs).not.toContain("entity_classification");
    expect(attrs).toContain("registration_country");
  });

  it("distinguishes ID-only, ID-and-V, and no-check attributes", () => {
    expect(attributeChecks("cip_classification")).toEqual({ id: true, verification: false });
    expect(attributeChecks("entity_name")).toEqual({ id: true, verification: true });
    expect(attributeChecks("unknown_attribute")).toEqual({ id: false, verification: false });
    expect(optionalCoreAttrs()).toContain("website_address");
  });

  it("shows only RIA-applicable party roles and fields", () => {
    const parties = visibleParties();
    expect(parties.map((party) => party.role)).toEqual([
      "authorized_signatory", "beneficial_owner", "Proxy_BO", "corporate_officer",
    ]);
    expect(parties.find((party) => party.role === "authorized_signatory")?.columns)
      .not.toContain("nationality");
    expect(parties.find((party) => party.role === "Proxy_BO")?.columns)
      .toContain("evidence_of_existence");
  });
});

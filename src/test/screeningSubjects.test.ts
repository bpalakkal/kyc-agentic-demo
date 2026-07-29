import { describe, expect, it } from "vitest";
import { buildSubjects, normalizeIdentityValue } from "../../agents/runners/api/ScreeningRunner.js";

const person = (role: string, index: number, name: string | null, dob?: string, address?: string) => ({
  person_index: index,
  full_name: name,
  attributes: {
    ...(dob ? { [`${role}_date_of_birth`]: { display_value: dob } } : {}),
    ...(address ? { [`${role}_address`]: { display_value: address } } : {}),
  },
});

const dbFor = (persons: Record<string, unknown[]>) => ({
  getPersons: async () => persons,
  getEntity: async () => ({ entity_name: "Acme Advisors LLC" }),
  getAttributes: async () => [],
});

describe("screening subject preparation", () => {
  it("normalizes punctuation, accents, casing, and whitespace for identity matching", () => {
    expect(normalizeIdentityValue("  José  O’Neil, Jr. ")).toBe("jose o neil jr");
  });

  it("deduplicates individuals by normalized name and DOB", async () => {
    const result = await buildSubjects("KYC-1", dbFor({
      beneficial_owner: [person("beneficial_owner", 0, "Jane   Doe", "1980-01-02")],
      authorized_signatory: [person("authorized_signatory", 0, "jane doe", "1980/01/02")],
    }));

    expect(result.subjects.filter((subject) => subject.query_schema === "Person")).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].skip_reason).toContain("duplicate");
  });

  it("accepts address as the secondary identifier and skips name-only people", async () => {
    const result = await buildSubjects("KYC-2", dbFor({
      beneficial_owner: [
        person("beneficial_owner", 0, "Address Person", undefined, "1 Main Street, Boston"),
        person("beneficial_owner", 1, "Name Only"),
      ],
    }));

    const screened = result.subjects.find((subject) => subject.party_name === "Address Person");
    expect(screened?.query_properties.address).toEqual(["1 Main Street, Boston"]);
    expect(result.skipped[0].skip_reason).toContain("date of birth or address");
  });
});

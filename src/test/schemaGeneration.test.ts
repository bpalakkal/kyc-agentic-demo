import { describe, expect, it } from "vitest";
import {
  entityFormFields,
  exceptionModel,
  requiredCaseFields,
  schemaCollections,
  schemaVersion,
  screeningSchema,
} from "@schema";

describe("generated UI schema contract", () => {
  it("generates a stable, versioned case creation contract", () => {
    expect(schemaVersion).toMatch(/^[a-f0-9]{16}$/);
    expect(requiredCaseFields).toEqual([
      "entity_name",
      "case_id",
      "entity_id",
      "policy",
      "risk_rating",
    ]);

    const fields = new Map(entityFormFields().map((field) => [field.path, field]));
    expect(fields.get("policy")).toMatchObject({
      control: "select",
      valueEnum: "Country",
      required: true,
    });
    expect(fields.get("risk_rating")).toMatchObject({
      control: "select",
      valueEnum: "CaseRiskRating",
      defaultValue: "medium",
      options: ["high", "medium", "low"],
      required: true,
    });
  });

  it("generates the repeatable regulator UI from the latest master schema", () => {
    const regulator = schemaCollections().find((collection) => collection.name === "regulator");
    expect(regulator).toMatchObject({
      collectionType: "group",
      children: ["regulator", "regulator_registration_number", "regulatory_status"],
    });
    expect(regulator?.fields.map((field) => field.control)).toEqual([
      "select",
      "text",
      "select",
    ]);
    expect(regulator?.fields[2].options).toEqual(["Active", "Inactive", "n/a"]);
  });

  it("generates exception controls and embeds the screening schema", () => {
    expect(exceptionModel).toMatchObject({
      exception_flag: { control: "select", options: ["Yes", "No"] },
      exception_type: { control: "select", valueEnum: "ExceptionType" },
      exception_reasoning: { control: "textarea" },
      exception_recommendation: { control: "textarea" },
    });
    expect(screeningSchema.title).toBeTruthy();
    expect(screeningSchema.schema).toHaveProperty("properties");
  });
});

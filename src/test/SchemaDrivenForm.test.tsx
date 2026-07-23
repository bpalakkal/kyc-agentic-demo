import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchemaDrivenForm } from "@/components/kyc/SchemaDrivenForm";

describe("SchemaDrivenForm", () => {
  it("renders required latest-schema controls and repeatable regulator records", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SchemaDrivenForm collectionTypes={["group"]} onChange={onChange} />,
    );

    expect(container.querySelector("form")?.getAttribute("data-schema-version")).toMatch(/^[a-f0-9]{16}$/);
    expect(screen.getByLabelText(/Policy/)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/^Risk Rating/)).toHaveValue("medium");

    fireEvent.click(screen.getByRole("button", { name: /Add Regulator/i }));
    expect(screen.getByLabelText(/^Regulator(?:\s*\*)?$/)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/^Regulatory Status/)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/^Regulator Registration Number/)).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole("button", { name: "Remove" })).toBeVisible();
  });
});

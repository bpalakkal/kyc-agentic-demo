// Helpers for attribute labels and source conflicts in the Attributes tab.
import { comparableAttributeValue } from "@/lib/valueNormalization";

// Canonical key for de-duplicating attribute labels that arrive in different
// formats from different sources — e.g. the schema key `entity_name`, the live
// DB key `entity_name`, and a humanized exception field name `entity name` all
// collapse to the same key so only one row is shown.
export const canonicalAttrKey = (label: string): string =>
  label.toLowerCase().replace(/[\s_-]+/g, "");

// Known acronyms kept upper-cased when prettifying snake_case keys.
const ACRONYMS = new Set([
  "lei", "psc", "ubo", "giin", "aum", "id", "us", "uk", "mlro",
  "cip", "kyc", "pep", "sec", "fca", "url", "tax", "aml",
]);

// Render a raw attribute key as a human label: snake_case → Title Case with
// known acronyms upper-cased. Labels that are already humanized (contain a
// space, e.g. curated profile labels) pass through unchanged.
export const prettifyAttrLabel = (label: string): string => {
  if (!label.includes("_")) return label;
  return label
    .split("_")
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
};

export type SourceValue = { source: string; value: string };

// Inspect an attribute's lineage and return the per-source values when sources
// disagree, or null when they agree / there is only one source. The first
// lineage entry is the primary value (first-in-JSON) shown in the field.
export const lineageConflict = (
  lineage?: { value: unknown; source?: string }[] | null,
): SourceValue[] | null => {
  if (!lineage || lineage.length < 2) return null;
  const bySource = new Map<string, string>();
  for (const e of lineage) {
    if (!e.source) continue;
    if (!bySource.has(e.source)) bySource.set(e.source, String(e.value ?? "").trim());
  }
  const distinct = new Set(
    Array.from(bySource.values()).map(comparableAttributeValue).filter(Boolean),
  );
  if (distinct.size <= 1) return null;
  return Array.from(bySource.entries()).map(([source, value]) => ({ source, value }));
};

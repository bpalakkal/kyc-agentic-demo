const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

/** Normalize values for comparison without changing their displayed source value. */
export const comparableAttributeValue = (value: unknown): string => {
  if (value === true) return "yes";
  if (value === false) return "no";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return "yes";
  if (FALSE_VALUES.has(normalized)) return "no";
  return normalized;
};

import type { ForgeAttrRow, ForgePersonRow } from "@/types/forgeTypes";
import { attributeChecks, entityLevelCoreAttrs, optionalCoreAttrs, visibleParties } from "@/lib/schemaAttrs";

export type CaseProgress = {
  completed: number;
  total: number;
  percent: number;
  collection: { completed: number; total: number };
  identification: { completed: number; total: number };
  verification: { completed: number; total: number };
};

const meaningful = (value: unknown) => {
  const text = String(value ?? "").trim();
  return Boolean(text) && !/^(n\/?a|none|null|unknown|not available|-)$/i.test(text);
};

function addField(
  progress: CaseProgress,
  value: unknown,
  idFlag: boolean | undefined,
  verificationFlag: boolean | undefined,
  checks: { id: boolean; verification: boolean },
) {
  progress.collection.total += 1;
  if (meaningful(value)) progress.collection.completed += 1;
  if (checks.id) {
    progress.identification.total += 1;
    if (idFlag === true) progress.identification.completed += 1;
  }
  if (checks.verification) {
    progress.verification.total += 1;
    if (verificationFlag === true) progress.verification.completed += 1;
  }
}

export function calculateCaseProgress(
  attributes: ForgeAttrRow[],
  personsGrouped: Record<string, ForgePersonRow[]>,
): CaseProgress {
  const progress: CaseProgress = {
    completed: 0,
    total: 0,
    percent: 0,
    collection: { completed: 0, total: 0 },
    identification: { completed: 0, total: 0 },
    verification: { completed: 0, total: 0 },
  };
  const byName = new Map(attributes.map((attribute) => [attribute.attribute_name, attribute]));
  const optional = optionalCoreAttrs();

  for (const name of entityLevelCoreAttrs().filter((attribute) => !optional.has(attribute))) {
    const row = byName.get(name);
    addField(progress, row?.display_value, row?.id_flag, row?.verification_flag, attributeChecks(name));
  }

  for (const party of visibleParties()) {
    for (const person of personsGrouped[party.role] ?? []) {
      for (const shortName of ["name", ...party.columns]) {
        const fullName = `${party.role}_${shortName}`;
        const cell = person.attributes?.[fullName] ?? person.attributes?.[shortName];
        const value = shortName === "name" ? (person.full_name ?? cell?.display_value) : cell?.display_value;
        addField(
          progress,
          value,
          cell?.id_flag,
          cell?.verification_flag,
          attributeChecks(`${party.role}.${fullName}`),
        );
      }
    }
  }

  progress.completed = progress.collection.completed + progress.identification.completed + progress.verification.completed;
  progress.total = progress.collection.total + progress.identification.total + progress.verification.total;
  progress.percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  return progress;
}

import { useState } from "react";
import { prettifyAttrLabel } from "@/lib/attrLabel";
import type { ForgePersonRow } from "@/types/forgeTypes";

// ─── helpers ─────────────────────────────────────────────────────────────────

const ENTITY_HINTS = ["llc", "ltd", "corp", "inc", "gmbh", "plc", "limited", "holdings", "fund", "trust", "co.", "company"];

function classify(p: ForgePersonRow): "entity" | "individual" {
  const name = (p.full_name ?? "").toLowerCase();
  return ENTITY_HINTS.some((h) => name.includes(h)) ? "entity" : "individual";
}

type RowState = "ok" | "pending" | "exception";

function rowState(p: ForgePersonRow): RowState {
  const attrs = Object.values(p.attributes ?? {});
  if (attrs.some((a) => a.exception_flag)) return "exception";
  if (attrs.some((a) => a.id_flag === false || a.verification_flag === false)) return "pending";
  return "ok";
}

const stableKey = (p: ForgePersonRow, role: string) =>
  `${p.kyc ?? ""}-${role}-${p.person_index}`;

const STATE_BADGES: Record<RowState, { label: string; className: string }> = {
  ok:        { label: "Verified",       className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  pending:   { label: "Needs Review",   className: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  exception: { label: "Exception",      className: "bg-red-100 text-red-700 border border-red-200" },
};

// ─── SubTable (inline-editable row) ──────────────────────────────────────────

function SubTable({
  person,
  role,
  onSave,
}: {
  person: ForgePersonRow;
  role: string;
  onSave: (values: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({
    full_name:     person.full_name ?? "",
    ownership_pct: person.ownership_pct != null ? String(person.ownership_pct) : "",
    nationality:   person.nationality ?? "",
  });

  const state = rowState(person);
  const badge = STATE_BADGES[state];
  const attrEntries = Object.entries(person.attributes ?? {});

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div
      key={stableKey(person, role)}
      className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900 text-sm">
            {person.full_name ?? <em className="text-gray-400">No name</em>}
          </span>
          <span className="text-xs text-gray-400">#{person.person_index}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* Core fields */}
      {editing ? (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { key: "full_name", label: "Full Name" },
            { key: "nationality", label: "Nationality" },
            { key: "ownership_pct", label: "Ownership %" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-3 text-sm text-gray-700">
          <div>
            <span className="text-xs text-gray-400 block">Nationality</span>
            {person.nationality ?? <em className="text-gray-300">—</em>}
          </div>
          {person.ownership_pct != null && (
            <div>
              <span className="text-xs text-gray-400 block">Ownership</span>
              {person.ownership_pct}%
            </div>
          )}
        </div>
      )}

      {/* Attribute cells */}
      {attrEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {attrEntries.map(([key, attr]) => (
            <div key={key} className="text-xs bg-gray-50 rounded p-2 border border-gray-100">
              <span className="text-gray-400 block mb-0.5">{prettifyAttrLabel(key)}</span>
              <span className="text-gray-700">{attr.display_value ?? "—"}</span>
              {attr.id_flag === true && (
                <span className="ml-2 text-emerald-600 font-medium">✓ ID</span>
              )}
              {attr.verification_flag === true && (
                <span className="ml-2 text-blue-600 font-medium">✓ Verified</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {editing && (
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSave}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PersonRoleTable ──────────────────────────────────────────────────────────

export function PersonRoleTable({
  persons,
  role,
  onPersist,
}: {
  persons: ForgePersonRow[];
  role: string;
  onPersist?: (
    kyc: string | undefined,
    role: string,
    personIndex: number,
    values: Record<string, string>
  ) => void;
}) {
  const individuals = persons.filter((p) => classify(p) === "individual");
  const entities    = persons.filter((p) => classify(p) === "entity");

  const renderGroup = (group: ForgePersonRow[], label: string) => {
    if (!group.length) return null;
    return (
      <div className="mb-4">
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {label} ({group.length})
        </h5>
        <div className="space-y-3">
          {group.map((p) => (
            <SubTable
              key={stableKey(p, role)}
              person={p}
              role={role}
              onSave={(values) => onPersist?.(p.kyc, role, p.person_index, values)}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!persons.length) {
    return (
      <p className="text-sm text-gray-400 italic py-4">No persons on record for this role.</p>
    );
  }

  return (
    <div>
      {renderGroup(individuals, "Individuals")}
      {renderGroup(entities, "Entities")}
    </div>
  );
}

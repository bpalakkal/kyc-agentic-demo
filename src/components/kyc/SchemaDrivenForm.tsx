import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { entityFormFields, schemaCollections, schemaVersion } from "@schema";

type SchemaValue = string | number | boolean | string[] | null;
export type SchemaFormValue = Record<string, SchemaValue | Record<string, SchemaValue>[]>;

type FieldMeta = {
  path: string;
  child?: string | null;
  label?: string;
  control?: string;
  options?: string[];
  defaultValue?: unknown;
  required?: boolean;
  description?: string | null;
};

function initialFieldValue(field: FieldMeta): SchemaValue {
  if (field.defaultValue != null) return field.defaultValue as SchemaValue;
  if (field.control === "checkbox") return false;
  if (field.control === "multiselect") return [];
  return "";
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldMeta;
  value: SchemaValue | undefined;
  onChange: (value: SchemaValue) => void;
}) {
  const id = `schema-field-${field.path.replaceAll(".", "-")}`;
  const shared = {
    id,
    "aria-required": field.required || undefined,
    className: "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {field.label ?? field.path}
        {field.required && <span className="ml-1 text-alert">*</span>}
      </label>
      {field.control === "select" ? (
        <select {...shared} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.control === "textarea" ? (
        <textarea
          id={id}
          aria-required={field.required || undefined}
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.control === "checkbox" ? (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      ) : (
        <input
          {...shared}
          type={
            field.control === "date" ? "date"
              : field.control === "number" ? "number"
                : field.control === "url" ? "url"
                  : "text"
          }
          value={String(value ?? "")}
          onChange={(event) => onChange(
            field.control === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value,
          )}
        />
      )}
      {field.description && <p className="text-[11px] text-muted-foreground">{field.description}</p>}
    </div>
  );
}

export function SchemaDrivenForm({
  value,
  onChange,
  onSubmit,
  collectionTypes = ["group", "party"],
}: {
  value?: SchemaFormValue;
  onChange?: (value: SchemaFormValue) => void;
  onSubmit?: (value: SchemaFormValue) => void;
  collectionTypes?: string[];
}) {
  const entityFields = useMemo(() => entityFormFields() as FieldMeta[], []);
  const collections = useMemo(
    () => schemaCollections().filter((collection) => collectionTypes.includes(collection.collectionType ?? "")),
    [collectionTypes],
  );
  const [formValue, setFormValue] = useState<SchemaFormValue>(() => {
    const initial: SchemaFormValue = { ...(value ?? {}) };
    for (const field of entityFields) {
      if (!(field.path in initial)) initial[field.path] = initialFieldValue(field);
    }
    for (const collection of collections) {
      if (!(collection.name in initial)) initial[collection.name] = [];
    }
    return initial;
  });

  useEffect(() => onChange?.(formValue), [formValue, onChange]);

  const setEntityField = (path: string, next: SchemaValue) => {
    setFormValue((current) => ({ ...current, [path]: next }));
  };

  const addCollectionRow = (name: string, fields: FieldMeta[]) => {
    const row = Object.fromEntries(fields.map((field) => [
      field.child ?? field.path.split(".").pop()!,
      initialFieldValue(field),
    ]));
    setFormValue((current) => ({
      ...current,
      [name]: [...((current[name] as Record<string, SchemaValue>[]) ?? []), row],
    }));
  };

  const updateCollectionField = (name: string, index: number, key: string, next: SchemaValue) => {
    setFormValue((current) => {
      const rows = [...((current[name] as Record<string, SchemaValue>[]) ?? [])];
      rows[index] = { ...rows[index], [key]: next };
      return { ...current, [name]: rows };
    });
  };

  const removeCollectionRow = (name: string, index: number) => {
    setFormValue((current) => ({
      ...current,
      [name]: ((current[name] as Record<string, SchemaValue>[]) ?? []).filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  return (
    <form
      data-schema-version={schemaVersion}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(formValue);
      }}
    >
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Entity Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {entityFields.map((field) => (
            <FieldControl
              key={field.path}
              field={field}
              value={formValue[field.path] as SchemaValue}
              onChange={(next) => setEntityField(field.path, next)}
            />
          ))}
        </div>
      </section>

      {collections.map((collection) => {
        const rows = (formValue[collection.name] as Record<string, SchemaValue>[]) ?? [];
        const fields = collection.fields as FieldMeta[];
        return (
          <section key={collection.name} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{collection.label}</h2>
                {collection.description && <p className="text-xs text-muted-foreground">{collection.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => addCollectionRow(collection.name, fields)}
                className="flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
              >
                <Plus className="size-3.5" /> Add {collection.label?.replace(/s$/, "") ?? "record"}
              </button>
            </div>
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="rounded-md border border-border p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    {fields.map((field) => {
                      const key = field.child ?? field.path.split(".").pop()!;
                      return (
                        <FieldControl
                          key={field.path}
                          field={{ ...field, path: `${field.path}-${index}` }}
                          value={row[key]}
                          onChange={(next) => updateCollectionField(collection.name, index, key, next)}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCollectionRow(collection.name, index)}
                    className="mt-3 flex items-center gap-1 text-xs text-alert"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              ))}
              {rows.length === 0 && <p className="text-xs italic text-muted-foreground">No records added.</p>}
            </div>
          </section>
        );
      })}

      {onSubmit && (
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Submit
        </button>
      )}
    </form>
  );
}

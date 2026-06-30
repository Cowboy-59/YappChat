"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * Spec 004 T002 — visual JSON Schema (Draft 7) editor with a live preview.
 * Builds an `object` schema from a field list; emits the schema via onChange.
 */
type FieldType = "string" | "number" | "boolean" | "array" | "object";

type Field = {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
};

type ObjectSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

function schemaToFields(schema: unknown): Field[] {
  const s = (schema ?? {}) as ObjectSchema;
  const required = new Set(s.required ?? []);
  return Object.entries(s.properties ?? {}).map(([name, def]) => ({
    name,
    type: (["string", "number", "boolean", "array", "object"].includes(def?.type ?? "")
      ? def!.type
      : "string") as FieldType,
    required: required.has(name),
    description: def?.description ?? "",
  }));
}

function fieldsToSchema(fields: Field[]): ObjectSchema {
  const properties: ObjectSchema["properties"] = {};
  const required: string[] = [];
  for (const f of fields) {
    if (!f.name) continue;
    properties[f.name] = { type: f.type, ...(f.description ? { description: f.description } : {}) };
    if (f.required) required.push(f.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

export function JSONSchemaEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (schema: ObjectSchema) => void;
}) {
  const [fields, setFields] = useState<Field[]>(() => schemaToFields(value));

  function update(next: Field[]) {
    setFields(next);
    onChange(fieldsToSchema(next));
  }

  const schema = fieldsToSchema(fields);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <input
                placeholder="field_name"
                value={f.name}
                onChange={(e) => update(fields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm"
              />
              <select
                value={f.type}
                onChange={(e) => update(fields.map((x, j) => (j === i ? { ...x, type: e.target.value as FieldType } : x)))}
                className="rounded border border-border bg-card px-2 py-1 text-sm"
              >
                {(["string", "number", "boolean", "array", "object"] as FieldType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => update(fields.filter((_, j) => j !== i))}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                placeholder="description"
                value={f.description}
                onChange={(e) => update(fields.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                />
                required
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update([...fields, { name: "", type: "string", required: false, description: "" }])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> Add field
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Live JSON Schema</p>
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </div>
    </div>
  );
}

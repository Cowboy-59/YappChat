/**
 * Spec 004 T003 — handler code generation (TypeScript / Python / JavaScript).
 * Produces a ready-to-deploy handler stub including the mandatory X-Skill-Token
 * auth pattern, input typing derived from the skill's JSON Schema, and inline
 * comments for a developer unfamiliar with YappChatt skill handlers.
 */
export type HandlerLanguage = "typescript" | "python" | "javascript";

type JsonSchema = {
  properties?: Record<string, { type?: string; description?: string }>;
  required?: string[];
};

function tsType(t: string | undefined): string {
  switch (t) {
    case "string": return "string";
    case "number": case "integer": return "number";
    case "boolean": return "boolean";
    case "array": return "unknown[]";
    case "object": return "Record<string, unknown>";
    default: return "unknown";
  }
}

function pyType(t: string | undefined): string {
  switch (t) {
    case "string": return "str";
    case "number": return "float";
    case "integer": return "int";
    case "boolean": return "bool";
    case "array": return "list";
    case "object": return "dict";
    default: return "object";
  }
}

function props(schema: unknown): Array<{ name: string; type?: string; required: boolean; description?: string }> {
  const s = (schema ?? {}) as JsonSchema;
  const required = new Set(s.required ?? []);
  return Object.entries(s.properties ?? {}).map(([name, def]) => ({
    name,
    type: def?.type,
    required: required.has(name),
    description: def?.description,
  }));
}

export function generateHandler(
  skill: { name: string; inputschema: unknown },
  language: HandlerLanguage,
): { source: string; filename: string; language: HandlerLanguage } {
  const fields = props(skill.inputschema);
  if (language === "typescript") {
    return { language, filename: `${skill.name}.ts`, source: tsHandler(skill.name, fields) };
  }
  if (language === "python") {
    return { language, filename: `${skill.name}.py`, source: pyHandler(skill.name, fields) };
  }
  return { language, filename: `${skill.name}.js`, source: jsHandler(skill.name, fields) };
}

function tsHandler(name: string, fields: ReturnType<typeof props>): string {
  const iface = fields.length
    ? fields
        .map((f) => `  ${f.name}${f.required ? "" : "?"}: ${tsType(f.type)};${f.description ? ` // ${f.description}` : ""}`)
        .join("\n")
    : "  [key: string]: unknown;";
  return `import express from "express";

const app = express();
app.use(express.json());

// Input shape derived from the skill's JSON Schema.
interface ${pascal(name)}Input {
${iface}
}

app.post("/${name}", (req, res) => {
  // 1) Auth: validate the X-Skill-Token header against your configured secret.
  const token = req.headers["x-skill-token"];
  if (!token || token !== process.env.SKILL_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2) Parse + (optionally) validate the input.
  const input = req.body as ${pascal(name)}Input;

  try {
    // 3) Business logic — replace this with your implementation.
    const result: unknown = { echo: input };

    // 4) Response shape: always return a { result } object.
    return res.json({ result });
  } catch (err) {
    // 5) Errors: return a structured error with a non-2xx status.
    return res.status(500).json({ error: (err as Error).message });
  }
});

const port = process.env.PORT ?? 8080;
app.listen(port, () => console.log(\`${name} handler listening on :\${port}\`));
`;
}

function jsHandler(name: string, fields: ReturnType<typeof props>): string {
  const jsdoc = fields.length
    ? fields.map((f) => ` * @property {${tsType(f.type)}} ${f.required ? "" : "["}${f.name}${f.required ? "" : "]"}${f.description ? ` - ${f.description}` : ""}`).join("\n")
    : " * @property {*} [key]";
  return `const express = require("express");

const app = express();
app.use(express.json());

/**
 * Input shape derived from the skill's JSON Schema.
 * @typedef {Object} ${pascal(name)}Input
${jsdoc}
 */

app.post("/${name}", (req, res) => {
  // 1) Auth: validate the X-Skill-Token header against your configured secret.
  const token = req.headers["x-skill-token"];
  if (!token || token !== process.env.SKILL_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2) Parse the input.
  const input = req.body;

  try {
    // 3) Business logic — replace this with your implementation.
    const result = { echo: input };

    // 4) Response shape: always return a { result } object.
    return res.json({ result });
  } catch (err) {
    // 5) Errors: return a structured error with a non-2xx status.
    return res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(\`${name} handler listening on :\${port}\`));
`;
}

function pyHandler(name: string, fields: ReturnType<typeof props>): string {
  const model = fields.length
    ? fields
        .map((f) => `    ${f.name}: ${f.required ? pyType(f.type) : `${pyType(f.type)} | None = None`}${f.description ? `  # ${f.description}` : ""}`)
        .join("\n")
    : "    pass";
  return `from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os

app = FastAPI()


# Input model derived from the skill's JSON Schema.
class ${pascal(name)}Input(BaseModel):
${model}


@app.post("/${name}")
def handle(input: ${pascal(name)}Input, x_skill_token: str | None = Header(default=None)):
    # 1) Auth: validate the X-Skill-Token header against your configured secret.
    if not x_skill_token or x_skill_token != os.environ.get("SKILL_TOKEN"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        # 2) Business logic — replace this with your implementation.
        result = {"echo": input.model_dump()}

        # 3) Response shape: always return a {"result": ...} object.
        return {"result": result}
    except Exception as err:  # noqa: BLE001
        # 4) Errors: return a non-2xx status.
        raise HTTPException(status_code=500, detail=str(err))
`;
}

function pascal(snake: string): string {
  return snake
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export const DEPLOY_CHECKLIST = [
  "Deploy the handler to a public HTTPS URL.",
  "Verify it is reachable from the YappChatt server (curl -X POST <url> -H 'X-Skill-Token: <token>' -d '<test-input>').",
  "Paste the URL back into the skill form.",
  "Run a test from the Test Console.",
];

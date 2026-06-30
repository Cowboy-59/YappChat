import { describe, expect, it } from "vitest";
import { bumpVersion, validateInput, validateJsonSchema } from "./skill-schema";
import { generateHandler } from "./codegen";

describe("bumpVersion", () => {
  it("bumps patch/minor/major correctly", () => {
    expect(bumpVersion("1.0.0", "patch")).toBe("1.0.1");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });
});

describe("validateJsonSchema", () => {
  it("accepts a valid Draft-7 object schema", () => {
    expect(validateJsonSchema({ type: "object", properties: { a: { type: "string" } } }).valid).toBe(true);
  });
  it("rejects a non-object", () => {
    expect(validateJsonSchema(null).valid).toBe(false);
    expect(validateJsonSchema("nope").valid).toBe(false);
  });
  it("rejects an invalid schema", () => {
    expect(validateJsonSchema({ type: "not-a-type" }).valid).toBe(false);
  });
});

describe("validateInput", () => {
  const schema = { type: "object", properties: { city: { type: "string" } }, required: ["city"] };
  it("passes valid input", () => {
    expect(validateInput(schema, { city: "Austin" }).valid).toBe(true);
  });
  it("fails missing required + reports errors", () => {
    const r = validateInput(schema, {});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("generateHandler", () => {
  const skill = { name: "get_weather", inputschema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } };

  it("TS handler includes the auth pattern + typed input", () => {
    const out = generateHandler(skill, "typescript");
    expect(out.filename).toBe("get_weather.ts");
    expect(out.source).toContain("x-skill-token");
    expect(out.source).toContain("process.env.SKILL_TOKEN");
    expect(out.source).toContain("city");
  });

  it("Python handler uses FastAPI + token check", () => {
    const out = generateHandler(skill, "python");
    expect(out.filename).toBe("get_weather.py");
    expect(out.source).toContain("FastAPI");
    expect(out.source).toContain("SKILL_TOKEN");
  });

  it("JS handler includes the auth pattern", () => {
    const out = generateHandler(skill, "javascript");
    expect(out.filename).toBe("get_weather.js");
    expect(out.source).toContain("x-skill-token");
  });
});

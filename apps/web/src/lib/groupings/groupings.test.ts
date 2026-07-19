import { describe, expect, it } from "vitest";
import { MAX_GROUPING_NAME, normalizeGroupingName, normalizeGroupingType, normalizePosition } from "./validation";
import { GROUPING_TYPES } from "../db/groupings-schema";
import { EngineError } from "../engine/errors";

describe("grouping name validation (FR-001/003 input guard)", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeGroupingName("  PROJECTS  ")).toBe("PROJECTS");
  });
  it("rejects empty / whitespace-only names with a 400", () => {
    for (const bad of ["", "   ", null, undefined, 42]) {
      expect(() => normalizeGroupingName(bad)).toThrow(EngineError);
    }
  });
  it("rejects names longer than the bound", () => {
    expect(() => normalizeGroupingName("x".repeat(MAX_GROUPING_NAME + 1))).toThrow(EngineError);
    // exactly at the bound is allowed
    expect(normalizeGroupingName("x".repeat(MAX_GROUPING_NAME))).toHaveLength(MAX_GROUPING_NAME);
  });
  it("throws a 400 EngineError (route maps to HTTP 400)", () => {
    try {
      normalizeGroupingName("");
    } catch (e) {
      expect((e as EngineError).status).toBe(400);
      expect((e as EngineError).code).toBe("invalid_name");
    }
  });
});

describe("grouping type validation (FR-008 — the general|projects contract SPEC-091 keys off)", () => {
  it("accepts exactly the allowed types", () => {
    expect(normalizeGroupingType("general")).toBe("general");
    expect(normalizeGroupingType("projects")).toBe("projects");
  });
  it("locks the allowed set to general + projects", () => {
    expect([...GROUPING_TYPES]).toEqual(["general", "projects"]);
  });
  it("rejects any other value", () => {
    for (const bad of ["admin", "PROJECTS", "", null, undefined, {}]) {
      expect(() => normalizeGroupingType(bad)).toThrow(EngineError);
    }
  });
});

describe("position validation (FR-002 ordering)", () => {
  it("defaults null/undefined to 0", () => {
    expect(normalizePosition(null)).toBe(0);
    expect(normalizePosition(undefined)).toBe(0);
  });
  it("floors positive numbers", () => {
    expect(normalizePosition(3.9)).toBe(3);
    expect(normalizePosition("5")).toBe(5);
  });
  it("rejects negatives and non-numbers", () => {
    for (const bad of [-1, "abc", NaN, Infinity]) {
      expect(() => normalizePosition(bad)).toThrow(EngineError);
    }
  });
});

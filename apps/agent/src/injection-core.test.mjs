import { describe, expect, it } from "vitest";
import { btn, toPixels, mapKey } from "./injection-core.mjs";

describe("toPixels", () => {
  it("scales a normalized coord to a rounded pixel", () => {
    expect(toPixels(0.5, 1920)).toBe(960);
    expect(toPixels(0, 1080)).toBe(0);
    expect(toPixels(1, 1080)).toBe(1080);
  });
});

describe("btn", () => {
  it("maps names to nut buttons distinctly", () => {
    expect(btn("right")).not.toBe(btn("left"));
    expect(btn("middle")).not.toBe(btn("left"));
    expect(btn("anything-else")).toBe(btn("left"));
  });
});

describe("mapKey", () => {
  it("maps known named keys and leaves single chars unmapped", () => {
    expect(mapKey("Enter")).toBeDefined();
    expect(mapKey("a")).toBeUndefined();
  });
});

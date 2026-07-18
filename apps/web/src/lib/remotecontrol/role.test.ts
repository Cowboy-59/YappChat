import { describe, expect, it } from "vitest";
import { roleOf } from "./role";

describe("roleOf", () => {
  const s = { controlleruserid: "c1", hostuserid: "h1" };
  it("returns controller for the controller user", () => {
    expect(roleOf(s, "c1")).toBe("controller");
  });
  it("returns host for the host user", () => {
    expect(roleOf(s, "h1")).toBe("host");
  });
  it("returns null when there is no session", () => {
    expect(roleOf(null, "c1")).toBeNull();
  });
});

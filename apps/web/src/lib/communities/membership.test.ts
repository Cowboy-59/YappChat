import { describe, expect, it } from "vitest";
import { decideJoinOutcome } from "./membership";

describe("decideJoinOutcome", () => {
  it("open community → instant join", () => {
    expect(decideJoinOutcome("open", false)).toBe("join");
  });

  it("approval community → request (or instant with a valid invite)", () => {
    expect(decideJoinOutcome("approval", false)).toBe("request");
    expect(decideJoinOutcome("approval", true)).toBe("join");
  });

  it("invite-only community → deny without an invite, join with one", () => {
    expect(decideJoinOutcome("invite", false)).toBe("deny");
    expect(decideJoinOutcome("invite", true)).toBe("join");
  });

  it("a valid invite always joins regardless of policy", () => {
    for (const p of ["open", "approval", "invite"] as const) {
      expect(decideJoinOutcome(p, true)).toBe("join");
    }
  });
});

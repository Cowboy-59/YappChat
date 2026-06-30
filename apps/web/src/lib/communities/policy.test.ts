import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  can,
  effectiveDiscoverability,
  effectiveJoinPolicy,
  isStricterOrEqualDiscover,
  isStricterOrEqualJoin,
} from "./policy";

describe("communities capability map", () => {
  it("owner satisfies every capability", () => {
    for (const cap of Object.keys(CAPABILITIES) as (keyof typeof CAPABILITIES)[]) {
      expect(can("owner", cap)).toBe(true);
    }
  });

  it("member cannot update the community or create spaces", () => {
    expect(can("member", "community:update")).toBe(false);
    expect(can("member", "space:create")).toBe(false);
  });

  it("moderator can create spaces but not delete the community or set roles", () => {
    expect(can("moderator", "space:create")).toBe(true);
    expect(can("moderator", "community:delete")).toBe(false);
    expect(can("moderator", "member:role:set")).toBe(false);
  });
});

describe("effective join policy = stricter of community ⊕ space", () => {
  it("inherits the community when the space does not override", () => {
    expect(effectiveJoinPolicy("approval", null)).toBe("approval");
  });

  it("takes the stricter side when the space overrides", () => {
    expect(effectiveJoinPolicy("open", "invite")).toBe("invite");
    expect(effectiveJoinPolicy("approval", "open")).toBe("approval"); // looser override ignored
    expect(effectiveJoinPolicy("invite", "approval")).toBe("invite");
  });
});

describe("effective discoverability = stricter of community ⊕ space", () => {
  it("unlisted always wins over public", () => {
    expect(effectiveDiscoverability("public", "unlisted")).toBe("unlisted");
    expect(effectiveDiscoverability("unlisted", "public")).toBe("unlisted");
    expect(effectiveDiscoverability("public", null)).toBe("public");
  });
});

describe("space-override legality (must be stricter-or-equal)", () => {
  it("join policy", () => {
    expect(isStricterOrEqualJoin("approval", "invite")).toBe(true);
    expect(isStricterOrEqualJoin("approval", "approval")).toBe(true);
    expect(isStricterOrEqualJoin("approval", "open")).toBe(false);
  });
  it("discoverability", () => {
    expect(isStricterOrEqualDiscover("public", "unlisted")).toBe(true);
    expect(isStricterOrEqualDiscover("unlisted", "public")).toBe(false);
  });
});

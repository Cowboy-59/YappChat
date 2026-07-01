import { describe, expect, it } from "vitest";
import {
  isAllowedReturnPath,
  resolveReturnPath,
  DEFAULT_ADMIN_PATH,
  DEFAULT_USER_PATH,
} from "./return-url";

const REGULAR = { isSystemStaff: false };
const STAFF = { isSystemStaff: true };

describe("isAllowedReturnPath — allowed", () => {
  it.each(["/app", "/app/", "/app/inbox", "/app/settings/profile"])(
    "allows %s for any authenticated user",
    (path) => {
      expect(isAllowedReturnPath(path, REGULAR)).toBe(true);
      expect(isAllowedReturnPath(path, STAFF)).toBe(true);
    },
  );

  it.each([
    "/communities",
    "/communities/",
    "/communities/123",
    "/messaging",
    "/messaging/inbox",
    "/assistant",
    "/studio",
    "/studio/agents",
  ])("allows authenticated surface %s for any user (spec 068)", (path) => {
    expect(isAllowedReturnPath(path, REGULAR)).toBe(true);
    expect(isAllowedReturnPath(path, STAFF)).toBe(true);
  });

  it.each(["/communityXYZ", "/messagingfoo", "/studiox", "/assistants"])(
    "does NOT allow a lookalike prefix %s",
    (path) => {
      expect(isAllowedReturnPath(path, REGULAR)).toBe(false);
    },
  );

  it.each(["/admin", "/admin/", "/admin/users"])(
    "allows %s only for system staff",
    (path) => {
      expect(isAllowedReturnPath(path, STAFF)).toBe(true);
      expect(isAllowedReturnPath(path, REGULAR)).toBe(false);
    },
  );

  it("allows an encoded but in-scope path", () => {
    expect(isAllowedReturnPath("%2Fapp%2Finbox", REGULAR)).toBe(true);
  });

  it("allows the FR-020 invite landing path WITH its token query (encoded + decoded)", () => {
    // The invite redirect round-trips `/communities/join?token=…` through sign-in;
    // the allow-list must accept it, or per-space invite redemption breaks.
    expect(isAllowedReturnPath("/communities/join?token=abc123", REGULAR)).toBe(true);
    expect(isAllowedReturnPath(encodeURIComponent("/communities/join?token=abc123"), REGULAR)).toBe(true);
    expect(resolveReturnPath("/communities/join?token=abc123", REGULAR)).toBe("/communities/join?token=abc123");
  });
});

describe("isAllowedReturnPath — attack matrix (all rejected)", () => {
  const attacks = [
    // off-domain / protocol-relative
    "//attacker.com",
    "//attacker.com/app",
    "/\\attacker.com",
    "https://attacker.com/app",
    "http://attacker.com",
    // scheme injection
    "javascript:alert(1)",
    "/javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "JaVaScRiPt:alert(1)",
    // encoded protocol-relative / scheme
    "%2F%2Fattacker.com",
    "%2f%2fattacker.com/app",
    "%6a%61vascript:alert(1)",
    // backslash smuggling
    "/app\\..\\admin",
    "\\\\attacker.com",
    // not in allow-list
    "/billing",
    "/",
    "/appfoo", // must not match /app prefix loosely
    "/administrator", // must not match /admin loosely
    // control chars / newlines (header/log injection)
    "/app\nSet-Cookie: x=1",
    "/app\r\nLocation: //evil",
    // empties
    "",
    null,
    undefined,
  ];

  it.each(attacks)("rejects %j for regular users", (val) => {
    expect(isAllowedReturnPath(val, REGULAR)).toBe(false);
  });

  it.each(attacks)("rejects %j for system staff too", (val) => {
    expect(isAllowedReturnPath(val, STAFF)).toBe(false);
  });

  it("rejects malformed percent-encoding", () => {
    expect(isAllowedReturnPath("/app%E0%A4%A", REGULAR)).toBe(false);
  });

  it("does not let a regular user reach /admin", () => {
    expect(isAllowedReturnPath("/admin", REGULAR)).toBe(false);
  });
});

describe("resolveReturnPath — safe fallback", () => {
  it("returns role default when return is missing", () => {
    expect(resolveReturnPath(null, REGULAR)).toBe(DEFAULT_USER_PATH);
    expect(resolveReturnPath(null, STAFF)).toBe(DEFAULT_ADMIN_PATH);
  });

  it("falls back to default on a rejected return", () => {
    expect(resolveReturnPath("//attacker.com", REGULAR)).toBe(DEFAULT_USER_PATH);
    expect(resolveReturnPath("/admin", REGULAR)).toBe(DEFAULT_USER_PATH);
    expect(resolveReturnPath("javascript:alert(1)", STAFF)).toBe(DEFAULT_ADMIN_PATH);
  });

  it("honours an allow-listed return", () => {
    expect(resolveReturnPath("/app/inbox", REGULAR)).toBe("/app/inbox");
    expect(resolveReturnPath("/admin/users", STAFF)).toBe("/admin/users");
    expect(resolveReturnPath("%2Fapp%2Finbox", REGULAR)).toBe("/app/inbox");
  });
});

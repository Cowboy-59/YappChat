import { describe, expect, it } from "vitest";
import {
  anonymizeIp,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./crypto";

describe("token hashing", () => {
  it("hashToken is deterministic + 64 hex chars (SHA-256)", () => {
    const t = "some-opaque-token";
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateToken returns distinct, url-safe values", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("password hashing (argon2id)", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("returns false (not throw) for a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("anonymizeIp", () => {
  it("zeroes the last v4 octet", () => {
    expect(anonymizeIp("203.0.113.42")).toBe("203.0.113.0");
  });
  it("keeps first 3 hextets of v6", () => {
    expect(anonymizeIp("2001:db8:1234:5678::1")).toBe("2001:db8:1234::");
  });
  it("returns null for empty/unknown", () => {
    expect(anonymizeIp(null)).toBeNull();
    expect(anonymizeIp("")).toBeNull();
    expect(anonymizeIp("garbage")).toBeNull();
  });
});

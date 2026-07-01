import { describe, expect, it } from "vitest";
import { pairKey } from "./service";
import { isUniqueViolation } from "../db/errors";
import { clearRateLimit, rateLimit, resetRateLimits } from "../auth/ratelimit";

describe("contacts pairKey (canonical unordered-pair invariant)", () => {
  it("produces the same (usera,userb) regardless of argument order", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const b = "22222222-2222-2222-2222-222222222222";
    expect(pairKey(a, b)).toEqual(pairKey(b, a));
  });

  it("orders usera < userb (LEAST/GREATEST)", () => {
    const lo = "aaaaaaaa-0000-0000-0000-000000000000";
    const hi = "ffffffff-0000-0000-0000-000000000000";
    const k = pairKey(hi, lo);
    expect(k.usera).toBe(lo);
    expect(k.userb).toBe(hi);
    expect(k.usera < k.userb).toBe(true);
  });
});

describe("isUniqueViolation (partial-unique race → idempotent no-op)", () => {
  it("detects SQLSTATE 23505 on the error", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });
  it("detects 23505 nested on cause", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });
  it("is false for other errors and non-objects", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("nope")).toBe(false);
  });
});

describe("rate limiter clear (sysadmin unfreeze resets a stale flood window)", () => {
  it("clearRateLimit drops a single key so it no longer trips", () => {
    resetRateLimits();
    const key = "contactflood:user-1";
    // Exhaust a tiny window.
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false);
    clearRateLimit(key);
    // After clearing, the window is fresh again.
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
  });
});

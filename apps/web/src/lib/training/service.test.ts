import { describe, expect, it } from "vitest";
import { itemHasMedia, orderItems } from "./service";

/**
 * Spec 092 (Training) — pure-logic units. The DB-bound access gates (non-member →
 * 403, TT-01) are covered by the e2e/manual pass; here we lock the pure pieces
 * that back FR-002 (ordering) and FR-003 (per-type media resolution).
 */

describe("itemHasMedia — each item type resolves its own backing column (FR-003)", () => {
  it("recording has media only with a presentationrecordingid", () => {
    expect(itemHasMedia({ type: "recording", presentationrecordingid: "r1", mediakey: null, documentkey: null })).toBe(true);
    expect(itemHasMedia({ type: "recording", presentationrecordingid: null, mediakey: "x", documentkey: "y" })).toBe(false);
  });
  it("video has media only with a mediakey (never a presentationrecordings row) (FR-006)", () => {
    expect(itemHasMedia({ type: "video", presentationrecordingid: null, mediakey: "k", documentkey: null })).toBe(true);
    expect(itemHasMedia({ type: "video", presentationrecordingid: "r1", mediakey: null, documentkey: null })).toBe(false);
  });
  it("document has media only with a documentkey (FR-007)", () => {
    expect(itemHasMedia({ type: "document", presentationrecordingid: null, mediakey: null, documentkey: "d" })).toBe(true);
    expect(itemHasMedia({ type: "document", presentationrecordingid: null, mediakey: "k", documentkey: null })).toBe(false);
  });
});

describe("orderItems — reorder resolves to owned ids in requested order (FR-002)", () => {
  it("keeps only owned ids, in the requested order", () => {
    expect(orderItems(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });
  it("ignores ids not owned by the course (can't reorder another course's item)", () => {
    expect(orderItems(["a", "b"], ["b", "zzz", "a"])).toEqual(["b", "a"]);
  });
  it("de-duplicates a repeated id", () => {
    expect(orderItems(["a", "b"], ["a", "a", "b"])).toEqual(["a", "b"]);
  });
  it("omits owned ids absent from the requested order (partial reorder)", () => {
    expect(orderItems(["a", "b", "c"], ["b"])).toEqual(["b"]);
  });
});

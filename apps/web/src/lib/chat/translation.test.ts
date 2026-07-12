import { describe, expect, it } from "vitest";
import { resolveMessageTranslation, translateText } from "./translation";

// These cover the deterministic, no-IO paths (no model call, no DB): the
// same-language / empty / all-code short-circuits that guarantee "same-language
// view = zero calls" (017 FR-012) and "code blocks never translated". The
// cache + live-translate paths are exercised by the DB-backed e2e, per the
// repo's convention of not mocking the database in unit tests.

describe("translateText — no-op short-circuits", () => {
  it("returns the original when source === target (zero model calls)", async () => {
    await expect(translateText("Bonjour", "fr", "fr")).resolves.toBe("Bonjour");
  });

  it("returns the original for empty / whitespace text", async () => {
    await expect(translateText("", "en", "fr")).resolves.toBe("");
    await expect(translateText("   \n ", "en", "fr")).resolves.toBe("   \n ");
  });

  it("does not translate (or require config for) an all-code message", async () => {
    const code = "```\nconst x = 1;\n```";
    // No ANTHROPIC_API_KEY in the test env — an all-code message must still
    // resolve (short-circuit) rather than throw translation_unconfigured.
    await expect(translateText(code, "en", "fr")).resolves.toBe(code);
  });
});

describe("resolveMessageTranslation — same-language path", () => {
  it("returns the original with sameLanguage=true and no DB touch when languages match", async () => {
    const res = await resolveMessageTranslation({
      messageid: "00000000-0000-0000-0000-000000000000",
      text: "hello",
      sourcelang: "en",
      targetlang: "en",
    });
    expect(res).toEqual({
      langcode: "en",
      sourcelang: "en",
      content: "hello",
      cached: false,
      sameLanguage: true,
    });
  });
});

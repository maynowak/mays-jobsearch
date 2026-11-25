import { describe, expect, it } from "vitest";
import { unwrapTranslationEnvelope } from "./translationEnvelope";

describe("translationEnvelope - client guard", () => {
  it("keeps a normal translation unchanged", () => {
    expect(unwrapTranslationEnvelope("Ein normaler Text.")).toBe("Ein normaler Text.");
  });

  it("unwraps a raw JSON envelope from a malformed upstream response", () => {
    expect(unwrapTranslationEnvelope('{"translation":"Er sagte "Hallo""}')).toBe('Er sagte "Hallo"');
    expect(unwrapTranslationEnvelope('{"translation":"Zeile\\nZwei"}')).toBe("Zeile\nZwei");
  });

  it("handles a plain quoted value", () => {
    expect(unwrapTranslationEnvelope('{"translation":"Nur Text"}')).toBe("Nur Text");
  });

  it("strips an invalid envelope without leaving JSON markers", () => {
    const value = unwrapTranslationEnvelope('{"translation":"Unvollständig');
    expect(value).not.toContain('{"translation"');
    expect(value).toContain("Unvollständig");
  });

  it("tolerates empty input", () => {
    expect(unwrapTranslationEnvelope("")).toBe("");
  });
});

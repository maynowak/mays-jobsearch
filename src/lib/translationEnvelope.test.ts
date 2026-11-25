import { describe, expect, it } from "vitest";
import { normalizeTranslationForDisplay, unwrapTranslationEnvelope } from "./translationEnvelope";

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


describe("translationEnvelope - strict display guard", () => {
  it("keeps normal translated text unchanged", () => {
    const text = "Wir suchen Fachkräfte für AWS und TypeScript.\n\n- Punkt eins";
    expect(normalizeTranslationForDisplay(text)).toBe(text);
  });

  it.each([
    '{"translation":"Hallo"}',
    '{ "translation" : "Hallo" }',
    '"{\\"translation\\":\\"Hallo\\"}"',
    '```json\n{"translation":"Hallo"}\n```',
    '{"translation":"Abgeschnitten',
  ])("rejects an unprocessed wrapper: %s", (value) => {
    expect(normalizeTranslationForDisplay(value)).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizeTranslationForDisplay("   ")).toBeNull();
  });

  it("does not reject legitimate JSON-like content later in the sentence", () => {
    const text = 'Die Anzeige nennt {"translation":"Beispiel"} nur als Beispiel.';
    expect(normalizeTranslationForDisplay(text)).toBe(text);
  });
});

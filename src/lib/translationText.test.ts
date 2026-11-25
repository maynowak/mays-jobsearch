import { describe, expect, it } from "vitest";
import {
  isUnprocessedTranslationWrapper,
  normalizeTranslationForDisplay,
} from "./translationText";

describe("translationText client guard", () => {
  it("accepts normal translated text without changing it", () => {
    const text = "Wir suchen Fachkräfte für AWS und TypeScript.\n\n- Punkt eins\n- Punkt zwei";
    expect(normalizeTranslationForDisplay(text)).toBe(text);
  });

  it.each([
    '{"translation":"Hallo"}',
    '{ "translation" : "Hallo" }',
    '"{\\"translation\\":\\"Hallo\\"}"',
    '```json\n{"translation":"Hallo"}\n```',
    '{"translation":"Abgeschnitten',
  ])("rejects an unprocessed wrapper: %s", (value) => {
    expect(isUnprocessedTranslationWrapper(value)).toBe(true);
    expect(normalizeTranslationForDisplay(value)).toBeNull();
  });

  it("rejects empty translations", () => {
    expect(normalizeTranslationForDisplay("   ")).toBeNull();
  });

  it("does not reject legitimate text merely because it contains JSON-like content later", () => {
    const text = "Die Anzeige nennt das Format {\"translation\":\"Beispiel\"} nur als Beispiel.";
    expect(normalizeTranslationForDisplay(text)).toBe(text);
  });
});

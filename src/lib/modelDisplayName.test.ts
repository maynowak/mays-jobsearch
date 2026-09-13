import { describe, expect, it } from "vitest";
import { modelDisplayName } from "./modelDisplayName";

describe("modelDisplayName", () => {
  it("gibt Leerstring zurück für null/undefined", () => {
    expect(modelDisplayName(null)).toBe("");
    expect(modelDisplayName(undefined)).toBe("");
  });

  it("zeigt Modellname ohne Provider", () => {
    expect(
      modelDisplayName({ id: "m-1", name: "Test Model" })
    ).toBe("Test Model");
  });

  it("zeigt Modellname mit Provider", () => {
    expect(
      modelDisplayName({
        id: "m-1",
        name: "Test Model",
        provider: { id: "edenai", name: "EdenAI" },
      })
    ).toBe("Test Model · EdenAI");
  });

  it("extrahiert lesbaren Namen aus internem ID-Format mit Slash", () => {
    expect(
      modelDisplayName({
        id: "dots-studio/dots-3-note-preview:free",
        name: "dots-studio/dots-3-note-preview:free",
        provider: { id: "openrouter", name: "OpenRouter" },
      })
    ).toBe("Dots 3 Note Preview Free · OpenRouter");
  });

  it("verwendet bereits hübsche Namen wie 'Dots 3 Note' unverändert", () => {
    expect(
      modelDisplayName({
        id: "dots-studio/dots-3-note-preview:free",
        name: "Dots 3 Note",
        provider: { id: "openrouter", name: "OpenRouter" },
      })
    ).toBe("Dots 3 Note · OpenRouter");
  });

  it("behält Modell-ID bei wenn Name leer ist", () => {
    expect(
      modelDisplayName({
        id: "some-model-id",
        name: "",
        provider: { id: "edenai", name: "EdenAI" },
      })
    ).toBe("Some Model Id · EdenAI");
  });

  it("zeigt nur Modellname wenn Provider fehlt", () => {
    expect(
      modelDisplayName({
        id: "dots-studio/dots-3-note-preview:free",
        name: "dots-studio/dots-3-note-preview:free",
      })
    ).toBe("Dots 3 Note Preview Free");
  });

  it("erkennt Model-internen-Name mit @-Präfix als nicht-lesbar", () => {
    expect(
      modelDisplayName({
        id: "@cf/mistral/mistral-7b-instruct",
        name: "@cf/mistral/mistral-7b-instruct",
        provider: { id: "edenai", name: "EdenAI" },
      })
    ).toBe("Mistral 7b Instruct · EdenAI");
  });
});
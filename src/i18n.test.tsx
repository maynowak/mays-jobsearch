import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { LangProvider, useLang } from "./i18n";

function TestComponent() {
  const { lang, t } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="t">{t("nav.search")}</span>
    </div>
  );
}

function renderWithProvider(options?: { storageLang?: "en" | "de" | null; navigatorMock?: { language?: string; languages?: string[] } }) {
  if (options?.storageLang !== undefined) {
    if (options.storageLang) {
      localStorage.setItem("mj-lang", options.storageLang);
    } else {
      localStorage.removeItem("mj-lang");
    }
  }
  if (options?.navigatorMock) {
    vi.stubGlobal("navigator", options.navigatorMock);
  }
  return render(<LangProvider><TestComponent /></LangProvider>);
}

describe("i18n - locale priority", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("1. explicit stored language: localStorage=de → DE", () => {
    localStorage.setItem("mj-lang", "de");
    renderWithProvider();
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("2. explicit stored language: localStorage=en → EN", () => {
    localStorage.setItem("mj-lang", "en");
    renderWithProvider();
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t").textContent).toBe("Search");
  });

  it("3. no stored language + browser de-DE → DE", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "de-DE", languages: ["de-DE"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("4. no stored language + browser de-AT → DE", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "de-AT", languages: ["de-AT"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("5. no stored language + browser de-CH → DE", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "de-CH", languages: ["de-CH"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("6. no stored language + browser en-US → EN", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "en-US", languages: ["en-US"] } });
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t").textContent).toBe("Search");
  });

  it("7. no stored language + browser en-GB → EN", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "en-GB", languages: ["en-GB"] } });
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t").textContent).toBe("Search");
  });

  it("8. no stored language + unknown browser language (fr-FR) → DE (fallback)", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "fr-FR", languages: ["fr-FR"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("9. no stored language + no navigator → DE (fallback)", () => {
    renderWithProvider({ storageLang: null, navigatorMock: {} });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("10. stored EN overrides browser DE", () => {
    localStorage.setItem("mj-lang", "en");
    renderWithProvider({ storageLang: "en", navigatorMock: { language: "de-DE", languages: ["de-DE"] } });
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t").textContent).toBe("Search");
  });

  it("11. stored DE overrides browser EN", () => {
    localStorage.setItem("mj-lang", "de");
    renderWithProvider({ storageLang: "de", navigatorMock: { language: "en-US", languages: ["en-US"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("t").textContent).toBe("Suche");
  });

  it("12. no stored language + browser de-DE → DE (default German)", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "de-DE", languages: ["de-DE"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
  });

  it("13. navigator.languages array takes precedence over navigator.language", () => {
    renderWithProvider({ 
      storageLang: null, 
      navigatorMock: { language: "en-US", languages: ["de-DE", "en-US"] } 
    });
    expect(screen.getByTestId("lang").textContent).toBe("de");
  });

  it("14. partial match: de-xx → DE", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "de-xx", languages: ["de-xx"] } });
    expect(screen.getByTestId("lang").textContent).toBe("de");
  });

  it("15. partial match: en-xx → EN", () => {
    renderWithProvider({ storageLang: null, navigatorMock: { language: "en-xx", languages: ["en-xx"] } });
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });
});

describe("i18n - language switching", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("setLang updates lang and localStorage", async () => {
    localStorage.setItem("mj-lang", "de");
    const { result } = renderHook(() => useLang(), {
      wrapper: LangProvider,
    });
    
    expect(result.current.lang).toBe("de");
    await act(async () => {
      result.current.setLang("en");
    });
    expect(result.current.lang).toBe("en");
    expect(localStorage.getItem("mj-lang")).toBe("en");
  });

  it("document.documentElement.lang updates on language change", () => {
    localStorage.setItem("mj-lang", "de");
    renderWithProvider({ storageLang: "de" });
    expect(document.documentElement.lang).toBe("de");
  });
});
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import Footer from "./Footer";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("LEGAL-IMPRINT-01: Footer mit Legal-Links", () => {
  it("enthält Link zu /impressum mit Text 'Impressum'", () => {
    render(
      <LangProvider>
        <Footer />
      </LangProvider>
    );

    const imprintLink = screen.getByRole("link", { name: "Impressum" });
    expect(imprintLink).toHaveAttribute("href", "/impressum");
  });

  it("enthält Link zu /datenschutz mit Text 'Datenschutz'", () => {
    render(
      <LangProvider>
        <Footer />
      </LangProvider>
    );

    const privacyLink = screen.getByRole("link", { name: "Datenschutz" });
    expect(privacyLink).toHaveAttribute("href", "/datenschutz");
  });

  it("enthält Link zu /datenschutzprinzipien mit Text 'Datenschutzprinzipien'", () => {
    render(
      <LangProvider>
        <Footer />
      </LangProvider>
    );

    const principlesLink = screen.getByRole("link", { name: "Datenschutzprinzipien" });
    expect(principlesLink).toHaveAttribute("href", "/datenschutzprinzipien");
  });

  it("Legal-Links sind in nav mit aria-label 'Rechtliche Links'", () => {
    render(
      <LangProvider>
        <Footer />
      </LangProvider>
    );

    const nav = screen.getByRole("navigation", { name: "Rechtliche Links" });
    expect(nav).toBeInTheDocument();
  });

  it("englische Labels bei EN-Sprache", () => {
    localStorage.setItem("mj-lang", "en");
    render(
      <LangProvider>
        <Footer />
      </LangProvider>
    );

    expect(screen.getByRole("link", { name: "Imprint" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByRole("link", { name: "Privacy principles" })).toHaveAttribute("href", "/datenschutzprinzipien");
    expect(screen.getByRole("navigation", { name: "Legal links" })).toBeInTheDocument();
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import Imprint from "./Imprint";
import { legalConfig, getContactEmailDisplay } from "../config/legal";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  // Reset environment mock
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

describe("LEGAL-IMPRINT-01: Imprint page", () => {
  it("zeigt Impressum-Titel und Provider-Sektion", () => {
    render(
      <LangProvider>
        <Imprint />
      </LangProvider>
    );

    expect(screen.getByText("Impressum")).toBeInTheDocument();
    expect(screen.getByText("Anbieter")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Anschrift")).toBeInTheDocument();
  });

  it("zeigt Kontakt-Sektion mit E-Mail aus Env-Config", () => {
    render(
      <LangProvider>
        <Imprint />
      </LangProvider>
    );

    expect(screen.getByText("Kontakt")).toBeInTheDocument();
    expect(screen.getByText("E-Mail")).toBeInTheDocument();
    // E-Mail wird als Link gerendert
    const emailLink = screen.getByRole("link", { name: /maysjobsearchinfos@gmail.com/i });
    expect(emailLink).toHaveAttribute("href", "mailto:maysjobsearchinfos@gmail.com");
  });

  it("zeigt Entwicklungs-Hinweis zur fehlenden Anschrift", () => {
    render(
      <LangProvider>
        <Imprint />
      </LangProvider>
    );

    expect(screen.getByText(/Betreiberanschrift wird vor dem produktiven rechtlichen Abschluss/)).toBeInTheDocument();
    expect(screen.getByText(/Impressum befindet sich in der Entwicklung/)).toBeInTheDocument();
  });

  it("Adresse ist als Platzhalter gekennzeichnet (italic/muted)", () => {
    render(
      <LangProvider>
        <Imprint />
      </LangProvider>
    );

    const addressDd = screen.getByText(/Betreiberanschrift wird vor dem produktiven/);
    expect(addressDd).toHaveClass("legal-placeholder");
  });

  it("englische Labels bei EN-Sprache", () => {
    localStorage.setItem("mj-lang", "en");
    render(
      <LangProvider>
        <Imprint />
      </LangProvider>
    );

    expect(screen.getByText("Imprint")).toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("E-Mail")).toBeInTheDocument();
    expect(screen.getByText(/operator address will be added/)).toBeInTheDocument();
  });
});

describe("LEGAL-IMPRINT-01: Legal Config", () => {
  it("legalConfig liest VITE_CONTACT_EMAIL", () => {
    // Import meta env wird durch Vite ersetzt, hier nur Smoke-Test
    expect(typeof legalConfig.isDev).toBe("boolean");
    expect(typeof legalConfig.contactEmail).toBe("string");
  });

  it("getContactEmailDisplay liefert Objekt mit email und isPlaceholder", () => {
    const result = getContactEmailDisplay();
    expect(result).toHaveProperty("email");
    expect(result).toHaveProperty("isPlaceholder");
    expect(typeof result.isPlaceholder).toBe("boolean");
  });
});
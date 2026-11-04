import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import StorageConsentSection from "./StorageConsentSection";

function renderSection(identityVerified: boolean) {
  return render(
    <LangProvider>
      <StorageConsentSection identityVerified={identityVerified} />
    </LangProvider>
  );
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("JM-PROFILE-STORAGE-CONSENT-01: privacy area", () => {
  it("shows preparation state and no active consent control", () => {
    renderSection(false);
    expect(screen.getByRole("heading", { name: "Datenschutz & Datenspeicherung" })).toBeInTheDocument();
    expect(
      screen.getByText(/Die dauerhafte Speicherung deiner Bewerbungsunterlagen wird vorbereitet/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/nicht verifiziert/)).toBeInTheDocument();
  });

  it("shows all independent storage categories", () => {
    renderSection(true);
    expect(screen.getByText("Lebensläufe speichern")).toBeInTheDocument();
    expect(screen.getByText("Bewerbungen speichern")).toBeInTheDocument();
    expect(screen.getByText("Suchprofile speichern")).toBeInTheDocument();
    expect(screen.getAllByText("Nicht freigegeben")).toHaveLength(3);
    expect(screen.getByText(/Identität über das angemeldete Konto verifiziert/)).toBeInTheDocument();
  });

  it("keeps future controls visibly disabled and explains the boundary", () => {
    renderSection(true);
    for (const name of [
      "Speicherfreigaben anzeigen",
      "Gespeicherte Daten exportieren",
      "Löschung beantragen",
      "Einwilligung widerrufen",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByText(/erst mit einem verifizierten Consent-Backend aktiv/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Datenschutzhinweise" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByRole("link", { name: "Datenschutzprinzipien" })).toHaveAttribute("href", "/datenschutzprinzipien");
  });

  it("renders English privacy text", () => {
    localStorage.setItem("mj-lang", "en");
    renderSection(true);
    expect(screen.getByRole("heading", { name: "Privacy & data storage" })).toBeInTheDocument();
    expect(screen.getByText(/not yet available/)).toBeInTheDocument();
  });
});

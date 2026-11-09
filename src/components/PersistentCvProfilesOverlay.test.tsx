import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import type { PersistentSearchProfiles } from "../lib/usePersistentSearchProfiles";
import PersistentCvProfilesOverlay from "./PersistentCvProfilesOverlay";

function profiles(overrides: Partial<PersistentSearchProfiles> = {}): PersistentSearchProfiles {
  return {
    available: true,
    active: false,
    persistentView: false,
    loading: false,
    error: null,
    consent: { grantAllowed: true } as PersistentSearchProfiles["consent"],
    manualProfiles: [],
    refresh: vi.fn(async () => undefined),
    grantConsent: vi.fn(async () => ({}) as never),
    withdrawConsent: vi.fn(async () => ({}) as never),
    saveManual: vi.fn(async () => undefined),
    deleteManual: vi.fn(async () => undefined),
    duplicateManual: vi.fn(async () => undefined),
    listCv: vi.fn(async () => []),
    createCv: vi.fn(async () => ({}) as never),
    updateCv: vi.fn(async () => ({}) as never),
    deleteCv: vi.fn(async () => undefined),
    listAts: vi.fn(async () => []),
    createAts: vi.fn(async () => ({}) as never),
    updateAts: vi.fn(async () => ({}) as never),
    deleteAts: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("PersistentCvProfilesOverlay consent reachability", () => {
  it("offers the separate consent directly for a stored CV", () => {
    const value = profiles();
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay cvId="cv-1" cvName="Lebenslauf.pdf" profiles={value} onClose={vi.fn()} />
      </LangProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Dauerhafte Suchprofil-Speicherung aktivieren" }));
    expect(value.grantConsent).toHaveBeenCalledTimes(1);
  });

  it("explains when search-profile storage is unavailable", () => {
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay
          cvId="cv-1"
          cvName="Lebenslauf.pdf"
          profiles={profiles({ available: false })}
          onClose={vi.fn()}
        />
      </LangProvider>
    );

    expect(screen.getByText("Die Suchprofil-Speicherung ist für dieses Konto nicht verfügbar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dauerhafte Suchprofil-Speicherung aktivieren" })).toBeNull();
  });
});

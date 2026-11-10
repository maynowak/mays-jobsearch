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

describe("PersistentCvProfilesOverlay card management", () => {
  it("shows profile cards and reveals the create form only on action", async () => {
    const cvProfile = {
      schemaVersion: 1,
      searchProfileId: "sp-1",
      cvId: "cv-1",
      name: "Frontend Berlin",
      origin: "cv",
      searchConfig: {
        skills: "React, TypeScript",
        targetRoles: ["Frontend"],
        city: "Berlin",
        radiusKm: 25,
        workModes: ["remote"],
        employmentTypes: ["full_time"],
      },
      createdAt: "2026-11-09T10:00:00Z",
      updatedAt: "2026-11-09T10:00:00Z",
      version: 1,
    } as never;
    const atsProfile = {
      schemaVersion: 1,
      atsSearchProfileId: "ats-1",
      searchProfileId: "sp-1",
      name: "Frontend ATS",
      targetRoles: ["Frontend"],
      skills: ["React"],
      createdAt: "2026-11-09T10:00:00Z",
      updatedAt: "2026-11-09T10:00:00Z",
      version: 1,
    } as never;
    const value = profiles({
      active: true,
      persistentView: true,
      listCv: vi.fn(async () => [cvProfile]),
      listAts: vi.fn(async () => [atsProfile]),
    });
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay cvId="cv-1" cvName="Lebenslauf.pdf" profiles={value} onClose={vi.fn()} />
      </LangProvider>
    );

    expect((await screen.findAllByText("Frontend Berlin")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" }));
    expect(await screen.findByText("Frontend ATS")).toBeInTheDocument();
    expect(screen.queryByText("CV-Suchprofil erstellen")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ Neues Suchprofil erstellen" }));
    expect(screen.getByText("CV-Suchprofil erstellen")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Frontend Berlin" } });
    expect(screen.getByText(/existiert bereits/)).toBeInTheDocument();
  });
});


describe("PersistentCvProfilesOverlay loading and hierarchy", () => {
  const cvProfile = (id: string, name: string) => ({
    schemaVersion: 1,
    searchProfileId: id,
    cvId: "cv-1",
    name,
    origin: "cv",
    searchConfig: {
      skills: "React, TypeScript",
      targetRoles: ["Frontend"],
      city: "Berlin",
      radiusKm: 25,
      workModes: ["remote"],
      employmentTypes: ["full_time"],
    },
    createdAt: "2026-11-09T10:00:00Z",
    updatedAt: "2026-11-09T10:00:00Z",
    version: 1,
  }) as never;

  it("shows a loading summary instead of an empty profile state", async () => {
    let resolveCv: ((value: never[]) => void) | undefined;
    const value = profiles({
      active: true,
      persistentView: true,
      listCv: vi.fn(() => new Promise<never[]>((resolve) => { resolveCv = resolve; })),
      listAts: vi.fn(async () => []),
    });
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay cvId="cv-1" cvName="Lebenslauf.pdf" profiles={value} onClose={vi.fn()} />
      </LangProvider>
    );

    expect(await screen.findByText("CV-Suchprofile und ATS-Profile werden geladen …")).toBeInTheDocument();
    expect(screen.queryByText("Noch kein dauerhaftes CV-Suchprofil.")).toBeNull();
    resolveCv?.([cvProfile("sp-1", "Frontend Berlin")]);
    expect(await screen.findByText("1 CV-Suchprofil · 0 ATS-Profile")).toBeInTheDocument();
  });

  it("shows an error with retry and keeps the loaded CV bound to its card", async () => {
    const listCv = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([cvProfile("sp-1", "Frontend Berlin")]);
    const value = profiles({
      active: true,
      persistentView: true,
      listCv,
      listAts: vi.fn(async () => []),
    });
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay cvId="cv-1" cvName="Lebenslauf.pdf" profiles={value} onClose={vi.fn()} />
      </LangProvider>
    );

    expect(await screen.findByText("Profile konnten nicht geladen werden.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Frontend Berlin")).toBeInTheDocument();
    expect(listCv).toHaveBeenCalledTimes(2);
  });

  it("keeps only one ATS area expanded at a time", async () => {
    const value = profiles({
      active: true,
      persistentView: true,
      listCv: vi.fn(async () => [
        cvProfile("sp-1", "Frontend Berlin"),
        cvProfile("sp-2", "Backend Berlin"),
      ]),
      listAts: vi.fn(async (id: string) => (id === "sp-1"
        ? [{
            schemaVersion: 1,
            atsSearchProfileId: "ats-1",
            searchProfileId: "sp-1",
            name: "Frontend ATS",
            targetRoles: ["Frontend"],
            skills: ["React"],
            createdAt: "2026-11-09T10:00:00Z",
            updatedAt: "2026-11-09T10:00:00Z",
            version: 1,
          }]
        : []) as never),
    });
    render(
      <LangProvider>
        <PersistentCvProfilesOverlay cvId="cv-1" cvName="Lebenslauf.pdf" profiles={value} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("Frontend Berlin");
    fireEvent.click(screen.getAllByRole("button", { name: "Zugehörige ATS-Profile anzeigen" })[0]);
    expect(await screen.findByText("Frontend ATS")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Zugehörige ATS-Profile anzeigen" })[0]);
    expect(await screen.findByText("Noch kein ATS-Profil zu diesem Suchprofil.")).toBeInTheDocument();
    expect(screen.queryByText("Frontend ATS")).toBeNull();
  });
});

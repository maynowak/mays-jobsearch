import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import { createManualSearchProfile } from "../lib/manualSearchProfiles";
import type { ManualSearchProfile } from "../lib/manualSearchProfiles";
import ManualSearchProfilesSection from "./ManualSearchProfilesSection";

const sampleProfile = (overrides: Partial<Parameters<typeof createManualSearchProfile>[0]> = {}) =>
  createManualSearchProfile({
    name: "AWS Cloud Engineer",
    description: "Independent profile",
    searchConfig: {
      skills: 'AWS, Terraform, "Cloud Architecture"',
      targetRoles: ["Cloud Engineer", "AWS Solutions Architect"],
      city: "Darmstadt",
      radiusKm: 50,
      workModes: ["remote", "hybrid"],
      employmentTypes: ["full_time"],
    },
    matchingPreferences: {
      requiredSkills: ["AWS", "Terraform"],
      preferredSkills: ["Python", "Cloud Architecture"],
      excludedTerms: ["Shift work"],
    },
    ...overrides,
  });

function renderSection(profiles: ManualSearchProfile[] = []) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onDuplicate = vi.fn();
  const onSearch = vi.fn();
  const view = render(
    <LangProvider>
      <ManualSearchProfilesSection
        profiles={profiles}
        onSave={onSave}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onSearch={onSearch}
      />
    </LangProvider>
  );
  return { ...view, onSave, onDelete, onDuplicate, onSearch };
}

describe("MAYS-SEARCH-PROFILE-MANUAL-01: Job preferences UI", () => {
  beforeEach(() => {
    localStorage.setItem("mj-lang", "de");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a manual search profile without any CV and without network calls", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { onSave } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));

    fireEvent.change(screen.getByLabelText("Profilname"), {
      target: { value: "AWS Cloud Engineer" },
    });
    fireEvent.change(screen.getByLabelText("Zielrollen"), {
      target: { value: "Cloud Engineer, AWS Solutions Architect" },
    });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), {
      target: { value: "AWS, Terraform, Docker" },
    });
    fireEvent.change(screen.getByLabelText("Erforderliche Kenntnisse"), {
      target: { value: "AWS\nTerraform" },
    });
    fireEvent.change(screen.getByLabelText("Gewünschte Kenntnisse"), {
      target: { value: "Python\nCloud Architecture" },
    });
    fireEvent.change(screen.getByLabelText("Ausschlüsse"), {
      target: { value: "Schichtarbeit" },
    });
    fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Darmstadt" } });

    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [draft, existingId] = onSave.mock.calls[0];
    expect(existingId).toBeNull();
    expect(draft.name).toBe("AWS Cloud Engineer");
    expect(draft.searchConfig.targetRoles).toEqual(["Cloud Engineer", "AWS Solutions Architect"]);
    expect(draft.searchConfig.city).toBe("Darmstadt");
    expect(draft.matchingPreferences).toEqual({
      requiredSkills: ["AWS", "Terraform"],
      preferredSkills: ["Python", "Cloud Architecture"],
      excludedTerms: ["Schichtarbeit"],
    });
    // Profilaktionen sind vollstaendig modell- und netzwerkfrei.
    expect(fetchSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("gespeichert");
    });
  });

  it("keeps required, preferred and excluded semantically separate", () => {
    const { onSave } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), { target: { value: "AWS" } });
    fireEvent.change(screen.getByLabelText("Erforderliche Kenntnisse"), {
      target: { value: "AWS\nTerraform" },
    });
    fireEvent.change(screen.getByLabelText("Gewünschte Kenntnisse"), {
      target: { value: "Python" },
    });
    fireEvent.change(screen.getByLabelText("Ausschlüsse"), { target: { value: "Nachtarbeit" } });

    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    const [draft] = onSave.mock.calls[0];
    expect(draft.matchingPreferences.requiredSkills).toEqual(["AWS", "Terraform"]);
    expect(draft.matchingPreferences.preferredSkills).toEqual(["Python"]);
    expect(draft.matchingPreferences.excludedTerms).toEqual(["Nachtarbeit"]);
  });

  it("keeps multi-word terms in the keyword round-trip", () => {
    const { onSave } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), {
      target: { value: 'Cloud Architecture, Machine Learning, "Amazon Web Services", C++, C#, .NET, CI/CD' },
    });

    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    const [draft] = onSave.mock.calls[0];
    expect(draft.searchConfig.skills).toBe(
      '"Cloud Architecture", "Machine Learning", "Amazon Web Services", C++, C#, .NET, CI/CD'
    );
  });

  it("shows validation errors instead of saving invalid drafts", () => {
    const { onSave } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    expect(screen.getByRole("alert").textContent).toBe("Bitte gib einen Profilnamen ein.");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Ohne Inhalt" } });
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Bitte ergänze mindestens eine Zielrolle oder ein Keyword."
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("edits an existing profile with its stable id", () => {
    const profile = sampleProfile();
    const { onSave } = renderSection([profile]);

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    expect((screen.getByLabelText("Profilname") as HTMLInputElement).value).toBe("AWS Cloud Engineer");
    expect((screen.getByLabelText("Erforderliche Kenntnisse") as HTMLTextAreaElement).value).toBe(
      "AWS\nTerraform"
    );

    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBe(profile.id);
    expect(onSave.mock.calls[0][0].name).toBe("Renamed");
  });

  it("shows an error and no success notice when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("save failed"));
    render(
      <LangProvider>
        <ManualSearchProfilesSection profiles={[]} onSave={onSave} onDelete={vi.fn()} onDuplicate={vi.fn()} onSearch={vi.fn()} />
      </LangProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Fail" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), { target: { value: "AWS" } });
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("konnte nicht gespeichert werden");
    });
    expect(screen.queryByText("Profil für diese Sitzung gespeichert.")).toBeNull();
  });

  it("keeps the form open and waits for a delayed save before reporting success", async () => {
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveSave = resolve;
      })
    );
    render(
      <LangProvider>
        <ManualSearchProfilesSection profiles={[]} onSave={onSave} onDelete={vi.fn()} onDuplicate={vi.fn()} onSearch={vi.fn()} />
      </LangProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Delayed" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), { target: { value: "AWS" } });
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    expect(screen.queryByText("Profil für diese Sitzung gespeichert.")).toBeNull();
    expect(screen.getByLabelText("Profilname")).toBeTruthy();

    resolveSave();
    await waitFor(() => {
      expect(screen.getByText("Profil für diese Sitzung gespeichert.")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Profilname")).toBeNull();
  });

  it("ignores a second save while the first request is pending", async () => {
    const onSave = vi.fn(() => new Promise<void>(() => undefined));
    render(
      <LangProvider>
        <ManualSearchProfilesSection profiles={[]} onSave={onSave} onDelete={vi.fn()} onDuplicate={vi.fn()} onSearch={vi.fn()} />
      </LangProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Once" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), { target: { value: "AWS" } });
    const save = screen.getByRole("button", { name: "Für diese Sitzung speichern" });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("duplicates, deletes (with confirmation) and searches", async () => {
    const profile = sampleProfile();
    const { onDuplicate, onDelete, onSearch } = renderSection([profile]);

    fireEvent.click(screen.getByRole("button", { name: "Duplizieren" }));
    expect(onDuplicate).toHaveBeenCalledWith(profile.id);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("dupliziert");
    });

    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Dieses Profil löschen?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Jetzt löschen" }));
    expect(onDelete).toHaveBeenCalledWith(profile.id);
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("gelöscht");
    });

    fireEvent.click(screen.getByRole("button", { name: "Damit suchen" }));
    expect(onSearch).toHaveBeenCalledWith(profile);
  });

  it("shows the session-only wording and the profile summary", () => {
    renderSection([sampleProfile()]);

    expect(screen.getAllByText("Nur diese Sitzung").length).toBeGreaterThan(0);
    expect(screen.getByText(/keine dauerhafte Kontospeicherung/)).toBeTruthy();
    expect(screen.getByText("Cloud Engineer · AWS Solutions Architect")).toBeTruthy();
    expect(screen.getByText("AWS · Terraform · Cloud Architecture")).toBeTruthy();
    // Keine erfundenen Prozentwerte / Scores.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders the English surface", () => {
    localStorage.setItem("mj-lang", "en");
    const { onSearch } = renderSection([sampleProfile()]);

    expect(screen.getByRole("heading", { name: "My search profiles" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Search with this profile" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when no manual profile exists", () => {
    renderSection();
    expect(screen.getByText(/Noch kein manuelles Suchprofil/)).toBeTruthy();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { JobsResponse, ModelsResponse } from "./types";

// MAYS-SEARCH-PROFILE-MANUAL-01: Integrationstests fuer
//  - manuelle Suchprofile im Dashboard ("Job-Praferenzen"),
//  - Uebergabe an den BESTEHENDEN Suchpfad (/api/jobs),
//  - Modellfreiheit der Profilaktionen,
//  - Session-Speicherung (Reload beendet die Sammlung),
//  - Ablehnung leerer PDFs im Mehrfach-Upload.

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    fetchJobs: vi.fn(),
    fetchMatches: vi.fn(),
    fetchModels: vi.fn(),
    fetchModel: vi.fn(),
    createProfile: vi.fn(),
    analyzeATS: vi.fn(),
  };
});

const authState = { isAuthenticated: true, sub: "profile-sub-123" };

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isLoading: false,
    error: undefined,
    isAuthenticated: authState.isAuthenticated,
    user: authState.isAuthenticated
      ? {
          profile: {
            sub: authState.sub,
            iss: "https://issuer.example",
            email: "profil@example.invalid",
            name: "Test Person",
          },
        }
      : undefined,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  }),
}));

const singleModel: ModelsResponse = {
  models: [{ id: "model-x", name: "Model X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

const jobsResponse: JobsResponse = {
  jobs: [
    {
      slug: "aws-job",
      title: "AWS Cloud Engineer",
      company_name: "Acme",
      location: ["Darmstadt"],
      remote: true,
      tags: ["aws", "terraform"],
      url: "https://example.com/job",
    },
  ],
};

async function setup() {
  const { fetchJobs, fetchMatches, fetchModels, createProfile, analyzeATS } = await import("./api");
  const { __resetModelsCacheForTests } = await import("./hooks/useAvailableModels");
  __resetModelsCacheForTests();
  vi.mocked(fetchModels).mockResolvedValue(singleModel);
  vi.mocked(fetchJobs).mockResolvedValue(jobsResponse);
  vi.mocked(fetchMatches).mockResolvedValue({ matches: [] });
  return { fetchJobs, fetchMatches, createProfile, analyzeATS };
}

async function renderAt(path: string) {
  const App = (await import("./App")).default;
  const { LangProvider } = await import("./i18n");
  window.history.pushState({}, "", path);
  return render(
    <LangProvider>
      <App />
    </LangProvider>
  );
}

function openPreferences() {
  fireEvent.click(screen.getByRole("button", { name: "Job-Präferenzen" }));
}

async function fillAndSaveProfile(name = "AWS Cloud Engineer") {
  fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
  fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Zielrollen"), {
    target: { value: "Cloud Engineer, AWS Solutions Architect" },
  });
  fireEvent.change(screen.getByLabelText("Skills / Keywords"), {
    target: { value: "AWS, Terraform" },
  });
  fireEvent.change(screen.getByLabelText("Erforderliche Kenntnisse"), {
    target: { value: "AWS\nTerraform" },
  });
  fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Darmstadt" } });
  fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));
  await waitFor(() => {
    expect(screen.getByText("Profil für diese Sitzung gespeichert.")).toBeTruthy();
  });
}

beforeEach(async () => {
  localStorage.setItem("mj-lang", "de");
  localStorage.removeItem("mj-lang");
  localStorage.setItem("mj-lang", "de");
  authState.isAuthenticated = true;
  authState.sub = "profile-sub-123";
  await setup();
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true });
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/search");
  vi.clearAllMocks();
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01: Dashboard und Suchintegration", () => {
  it("creates a manual profile without a CV and keeps every profile action model-free", async () => {
    const { fetchJobs, fetchMatches, createProfile, analyzeATS } = await import("./api");
    vi.mocked(fetchJobs).mockClear();
    vi.mocked(fetchMatches).mockClear();
    vi.mocked(createProfile).mockClear();
    vi.mocked(analyzeATS).mockClear();

    await renderAt("/profil");
    openPreferences();
    await fillAndSaveProfile();

    // Profil ist in der Session-Liste sichtbar.
    const list = document.querySelector(".dashboard-v2__manual-list") as HTMLElement;
    expect(within(list).getByText("AWS Cloud Engineer")).toBeTruthy();
    expect(screen.getByText("Profil für diese Sitzung gespeichert.")).toBeTruthy();

    // Duplizieren und Loeschen bleiben ebenfalls rein lokal.
    fireEvent.click(screen.getByRole("button", { name: "Duplizieren" }));
    await waitFor(() => {
      expect(screen.getByText("AWS Cloud Engineer (Kopie)")).toBeTruthy();
    });

    // Keine CV-Verarbeitung, kein Matching, kein Modellaufruf.
    expect(createProfile).not.toHaveBeenCalled();
    expect(analyzeATS).not.toHaveBeenCalled();
    expect(fetchMatches).not.toHaveBeenCalled();
    expect(fetchJobs).not.toHaveBeenCalled();
  });

  it("hands the profile to the existing search path with exactly one /api/jobs request", async () => {
    const { fetchJobs, fetchMatches, createProfile, analyzeATS } = await import("./api");
    vi.mocked(fetchJobs).mockClear();
    vi.mocked(fetchMatches).mockClear();

    await renderAt("/profil");
    openPreferences();
    await fillAndSaveProfile();

    fireEvent.click(screen.getByRole("button", { name: "Damit suchen" }));

    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(fetchJobs).mock.calls[0][0];
    expect(submitted.skills).toBe("AWS, Terraform");
    expect(submitted.targetRoles).toEqual(["Cloud Engineer", "AWS Solutions Architect"]);
    expect(submitted.city).toBe("Darmstadt");

    // Keine parallele/zweite Suche und kein automatisches AI-Matching.
    await waitFor(() => expect(window.location.pathname).toBe("/search"));
    expect(fetchJobs).toHaveBeenCalledTimes(1);
    expect(fetchMatches).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
    expect(analyzeATS).not.toHaveBeenCalled();

    // Die bestehende Suchmaske ist mit dem Profil vorbefuellt.
    const skillsInput = document.getElementById("skills") as HTMLInputElement;
    expect(skillsInput.value).toContain("AWS");
    expect((document.getElementById("city") as HTMLInputElement).value).toBe("Darmstadt");
  });

  it("keeps manual profiles independent from the CV profile lists", async () => {
    const { readCvProfileLists, resetCvProfileLists } = await import("./lib/cvProfileStore");
    resetCvProfileLists();

    await renderAt("/profil");
    openPreferences();
    await fillAndSaveProfile();

    // Kein CV-Bezug: die CV-Listen bleiben leer, es entsteht kein CV-Eintrag.
    expect(readCvProfileLists(null)).toEqual({ searchProfiles: [], atsProfiles: [] });
    const cvNav = screen.getByRole("button", { name: /Lebenslauf/ });
    fireEvent.click(cvNav);
    expect(screen.queryByText("AWS Cloud Engineer")).toBeNull();
  });

  it("clears CV hash buckets when the authenticated identity changes", async () => {
    const { readCvProfileLists, saveCvSearchProfile, resetCvProfileLists } = await import("./lib/cvProfileStore");
    resetCvProfileLists();
    const view = await renderAt("/profil");
    saveCvSearchProfile("hash-user-a", "User A profile", {
      skills: "AWS",
      targetRoles: ["Cloud Engineer"],
      city: "",
      radiusKm: null,
      workModes: [],
      employmentTypes: ["full_time"],
    });
    expect(readCvProfileLists("hash-user-a").searchProfiles).toHaveLength(1);

    authState.sub = "profile-sub-456";
    const App = (await import("./App")).default;
    const { LangProvider } = await import("./i18n");
    view.rerender(
      <LangProvider>
        <App />
      </LangProvider>
    );

    await waitFor(() => {
      expect(readCvProfileLists("hash-user-a").searchProfiles).toHaveLength(0);
    });
  });

  it("drops the in-memory profiles on a fresh session (reload)", async () => {
    const first = await renderAt("/profil");
    openPreferences();
    await fillAndSaveProfile();
    expect(document.querySelectorAll(".dashboard-v2__manual-item")).toHaveLength(1);

    first.unmount();
    await renderAt("/profil");
    openPreferences();
    expect(document.querySelectorAll(".dashboard-v2__manual-item")).toHaveLength(0);
    expect(screen.getByText(/Noch kein manuelles Suchprofil/)).toBeTruthy();
  });
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01 / CV-FILESIZE-DISPLAY-01: Upload-Guard", () => {
  async function addFiles(files: File[]) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
  }

  it("rejects an empty PDF in the multi upload of the dashboard CV section", async () => {
    await renderAt("/profil");
    fireEvent.click(screen.getByRole("button", { name: /Lebenslauf/ }));

    const empty = new File([], "leer.pdf", { type: "application/pdf" });
    await addFiles([empty]);

    expect(screen.getByText("Leere PDF-Dateien (0 Byte) wurden übersprungen.")).toBeTruthy();
    expect(screen.queryByText("leer.pdf")).toBeNull();
    // Kein Dokument wurde als verarbeitungsbereit aufgenommen.
    expect(document.querySelectorAll(".cv-document-list__item")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "PDF auswählen" })).toBeTruthy();
  });

  it("accepts a small valid PDF in the same multi upload", async () => {
    await renderAt("/profil");
    fireEvent.click(screen.getByRole("button", { name: /Lebenslauf/ }));

    const small = new File(["%PDF-1.4\n%tiny"], "klein.pdf", { type: "application/pdf" });
    await addFiles([small]);

    await waitFor(() => expect(screen.getAllByText("klein.pdf").length).toBeGreaterThan(0));
    expect(screen.getByText(`${small.size} B`)).toBeTruthy();
    expect(screen.queryByText("0,0 MB")).toBeNull();
  });

  it("rejects an empty PDF on the CV upload tab with an understandable message", async () => {
    await renderAt("/search");
    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));

    const empty = new File([], "leer.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [empty] } });

    expect(screen.getByRole("alert").textContent).toContain("leer (0 Byte)");
    expect(screen.queryByText("CV-Verarbeitung erlauben?")).toBeNull();
  });
});

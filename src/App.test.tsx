import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Job, MatchResponse, ModelsResponse, JobsResponse, SuggestedProfile, Profile } from "./types";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    fetchJobs: vi.fn(),
    fetchMatches: vi.fn(),
    fetchModels: vi.fn(),
    fetchModel: vi.fn(),
    createProfile: vi.fn(),
  };
});

vi.mock("./lib/pdf", () => ({
  extractPdfText: vi.fn(async () => "React Developer with five years of experience in Berlin"),
}));

import {
  ApiError,
  createProfile,
  fetchJobs,
  fetchMatches,
  fetchModels,
  setFallbackMaxAttempts,
} from "./api";
import App from "./App";
import { LangProvider } from "./i18n";
import { __resetModelsCacheForTests } from "./hooks/useAvailableModels";

function baseProfile(overrides: Partial<Pick<Profile, "skills" | "targetRole" | "city" | "radiusKm" | "workModes" | "employmentTypes">> = {}): Profile {
  return {
    skills: "",
    targetRole: "",
    city: "",
    radiusKm: null,
    workModes: [],
    employmentTypes: ["full_time"],
    ...overrides,
  };
}

const job: Job = {
  slug: "aws-job",
  title: "AWS Engineer",
  company_name: "Acme",
  location: ["Berlin"],
  remote: false,
  tags: ["aws"],
  url: "https://example.com/job",
};

const jobB: Job = {
  slug: "java-job",
  title: "Java Engineer",
  company_name: "Beta",
  location: ["Frankfurt"],
  remote: false,
  tags: ["java"],
  url: "https://example.com/job-b",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderApp() {
  return render(
    <LangProvider>
      <App />
    </LangProvider>
  );
}

const singleModel: ModelsResponse = {
  models: [{ id: "model-x", name: "Model X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

const multiModels: ModelsResponse = {
  models: [
    { id: "m-a", name: "Modell A" },
    { id: "m-b", name: "Modell B" },
  ],
  defaultModel: "m-a",
  fallbackModel: null,
  recommendedModel: null,
};

const matchOk = {
  matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
} as MatchResponse;

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  window.history.pushState({}, "", "/top");
  __resetModelsCacheForTests();
  setFallbackMaxAttempts(3);
  vi.mocked(fetchJobs).mockReset();
  vi.mocked(fetchMatches).mockReset();
  vi.mocked(fetchModels).mockReset();
  vi.mocked(createProfile).mockReset();
  vi.mocked(fetchModels).mockResolvedValue(singleModel);
  vi.mocked(fetchMatches).mockResolvedValue(matchOk);
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true });
  globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined));
});

afterEach(() => {
  cleanup();
});

const modelTrigger = () => document.querySelector(".model-trigger") as HTMLButtonElement;
const matchBtn = () => document.getElementById("match-btn") as HTMLButtonElement | null;
const findBtn = () => document.getElementById("find-btn") as HTMLButtonElement;

async function waitForModelsReady() {
  await waitFor(() => {
    const trigger = modelTrigger();
    expect(trigger && !trigger.disabled).toBe(true);
  });
}

describe("Explizites AI-Matching nach Jobsuche (Step 22)", () => {
  describe("A: Jobsuche zeigt Jobs ohne automatisches Matching", () => {
    it("ruft nur /api/jobs auf, nicht /api/match", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");

      expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetchMatches)).not.toHaveBeenCalled();
    });

    it("zeigt gefundene Jobs sofort an", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job, jobB], meta: { totalFiltered: 2 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      await screen.findByText("Java Engineer");

      expect(screen.getByText("AWS Engineer")).toBeTruthy();
      expect(screen.getByText("Java Engineer")).toBeTruthy();
    });
  });

  describe("B: Nach erfolgreicher Jobsuche wurde /api/match NICHT automatisch aufgerufen", () => {
    it("fetchMatches wird nicht aufgerufen, bis 'Mit KI bewerten' geklickt wird", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");

      expect(vi.mocked(fetchMatches)).not.toHaveBeenCalled();
    });
  });

  describe("C: 'Mit KI bewerten' löst explizit /api/match aus", () => {
    it("zeigt 'Mit KI bewerten' Button nach erfolgreicher Jobsuche", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      expect(screen.getByText("Mit KI bewerten")).toBeTruthy();
    });

    it("Klick auf 'Mit KI bewerten' ruft fetchMatches auf", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText("AWS Engineer");
      expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(1);
    });

    it("während des Matchings ist der Button deaktiviert und zeigt 'Bewerte mit KI…'", async () => {
      const matches = deferred<MatchResponse>();
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches).mockReturnValue(matches.promise);
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      const matchButtons = screen.getAllByRole("button", { name: "Bewerte mit KI…" });
      expect(matchButtons.length).toBeGreaterThan(0);
      matchButtons.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(true));

      matches.resolve(matchOk);
      await screen.findByText("AWS Engineer");
    });
  });

  describe("D: Das bestehende Dataset wird für das Matching verwendet", () => {
    it("fetchMatches erhält die Jobs aus der vorherigen Jobsuche", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job, jobB], meta: { totalFiltered: 2 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText("AWS Engineer");

      const lastCall = vi.mocked(fetchMatches).mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual([job, jobB]);
    });

    it("Profil-Daten aus der Jobsuche werden für Matching verwendet", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Engineer" } });
      fireEvent.change(screen.getByLabelText("Stadt oder PLZ"), { target: { value: "Berlin" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText("AWS Engineer");

      const lastCall = vi.mocked(fetchMatches).mock.calls.at(-1)!;
      expect(lastCall[0].skills).toBe("aws");
      expect(lastCall[0].targetRole).toBe("Engineer");
      expect(lastCall[0].city).toBe("Berlin");
    });
  });

  describe("E: Beim Matching wird /api/jobs NICHT erneut aufgerufen", () => {
    it("fetchJobs wird nur einmal aufgerufen, auch bei Matching", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      const jobsCallsAfterSearch = vi.mocked(fetchJobs).mock.calls.length;

      fireEvent.click(screen.getByText("Mit KI bewerten"));
      await screen.findByText("AWS Engineer");

      expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsCallsAfterSearch);
    });
  });

  describe("F: foundJobs bleiben während des Matchings sichtbar", () => {
    it("Jobs bleiben sichtbar während 'Mit KI bewerten' läuft", async () => {
      const matches = deferred<MatchResponse>();
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches).mockReturnValue(matches.promise);
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      expect(screen.getByText("AWS Engineer")).toBeTruthy();

      fireEvent.click(screen.getByText("Mit KI bewerten"));

      expect(screen.getByText("AWS Engineer")).toBeTruthy();

      matches.resolve(matchOk);
      await screen.findByText("AWS Engineer");
    });
  });

  describe("G: AI-Fehler löschen foundJobs nicht", () => {
    it("bei Model-Fehler bleiben die gefundenen Jobs erhalten", async () => {
      vi.mocked(fetchModels).mockResolvedValue(singleModel);
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches).mockRejectedValue(new ApiError("unavailable", 502, "model_unavailable"));
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText(/nicht verfügbar/);
      expect(screen.getByText("AWS Engineer")).toBeTruthy();
    });

    it("bei Quota-Fehler bleiben die gefundenen Jobs erhalten", async () => {
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches).mockRejectedValue(new ApiError("quota", 429, "free_quota_exceeded"));
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText(/aufgebraucht/);
      expect(screen.getByText("AWS Engineer")).toBeTruthy();
    });
  });

  describe("H: Der Matching-Button verhindert parallele Matching-Aufrufe", () => {
    it("Button ist während Matching deaktiviert, keine doppelten Requests", async () => {
      const matches = deferred<MatchResponse>();
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches).mockReturnValue(matches.promise);
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      expect(matchBtn()?.disabled).toBe(true);

      fireEvent.click(matchBtn()!);
      expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(1);

      matches.resolve(matchOk);
      await screen.findByText("AWS Engineer");
    });
  });

  describe("I: Model-Retry bleibt /api/match-only", () => {
    it("Modellwechsel nach Fehler ruft nur fetchMatches, nicht fetchJobs", async () => {
      vi.mocked(fetchModels).mockResolvedValue(multiModels);
      vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
      vi.mocked(fetchMatches)
        .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
        .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
        .mockResolvedValueOnce(matchOk);
      renderApp();
      await waitForModelsReady();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText(/nicht verfügbar/);

      fireEvent.click(modelTrigger());
      fireEvent.click(screen.getByRole("option", { name: "Modell B" }));
      fireEvent.click(screen.getByText("Mit KI bewerten"));

      await screen.findByText("AWS Engineer");

      expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(3);
      const lastCall = vi.mocked(fetchMatches).mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual([job]);
      expect(lastCall[2]).toBe("m-b");
    });

    it("Suchparameteränderung invalidiert Dataset - neue Suche nötig", async () => {
      vi.mocked(fetchModels).mockResolvedValue(multiModels);
      vi.mocked(fetchJobs)
        .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
        .mockResolvedValueOnce({ jobs: [jobB], meta: { totalFiltered: 1 } });
      renderApp();
      await waitForModelsReady();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
      expect(screen.getByText("Meine Treffer finden")).toBeTruthy();
      expect(screen.queryByText("Mit KI bewerten")).toBeNull();

      fireEvent.click(screen.getByText("Meine Treffer finden"));
      await screen.findByText("Java Engineer");

      expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Suchparameter-Erweiterung (Lifecycle, Step 7)", () => {
  it("13: Änderung Umkreis invalidiert Dataset -> manuelle neue Suche mit /api/jobs", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].radiusKm).toBe(10);

    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "25" } });
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before + 1);
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0].radiusKm).toBe(25);
  });

  it("14: Änderung Arbeitsmodell invalidiert Dataset und wird an /api/jobs übergeben", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByLabelText("Remote"));
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].workModes).toEqual(["remote"]);

    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.click(screen.getByLabelText("Remote"));
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before + 1);
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0].workModes).toEqual([]);
  });

  it("15: Änderung Arbeitszeit invalidiert Dataset", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByLabelText("Teilzeit"));
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].employmentTypes).toEqual(["full_time", "part_time"]);

    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.click(screen.getByLabelText("Teilzeit"));
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before + 1);
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0].employmentTypes).toEqual(["full_time"]);
  });
});

describe("Footer im App-Layout (Regression)", () => {
  it("Footer wird im Matcher-Layout gerendert und zeigt die Build-Identität", () => {
    renderApp();
    const footer = document.querySelector(".footer");
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain("Version");
  });

  it("Footer zeigt Version aus package.json und kein hartcodiertes Label", () => {
    renderApp();
    const footer = document.querySelector(".footer-version");
    expect(footer?.textContent).toContain("Version");
  });
});

describe("CV workflow", () => {
  it("CV Upload -> Profil -> anschließende Jobsuche", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    const file = new File(
      ["React Developer with five years of experience in Berlin"],
      "cv.pdf",
      { type: "application/pdf" }
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Dein vorgeschlagenes Suchprofil");
    fireEvent.click(screen.getByText("Profil übernehmen und Jobs finden"));

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledWith(
      baseProfile({ skills: "React", targetRole: "Frontend", city: "Berlin" })
    );

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");

    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("React");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt oder PLZ") as HTMLInputElement).value).toBe("Berlin");
  });
});

describe("No landing-page flash during a search", () => {
  it("Initialzustand: Search-Hero wird angezeigt, keine Landingpage", () => {
    renderApp();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeNull();
  });

  it("Bug-Regression: runSearch -> phase=searching -> Landingpage NICHT gerendert", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect(window.location.pathname).toBe("/top");

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".layout-split")).toBeTruthy();
  });

  it("Scoring (foundJobs gesetzt, Matches ausstehend): Suchansicht bleibt, kein Hero-/Ergebnis-Wechsel", async () => {
    const jobs = deferred<JobsResponse>();
    const matches = deferred<MatchResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(fetchMatches).mockReturnValue(matches.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    // Explizites Matching wird durch "Mit KI bewerten" gestartet, nicht automatisch
    // Nach Suche: Ergebnisse sofort sichtbar (layout-split), search-hero ausgeblendet
    await screen.findByText("AWS Engineer");
    expect(screen.getByText("Mit KI bewerten")).toBeTruthy();

    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeNull();
    // Der kompakte Ergebnis-Hero (header.hero) gehört zur Ergebnisansicht und ist korrekt sichtbar
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    matches.resolve({
      matches: [{ score: 90, why: "gut", prepare: "Bereite dich vor", job }],
    } as MatchResponse);
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".layout-split")).toBeTruthy();
    expect(document.querySelector(".search-hero")).toBeNull();
  });

  it("Fehler: keine Landingpage, Werte bleiben erhalten", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobs.reject(new Error("boom"));
    await screen.findByText("boom");

    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
  });

  it("0 AI-Evaluation: kein Landing-Rücksprung, Zero-Evaluation-UX wird gezeigt", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockResolvedValue({
      matches: [],
      meta: { note: "Keine KI-Bewertung verfügbar." },
    } as MatchResponse);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    await screen.findByText(/konnten aber gerade nicht per KI bewertet werden/);

    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".layout-split")).toBeTruthy();
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
  });

  it("CV-Suche: kein Landing-Flicker während der Suche", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    const file = new File(
      ["React Developer with five years of experience in Berlin"],
      "cv.pdf",
      { type: "application/pdf" }
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Dein vorgeschlagenes Suchprofil");
    fireEvent.click(screen.getByText("Profil übernehmen und Jobs finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect(window.location.pathname).toBe("/top");

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".landing")).toBeNull();
  });
});

describe("Old results / Search Clearing A-G (neue Semantik: sofortiges Leeren beim Suchstart)", () => {
  async function runSearchA() {
    vi.mocked(fetchJobs).mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".layout-split")).toBeTruthy();
  }

  it("Test A: Neue Suche invalidiert alte Ergebnisse sofort", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Java Engineer")).toBeNull());
  });

  it("Test B: Neue Suche erfolgreich -> Ergebnisse B ersetzen A", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    vi.mocked(fetchMatches).mockResolvedValueOnce({
      matches: [{ score: 80, why: "gut", prepare: "Frage", job: jobB }],
    } as MatchResponse);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
  });

  it("Test C: Neue Suche schlägt fehl -> alte Ergebnisse werden entfernt", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobsB.reject(new Error("boom"));
    await screen.findByText("boom");

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Java Engineer")).toBeNull());
    expect(document.querySelector(".layout-split")).toBeFalsy();
    expect(document.querySelector(".landing")).toBeNull();
  });

  it("Test D: Neue Suche mit 0 AI-Evaluation -> erst nach Abschluss Zero-Evaluation von B", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    vi.mocked(fetchMatches).mockResolvedValueOnce({
      matches: [],
      meta: { note: "Keine KI-Bewertung verfügbar." },
    } as MatchResponse);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    expect(screen.getByText(/konnten aber gerade nicht per KI bewertet werden/)).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();
  });

  it("Test E: SearchForm zeigt B, Results zeigt währenddessen nichts (altes A entfernt)", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("java");
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Java Engineer")).toBeNull());
  });

  it("Test F: CV-Suche während Ergebnisse A sichtbar -> A wird sofort entfernt", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    vi.mocked(fetchMatches).mockResolvedValueOnce({
      matches: [{ score: 80, why: "gut", prepare: "Frage", job: jobB }],
    } as MatchResponse);
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["Java"],
      experienceLevel: "Senior",
      targetRoles: ["Backend"],
      location: "Frankfurt",
    } as SuggestedProfile);

    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    const file = new File(
      ["React Developer with five years of experience in Berlin"],
      "cv.pdf",
      { type: "application/pdf" }
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("Dein vorgeschlagenes Suchprofil");
    fireEvent.click(screen.getByText("Profil übernehmen und Jobs finden"));

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    expect(document.querySelector(".layout-split")).toBeFalsy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
  });

  it("Test G: Model-Fallback während Matching B -> alte Ergebnisse bereits entfernt", async () => {
    vi.mocked(fetchModels).mockResolvedValue({
      models: [
        { id: "m-a", name: "Modell A" },
        { id: "m-b", name: "Modell B" },
        { id: "m-c", name: "Modell C" },
      ],
      defaultModel: "m-a",
      fallbackModel: null,
      recommendedModel: null,
    } as ModelsResponse);
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    const attempt1 = deferred<MatchResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    vi.mocked(fetchMatches)
      .mockReturnValueOnce(attempt1.promise)
      .mockResolvedValueOnce({
        matches: [{ score: 80, why: "gut", prepare: "Frage", job: jobB }],
      } as MatchResponse);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    expect(screen.getByText("Mit KI bewerten")).toBeTruthy();

    // Layout-split ist nach erfolgreicher Suche B sichtbar
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    expect(document.querySelector(".layout-split")).toBeTruthy();

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    // Während des Matchings bleibt Layout sichtbar
    expect(document.querySelector(".layout-split")).toBeTruthy();

    // Model-Fallback: erster Versuch schlägt fehl
    attempt1.reject(new ApiError("unavailable", 502, "model_unavailable"));
    // Zweiter Versuch (Fallback) löst sich auf
    await screen.findByText("Java Engineer");
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
  });
});

describe("UX-/Datenquellen-Runde: Tests E, F, G, K, L, M", () => {
  const modelTrigger = () => document.querySelector(".model-trigger") as HTMLButtonElement;

  async function waitForModelsReady() {
    await waitFor(() => {
      const trigger = modelTrigger();
      expect(trigger && !trigger.disabled).toBe(true);
    });
  }

  async function runSearchA() {
    vi.mocked(fetchJobs).mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".layout-split")).toBeTruthy();
  }

  it("Test E: Modellauswahl ist während der Suche deaktiviert", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();
    await waitForModelsReady();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(modelTrigger().disabled).toBe(true);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
  });

  it("Test F: Modellauswahl ist während der KI-Bewertung deaktiviert", async () => {
    const jobs = deferred<JobsResponse>();
    const matches = deferred<MatchResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(fetchMatches).mockReturnValue(matches.promise);
    renderApp();
    await waitForModelsReady();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
    expect(screen.getByText("Mit KI bewerten")).toBeTruthy();

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));
    expect(modelTrigger().disabled).toBe(true);

    matches.resolve({
      matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
    } as MatchResponse);
    await screen.findByText("AWS Engineer");
  });

  it("Test G: Modellauswahl ist nach Abschluss wieder aktiv", async () => {
    await runSearchA();
    expect(modelTrigger().disabled).toBe(false);
  });

  it("Test K: OpenRouter 429 free-models-per-day -> spezifische freundliche Meldung", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("quota", 429, "free_quota_exceeded"));
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    await screen.findByText(/Die kostenlosen KI-Anfragen für heute sind aufgebraucht/);
    expect(screen.getByText(/Die kostenlosen KI-Anfragen für heute sind aufgebraucht/)).toBeTruthy();
  });

  it("Test L: normales model_unavailable -> bestehende Fallback-/Fehlerlogik bleibt intakt", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("unavailable", 502, "model_unavailable"));
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);
    expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(1);
  });

  it("Test M: Erweitern der gefundenen Jobs löst KEINE zusätzlichen Requests aus", async () => {
    vi.mocked(fetchJobs).mockResolvedValueOnce({
      jobs: [job, jobB],
      meta: { totalFiltered: 2 },
    });
    vi.mocked(fetchMatches).mockResolvedValueOnce({
      matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
    } as MatchResponse);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    // Explizites Matching durchführen
    fireEvent.click(screen.getByText("Mit KI bewerten"));
    await screen.findByText("AWS Engineer");

    const jobsCalls = vi.mocked(fetchJobs).mock.calls.length;
    const matchCalls = vi.mocked(fetchMatches).mock.calls.length;

    // Button für "Weitere gefundene Jobs ansehen" finden (via querySelector auf Klasse)
    const expandBtn = document.querySelector(".results-remaining-toggle") as HTMLButtonElement;
    expect(expandBtn).toBeTruthy();
    expandBtn.click();
    await waitFor(() => expect(screen.getByText("Java Engineer")).toBeTruthy());

    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsCalls);
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(matchCalls);
  });
});

describe("Suchparameter-Erweiterung (Lifecycle, Step 7)", () => {
  const twoModels: ModelsResponse = {
    models: [
      { id: "m-a", name: "Modell A" },
      { id: "m-b", name: "Modell B" },
    ],
    defaultModel: "m-a",
    fallbackModel: null,
    recommendedModel: null,
  };

  const modelTrigger = () => document.querySelector(".model-trigger") as HTMLButtonElement;
  const findBtn = () => document.getElementById("find-btn") as HTMLButtonElement;

  async function waitForModelsReady() {
    await waitFor(() => {
      const trigger = modelTrigger();
      expect(trigger && !trigger.disabled).toBe(true);
    });
  }

  function fillSkills(value = "aws") {
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value } });
  }

  it("16: Änderung von Skills invalidiert weiterhin das Dataset", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [jobB], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches)
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Bereite dich vor", job }],
      } as MatchResponse)
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Bereite dich vor", job: jobB }],
      } as MatchResponse);
    renderApp();

    fillSkills();
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(findBtn());
    await screen.findByText("Java Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(2);
    expect(vi.mocked(fetchJobs).mock.calls[1][0].skills).toBe("java");
  });

  it("17/18: neue Suche bleibt manuell und darf /api/jobs verwenden", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fillSkills();
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "50" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "100" } });
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before + 1);
  });

it("19/20/21: Modellwechsel invalidiert Dataset NICHT und löst kein /api/jobs/Apify aus", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockResolvedValue({
      matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
    } as MatchResponse);
    renderApp();
    await waitForModelsReady();

    fillSkills();
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    const jobsBefore = vi.mocked(fetchJobs).mock.calls.length;
    const matchesBefore = vi.mocked(fetchMatches).mock.calls.length;
    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));

    // Modellwahl allein -> kein /api/jobs (=> kein Apify), kein Auto-Match
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsBefore);
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(matchesBefore);

    // manueller Retry über "Mit KI bewerten" -> vorhandenes Dataset, kein neues /api/jobs
    fireEvent.click(screen.getByText("Mit KI bewerten"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsBefore);
  });

  it("22: manueller Retry verwendet vorhandenes Dataset (exakte Jobs + Modell)", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches)
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
      } as MatchResponse);
    renderApp();
    await waitForModelsReady();

    fillSkills();
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    // Modell wechseln
    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));

    // Erneut "Mit KI bewerten" klicken -> Match-only auf vorhandenem Dataset
    fireEvent.click(screen.getByText("Mit KI bewerten"));
    await screen.findByText("AWS Engineer");

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    const calls = vi.mocked(fetchMatches).mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[2][0].radiusKm).toBe(10);
    expect(calls[2][1]).toEqual([job]);
    expect(calls[2][2]).toBe("m-b");
  });

  it("24: UI-Locking -- neue Suchparameter sind während der Suche gesperrt", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fillSkills();
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect((screen.getByLabelText("Umkreis") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Remote") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Hybrid") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Vor Ort") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Vollzeit") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Teilzeit") as HTMLInputElement).disabled).toBe(true);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
    expect((screen.getByLabelText("Umkreis") as HTMLSelectElement).disabled).toBe(false);
  });
});
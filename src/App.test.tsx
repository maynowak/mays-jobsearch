import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Job, JobsResponse, MatchResponse, ModelsResponse, SuggestedProfile } from "./types";

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

const models: ModelsResponse = {
  models: [{ id: "model-x", name: "X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  window.history.pushState({}, "", "/top");
  __resetModelsCacheForTests();
  setFallbackMaxAttempts(3);
  vi.mocked(fetchJobs).mockReset();
  vi.mocked(fetchMatches).mockReset();
  vi.mocked(fetchModels).mockReset();
  vi.mocked(createProfile).mockReset();
  vi.mocked(fetchModels).mockResolvedValue(models);
  vi.mocked(fetchMatches).mockResolvedValue({
    matches: [{ score: 90, why: "gut", prepare: "Bereite dich vor", job }],
  } as MatchResponse);
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true });
  // OpenPLZ never resolves -> no late state updates from the city autocomplete
  globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined));
});

afterEach(() => {
  cleanup();
});

describe("Search values persist across the search lifecycle", () => {
  it("behält Skills, Zielrolle und Stadt während des Ladens und nach erfolgreicher Suche", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Frontend" } });
    fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    // Loading state (phase = searching): values must stay visible
    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");

    // After results are rendered the values must still be present
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");
  });

  it("behält die Werte nach einem API-Fehler", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Frontend" } });
    fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobs.reject(new Error("boom"));
    await screen.findByText("boom");

    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");
  });

  it("remountet die SearchForm beim Wechsel zur Ergebnisdarstellung – Werte bleiben erhalten", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    const formBefore = document.getElementById("search-form");
    expect(formBefore?.closest(".search-hero")).toBeTruthy();

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");

    const formAfter = document.getElementById("search-form");
    expect(formAfter?.closest(".sidebar")).toBeTruthy();
    expect(formAfter).not.toBe(formBefore);
    expect(formBefore?.isConnected).toBe(false);
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
  });
});

describe("CV workflow", () => {
  it("bleibt funktionsfähig und Werte bleiben nach einer CV-Suche erhalten", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);

    renderApp();

    // Manual values survive switching to the CV tab and back
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    expect(screen.getByText("Lebenslauf hier ablegen")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Manuell eingeben" }));
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");

    // Upload a PDF -> suggested profile -> confirm
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

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledWith({
      skills: "React",
      targetRole: "Frontend",
      city: "Berlin",
    });

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");

    // After the remount the CV-derived profile is shown in the manual form
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("React");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");
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

    // phase === "searching"
    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    // the pathname must not change while a search is running
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
    await screen.findByText("Bewerte deine Treffer mit KI…");

    // While the model call runs the app must stay on the search UI,
    // not flip to the sparse results hero (the observed "landing flash").
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-hero")).toBeTruthy();
    expect(document.querySelector(".hero")).toBeNull();
    expect(document.querySelector(".layout-split")).toBeNull();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");

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

describe("Old results stay visible while a new search is running", () => {
  async function runSearchA() {
    vi.mocked(fetchJobs).mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".layout-split")).toBeTruthy();
  }

  it("Test A: Ergebnisse A bleiben sichtbar, während Suche B läuft (kein leerer Bereich/Hero/Landing)", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    // Neue Suche läuft, Ergebnisse A bleiben sichtbar, Layout bleibt die Ergebnisansicht
    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();
    expect(document.querySelector(".search-hero")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".landing")).toBeNull();
    // Der kompakte Ergebnis-Hero (header.hero) gehört zur Ergebnisansicht und ist korrekt sichtbar
    expect(document.querySelector(".hero")).toBeTruthy();
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

    expect(screen.getByText("AWS Engineer")).toBeTruthy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    expect(screen.queryByText("AWS Engineer")).toBeNull();
    expect(document.querySelector(".layout-split")).toBeTruthy();
  });

  it("Test C: Neue Suche schlägt fehl -> A bleibt sichtbar + Fehlermeldung", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    jobsB.reject(new Error("boom"));
    await screen.findByText("boom");

    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();
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

    // Solange B läuft: A bleibt sichtbar
    expect(screen.getByText("AWS Engineer")).toBeTruthy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");

    expect(screen.queryByText("AWS Engineer")).toBeNull();
    expect(screen.getByText(/konnten aber gerade nicht per KI bewertet werden/)).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();
  });

  it("Test E: SearchForm zeigt B, Results zeigt währenddessen A", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("java");
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(screen.queryByText("Java Engineer")).toBeNull();
  });

  it("Test F: CV-Suche während Ergebnisse A sichtbar -> A bleibt bis zum Abschluss", async () => {
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

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    expect(screen.queryByText("AWS Engineer")).toBeNull();
  });

  it("Test G: Model-Fallback während Suche B -> A bleibt sichtbar, Spinner aktiv", async () => {
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
    vi.mocked(fetchMatches).mockReturnValueOnce(attempt1.promise);
    vi.mocked(fetchMatches).mockResolvedValueOnce({
      matches: [{ score: 80, why: "gut", prepare: "Frage", job: jobB }],
    } as MatchResponse);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("AWS Engineer")).toBeTruthy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Bewerte deine Treffer mit KI…");

    // Während des (potenziell mehrstufigen) Model-Calls bleibt A sichtbar
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(document.querySelector(".layout-split")).toBeTruthy();

    attempt1.reject(new ApiError("unavailable", 502, "model_unavailable"));
    await screen.findByText("Java Engineer");
    expect(screen.queryByText("AWS Engineer")).toBeNull();
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
    await screen.findByText("Bewerte deine Treffer mit KI…");
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

  it("Test K: OpenRouter 429 free-models-per-day → spezifische freundliche Meldung", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("quota", 429, "free_quota_exceeded"));
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    await screen.findByText(/kostenlosen KI-Anfragen für heute sind aufgebraucht/);
    expect(screen.getByText(/kostenlosen KI-Anfragen für heute sind aufgebraucht/)).toBeTruthy();
  });

  it("Test L: normales model_unavailable → bestehende Fallback-/Fehlerlogik bleibt intakt", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("unavailable", 502, "model_unavailable"));
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    // Mit dem Ein-Modell-Katalog bleibt nur ein Versuch übrig -> bestehende Fehlermeldung
    await screen.findByText(/momentan nicht verfügbar/);
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

    const jobsCalls = vi.mocked(fetchJobs).mock.calls.length;
    const matchCalls = vi.mocked(fetchMatches).mock.calls.length;

    fireEvent.click(screen.getByText("Weitere gefundene Jobs ansehen →"));
    expect(screen.getByText("Java Engineer")).toBeTruthy();

    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsCalls);
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(matchCalls);
  });
});

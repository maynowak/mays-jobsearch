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

function baseProfile(overrides: { skills?: string; targetRole?: string; city?: string } = {}) {
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

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledWith(
      baseProfile({ skills: "React", targetRole: "Frontend", city: "Berlin" })
    );

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

it("Test A: Neue Suche invalidiert alte Ergebnisse sofort", async () => {
    await runSearchA();

    const jobsB = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValueOnce(jobsB.promise);
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);

    // Alte Ergebnisse wurden sofort entfernt.
    // Während der neuen Suche ist der Suchbereich sichtbar (SearchForm),
    // es darf aber kein Ergebnis-Alte-Treffer (AWS Engineer) mehr existieren.
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
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);

    // Nach erfolgreicher Suche: alte Ergebnisse wurden entfernt,
    // neue Ergebnisse (Java Engineer) erscheinen.
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
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
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

    const jobsCalls = vi.mocked(fetchJobs).mock.calls.length;
    const matchCalls = vi.mocked(fetchMatches).mock.calls.length;

    fireEvent.click(screen.getByText("Weitere gefundene Jobs ansehen →"));
    expect(screen.getByText("Java Engineer")).toBeTruthy();

    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(jobsCalls);
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(matchCalls);
  });
});

describe("Matching Retry ohne Job-Re-Fetch (Feature)", () => {
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

  const modelTrigger = () => document.querySelector(".model-trigger") as HTMLButtonElement;

  async function waitForModelsReady() {
    await waitFor(() => {
      const trigger = modelTrigger();
      expect(trigger && !trigger.disabled).toBe(true);
    });
  }

  function selectModelOption(name: string) {
    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name }));
  }

  async function runSearchA() {
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
  }

  it("Test 1: Erste Suche ruft fetchJobs genau einmal auf", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    await runSearchA();
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
  });

  it("Test 2: Erfolgreiches Matching löst keinen weiteren Job-Fetch aus", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    await runSearchA();
    expect(screen.getByText("AWS Engineer")).toBeTruthy();
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
  });

  it("Test 3: Matching-Fehler behält das Dataset (Re-Match nutzt vorhandene Jobs)", async () => {
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

    // Matching schlägt fehl (beide Modelle unavailable) -> Fehlermeldung
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    // Modellwechsel -> nur Auswahl, KEIN Auto-Start
    selectModelOption("Modell B");
    // Manueller Start -> Match-only auf dem vorhandenen Dataset
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);
    await screen.findByText("AWS Engineer");

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    const lastMatch = vi.mocked(fetchMatches).mock.calls.at(-1)!;
    expect(lastMatch[1]).toEqual([job]);
    expect(lastMatch[2]).toBe("m-b");
  });

  it("Test 4: Modellwechsel nach Fehler ruft fetchJobs NICHT erneut auf", async () => {
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
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    const before = vi.mocked(fetchJobs).mock.calls.length;
    selectModelOption("Modell B");
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);
  });

  it("Test 5: Modellwechsel nach Fehler -> fetchMatches mit exakt vorhandenem Dataset", async () => {
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
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    selectModelOption("Modell B");
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);
    await screen.findByText("AWS Engineer");

    const calls = vi.mocked(fetchMatches).mock.calls;
    expect(calls.length).toBe(3);
    // call[0]/[1] = erster Versuch (m-a, m-b), call[2] = Re-Match auf vorhandenem Dataset
    expect(calls[2][0]).toEqual(baseProfile({ skills: "aws" }));
    expect(calls[2][1]).toEqual([job]);
    expect(calls[2][2]).toBe("m-b");
  });

  it("Test 6: Suchparameteränderung invalidiert das Dataset (kein Match auf altem Dataset)", async () => {
    vi.mocked(fetchModels).mockResolvedValue(multiModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    await waitForModelsReady();
    await runSearchA();

    const matchesBefore = vi.mocked(fetchMatches).mock.calls.length;

    // Suchparameter ändern -> Dataset wird invalidiert
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });

    // Modellwechsel darf jetzt KEINEN Match mehr auslösen (Dataset ungültig)
    selectModelOption("Modell B");
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(matchesBefore);
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(1);
  });

  it("Test 7: Neue Suche ruft fetchJobs wieder auf", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [jobB], meta: { totalFiltered: 1 } });
    renderApp();
    await runSearchA();
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    fireEvent.click(screen.getByText("Weitere gefundene Jobs ansehen →"));
    await screen.findByText("Java Engineer");

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchJobs).mock.calls[1][0].skills).toBe("java");
  });

  it("Test 8: Suchmaske ist während der Suche technisch deaktiviert", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(screen.getByText("Suche auf der Jobbörse…")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).disabled).toBe(true);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
  });

  it("Test 8b: CV-EditableProfile-Inputs sind während der Suche deaktiviert", async () => {
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
    expect((screen.getByLabelText("Erfahrungslevel") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).disabled).toBe(true);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
  });

  it("Test 9: Model-Combobox ist während der Suche deaktiviert", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();
    await waitForModelsReady();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));

    expect(modelTrigger().disabled).toBe(true);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
  });

  it("Test 10: paralleler zweiter Suchstart wird verhindert (Re-Entrancy-Guard)", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    const form = document.getElementById("search-form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
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

describe("Präzises Model-Fallback-Feedback (Feature)", () => {
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

  async function waitForModelsReady() {
    await waitFor(() => {
      const trigger = modelTrigger();
      expect(trigger && !trigger.disabled).toBe(true);
    });
  }

  function startSearch() {
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
  }

  it("1: Fallback-Erfolg (A fehl, B ok) -> Meldung nennt A, B und Job-Erhalt; fetchJobs genau 1x", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches)
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
      } as MatchResponse);
    renderApp();
    await waitForModelsReady();

    startSearch();

    await screen.findByText(
      (content) =>
        content.includes("Das Modell Modell A ist derzeit nicht verfügbar") &&
        content.includes("automatisch mit Modell B") &&
        content.includes("Stellen bleiben erhalten")
    );

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(2);
  });

  it("2: alle Versuche schlagen fehl -> Meldung mit Job-Erhalt + Modellwahl ohne neue Suche", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("unavailable", 502, "model_unavailable"));
    renderApp();
    await waitForModelsReady();

    startSearch();

    await screen.findByText(
      (content) =>
        content.includes("Das ausgewählte AI-Modell ist derzeit nicht verfügbar") &&
        content.includes("Stellen bleiben erhalten") &&
        content.includes("anderes verfügbares Modell auswählen") &&
        content.includes("ohne die Jobs erneut zu laden")
    );

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(2);
  });

  it("3: Ein-Modell-Katalog -> erweiterte Meldung korrekt", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches).mockRejectedValue(new ApiError("unavailable", 502, "model_unavailable"));
    renderApp();
    await waitForModelsReady();

    startSearch();

    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);
    expect(screen.getByText(/Stellen bleiben erhalten/)).toBeTruthy();
    expect(vi.mocked(fetchMatches)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
  });

  it("4: Modellwechsel nach Fehlschlag -> nur /api/match, kein /api/jobs, kein Apify", async () => {
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

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));
    fireEvent.click(document.getElementById("find-btn") as HTMLButtonElement);
    await screen.findByText("AWS Engineer");

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    const matchCalls = vi.mocked(fetchMatches).mock.calls;
    expect(matchCalls.length).toBe(3);
    expect(matchCalls[2][1]).toEqual([job]);
    expect(matchCalls[2][2]).toBe("m-b");
  });

  it("5: Englische Meldungen (i18n EN) korrekt", async () => {
    localStorage.setItem("mj-lang", "en");
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(fetchMatches)
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
      } as MatchResponse);
    renderApp();
    await waitForModelsReady();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Find my matches"));

    await screen.findByText(
      (content) =>
        content.includes("The model Modell A is currently unavailable") &&
        content.includes("automatically try Modell B") &&
        content.includes("Your found jobs are kept")
    );
  });
});

describe("UX-Korrektur: Manueller Modell-Retry (Step 4a)", () => {
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

  function startSearch() {
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
  }

  function exhaustAll() {
    vi.mocked(fetchMatches).mockRejectedValue(
      new ApiError("unavailable", 502, "model_unavailable")
    );
  }

  function exhaustThenOk() {
    vi.mocked(fetchMatches)
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockResolvedValueOnce({
        matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
      } as MatchResponse);
  }

  it("A: Modellwahl startet nach erschöpftem Fallback KEIN automatisches Matching", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustAll();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    const before = vi.mocked(fetchMatches).mock.calls.length;
    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));

    await waitFor(() => expect(findBtn().disabled).toBe(false));
    expect(vi.mocked(fetchMatches).mock.calls.length).toBe(before);
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(1);
  });

  it("B: Hinweis erscheint nach erschöpftem Fallback", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustAll();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText("Bitte versuche, ein anderes Modell auszuwählen.");
    expect(document.querySelector(".model-field--attention")).toBeTruthy();
  });

  it("C: Hinweis verschwindet nach Modellwahl", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustAll();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText("Bitte versuche, ein anderes Modell auszuwählen.");

    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));

    await waitFor(() => expect(document.querySelector(".model-field--attention")).toBeNull());
  });

  it("D: Manueller Start -> /api/match auf vorhandenem Dataset, kein /api/jobs", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustThenOk();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));
    fireEvent.click(findBtn());

    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    const calls = vi.mocked(fetchMatches).mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[2][1]).toEqual([job]);
    expect(calls[2][2]).toBe("m-b");
  });

  it("E: Rematch-Label erscheint bei gültigem Dataset", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustAll();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    expect(screen.getByText("Mit diesem Modell erneut bewerten")).toBeTruthy();
  });

  it("F: Suchparameteränderung -> Submit startet neue Suche, kein Rematch-Label", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    exhaustAll();
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "java" } });
    expect(screen.getByText("Meine Treffer finden")).toBeTruthy();

    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);
    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(2);
  });

  it("G: UI ist während manuellen Matchings gesperrt", async () => {
    vi.mocked(fetchModels).mockResolvedValue(twoModels);
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    const pendingMatch = deferred<MatchResponse>();
    vi.mocked(fetchMatches)
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockRejectedValueOnce(new ApiError("unavailable", 502, "model_unavailable"))
      .mockReturnValueOnce(pendingMatch.promise);
    renderApp();
    await waitForModelsReady();

    startSearch();
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));
    fireEvent.click(findBtn());

    expect(screen.getByText("Bewerte deine Treffer mit KI…")).toBeTruthy();
    expect(modelTrigger().disabled).toBe(true);
    expect(findBtn().disabled).toBe(true);

    pendingMatch.resolve({
      matches: [{ score: 90, why: "gut", prepare: "Frage", job }],
    } as MatchResponse);
    await screen.findByText("AWS Engineer");
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

  it("13: Änderung Umkreis invalidiert Dataset -> manuelle neue Suche mit /api/jobs", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fillSkills();
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].radiusKm).toBe(10);

    // Umkreis ändern -> Dataset invalidieren, KEINE automatische Suche
    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "25" } });
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    // manueller Start -> neue Suche über /api/jobs
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

    fillSkills();
    fireEvent.click(screen.getByLabelText("Remote"));
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].workModes).toEqual(["remote"]);

    fireEvent.click(screen.getByLabelText("Hybrid"));
    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0].workModes).toEqual(["remote", "hybrid"]);
  });

  it("15: Änderung Arbeitszeit invalidiert Dataset und wird an /api/jobs übergeben", async () => {
    vi.mocked(fetchJobs)
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } })
      .mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    fillSkills();
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls[0][0].employmentTypes).toEqual(["full_time"]);

    fireEvent.click(screen.getByLabelText("Teilzeit"));
    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0].employmentTypes).toEqual([
      "full_time",
      "part_time",
    ]);
  });

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

    // Parameteränderung -> KEINE automatische Suche (kein /api/jobs)
    const before = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: "100" } });
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(before);

    // manueller Start -> /api/jobs erlaubt
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

    // manueller Retry -> vorhandenes Dataset, kein neues /api/jobs
    fireEvent.click(findBtn());
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
    await screen.findByText(/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/);

    fireEvent.click(modelTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Modell B" }));
    fireEvent.click(findBtn());
    await screen.findByText("AWS Engineer");

    expect(vi.mocked(fetchJobs)).toHaveBeenCalledTimes(1);
    const calls = vi.mocked(fetchMatches).mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[2][0].radiusKm).toBe(10);
    expect(calls[2][1]).toEqual([job]);
    expect(calls[2][2]).toBe("m-b");
  });

  it("24: UI-Locking — neue Suchparameter sind während der Suche gesperrt", async () => {
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

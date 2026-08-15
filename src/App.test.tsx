import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Job, JobsResponse, MatchResponse, ModelsResponse, SuggestedProfile } from "./types";

vi.mock("./api", () => {
  class ApiError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, status?: number, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  const isModelUnavailable = (err: unknown): boolean => {
    if (err instanceof ApiError) {
      if (err.code === "model_unavailable") return true;
      if (typeof err.status === "number" && [429, 502, 503, 504].includes(err.status)) return true;
      return false;
    }
    return err instanceof Error && (err.name === "TypeError" || err.name === "TimeoutError" || err.name === "AbortError");
  };
  return {
    ApiError,
    isModelUnavailable,
    withModelFallback: async ({
      request,
    }: {
      request: (model: string | null, attempt: number) => Promise<unknown>;
    }) => ({ data: await request(null, 1), usedFallback: false }),
    fetchJobs: vi.fn(),
    fetchMatches: vi.fn(),
    fetchModels: vi.fn(),
    fetchModel: vi.fn(),
    createProfile: vi.fn(),
    setFallbackMaxAttempts: vi.fn(),
  };
});

vi.mock("./lib/pdf", () => ({
  extractPdfText: vi.fn(async () => "React Developer with five years of experience in Berlin"),
}));

import { createProfile, fetchJobs, fetchMatches, fetchModels } from "./api";
import App from "./App";
import { LangProvider } from "./i18n";

const job: Job = {
  slug: "aws-job",
  title: "AWS Engineer",
  company_name: "Acme",
  location: ["Berlin"],
  remote: false,
  tags: ["aws"],
  url: "https://example.com/job",
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

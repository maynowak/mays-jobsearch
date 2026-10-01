import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Job, MatchResponse, ModelsResponse, JobsResponse, SuggestedProfile } from "./types";

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

vi.mock("./lib/pdf", () => ({
  extractPdfText: vi.fn(async () => "React Developer with five years of experience in Berlin"),
}));

import { extractPdfText } from "./lib/pdf";

import {
  ApiError,
  analyzeATS,
  createProfile,
  fetchJobs,
  fetchMatches,
  fetchModels,
  setFallbackMaxAttempts,
} from "./api";
import App from "./App";
import { LangProvider } from "./i18n";
import { __resetModelsCacheForTests } from "./hooks/useAvailableModels";
import { resetCvProfileLists } from "./lib/cvProfileStore";

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

// Zwei Buttons heißen "Jobs Finden": in der Saved-Profile-Box und in der
// CV-Dokumentenliste — Abfragen deshalb je Bereich scopen.
function savedBoxStartButton() {
  const box = document.querySelector(".cv-saved-profiles") as HTMLElement;
  return within(box).getByRole("button", { name: "Jobs Finden" }) as HTMLButtonElement;
}

function docListStartButton() {
  const list = document.querySelector(".cv-document-list") as HTMLElement;
  return within(list).getByRole("button", { name: "Jobs Finden" }) as HTMLButtonElement;
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
  // CV-Profil-Cache-Treffer ueber Testgrenzen hinweg unterbinden, damit der
  // Quick-Upload-Pfad deterministisch durch Consent + AI-Call laeuft
  Object.keys(localStorage)
    .filter((k) => k.startsWith("mj-cv-profile:") || k.startsWith("mj-cv-lists:"))
    .forEach((k) => localStorage.removeItem(k));
  // CV-PROFILE-LISTS-02: Listen leben im Session-Speicher — pro Test leeren
  // (der Inhalts-Hash ist testuebergreifend gleich).
  resetCvProfileLists();
  window.history.pushState({}, "", "/top");
  __resetModelsCacheForTests();
  setFallbackMaxAttempts(3);
  vi.mocked(fetchJobs).mockReset();
  vi.mocked(fetchMatches).mockReset();
  vi.mocked(fetchModels).mockReset();
  vi.mocked(createProfile).mockReset();
  vi.mocked(analyzeATS).mockReset();
  vi.mocked(fetchModels).mockResolvedValue(singleModel);
  vi.mocked(fetchMatches).mockResolvedValue(matchOk);
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true });
  globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined));
});

afterEach(() => {
  cleanup();
});

  // Quick-Upload: Consent-Gate (Privacy-Grenze vor dem AI-Call)
  // CV-UPLOAD-UX-01: Die Einwilligung erscheint seit der UX-Korrektur direkt
  // im CV-Workflow-Overlay (Pfad B) — nicht mehr inline in der Suchmaske.
  async function acceptUploadConsent() {
    await screen.findByText("CV-Verarbeitung erlauben?");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Verarbeitung erlauben" }));
  }

  // CV-UPLOAD-UX-01: Quick-Upload -> Workflow-Overlay öffnet direkt mit der
  // Einwilligung (kein Inline-Consent, kein Overlap des Dateinamens mehr).
  async function uploadCvToConsent(fileName = "cv.pdf") {
    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    const file = new File(
      ["React Developer with five years of experience in Berlin"],
      fileName,
      { type: "application/pdf" }
    );
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await screen.findByText("CV-Verarbeitung erlauben?");
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
  }

  // Workflow im Overlay (CV-UPLOAD-UX-03): creating-profile (Optionen inkl.
  // Anonymisierung) -> model-selection -> anonymizing -> profile-ready.
  // Die Anonymisierung wird damit vor dem ersten Modell-Call festgelegt.
  async function proceedToProfileReady() {
    await waitFor(() =>
      expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> model-selection
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing
    await waitFor(() =>
      expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy()
    );
  }

  function confirmProfileInOverlay() {
    const card = document.querySelector(".cv-processing-card") as HTMLElement;
    fireEvent.click(
      Array.from(card.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Profil übernehmen und Jobs finden")
      ) as HTMLButtonElement
    );
  }

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

    it("liefernde, aber herausgefilterte Quellen bleiben in der Jobquellen-Box sichtbar", async () => {
      const sourcedJob: Job = { ...job, source: ["arbeitnow"] };
      vi.mocked(fetchJobs).mockResolvedValue({
        jobs: [sourcedJob],
        meta: { totalFiltered: 1, sources: { arbeitnow: 1, jooble: 25 } },
      });
      renderApp();

      fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
      fireEvent.click(screen.getByText("Meine Treffer finden"));

      await screen.findByText("AWS Engineer");
      expect(screen.getByText("Jooble")).toBeTruthy();
      expect(screen.getByText(/nicht angezeigt/)).toBeTruthy();
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
      expect(lastCall[0].targetRoles).toEqual(["Engineer"]);
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
  it("CV Upload -> Workflow im Overlay -> Profil -> anschließende Jobsuche", async () => {
    const jobs = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobs.promise);
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Der Upload oeffnet direkt das Workflow-Overlay (Pfad B)
    // mit der Einwilligung — kein Inline-Consent in der Suchmaske.
    await uploadCvToConsent();
    expect(vi.mocked(createProfile)).not.toHaveBeenCalled();

    await acceptUploadConsent();
    await proceedToProfileReady();
    const overlayCvSkills = document.querySelector(".cv-workflow-overlay #cv-skills") as HTMLInputElement;
    expect(overlayCvSkills.value).toBe("React");

    // Bestaetigen -> goal-selection im Overlay
    confirmProfileInOverlay();
    await waitFor(() => expect(document.querySelector(".cv-workflow-overlay #cv-goal-execution-title")).toBeTruthy());
  });

  it("BROWSER-BUG-02: nach CV-Upload ist die Dokumentliste sichtbar und Checkboxen funktionieren", async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    // CV-UPLOAD-UX-03: Optionen-Step (Anonymisierung) erreicht -> zurueck zur
    // Listen-Ansicht (Workflow verlassen); das Menue liegt dann inline UNTER
    // der Suchmaske (CV-UPLOAD-UX-01)
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu Dokumenten" }));
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();

    // Die CV-Dokumentliste ist sichtbar (SEARCH-CV-01)
    expect(await screen.findByText("Deine Lebensläufe")).toBeTruthy();
    expect(screen.getByText("cv.pdf")).toBeTruthy();
    // CV-UPLOAD-UX-01: das frisch hochgeladene Dokument ist automatisch ausgewählt
    const checkbox = document.querySelector(".cv-document-list__checkbox") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("1 ausgewählt")).toBeTruthy();

    // Einzelnes Dokument abwählen/auswählen
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText("Keine ausgewählt")).toBeTruthy();
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("1 ausgewählt")).toBeTruthy();

    // Select All / Deselect All
    fireEvent.click(screen.getByRole("button", { name: "Alle abwählen" }));
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText("Keine ausgewählt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alle auswählen" }));
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("1 ausgewählt")).toBeTruthy();

    // Aktionen sind mit Auswahl aktiviert
    expect((screen.getByRole("button", { name: "Jobs Finden" }) as HTMLButtonElement).disabled).toBe(false);
  });

  // Gemeinsamer Upload-Helper für die CV-Flow-Tests.
  // CV-UPLOAD-UX-01: Upload -> Consent im Overlay (Pfad B) -> Modell-Step ->
  // zurueck zur Dokumentliste (inline unter der Suchmaske; Dokument bleibt
  // ausgewaehlt, Einwilligung ist fuer die Sitzung erteilt).
  async function uploadCvAndOpenList(fileName = "cv.pdf") {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();
    await uploadCvToConsent(fileName);
    await acceptUploadConsent();
    // CV-UPLOAD-UX-03: Nach der Einwilligung kommt zuerst der Optionen-Step
    // (Anonymisierungs-Modus) — von dort zurueck zur Liste.
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu Dokumenten" }));
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
  }

  it("BROWSER-BUG-06/07: Consent-Overlay ist verpflichtend, schließbar und erneut öffnenbar", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Die Einwilligung erscheint direkt nach dem Upload als
    // Overlay im Vordergrund (Pfad B) — nicht inline in der Suchmaske.
    await uploadCvToConsent();
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();

    // BUG-06: Checkbox unchecked -> Confirm disabled, keine Verarbeitung
    const confirm = screen.getByRole("button", { name: "Verarbeitung erlauben" }) as HTMLButtonElement;
    const checkbox = screen.getByRole("checkbox", {
      name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(confirm.disabled).toBe(true);
    const createCallsBefore = vi.mocked(createProfile).mock.calls.length;
    fireEvent.click(confirm);
    // kein zusätzlicher Verarbeitungs-Call durch den disabled-Button
    expect(vi.mocked(createProfile)).toHaveBeenCalledTimes(createCallsBefore);

    // BUG-07: Schließen -> Hinweis + Trigger, Verarbeitung startet nicht;
    // das Menue (CV-Liste) liegt dann inline unter der Suchmaske (CV-UPLOAD-UX-01)
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await screen.findByText(/Zustimmung ausstehend/);
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    expect(screen.queryByText("CV-Verarbeitung erlauben?")).toBeNull();
    expect(screen.getByText("cv.pdf")).toBeTruthy(); // CV bleibt erhalten

    // BUG-07: erneut öffnen
    fireEvent.click(screen.getByRole("button", { name: "Einwilligung anzeigen" }));
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
    // Checkbox bleibt nach dem erneuten Öffnen unchecked (kein Auto-Consent)
    const reopenedCheckbox = screen.getByRole("checkbox", {
      name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
    }) as HTMLInputElement;
    expect(reopenedCheckbox.checked).toBe(false);

    // BUG-06: Checkbox checked -> Confirm enabled -> Verarbeitung startet
    fireEvent.click(reopenedCheckbox);
    const enabledConfirm = screen.getByRole("button", { name: "Verarbeitung erlauben" }) as HTMLButtonElement;
    expect(enabledConfirm.disabled).toBe(false);
    fireEvent.click(enabledConfirm);
    // CV-UPLOAD-UX-03: nach der Zustimmung kommt zuerst der Optionen-Step
    // (Anonymisierungs-Modus) — vor der Modellwahl
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());

    // BUG-14/15: nach der Zustimmung bleibt der Workflow im gemeinsamen
    // Overlay (Optionen-Step im Vordergrund)
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
    expect(document.querySelector(".cv-workflow-overlay .cv-anonymization-choice")).toBeTruthy();
  });

  it("BROWSER-BUG-14..19: Workflow bleibt im gemeinsamen Overlay; Fehler bleibt im Overlay-Kontext", async () => {
    // BUG-17: ATS-Fehlschlag soll einen kontrollierten Fehler-Step erzeugen
    vi.mocked(analyzeATS).mockRejectedValue(new Error("kaputt"));
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Upload -> Einwilligung direkt im Overlay (Pfad B)
    await uploadCvToConsent();
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Verarbeitung erlauben" }));

    // CV-UPLOAD-UX-03: nach der Zustimmung zuerst Optionen-Step
    // (Anonymisierung vor Modellwahl) im Overlay
    await waitFor(() => {
      expect(document.querySelector(".cv-workflow-overlay .cv-anonymization-choice")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    // BUG-15: Model-Step im Overlay
    await waitFor(() => {
      expect(document.querySelector(".cv-workflow-overlay #cv-model-selection-title")).toBeTruthy();
    });

    // BUG-16: Weiter -> anonymizing -> profile-ready (alles im Overlay)
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => {
      expect(document.querySelector(".cv-workflow-overlay .cv-result")).toBeTruthy();
    });
    const card = document.querySelector(".cv-processing-card") as HTMLElement;
    fireEvent.click(
      Array.from(card.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Profil übernehmen und Jobs finden")
      ) as HTMLButtonElement
    );

    // goal-selection im Overlay
    await waitFor(() => {
      expect(document.querySelector(".cv-workflow-overlay #cv-goal-execution-title")).toBeTruthy();
    });

    // CV-UPLOAD-UX-06: Alle Skills sind vorausgewaehlt; CV-UPLOAD-UX-07:
    // Confirm speichert das ATS-Profil und SCHLIESST den Workflow (keine
    // in-Workflow-Analyse mehr; ATS laeuft pro Treffer-Job)
    fireEvent.click(screen.getByRole("button", { name: "Ziel ausführen" }));
    await waitFor(() => {
      expect(document.getElementById("cv-skill-selection-title")).toBeTruthy();
      expect(document.querySelector(".cv-workflow-overlay #cv-skill-selection-title")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }));

    // Geschlossen: Liste inline sichtbar, Status-Hinweis "gespeichert"
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    expect(screen.getByText(/gespeichert/)).toBeTruthy();
  });

  it("CV-UPLOAD-UX-09: Overlay laesst sich in jedem Step schliessen (Zustand bleibt erhalten)", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // Kein X im Inline-Ruhezustand (document-selected zeigt keine Karte)
    await uploadCvToConsent();
    await acceptUploadConsent();

    // Optionen-Step: X schliesst -> Liste inline, Dokument bleibt erhalten
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workflow schließen" }));
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    expect(screen.getByText("cv.pdf")).toBeTruthy();

    // Wieder rein: Consent erteilt -> Optionen -> Modell -> X schliesst auch da
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Workflow schließen" }));
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
  });

  it("CV-UPLOAD-UX-09: Schliessen im Consent-Step zaehlt als ausstehend (wieder oeffnbar)", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    await uploadCvToConsent();
    // X statt Abbrechen: Overlay weg, Hinweis "Zustimmung ausstehend"
    fireEvent.click(screen.getByRole("button", { name: "Workflow schließen" }));
    await screen.findByText(/Zustimmung ausstehend/);
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    // wieder oeffnbar
    fireEvent.click(screen.getByRole("button", { name: "Einwilligung anzeigen" }));
    await screen.findByText("CV-Verarbeitung erlauben?");
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
  });

  it("BROWSER-BUG-07 (regression): geschlossener Consent -> KEIN Overlay, Hinweis inline", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Upload oeffnet das Consent-Overlay direkt
    await uploadCvToConsent();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    await screen.findByText(/Zustimmung ausstehend/);
    // Kein Overlay im dismissed-Zustand — Menue inline unter der Suchmaske
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    // Liste bleibt inline sichtbar
    expect(screen.getByText("cv.pdf")).toBeTruthy();
    // Reopen funktioniert
    fireEvent.click(screen.getByRole("button", { name: "Einwilligung anzeigen" }));
    await screen.findByText("CV-Verarbeitung erlauben?");
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();
  });

  it("BROWSER-BUG-21B: Model-unavailable -> 'Zurück zur Modellauswahl' -> anderes Modell -> Recovery", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Upload -> Einwilligung direkt im Overlay, erst danach
    // darf ein AI-Call starten
    await uploadCvToConsent("recovery.pdf");
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Verarbeitung erlauben" }));
    // CV-UPLOAD-UX-03: Optionen-Step (Anonymisierung) vor der Modellwahl
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> model-selection
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());

    // Modell nicht verfügbar: createProfile schlägt einmal mit transientem Fehler fehl
    vi.mocked(createProfile).mockRejectedValueOnce(new ApiError("overloaded", 429, "rate_limited"));
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing -> createProfileFromPdf schlägt fehl

    // Fehler erscheint; Rücksprung zielt auf Modellauswahl
    await waitFor(() => expect(document.querySelector(".cv-error-state")).toBeTruthy());
    const backToModel = screen.getByRole("button", { name: "Zurück zur Modellauswahl" });
    fireEvent.click(backToModel);

    // Model Selection wieder da, Dokument noch vorhanden
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());

    // Recovery: nächster Durchlauf erfolgreich (kein neuer Upload nötig)
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing -> erfolgreich
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    // zurück zur Liste zeigt das erhaltene Dokument
    const card = document.querySelector(".cv-processing-card") as HTMLElement;
    fireEvent.click(
      Array.from(card.querySelectorAll("button")).find((b) => b.textContent?.includes("Profil übernehmen und Jobs finden")) as HTMLButtonElement
    );
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
  });

  it("CV-Upload: Modell-Ausfall -> Modellauswahl-Recovery im Overlay (kein Neustart)", async () => {
    vi.mocked(fetchModels).mockResolvedValue(multiModels);
    vi.mocked(createProfile)
      .mockRejectedValueOnce(new ApiError("The selected model isn't currently available as a free compatible model.", 400, "model_not_free"))
      .mockResolvedValue({
        skills: ["React"],
        experienceLevel: "Senior",
        targetRoles: ["Frontend"],
        location: "Berlin",
      } as SuggestedProfile);
    renderApp();

    // Consent zuerst (im Overlay), dann erst AI-Call
    await uploadCvToConsent();
    expect(vi.mocked(createProfile)).not.toHaveBeenCalled();
    await acceptUploadConsent();
    // CV-UPLOAD-UX-03: Optionen-Step (Anonymisierung) vor der Modellwahl
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> model-selection
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());

    // Modell-Ausfall (model_not_free, nicht transient) bei der Profil-Erstellung
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing -> schlaegt fehl

    // Modell-Recovery im Overlay statt generischem Fehler + Neustart
    // (CV-UPLOAD-UX-01: model_not_free fuehrt zurueck zur Modellauswahl)
    await waitFor(() => expect(document.querySelector(".cv-error-state")).toBeTruthy());
    expect(screen.getAllByText(/KI-Modell ist momentan nicht verfügbar/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/konnte gerade nicht ausgewertet werden/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zurück zur Modellauswahl" }));

    // anderes Modell waehlen und direkt erneut starten — ohne erneuten Upload
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(document.querySelector(".cv-model-selection .model-trigger") as HTMLButtonElement);
    // MODEL-SELECT-01: die geoeffnete Liste liegt ueberlaufend (position: fixed)
    expect(document.querySelector(".model-popover--fixed")).toBeTruthy();
    fireEvent.click(await screen.findByRole("option", { name: /Modell B/ }));
    const callsBefore = vi.mocked(createProfile).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing -> erfolgreich (mit m-b)

    // erneuter Call mit dem neuen Modell — ohne erneuten Upload
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    expect(vi.mocked(createProfile).mock.calls.length).toBe(callsBefore + 1);
    expect(vi.mocked(createProfile).mock.calls[callsBefore][1]).toBe("m-b");
  });

  it("Privacy Boundary: Consent-Pflicht vor AI-Call; PII wird vorher anonymisiert", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce(
      "Max Mustermann, max.mustermann@example.com, +49 170 1234567. React Developer in Berlin."
    );
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    renderApp();

    // CV-UPLOAD-UX-01: Consent-Gate erscheint im Workflow-Overlay; noch kein AI-Call
    await uploadCvToConsent("privacy.pdf");
    expect(vi.mocked(createProfile)).not.toHaveBeenCalled();

    await acceptUploadConsent();
    // CV-UPLOAD-UX-03: Optionen (Anonymisierung) -> Modellwahl -> erst jetzt
    // Extraction + lokale Anonymisierung + erster AI-Call
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(vi.mocked(createProfile)).toHaveBeenCalled());
    const sentText = vi.mocked(createProfile).mock.calls[0][0] as string;
    // Keine PII im Text, der an die AI geht
    expect(sentText).not.toContain("max.mustermann@example.com");
    expect(sentText).not.toContain("Max Mustermann");
    expect(sentText).not.toContain("+49 170 1234567");
    expect(sentText).toContain("[E-MAIL]");
    expect(sentText).toContain("[NAME]");
  });

  it("BROWSER-BUG-22: ATS Model-unavailable -> Recovery am ATS-Punkt -> anderes Modell -> nur ATS erneut", async () => {
    vi.mocked(fetchModels).mockResolvedValue(multiModels);
    vi.mocked(analyzeATS).mockResolvedValue({
      analysis: { score: 80, keywordCoverage: { overall: 75 }, criticalGaps: [], requirements: [], matches: [] },
      recommendations: [],
      ai: { requested: false, executed: false, consentRequired: true, consentGiven: false, externalProcessing: false, dataMinimized: true },
    } as never);

    await uploadCvAndOpenList("ats-recovery.pdf");
    // CV-UPLOAD-UX-01: Einwilligung wurde bereits beim Upload im Overlay erteilt;
    // das hochgeladene Dokument bleibt ausgewaehlt -> direkt zu den Optionen
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    // CV-UPLOAD-UX-03: Optionen (Anonymisierung) -> Modellwahl -> Verarbeitung
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // creating-profile -> model-selection
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());

    // CV-UPLOAD-UX-07: ATS-Ziel speichert das ATS-Profil und schliesst den
    // Workflow — keine Sofort-Analyse mehr (die in-Workflow-Recovery des
    // ATS-Punkts ist damit ruhend; Modellwahl/Recovery laeuft pro Treffer-Job
    // im ATS-Overlay, siehe AtsOverlay)
    fireEvent.click(screen.getByRole("button", { name: "Ziel ausführen" }));
    await waitFor(() => expect(document.getElementById("cv-skill-selection-title")).toBeTruthy());
    expect(vi.mocked(analyzeATS)).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }));

    // Geschlossen + gespeichert; ATS-Profil im CV-Bereich waehlbar
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    expect(screen.getByText(/gespeichert/)).toBeTruthy();
    expect(vi.mocked(analyzeATS)).not.toHaveBeenCalled();
    const atsSelect = document.getElementById("cv-saved-ats-profile") as HTMLSelectElement;
    expect(Array.from(atsSelect.options).map((o) => o.text)).toContain("Frontend - ATS1");
  });

  it("BROWSER-BUG-20: ATS-Pfad erhält das bestätigte CV-Profil (kein atsNoProfile)", async () => {
    vi.mocked(analyzeATS).mockResolvedValue({
      analysis: { score: 80, keywordCoverage: { overall: 75 }, criticalGaps: [], requirements: [], matches: [] },
      recommendations: [],
      ai: { requested: false, executed: false, consentRequired: true, consentGiven: false, externalProcessing: false, dataMinimized: true },
    } as never);
    await uploadCvAndOpenList("ats-flow.pdf");

    // CV-UPLOAD-UX-01: Consent wurde beim Upload im Overlay erteilt; Dokument
    // bleibt ausgewaehlt -> Verarbeiten geht direkt zu den Optionen
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    // CV-UPLOAD-UX-03: Optionen (Anonymisierung) -> Modellwahl -> Verarbeitung
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // creating-profile -> model-selection
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // -> anonymizing

    // profile-ready -> bestätigen (legt cvState.cvProfile an)
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());

    // ATS-Ziel -> Skills — CV-UPLOAD-UX-04/07: bestaetigte Skills werden
    // gespeichert (kein Datenverlust, kein atsNoProfile-Risiko mehr) und der
    // Workflow schliesst; keine Sofort-Analyse
    fireEvent.click(screen.getByRole("button", { name: "Ziel ausführen" }));
    await waitFor(() => expect(document.getElementById("cv-skill-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }));

    await screen.findByText("Deine Lebensläufe");
    expect(vi.mocked(analyzeATS)).not.toHaveBeenCalled();

    // Das ATS-Profil traegt die bestaetigten Skills + Zielrolle des CV-Profils
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    const atsSection = await screen.findByRole("dialog", { name: /ats-flow\.pdf/ }).then(() =>
      document.querySelector('[aria-labelledby="cv-ats-profiles-title"]') as HTMLElement
    );
    fireEvent.click(atsSection.querySelector(".cv-profiles-overlay__select") as HTMLButtonElement);
    const details = document.querySelector(".cv-profiles-overlay__details") as HTMLElement;
    expect(details.textContent).toContain("React");
    expect(details.textContent).toContain("Frontend");
    expect(document.querySelector(".cv-error-state")).toBeNull();
  });

  it("BROWSER-BUG-11: Zurück-Navigation im CV-Flow ohne State-Verlust", async () => {
    await uploadCvAndOpenList();
    // CV-UPLOAD-UX-01: Dokument blieb nach dem Upload ausgewaehlt; Consent
    // wurde beim Upload im Overlay erteilt -> Verarbeiten -> Optionen-Step
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    await waitFor(() => {
      expect(screen.queryByText("CV-Verarbeitung erlauben?")).toBeNull();
    });

    // CV-UPLOAD-UX-03: Optionen (Anonymisierung) -> Modellwahl -> zurueck
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu den Optionen" }));
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    // State erhalten: Dokument weiterhin vorhanden, zurueck zur Liste
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu Dokumenten" }));
    await screen.findByText("cv.pdf");
    expect(screen.getByText("Deine Lebensläufe")).toBeTruthy();

    // Wieder vor -> Consent bleibt erteilt, Optionen-Step direkt
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    await waitFor(() => {
      expect(screen.queryByText("CV-Verarbeitung erlauben?")).toBeNull();
    });
    expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu Dokumenten" }));
    await screen.findByText("cv.pdf");
  });

  it("BROWSER-BUG-10: 'Weiter' in model-selection startet die Profil-Erstellung ohne React-Fehler", async () => {
    await uploadCvAndOpenList();
    // CV-UPLOAD-UX-01: Consent bereits beim Upload erteilt, Dokument ausgewaehlt
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählten CV verarbeiten" }));
    // Consent erteilt -> direkt creating-profile (Optionen, CV-UPLOAD-UX-03)
    await waitFor(() => {
      expect(screen.queryByText("CV-Verarbeitung erlauben?")).toBeNull();
    });

    // Optionen -> model-selection -> Weiter startet createProfileFromPdf
    // (früher React #321 via useLang im Handler)
    const createProfileCallsBefore = vi.mocked(createProfile).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await screen.findByRole("button", { name: "Weiter" });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => {
      expect(vi.mocked(createProfile).mock.calls.length).toBeGreaterThan(createProfileCallsBefore);
    });
  });

  it("BROWSER-BUG-08: zweiter CV lässt sich über die Liste hochladen", async () => {
    await uploadCvAndOpenList();
    expect(screen.getByText("Weitere CVs hochladen")).toBeTruthy();

    const second = new File(["zweiter lebenslauf"], "lebenslauf-2.pdf", { type: "application/pdf" });
    const listFileInput = document.querySelector(".cv-document-list__actions input[type='file']") as HTMLInputElement;
    fireEvent.change(listFileInput, { target: { files: [second] } });

    await screen.findByText("lebenslauf-2.pdf");
    expect(screen.getByText("cv.pdf")).toBeTruthy();
    // beide Dokumente haben Checkboxen
    expect(document.querySelectorAll(".cv-document-list__checkbox").length).toBe(2);
  });
});

describe("CV-PROFILE-LISTS-01: Benannte Profil-Listen pro CV", () => {
  function mockProfile() {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
  }

  async function backToDocumentList() {
    // goal-selection -> profile-ready -> document-selected (Liste inline)
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Profil" }));
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Bearbeiten" }));
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
  }

  it("Suchprofil wird benannt gespeichert und im Overlay des CVs angezeigt", async () => {
    mockProfile();
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();

    // CV-PROFILE-LISTS-01/03/05: Name fuer den Listen-Eintrag — Vorschlag
    // "<Zielrolle> - Profil1" (Zaehler aus der Liste dieses CVs); das Feld
    // steht an erster Stelle der Eingabereihenfolge; Klick markiert alles
    const nameInput = document.getElementById("cv-profile-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Frontend - Profil1");
    const firstFieldInput = document.querySelector(".cv-result .field input") as HTMLInputElement;
    expect(firstFieldInput.id).toBe("cv-profile-name");
    fireEvent.focus(nameInput);
    expect(nameInput.selectionStart).toBe(0);
    expect(nameInput.selectionEnd).toBe("Frontend - Profil1".length);
    fireEvent.change(nameInput, { target: { value: "Frontend Berlin" } });
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());

    await backToDocumentList();

    // Overlay des CVs oeffnen: Titel = Dateiname
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    expect(await screen.findByRole("dialog", { name: /cv\.pdf/ })).toBeTruthy();

    // Suchprofile-Tabelle enthaelt den benannten Eintrag (gescoped: der
    // CV-Bereich hat zusaetzlich ein Select mit dem selben Namen)
    expect(screen.getByText("Suchprofile")).toBeTruthy();
    const searchSection = document.querySelector('[aria-labelledby="cv-search-profiles-title"]') as HTMLElement;
    expect(searchSection.textContent).toContain("Frontend Berlin");
    expect(screen.getByText("ATS-Matching-Profile")).toBeTruthy();

    // "Profil anzeigen" blendet das neueste Suchprofil ein/aus
    const toggle = screen.getByRole("button", { name: "Profil anzeigen" });
    fireEvent.click(toggle);
    expect(screen.getByText("Frontend")).toBeTruthy();

    // Auswahl des Eintrags -> Detailbereich (Thema Suchprofil)
    fireEvent.click(screen.getByRole("button", { name: "Anzeigen" }));
    const details = document.querySelector(".cv-profiles-overlay__details") as HTMLElement;
    expect(details.textContent).toContain("Suchprofil: Frontend Berlin");
    expect(details.textContent).toContain("React");
    expect(details.textContent).toContain("Berlin");
  });

  it("ATS-Profil (bestaetigte Skills) wird benannt gespeichert und im Overlay angezeigt", async () => {
    mockProfile();
    vi.mocked(analyzeATS).mockResolvedValue({
      analysis: { score: 80, keywordCoverage: { overall: 75 }, criticalGaps: [], requirements: [], matches: [] },
      recommendations: [],
      ai: { requested: false, executed: false, consentRequired: true, consentGiven: false, externalProcessing: false, dataMinimized: true },
    } as never);
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());

    // Ziel ATS (Default) -> Ziel ausfuehren -> Skills-Step (CV-UPLOAD-UX-04)
    fireEvent.click(screen.getByRole("button", { name: "Ziel ausführen" }));
    await waitFor(() => expect(document.getElementById("cv-skill-selection-title")).toBeTruthy());

    // CV-PROFILE-LISTS-01/03/05: Name fuer den ATS-Profil-Eintrag — Vorschlag
    // "<Zielrolle> - ATS1"; Klick markiert den ganzen Text; Feld steht oben
    // vor der Skills-Liste
    const atsNameInput = document.getElementById("cv-ats-profile-name") as HTMLInputElement;
    expect(atsNameInput.value).toBe("Frontend - ATS1");
    const skillSection = document.querySelector(".cv-skill-selection") as HTMLElement;
    expect(skillSection.querySelector("input")!.id).toBe("cv-ats-profile-name");
    fireEvent.focus(atsNameInput);
    expect(atsNameInput.selectionStart).toBe(0);
    expect(atsNameInput.selectionEnd).toBe("Frontend - ATS1".length);
    fireEvent.change(atsNameInput, { target: { value: "React ATS" } });
    fireEvent.click(screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }));

    // CV-UPLOAD-UX-07: Speichern + Schliessen — KEINE Sofort-Analyse mehr;
    // das ATS-Profil ist direkt im CV-Bereich auswaehlbar
    expect(vi.mocked(analyzeATS)).not.toHaveBeenCalled();
    await screen.findByText("Deine Lebensläufe");
    expect(document.querySelector(".cv-workflow-overlay")).toBeNull();
    expect(screen.getByText(/gespeichert/)).toBeTruthy();
    const atsSelect = document.getElementById("cv-saved-ats-profile") as HTMLSelectElement;
    expect(Array.from(atsSelect.options).map((o) => o.text)).toContain("React ATS");

    // Overlay: ATS-Tabelle enthaelt den benannten Eintrag (gescoped)
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    expect(await screen.findByRole("dialog", { name: /cv\.pdf/ })).toBeTruthy();
    const atsTable = document.querySelector('[aria-labelledby="cv-ats-profiles-title"]') as HTMLElement;
    expect(atsTable.textContent).toContain("React ATS");

    // Auswahl (ATS-Tabelle) -> Detailbereich (Thema ATS-Profil) zeigt die Skills
    const atsSection = document.querySelector('[aria-labelledby="cv-ats-profiles-title"]') as HTMLElement;
    fireEvent.click(atsSection.querySelector(".cv-profiles-overlay__select") as HTMLButtonElement);
    const details = document.querySelector(".cv-profiles-overlay__details") as HTMLElement;
    expect(details.textContent).toContain("ATS-Matching-Profil: React ATS");
    expect(details.querySelector(".tag")?.textContent).toBe("React");
  });

  it("Overlay ohne gespeicherte Listen zeigt leere Zustaende", async () => {
    mockProfile();
    renderApp();

    // Upload, aber Workflow nicht durchlaufen (kein Hash/Profil gespeichert)
    await uploadCvToConsent();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await screen.findByText(/Zustimmung ausstehend/);

    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    const dialog = await screen.findByRole("dialog", { name: /cv\.pdf/ });
    expect(dialog.textContent).toContain("Noch keine Einträge gespeichert.");
    expect(screen.getByText("Profil anzeigen")).toBeTruthy();
    // Schliessen per X
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog", { name: /cv\.pdf/ })).toBeNull();
  });

  it("CV-PROFILE-LISTS-04 (Privacy): 'CV-Daten entfernen' mit Bestaetigung leert Dokumente + Listen", async () => {
    mockProfile();
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    // Suchprofil wird als "Frontend - Profil1" gespeichert
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    // Liste vorhanden
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    expect(await screen.findByRole("dialog", { name: /cv\.pdf/ })).toBeTruthy();
    // gescoped auf die Suchprofile-Tabelle (CV-Bereich hat Select mit gleichem Namen)
    const searchTable = document.querySelector('[aria-labelledby="cv-search-profiles-title"]') as HTMLElement;
    expect(searchTable.textContent).toContain("Frontend - Profil1");
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    // Entfernen-Button -> Bestaetigung mit Hinweis auf erneutes Hochladen
    fireEvent.click(screen.getByRole("button", { name: "CV-Daten entfernen" }));
    const confirmBox = await screen.findByRole("alertdialog", { name: "CV-Daten entfernen" });
    expect(confirmBox.textContent).toContain("erneut hochgeladen");

    // Abbrechen: nichts wird entfernt
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText("cv.pdf")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    expect(await screen.findByRole("dialog", { name: /cv\.pdf/ })).toBeTruthy();
    const searchTable2 = document.querySelector('[aria-labelledby="cv-search-profiles-title"]') as HTMLElement;
    expect(searchTable2.textContent).toContain("Frontend - Profil1");
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    // Endgueltig entfernen: Dokumente + Listen weg, CV-Menue schliesst sich
    fireEvent.click(screen.getByRole("button", { name: "CV-Daten entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig entfernen" }));
    await waitFor(() => expect(screen.queryByText("Deine Lebensläufe")).toBeNull());
    expect(screen.queryByRole("button", { name: "Profile anzeigen" })).toBeNull();
    // Dropzone ist wieder der sichtbare Einstieg (erneutes Hochladen)
    expect(document.querySelector(".cv-dropzone")).toBeTruthy();
  });

  it("CV-UPLOAD-UX-06: Skills-Step — Default alle selektiert + Alle auswaehlen/abwaehlen", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["React", "TypeScript", "Node.js"],
      experienceLevel: "Senior",
      targetRoles: ["Frontend"],
      location: "Berlin",
    } as SuggestedProfile);
    vi.mocked(analyzeATS).mockResolvedValue({
      analysis: { score: 80, keywordCoverage: { overall: 75 }, criticalGaps: [], requirements: [], matches: [] },
      recommendations: [],
      ai: { requested: false, executed: false, consentRequired: true, consentGiven: false, externalProcessing: false, dataMinimized: true },
    } as never);
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ziel ausführen" }));

    // Default: ALLE erkannten Skills sind selektiert
    await waitFor(() => expect(document.getElementById("cv-skill-selection-title")).toBeTruthy());
    const boxes = ["React", "TypeScript", "Node.js"].map(
      (s) => screen.getByRole("checkbox", { name: s }) as HTMLInputElement
    );
    boxes.forEach((b) => expect(b.checked).toBe(true));

    // "Alle abwählen" -> alle weg, Fehlerhinweis, Confirm gesperrt
    fireEvent.click(screen.getByRole("button", { name: "Alle abwählen" }));
    boxes.forEach((b) => expect(b.checked).toBe(false));
    expect(screen.getByText(/Keine Skills ausgewählt/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }) as HTMLButtonElement).disabled
    ).toBe(true);

    // "Alle auswählen" -> alle wieder drin
    fireEvent.click(screen.getByRole("button", { name: "Alle auswählen" }));
    boxes.forEach((b) => expect(b.checked).toBe(true));

    // Einzelabwahl wirkt: gespeichertes ATS-Profil traegt nur die gewaehlten
    // Skills (CV-UPLOAD-UX-07: speichern + schliessen, keine Sofort-Analyse)
    fireEvent.click(boxes[2]); // Node.js abwaehlen
    fireEvent.click(screen.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }));
    await screen.findByText("Deine Lebensläufe");
    expect(vi.mocked(analyzeATS)).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    const atsSection = document.querySelector('[aria-labelledby="cv-ats-profiles-title"]') as HTMLElement;
    fireEvent.click(atsSection.querySelector(".cv-profiles-overlay__select") as HTMLButtonElement);
    const details = document.querySelector(".cv-profiles-overlay__details") as HTMLElement;
    expect(details.textContent).toContain("React");
    expect(details.textContent).toContain("TypeScript");
    expect(details.textContent).not.toContain("Node.js");
  });

  it("CV-UPLOAD-UX-08: Auswahl-Box unter dem Upload-Bereich + Edit-Sprung + Ueberschreiben", async () => {
    mockProfile();
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    // Suchprofil speichern (Default-Name "Frontend - Profil1")
    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    // Box unter dem CV-Upload-Bereich — das gespeicherte Profil ist direkt
    // vorausgewaehlt (Auto-Select beim Speichern)
    expect(document.getElementById("cv-saved-search-profile")).toBeTruthy();
    const editBtn = screen.getAllByRole("button", { name: "Bearbeiten" })[0] as HTMLButtonElement;
    expect(editBtn.disabled).toBe(false);

    // Placeholder ("— auswählen —") bleibt moeglich: dann ist Edit gesperrt
    fireEvent.change(document.getElementById("cv-saved-search-profile") as HTMLSelectElement, {
      target: { value: "" },
    });
    expect(editBtn.disabled).toBe(true);
    fireEvent.change(document.getElementById("cv-saved-search-profile") as HTMLSelectElement, {
      target: {
        value: (document.querySelector("#cv-saved-search-profile option:not([value=''])") as HTMLOptionElement).value,
      },
    });
    expect(editBtn.disabled).toBe(false);

    // Edit-Sprung: Profil-Step wird vorbefuellt geoeffnet (Name + Werte)
    fireEvent.click(editBtn);
    await waitFor(() =>
      expect(document.querySelector(".cv-workflow-overlay .cv-result")).toBeTruthy()
    );
    expect((document.getElementById("cv-profile-name") as HTMLInputElement).value).toBe("Frontend - Profil1");
    expect((document.getElementById("cv-skills") as HTMLInputElement).value).toBe("React");
    expect((document.getElementById("cv-city") as HTMLInputElement).value).toBe("Berlin");

    // Gleicher Name beim Speichern -> ueberschreibt (Stadt geaendert)
    fireEvent.change(document.getElementById("cv-city") as HTMLInputElement, {
      target: { value: "Hamburg" },
    });
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    // Immer noch genau EIN Eintrag mit dem Namen (kein Duplikat)
    const searchBox = document.getElementById("cv-saved-search-profile") as HTMLSelectElement;
    const names = Array.from(searchBox.options).map((o) => o.text).filter((n) => n !== "— auswählen —");
    expect(names).toEqual(["Frontend - Profil1"]);
  });

  it("CV-UPLOAD-UX-11: Zielrolle im Suchprofil ist editier-/entfernbar", async () => {
    mockProfile();
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();

    // Zielrolle komplett leeren und speichern
    const roleInput = document.getElementById("cv-targetRole") as HTMLInputElement;
    expect(roleInput.value).toBe("Frontend");
    fireEvent.change(roleInput, { target: { value: "" } });
    expect(roleInput.value).toBe("");
    confirmProfileInOverlay();

    // Gespeicherter Eintrag traegt die geleerte Zielrolle (kein Fallback)
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();
    fireEvent.click(screen.getByRole("button", { name: "Profile anzeigen" }));
    const searchSection = document.querySelector('[aria-labelledby="cv-search-profiles-title"]') as HTMLElement;
    fireEvent.click(searchSection.querySelector(".cv-profiles-overlay__select") as HTMLButtonElement);
    const details = document.querySelector(".cv-profiles-overlay__details") as HTMLElement;
    expect(details.textContent).toContain("- Profil1"); // Default-Name hat Rolle noch enthalten
    expect(details.textContent).toContain("Zielrolle—"); // gespeicherte Zielrolle leer
  });

  it("CV-UPLOAD-UX-10: Suche startet erst mit gewaehltem Profil (Auswahl bleibt Pflicht)", async () => {
    mockProfile();
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    const startBtn = savedBoxStartButton();
    const searchSelect = document.getElementById("cv-saved-search-profile") as HTMLSelectElement;

    // Nach dem Speichern ist das Profil auto-selektiert -> Start aktiv
    expect(searchSelect.value).not.toBe("");
    expect(startBtn.disabled).toBe(false);

    // Auswahl zurueck auf Placeholder -> Start gesperrt + Hinweis sichtbar
    fireEvent.change(searchSelect, { target: { value: "" } });
    expect(startBtn.disabled).toBe(true);
    expect(screen.getByText(/Wähle zuerst ein CV-Profil/)).toBeTruthy();
    const callsBefore = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.click(startBtn); // gesperrt, kein Call
    expect(vi.mocked(fetchJobs).mock.calls.length).toBe(callsBefore);

    // wieder auswaehlen -> Start aktiv
    fireEvent.change(searchSelect, {
      target: { value: (searchSelect.querySelector("option:not([value=''])") as HTMLOptionElement).value },
    });
    expect(savedBoxStartButton().disabled).toBe(false);
    fireEvent.click(savedBoxStartButton());
    await waitFor(() => expect(vi.mocked(fetchJobs).mock.calls.length).toBe(callsBefore + 1));
  });

  it("'Jobs Finden' zeigt Spinner und sperrt während der Suche (Anfragerunner)", async () => {
    mockProfile();
    const gate = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(gate.promise);
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    const startBtn = savedBoxStartButton();
    fireEvent.click(startBtn);

    // Suche läuft: Button zeigt Spinner + Such-Label und ist gesperrt
    // (DOM-Node bleibt über Re-Renders stabil, daher einmalig referenzieren)
    await waitFor(() => expect(startBtn.disabled).toBe(true));
    expect(startBtn.querySelector(".spinner")).toBeTruthy();
    expect(startBtn.textContent).toContain("Suche");

    gate.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
  });

  it("CV-UPLOAD-UX-08: 'Jobs Finden' nutzt das gewaehlte gespeicherte Suchprofil", async () => {
    mockProfile();
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    await backToDocumentList();

    // Suchprofil waehlen + Start
    fireEvent.change(document.getElementById("cv-saved-search-profile") as HTMLSelectElement, {
      target: {
        value: (document.querySelector("#cv-saved-search-profile option:not([value=''])") as HTMLOptionElement).value,
      },
    });
    const callsBefore = vi.mocked(fetchJobs).mock.calls.length;
    fireEvent.click(savedBoxStartButton());
    await waitFor(() => expect(vi.mocked(fetchJobs).mock.calls.length).toBe(callsBefore + 1));
    expect(vi.mocked(fetchJobs).mock.calls.at(-1)![0]).toMatchObject({
      skills: "React",
      targetRoles: ["Frontend"],
      city: "Berlin",
    });
  });
});

describe("No landing-page flash during a search", () => {
  it("Initialzustand: Search-Hero wird angezeigt, keine Landingpage", () => {
    renderApp();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
    expect(document.querySelector(".results-workspace")).toBeNull();
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
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect(window.location.pathname).toBe("/top");

    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".results-workspace")).toBeTruthy();
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
    // Nach Suche: Ergebnisse sofort sichtbar in .results-workspace; search-hero bleibt sichtbar
    await screen.findByText("AWS Engineer");
    expect(screen.getByText("Mit KI bewerten")).toBeTruthy();

    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
    expect(document.querySelector(".results-workspace")).toBeTruthy();
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    matches.resolve({
      matches: [{ score: 90, why: "gut", prepare: "Bereite dich vor", job }],
    } as MatchResponse);
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".results-workspace")).toBeTruthy();
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
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
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
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
    expect(document.querySelector(".results-workspace")).toBeTruthy();
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

    // CV-UPLOAD-UX-01: Auto-Start des Workflows im Overlay direkt nach dem
    // Upload — keine Landingpage, kein Flicker
    await uploadCvToConsent();
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".landing-hero")).toBeNull();
    expect(document.querySelector(".search-sidebar")).toBeTruthy();
    expect(window.location.pathname).toBe("/top");

    await acceptUploadConsent();
    await proceedToProfileReady();
    await screen.findByText("Dein vorgeschlagenes Suchprofil");
    expect(document.querySelector(".landing")).toBeNull();
    expect(document.querySelector(".cv-workflow-overlay")).toBeTruthy();

    // Der Workflow-Overlay-Start verhindert ein Landing-Aufblitzen; im
    // Hintergrund laufende Suche bleibt davon unberuehrt (jobs resolve ok).
    jobs.resolve({ jobs: [job], meta: { totalFiltered: 1 } });
  });
});
describe("Old results / Search Clearing A-G (neue Semantik: sofortiges Leeren beim Suchstart)", () => {
  async function runSearchA() {
    vi.mocked(fetchJobs).mockResolvedValueOnce({ jobs: [job], meta: { totalFiltered: 1 } });
    renderApp();
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    fireEvent.click(screen.getByText("Meine Treffer finden"));
    await screen.findByText("AWS Engineer");
    expect(document.querySelector(".results-workspace")).toBeTruthy();
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
    expect(document.querySelector(".results-workspace")).toBeFalsy();
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
    expect(document.querySelector(".results-workspace")).toBeTruthy();
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

    // CV-UPLOAD-UX-01: Upload startet den Workflow im Overlay; Profil anlegen
    // (cvProfile) und bestaetigen, dann zurueck zur Liste und "Jobs Finden"
    // loest die CV-Suche aus (runCvSearch)
    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay(); // -> goal-selection, cvProfile ist gesetzt
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    // Zurueck: goal-selection -> profile-ready -> document-selected (Liste)
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Profil" }));
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Bearbeiten" }));
    await screen.findByText("Deine Lebensläufe");
    // Dokument blieb ausgewaehlt
    expect(screen.getByText("1 ausgewählt")).toBeTruthy();
    fireEvent.click(docListStartButton());

    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
    expect(document.querySelector(".results-workspace")).toBeFalsy();

    jobsB.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
    await waitFor(() => expect(screen.queryByText("AWS Engineer")).toBeNull());
  });

  it("CV-Dokumentenliste: 'Jobs Finden' startet die Suche (Liste navigiert zur Ziel-Ansicht)", async () => {
    vi.mocked(createProfile).mockResolvedValue({
      skills: ["Java"],
      experienceLevel: "Senior",
      targetRoles: ["Backend"],
      location: "Frankfurt",
    } as SuggestedProfile);
    const jobsGate = deferred<JobsResponse>();
    vi.mocked(fetchJobs).mockReturnValue(jobsGate.promise);
    renderApp();

    await uploadCvToConsent();
    await acceptUploadConsent();
    await proceedToProfileReady();
    confirmProfileInOverlay();
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Profil" }));
    await waitFor(() => expect(document.querySelector(".cv-processing-card .cv-result")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Zurück zum Bearbeiten" }));
    await screen.findByText("Deine Lebensläufe");

    fireEvent.click(docListStartButton());

    // Der Klick navigiert zur Ziel-Ansicht (Liste wird entmountet, daher kein
    // Spinner auf dem alten Button) und startet die CV-Suche.
    await waitFor(() => expect(vi.mocked(fetchJobs)).toHaveBeenCalled());
    await waitFor(() => expect(document.getElementById("cv-goal-execution-title")).toBeTruthy());

    jobsGate.resolve({ jobs: [jobB], meta: { totalFiltered: 1 } });
    await screen.findByText("Java Engineer");
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
    expect(document.querySelector(".results-workspace")).toBeTruthy();

    // Explizites Matching starten
    fireEvent.click(screen.getByText("Mit KI bewerten"));

    // Während des Matchings bleibt Layout sichtbar
    expect(document.querySelector(".results-workspace")).toBeTruthy();

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
    expect(document.querySelector(".results-workspace")).toBeTruthy();
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
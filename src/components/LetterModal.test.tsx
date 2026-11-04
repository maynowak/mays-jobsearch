import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LetterModal from "./LetterModal";
import { generateCoverLetter, isModelUnavailable, withModelFallback } from "../api";
import { resetCvProfileLists, saveCvAtsProfile, saveCvSearchProfile } from "../lib/cvProfileStore";
import { extractPdfText } from "../lib/pdf";
import { anonymizeText } from "../lib/anonymize";
import type { CvDocument, Job, Profile } from "../types";

vi.mock("../api", () => ({
  generateCoverLetter: vi.fn(),
  withModelFallback: vi.fn(),
  isFreeQuotaExceeded: vi.fn(() => false),
  isModelUnavailable: vi.fn(() => false),
}));

vi.mock("../lib/pdf", () => ({
  extractPdfText: vi.fn(async () => "Synthetic CV with React and TypeScript"),
}));

vi.mock("../lib/anonymize", () => ({
  anonymizeText: vi.fn((text: string) => `anonymized: ${text}`),
}));

const job: Job = {
  slug: "job-1",
  title: "Frontend Engineer",
  company_name: "Example GmbH",
  location: ["Berlin"],
  remote: true,
  tags: ["React"],
  url: "https://example.com/job-1",
  source: ["arbeitnow"],
};

const fullDescription =
  "Du entwickelst React-Anwendungen und betreust unsere Frontend-Plattform. " +
  "Du hast mindestens 3 Jahre Erfahrung mit TypeScript und React. " +
  "Kenntnisse in CSS und barrierefreiem Webdesign sind erforderlich.";

const reviewedJob: Job = {
  ...job,
  description: `<p>${fullDescription}</p>`,
  descriptionPlain: fullDescription,
};

function makeCv(overrides: Partial<CvDocument> = {}): CvDocument {
  return {
    id: "cv-1",
    name: "my-cv.pdf",
    size: 1024,
    selected: false,
    file: new File(["synthetic"], "my-cv.pdf", { type: "application/pdf" }),
    ...overrides,
  };
}

const profile: Profile = {
  skills: "React, TypeScript",
  targetRoles: ["Frontend Engineer"],
  city: "Berlin",
  radiusKm: 25,
  workModes: ["remote"],
  employmentTypes: ["full_time"],
};

const defaultProps: React.ComponentProps<typeof LetterModal> = {
  job,
  prepare: "Ask about the team.",
  profile,
  model: "model-x",
  modelsState: "ready",
  models: [
    { id: "model-x", name: "Model X" },
    { id: "model-y", name: "Model Y" },
  ],
  defaultModel: "model-x",
  availableModels: ["model-x", "model-y"],
  recommendedModel: "model-x",
  cvDocuments: [],
  onAddCv: vi.fn(),
  onClose: vi.fn(),
};

function renderModal(overrides: Partial<React.ComponentProps<typeof LetterModal>> = {}, lang: "de" | "en" = "de") {
  try {
    localStorage.setItem("mj-lang", lang);
  } catch {
    // ignore
  }
  return render(
    <LangProvider>
      <LetterModal {...defaultProps} {...overrides} />
    </LangProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCvProfileLists();
  vi.mocked(extractPdfText).mockResolvedValue("Synthetic CV with React and TypeScript");
  vi.mocked(anonymizeText).mockImplementation((text: string) => `anonymized: ${text}`);
  try {
    localStorage.setItem("mj-lang", "de");
  } catch {
    // ignore
  }
  vi.mocked(isModelUnavailable).mockReturnValue(false);
  vi.mocked(generateCoverLetter).mockResolvedValue({ letter: "Dear hiring team," });
  vi.mocked(withModelFallback).mockImplementation(async ({ initialModel, request }) => ({
    data: await request(initialModel ?? "model-x", 1),
    usedFallback: false,
    attempts: [],
  }));
});

afterEach(() => {
  cleanup();
  resetCvProfileLists();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe("CL-01 LetterModal: explicit start, no automatic AI call", () => {
  it("requires an explicit CV choice even when one CV exists", () => {
    const cv = makeCv();
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    expect(screen.getByLabelText("Ohne Lebenslauf fortfahren")).toBeChecked();
    expect(screen.getByLabelText(/my-cv\.pdf/)).not.toBeChecked();
    expect(screen.getByText("Hochgeladen — noch nicht verarbeitet")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("shows processed CV profile information without auto-selecting it", () => {
    const hash = "a".repeat(64);
    const saved = saveCvSearchProfile(hash, "Frontend", profile);
    expect(saved).not.toBeNull();
    if (saved) saveCvAtsProfile(hash, "ATS Frontend", ["React"], ["Frontend Engineer"], saved.id);
    const cv = makeCv({ processedAt: Date.now(), hash });
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    expect(screen.getByLabelText(/my-cv\.pdf/)).not.toBeChecked();
    expect(screen.getByText("Verarbeitet — Profilinformationen verfügbar")).toBeInTheDocument();
    expect(screen.getByText("1 Suchprofile · 1 ATS-Profile")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("selects an existing CV explicitly and drops the selection when it disappears", () => {
    const cv = makeCv();
    const view = renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });
    fireEvent.click(screen.getByLabelText(/my-cv\.pdf/));
    expect(screen.getByLabelText(/my-cv\.pdf/)).toBeChecked();

    view.rerender(
      <LangProvider>
        <LetterModal {...defaultProps} cvDocuments={[]} onAddCv={vi.fn()} />
      </LangProvider>
    );

    expect(screen.getByLabelText("Ohne Lebenslauf fortfahren")).toBeChecked();
    expect(screen.queryByLabelText(/my-cv\.pdf/)).not.toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("adds a new CV through the existing callback and preserves context", () => {
    const onAddCv = vi.fn();
    renderModal({ cvDocuments: [], onAddCv });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["synthetic"], "new-cv.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onAddCv).toHaveBeenCalledTimes(1);
    const [sentFile, context] = onAddCv.mock.calls[0];
    expect(sentFile.name).toBe("new-cv.pdf");
    expect(context.jobSlug).toBe(job.slug);
    expect(context.cvChoice).toBe("none");
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("restores a preserved preparation context", () => {
    const cv = makeCv({ id: "cv-restored", name: "restored.pdf" });
    renderModal({
      cvDocuments: [cv],
      initialContext: {
        jobSlug: job.slug,
        descriptionInput: "Preserved description",
        review: null,
        cvChoice: "existing",
        selectedCvId: cv.id,
      },
    });

    expect(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen")).toHaveValue(
      "Preserved description"
    );
    expect(screen.getByLabelText(/restored\.pdf/)).toBeChecked();
  });

  it("restores the locally selected model from a preserved context", () => {
    renderModal({
      initialContext: {
        jobSlug: job.slug,
        descriptionInput: "",
        review: null,
        cvChoice: "none",
        selectedCvId: null,
        model: "model-y",
      },
    });

    expect(screen.getAllByRole("combobox")[0].getAttribute("aria-label")).toContain(
      "model-y"
    );
  });

  it("opens with a preparation view and sends no AI request", () => {
    renderModal();

    expect(screen.getByText("Anschreiben-Assistent")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Example GmbH")).toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    expect(screen.getByText(/keine KI-Anfrage gesendet/i)).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("does not generate on re-render", () => {
    const view = renderModal();
    view.rerender(
      <LangProvider>
        <LetterModal {...defaultProps} />
      </LangProvider>
    );

    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("does not generate when closing the dialog", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("closes on Escape without starting generation", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("uses only the selected processed CV and sends no CV hash", async () => {
    const first = makeCv({
      id: "cv-first",
      name: "first.pdf",
      processedAt: Date.now(),
      hash: "a".repeat(64),
      file: new File(["first"], "first.pdf", { type: "application/pdf" }),
    });
    const second = makeCv({
      id: "cv-second",
      name: "second.pdf",
      processedAt: Date.now(),
      hash: "b".repeat(64),
      file: new File(["second"], "second.pdf", { type: "application/pdf" }),
    });
    vi.mocked(extractPdfText).mockImplementation(async (file: File) =>
      file.name === "first.pdf" ? "First CV content" : "Second CV content"
    );
    renderModal({ cvDocuments: [first, second], onAddCv: vi.fn() });

    fireEvent.click(screen.getByLabelText(/first\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    const [request] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.candidate.mode).toBe("cv");
    expect(request.candidate.cv_text).toContain("First CV content");
    expect(request.candidate.cv_text).not.toContain("Second CV content");
    expect(request.candidate).not.toHaveProperty("hash");
    expect(request.candidate).not.toHaveProperty("cv_hash");
    expect(request.candidate.cv_anonymized).toBe(true);
    expect(extractPdfText).toHaveBeenCalledTimes(1);
  });

  it("reuses the stored anonymized text of an already processed CV without re-reading the PDF", async () => {
    const cv = makeCv({
      id: "cv-processed",
      name: "processed.pdf",
      processedAt: Date.now(),
      hash: "c".repeat(64),
      letterText: "Stored anonymized CV text",
    });
    vi.mocked(extractPdfText).mockRejectedValue(new Error("PDF should not be read"));
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    fireEvent.click(screen.getByLabelText(/processed\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    const [request] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.candidate.mode).toBe("cv");
    expect(request.candidate.cv_text).toBe("Stored anonymized CV text");
    expect(request.candidate.cv_anonymized).toBe(true);
  });

  it("does not use an uploaded, unprocessed CV silently", () => {
    const cv = makeCv();
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    fireEvent.click(screen.getByLabelText(/my-cv\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/noch nicht verarbeitet/i);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("rejects an oversized CV instead of silently truncating it", async () => {
    const cv = makeCv({ processedAt: Date.now(), hash: "a".repeat(64) });
    vi.mocked(extractPdfText).mockResolvedValue("x".repeat(30001));
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    fireEvent.click(screen.getByLabelText(/my-cv\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/zu lang/i);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("does not offer an unredacted CV transfer and always sends anonymized text", async () => {
    const cv = makeCv({ processedAt: Date.now(), hash: "a".repeat(64) });
    renderModal({ cvDocuments: [cv], onAddCv: vi.fn() });

    fireEvent.click(screen.getByLabelText(/my-cv\.pdf/));
    expect(screen.queryByText("Ich verstehe, dass unredigierte personenbezogene Daten übertragen werden können.")).not.toBeInTheDocument();
    expect(screen.getByText(/unredigierte CV-Übertragung ist in diesem Release nicht verfügbar/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    const [request] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.candidate.cv_anonymized).toBe(true);
    expect(request.candidate.cv_text).toContain("anonymized:");
    expect(anonymizeText).toHaveBeenCalled();
  });

  it("supports a manual candidate context without a CV", async () => {
    renderModal({ cvDocuments: [], onAddCv: vi.fn() });

    fireEvent.change(screen.getByLabelText("Fähigkeiten"), {
      target: { value: "React, TypeScript" },
    });
    fireEvent.change(screen.getByLabelText("Erfahrung"), {
      target: { value: "4 Jahre Frontend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    const [request] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.candidate.mode).toBe("manual");
    expect(request.candidate.skills).toEqual(["React", "TypeScript"]);
    expect(request.candidate.experience).toBe("4 Jahre Frontend");
    expect(request.candidate).not.toHaveProperty("cv_text");
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("passes each fallback model through options.model", async () => {
    vi.mocked(withModelFallback).mockImplementation(async ({ request }) => {
      const data = await request("fallback-model", 2);
      return { data, usedFallback: true, attempts: [] };
    });

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    const [request, attempt] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.options.model).toBe("fallback-model");
    expect(attempt).toBe(2);
  });

  it("keeps the edited text and warns before regeneration", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    fireEvent.change(editor, { target: { value: "My edited draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Neu generieren" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/bearbeiteter Entwurf/);
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(editor).toHaveValue("My edited draft");
  });

  it("starts generation only after an explicit user action and uses the selected job", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    await waitFor(() => expect(screen.getByText("Dear hiring team,")).toBeInTheDocument());
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    const [request, attempt] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.job).toMatchObject({
      title: job.title,
      company_name: job.company_name,
      description_origin: "original",
    });
    expect(request.candidate).toMatchObject({ mode: "manual", skills: [] });
    expect(request.operation).toBe("generate");
    expect(request.options).toMatchObject({
      language: "German",
      style: "professional",
      length: "one_page",
      target_roles: profile.targetRoles,
      model: "model-x",
    });
    expect(attempt).toBe(1);
  });

  it("does not start a second request while the first one is loading", async () => {
    let resolveGeneration: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      resolveGeneration = resolve;
    });
    vi.mocked(withModelFallback).mockImplementation(async () => ({
      data: { letter: await pending },
      usedFallback: false,
      attempts: [],
    }));

    renderModal();
    const start = screen.getByRole("button", { name: "Anschreiben generieren" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(withModelFallback).toHaveBeenCalledTimes(1);
    resolveGeneration("Done");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Bearbeitbares Anschreiben" })).toHaveValue("Done")
    );
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("supports English labels", () => {
    renderModal({}, "en");

    expect(screen.getByText("Cover letter assistant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate cover letter" })).toBeInTheDocument();
  });

  it("resets to the preparation view when the job changes", () => {
    const view = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    view.rerender(
      <LangProvider>
        <LetterModal
          {...defaultProps}
          job={{ ...job, slug: "job-2", title: "Backend Engineer", company_name: "Other AG" }}
        />
      </LangProvider>
    );

    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Other AG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anschreiben generieren" })).toBeInTheDocument();
  });

  it("adopts an existing letter as an application draft without another AI call", async () => {
    const onAdoptAsApplication = vi.fn().mockResolvedValue("created");
    renderModal({ onAdoptAsApplication });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(withModelFallback).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }));

    expect(onAdoptAsApplication).toHaveBeenCalledTimes(1);
    expect(onAdoptAsApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({ slug: job.slug }),
        letter: "Dear hiring team,",
      })
    );
    expect(await screen.findByText("Dein Bewerbungsentwurf ist bereit.")).toBeInTheDocument();
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
  });

  it("adopts a manual job without URL and sends version metadata", async () => {
    const manualJob: Job = {
      ...job,
      slug: "manual:adopt-no-url",
      title: "Initiativbewerbung",
      company_name: "Unternehmen nicht angegeben",
      url: "",
      source: ["manual"],
      description: fullDescription,
      descriptionPlain: fullDescription,
    };
    const onAdoptAsApplication = vi.fn().mockResolvedValue("created");
    const onOpenApplicationDocuments = vi.fn();
    renderModal({
      job: manualJob,
      onAdoptAsApplication,
      onOpenApplicationDocuments,
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.click(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }));

    expect(onAdoptAsApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({ slug: "manual:adopt-no-url", url: "" }),
        versionSource: "generated",
        language: "de",
        model: "model-x",
      })
    );
    await screen.findByText("Dein Bewerbungsentwurf ist bereit.");
    fireEvent.click(screen.getByRole("button", { name: "Dokumente öffnen" }));
    expect(onOpenApplicationDocuments).toHaveBeenCalledTimes(1);
  });

  it("passes the selected CV reference into the local application draft", async () => {
    const cv = makeCv({ processedAt: Date.now(), hash: "a".repeat(64), name: "selected.pdf" });
    const onAdoptAsApplication = vi.fn().mockResolvedValue("created");
    renderModal({ cvDocuments: [cv], onAdoptAsApplication });
    fireEvent.click(screen.getByLabelText(/selected\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.click(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }));

    expect(onAdoptAsApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        cvReference: { cvId: cv.id, label: cv.name },
      })
    );
  });

  it("shows an existing draft with a check and still allows updating it", async () => {
    const onAdoptAsApplication = vi.fn().mockResolvedValue("updated");
    renderModal({ onAdoptAsApplication, hasApplicationDraft: true });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    expect(
      screen.getByText("Für diese Stelle ist bereits ein Anschreiben gespeichert.")
    ).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Anschreiben im Bewerbungsentwurf aktualisieren",
    });
    expect(button).toBeEnabled();
    expect(button.closest(".letter-application-adopt--existing")).not.toBeNull();
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(button);
    expect(onAdoptAsApplication).toHaveBeenCalledTimes(1);
  });

  it("shows the guest handoff and warns before sign-in when session applications exist", async () => {
    const onSignIn = vi.fn();
    renderModal({
      isAuthenticated: false,
      hasSessionApplications: true,
      onSignIn,
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    expect(screen.getByRole("heading", { name: "Deine Bewerbungen im Blick behalten" })).toBeInTheDocument();
    expect(screen.getByText(/ausschließlich während der aktiven Sitzung/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anmelden / Registrieren" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Nicht gespeicherte Bewerbungsentwürfe dieser Sitzung/);
    expect(screen.getByRole("button", { name: "Weiter zur Anmeldung" })).toHaveFocus();
    expect(onSignIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Anmelden / Registrieren" })).toHaveFocus()
    );
    fireEvent.click(screen.getByRole("button", { name: "Anmelden / Registrieren" }));
    fireEvent.click(screen.getByRole("button", { name: "Weiter zur Anmeldung" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("uses the existing sign-in callback directly for guests without session applications", async () => {
    const onSignIn = vi.fn();
    renderModal({ isAuthenticated: false, onSignIn });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    fireEvent.click(screen.getByRole("button", { name: "Anmelden / Registrieren" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows created/edited status and opens the existing applications view after adoption", async () => {
    const onAdoptAsApplication = vi.fn().mockResolvedValue("created");
    const onOpenApplications = vi.fn();
    renderModal({
      isAuthenticated: true,
      onAdoptAsApplication,
      onOpenApplications,
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(screen.getByText("Anschreiben erstellt.")).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: "Edited letter" } });
    expect(screen.getByText("Anschreiben bearbeitet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }));
    const ready = await screen.findByRole("heading", { name: "Dein Bewerbungsentwurf ist bereit." });
    await waitFor(() => expect(ready).toHaveFocus());
    expect(screen.getByText("Bewerbungsentwurf erfolgreich übernommen.")).toBeInTheDocument();
    expect(editor).toHaveValue("Edited letter");
    fireEvent.click(screen.getByRole("button", { name: "Meine Bewerbungen öffnen" }));
    expect(onOpenApplications).toHaveBeenCalledTimes(1);
    expect(withModelFallback).toHaveBeenCalledTimes(1);
  });

  it("shows the update status for an existing application draft", async () => {
    const onAdoptAsApplication = vi.fn().mockResolvedValue("updated");
    renderModal({
      isAuthenticated: true,
      onAdoptAsApplication,
      hasApplicationDraft: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben im Bewerbungsentwurf aktualisieren" }));
    expect(await screen.findByText("Bestehender Bewerbungsentwurf aktualisiert.")).toBeInTheDocument();
  });

  it("keeps the letter unchanged and offers retry when adoption fails", async () => {
    const onAdoptAsApplication = vi.fn().mockRejectedValue(new Error("repository down"));
    renderModal({ isAuthenticated: true, onAdoptAsApplication });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.click(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Übernahme als Bewerbungsentwurf ist fehlgeschlagen/);
    expect(editor).toHaveValue("Dear hiring team,");
    expect(screen.queryByText("Dein Bewerbungsentwurf ist bereit.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" })).toBeEnabled();
  });

  it("does not create a second application draft on double-click", async () => {
    let resolveAdopt!: (value: "created" | "updated") => void;
    const onAdoptAsApplication = vi.fn(
      () => new Promise<"created" | "updated">((resolve) => {
        resolveAdopt = resolve;
      })
    );
    renderModal({ isAuthenticated: true, onAdoptAsApplication });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    const adopt = screen.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" });
    fireEvent.click(adopt);
    fireEvent.click(adopt);
    expect(onAdoptAsApplication).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Dein Bewerbungsentwurf ist bereit.")).not.toBeInTheDocument();
    resolveAdopt("created");
    expect(await screen.findByText("Bewerbungsentwurf erfolgreich übernommen.")).toBeInTheDocument();
  });

  it("shows an error state and allows an explicit retry", async () => {
    vi.mocked(withModelFallback).mockRejectedValueOnce(new Error("provider down"));

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("provider down");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
    expect(withModelFallback).toHaveBeenCalledTimes(1);
  });

  it("focuses the heading on open, starts at the top and returns focus to the trigger on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <LangProvider>
          <button type="button" onClick={() => setOpen(true)}>
            Trigger
          </button>
          {open && <LetterModal {...defaultProps} onClose={() => setOpen(false)} />}
        </LangProvider>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Bewerbungsschreiben" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(heading).toHaveFocus();
    expect(dialog.scrollTop).toBe(0);
    expect(screen.getByRole("button", { name: "Anschreiben generieren" })).not.toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("keeps the focus trap around the modal heading", () => {
    renderModal();
    const heading = screen.getByRole("heading", { name: "Bewerbungsschreiben" });
    const generate = screen.getByRole("button", { name: "Anschreiben generieren" });
    expect(heading).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(generate).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Schließen" })).toHaveFocus();
  });

  it("shows a deterministic review with no AI call during the check", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      {
        target: {
          value:
            "Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript.",
        },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Plausibel")).toBeInTheDocument();
    expect(screen.getByText("Ergänzt")).toBeInTheDocument();
    expect(screen.getByText("Vorgesehene Beschreibung für die spätere Generierung")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("falls back to the original description on a clear mismatch", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      {
        target: {
          value:
            "Position als Backend Engineer bei Other AG. Du entwickelst Java-Anwendungen.",
        },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Deutlicher Widerspruch")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText(/Die vorhandene Beschreibung bleibt ausgewählt/)).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("requires and accepts confirmation for an uncertain enrichment", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      { target: { value: "Wir suchen eine motivierte Person mit Erfahrung und Teamgeist." } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Zuordnung unklar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Diesen Text trotzdem verwenden" }));

    expect(screen.getByText("Vom Benutzer ergänzt")).toBeInTheDocument();
    expect(screen.getByText("Für die spätere Verwendung bestätigt.")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("discards review input after closing and reopening", () => {
    const first = renderModal({ job: reviewedJob });
    fireEvent.change(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"), {
      target: { value: "Some text" },
    });
    first.unmount();

    renderModal({ job: reviewedJob });
    expect(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen")).toHaveValue("");
    expect(screen.queryByText("Prüfergebnis")).not.toBeInTheDocument();
  });

  it("resets the review input when the selected job changes", () => {
    const view = renderModal({ job: reviewedJob });
    const textarea = screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen");
    fireEvent.change(textarea, { target: { value: "Some text" } });
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));
    expect(screen.getByText("Prüfergebnis")).toBeInTheDocument();

    view.rerender(
      <LangProvider>
        <LetterModal
          {...defaultProps}
          job={{ ...reviewedJob, slug: "job-2", title: "Backend Engineer" }}
        />
      </LangProvider>
    );

    expect(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen")).toHaveValue("");
    expect(screen.queryByText("Prüfergebnis")).not.toBeInTheDocument();
  });

  it("downloads the edited cover letter text", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:cover-letter");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, { target: { value: "Edited download text" } });
    fireEvent.click(screen.getByRole("button", { name: "Download .txt" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    await expect(blob.text()).resolves.toBe("Edited download text");
    clickSpy.mockRestore();
  });

  it("keeps the copy action usable after generation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, { target: { value: "My edited letter text" } });

    fireEvent.click(screen.getByRole("button", { name: "Kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("My edited letter text"));
    expect(screen.getByText("Kopiert ✓")).toBeInTheDocument();
  });
});

describe("JM-COVER-LETTER-UX-01: local model choice and guided revision", () => {
  const generate = () =>
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));

  const modelCombobox = () => screen.getAllByRole("combobox")[0];
  const selectModel = (name: RegExp) => {
    fireEvent.click(modelCombobox());
    fireEvent.click(screen.getByRole("option", { name }));
  };

  it("shows the local model selector before generation without starting a request", () => {
    renderModal();

    expect(modelCombobox()).toBeInTheDocument();
    expect(screen.getByText("Das gewählte Modell wird für die nächste Generierung oder Überarbeitung verwendet.")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("changes the model without a request and uses it for the next generation", async () => {
    renderModal();
    generate();
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(withModelFallback).toHaveBeenCalledTimes(1);

    selectModel(/Model Y/);
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Neu generieren" }));
    await waitFor(() => expect(withModelFallback).toHaveBeenCalledTimes(2));
    expect(vi.mocked(withModelFallback).mock.calls[1][0].initialModel).toBe("model-y");
    expect(generateCoverLetter).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateCoverLetter).mock.calls[1][0].options.model).toBe("model-y");
  });

  it("keeps the model selector visible after a model failure and retries explicitly", async () => {
    vi.mocked(isModelUnavailable).mockReturnValue(true);
    vi.mocked(withModelFallback).mockRejectedValueOnce(new Error("provider down"));
    renderModal();

    generate();
    expect(await screen.findByRole("alert")).toHaveTextContent(/KI-Modell/);
    expect(modelCombobox()).toBeInTheDocument();

    selectModel(/Model Y/);
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    await waitFor(() => expect(withModelFallback).toHaveBeenCalledTimes(2));
    expect(vi.mocked(withModelFallback).mock.calls[1][0].initialModel).toBe("model-y");
  });

  it("preserves an edited draft when the model changes", async () => {
    renderModal();
    generate();
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, { target: { value: "Edited draft must stay" } });

    selectModel(/Model Y/);

    expect(editor).toHaveValue("Edited draft must stay");
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
  });

  it("does not start a revision when the feedback changes", async () => {
    renderModal();
    generate();
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    fireEvent.change(screen.getByLabelText("Was möchtest du am Anschreiben verbessern?"), {
      target: { value: "Bitte kürzer." },
    });

    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
  });

  it("revises with feedback using the edited draft as the basis", async () => {
    renderModal();
    generate();
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, { target: { value: "Edited draft text" } });
    fireEvent.change(screen.getByLabelText("Was möchtest du am Anschreiben verbessern?"), {
      target: { value: "Bitte kürzer formulieren." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Mit Kommentar verbessern" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/bearbeiteter Entwurf/);
    expect(withModelFallback).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiteten Entwurf verbessern" }));
    await waitFor(() => expect(withModelFallback).toHaveBeenCalledTimes(2));

    const [request] = vi.mocked(generateCoverLetter).mock.calls[1];
    expect(request.operation).toBe("revise");
    expect(request.revision?.draft_text).toContain("anonymized: Edited draft text");
    expect(request.revision?.draft_text).not.toBe("Edited draft text");
    expect(request.revision?.feedback).toContain("anonymized: Bitte kürzer formulieren.");
    expect(request.revision?.draft_anonymized).toBe(true);
  });

  it("revises without feedback and asks for general improvement", async () => {
    renderModal();
    generate();
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    fireEvent.click(screen.getByRole("button", { name: "Mit Kommentar verbessern" }));
    await waitFor(() => expect(withModelFallback).toHaveBeenCalledTimes(2));

    const [request] = vi.mocked(generateCoverLetter).mock.calls[1];
    expect(request.operation).toBe("revise");
    expect(request.revision?.draft_text).toContain("Dear hiring team,");
    expect(request.revision?.feedback).toBeUndefined();
  });

  it("keeps the previous draft when the model returns an empty letter", async () => {
    renderModal();
    generate();
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    expect(editor).toHaveValue("Dear hiring team,");
    vi.mocked(withModelFallback).mockResolvedValueOnce({
      data: { letter: "   " },
      usedFallback: false,
      attempts: [],
    });

    fireEvent.click(screen.getByRole("button", { name: "Neu generieren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/kein verwertbares Anschreiben/);
    expect(screen.getByRole("textbox", { name: "Bearbeitbares Anschreiben" })).toHaveValue(
      "Dear hiring team,"
    );
  });

  it("keeps the previous draft when regeneration fails", async () => {
    renderModal();
    generate();
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, { target: { value: "Draft that must survive" } });
    vi.mocked(withModelFallback).mockRejectedValueOnce(new Error("provider down"));

    fireEvent.click(screen.getByRole("button", { name: "Neu generieren" }));
    fireEvent.click(screen.getByRole("button", { name: "Bearbeiteten Entwurf überschreiben" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("provider down");

    expect(screen.getByRole("textbox", { name: "Bearbeitbares Anschreiben" })).toHaveValue(
      "Draft that must survive"
    );
    expect(withModelFallback).toHaveBeenCalledTimes(2);
  });

  it("anonymizes personal data in the revised draft before transfer", async () => {
    vi.mocked(anonymizeText).mockImplementation((text: string) =>
      `anonymized: ${text.replace("max@example.com", "[E-MAIL]")}`
    );
    renderModal();
    generate();
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    fireEvent.change(editor, {
      target: { value: "Max Mustermann, max@example.com, Telefon 0170 1234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Mit Kommentar verbessern" }));
    fireEvent.click(screen.getByRole("button", { name: "Bearbeiteten Entwurf verbessern" }));
    await waitFor(() => expect(withModelFallback).toHaveBeenCalledTimes(2));

    const [request] = vi.mocked(generateCoverLetter).mock.calls[1];
    expect(request.revision?.draft_text).toContain("anonymized:");
    expect(request.revision?.draft_text).not.toContain("max@example.com");
    expect(anonymizeText).toHaveBeenCalled();
  });

  it("shows distinct regenerate and improve actions after generation", async () => {
    renderModal();
    generate();
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });

    expect(screen.getByRole("button", { name: "Neu generieren" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mit Kommentar verbessern" })
    ).toBeInTheDocument();
  });

  it("uses a complete manual description and locks Phase B adoption clearly", async () => {
    const manualJob: Job = {
      ...job,
      slug: "manual:phase-b",
      title: "Initiativbewerbung",
      company_name: "Unternehmen nicht angegeben",
      url: "",
      source: ["manual"],
      description: fullDescription,
      descriptionPlain: fullDescription,
    };
    renderModal({
      job: manualJob,
      adoptionLocked: true,
      onAdoptAsApplication: vi.fn(),
    });
    expect(screen.getByText(/keine KI-Anfrage/)).toBeInTheDocument();
    generate();
    await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    const [request] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(request.job.description).toBe(fullDescription);
    expect(request.job.source).toEqual(["manual"]);
    expect(request.job.url).toBe("");
    expect(screen.getByText("Übernahme noch nicht verfügbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Als Bewerbungsentwurf übernehmen/ })).toBeNull();
  });
});

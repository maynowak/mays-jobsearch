import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationLetterComparison from "./ApplicationLetterComparison";
import { generateCoverLetter } from "../api";
import { createSessionApplication, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
import { ApplicationRepositoryError } from "../lib/applications/repositoryTypes";
import type { ApplicationJobReferenceV1, CoverLetterVersionV1 } from "../lib/applications/contractTypes";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    generateCoverLetter: vi.fn(),
    withModelFallback: vi.fn(async ({ request }) => {
      const data = await request("model-a", 1);
      return { data, usedFallback: false, attempts: [{ model: "model-a", ok: true }] };
    }),
  };
});

vi.mock("../lib/anonymize", () => ({
  anonymizeText: (text: string) => `ANON:${text}`,
}));

const NOW = "2026-11-03T10:00:00.000Z";
const job: ApplicationJobReferenceV1 = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://example.invalid/job-1",
};

function version(
  id: string,
  content: string,
  language: "de" | "en" = "de"
): CoverLetterVersionV1 {
  return {
    versionId: id,
    jobId: job.jobId,
    createdAt: NOW,
    content,
    source: "generated",
    language,
    model: "model-old",
  };
}

function makeApplication(
  versions: CoverLetterVersionV1[] = [],
  draft = "Original letter",
  localId = "local-1"
): SessionApplicationV1 {
  const base = createSessionApplication({ localId, now: NOW, job, coverLetter: draft });
  return { ...base, documents: { ...base.documents, coverLetterDraft: draft, coverLetterVersions: versions } };
}

const models = [{ id: "model-a", name: "Model A" }];

function renderComparison(
  application: SessionApplicationV1,
  callbacks: {
    onSaveVersion?: (version: Parameters<NonNullable<React.ComponentProps<typeof ApplicationLetterComparison>["onSaveVersion"]>>[0]) => Promise<SessionApplicationV1>;
    onAdoptDraft?: (content: string) => Promise<SessionApplicationV1>;
    onOpenDraft?: () => void;
    onNavigateToOverview?: () => void;
    onShowApplicationList?: () => void;
  } = {}
) {
  return render(
    <LangProvider>
      <ApplicationLetterComparison
        application={application}
        models={models}
        defaultModel="model-a"
        recommendedModel="model-a"
        {...callbacks}
      />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  vi.clearAllMocks();
  vi.mocked(generateCoverLetter).mockResolvedValue({ letter: "IMPROVED LETTER" });
});

afterEach(() => {
  cleanup();
});

describe("LETTER-REVISION-01B AI improvement preview", () => {
  it("requires explicit consent and sends one anonymised revise request", async () => {
    const application = makeApplication([version("v1", "Version one")], "Current letter");
    renderComparison(application);
    const button = screen.getByRole("button", { name: "Verbesserung vorschlagen" });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Verbesserungswunsch"), {
      target: { value: "Bitte persönlicher formulieren." },
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    const proposal = await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    expect(proposal).toHaveValue("IMPROVED LETTER");
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    const [request, attempt] = vi.mocked(generateCoverLetter).mock.calls[0];
    expect(attempt).toBe(1);
    expect(request.operation).toBe("revise");
    expect(request.options.model).toBe("model-a");
    expect(request.candidate.mode).toBe("manual");
    expect(request.candidate.skills).toEqual([]);
    expect(request.job).toMatchObject({ title: "Senior Fullstack Developer", company_name: "Siemens AG" });
    expect(request.revision?.draft_text).toBe("ANON:Current letter");
    expect(request.revision?.feedback).toBe("ANON:Bitte persönlicher formulieren.");
    expect(request.revision?.draft_anonymized).toBe(true);

    expect(screen.getAllByText("Current letter").length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).toHaveValue("IMPROVED LETTER");
    expect(screen.getByRole("heading", { name: "Änderungen" })).toBeInTheDocument();
    expect(document.querySelector(".applications-letter-improvement__diff-text ins")).not.toBeNull();
    expect(screen.getAllByText(/Nicht automatisch als Version gespeichert/).length).toBeGreaterThan(0);
  });

  it("uses the selected saved version as source", async () => {
    renderComparison(makeApplication([version("v1", "Version one"), version("v2", "Version two")], "Draft"));
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    expect(await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).toHaveValue("IMPROVED LETTER");
    expect(vi.mocked(generateCoverLetter).mock.calls[0][0].revision?.draft_text).toBe("ANON:Version one");
  });

  it("discards the proposal and keeps the original texts unchanged", async () => {
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Vorschlag verwerfen" }));
    expect(screen.queryByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verbesserung vorschlagen" })).toHaveFocus()
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("keeps the original and shows a useful error when the provider fails", async () => {
    vi.mocked(generateCoverLetter).mockRejectedValueOnce(new Error("provider down"));
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Verbesserung konnte nicht erstellt werden/);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).not.toBeInTheDocument();
  });

  it("does not issue a second request when the action is clicked twice while pending", async () => {
    let resolveRequest!: (value: { letter: string }) => void;
    vi.mocked(generateCoverLetter).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    fireEvent.click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: "Verbesserung vorschlagen" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    resolveRequest({ letter: "AFTER PENDING" });
    expect(await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).toHaveValue("AFTER PENDING");
  });

  it("does not show a late proposal after switching applications", async () => {
    let resolveRequest!: (value: { letter: string }) => void;
    vi.mocked(generateCoverLetter).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    const first = makeApplication([version("v1", "First")], "First draft");
    const second = makeApplication([version("v2", "Second")], "Second draft", "local-2");
    const view = renderComparison(first);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    view.rerender(
      <LangProvider>
        <ApplicationLetterComparison
          application={second}
          models={models}
          defaultModel="model-a"
          recommendedModel="model-a"
        />
      </LangProvider>
    );
    resolveRequest({ letter: "LATE PROPOSAL" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).not.toBeInTheDocument());
    expect(screen.getByText("Second draft")).toBeInTheDocument();
  });
  it("updates the diff while the proposal is edited without changing the original", async () => {
    renderComparison(makeApplication([version("v1", "Version one")], "Original letter"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    const proposal = await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.change(proposal, { target: { value: "Manually edited proposal" } });
    expect(proposal).toHaveValue("Manually edited proposal");
    expect(screen.getAllByText("Original letter").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Änderungen" })).toBeInTheDocument();
    expect(document.querySelector(".applications-letter-improvement__diff-text ins")).not.toBeNull();
  });

  it("shows no-change state when source and proposal are identical", async () => {
    vi.mocked(generateCoverLetter).mockResolvedValueOnce({ letter: "Current letter" });
    renderComparison(makeApplication([], "Current letter"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    expect(screen.getByText("Keine Änderungen.")).toBeInTheDocument();
  });

  it("saves the edited AI proposal as a revised version through the existing callback", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    const onSaveVersion = vi.fn(async (nextVersion) => ({
      ...application,
      documents: { ...application.documents, coverLetterVersions: [...application.documents.coverLetterVersions, nextVersion] },
      version: application.version + 1,
    }));
    const onNavigateToOverview = vi.fn();
    const onShowApplicationList = vi.fn();
    const view = renderComparison(application, {
      onSaveVersion,
      onNavigateToOverview,
      onShowApplicationList,
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    const editor = await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.change(editor, { target: { value: "Edited AI proposal" } });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    const savedStatus = await screen.findByText("Version 2 gespeichert.");
    await waitFor(() => expect(savedStatus).toHaveFocus());
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
    const saved = onSaveVersion.mock.calls[0][0];
    expect(saved.source).toBe("revised");
    expect(saved.content).toBe("Edited AI proposal");
    expect(saved.model).toBe("model-a");
    expect(saved.versionId).not.toBe("v1");
    expect(application.documents.coverLetterVersions).toHaveLength(1);
    expect(application.documents.coverLetterVersions[0].content).toBe("Version one");
    const updated = await onSaveVersion.mock.results[0].value;
    view.rerender(
      <LangProvider>
        <ApplicationLetterComparison
          application={updated}
          models={models}
          defaultModel="model-a"
          recommendedModel="model-a"
          onSaveVersion={onSaveVersion}
          onNavigateToOverview={onNavigateToOverview}
          onShowApplicationList={onShowApplicationList}
        />
      </LangProvider>
    );
    expect(screen.getByText("Anschreiben-Version erfolgreich gespeichert.")).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /Version 2/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Version vergleichen" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Vergleichsversion") as HTMLSelectElement).value).toBe(saved.versionId)
    );
    fireEvent.click(screen.getByRole("button", { name: "Zur Bewerbungsübersicht" }));
    expect(onNavigateToOverview).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Alle Bewerbungen anzeigen" }));
    expect(onShowApplicationList).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before adopting a version as the current draft", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    const onAdoptDraft = vi.fn(async (content) => ({
      ...application,
      documents: { ...application.documents, coverLetterDraft: content, documentStatus: "draft" as const },
      version: application.version + 1,
    }));
    const onOpenDraft = vi.fn();
    renderComparison(application, { onAdoptDraft, onOpenDraft });
    fireEvent.click(screen.getByRole("button", { name: "Als aktuellen Entwurf übernehmen" }));
    expect(screen.getByText(/Den aktuellen Anschreibenentwurf durch diese Version ersetzen/)).toBeInTheDocument();
    expect(onAdoptDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onAdoptDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Als aktuellen Entwurf übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, Entwurf ersetzen" }));
    const adoptedStatus = await screen.findByText("Version als aktueller Entwurf übernommen.");
    await waitFor(() => expect(adoptedStatus).toHaveFocus());
    expect(onAdoptDraft).toHaveBeenCalledWith("Version one");
    expect(screen.getByText("Aktueller Anschreibenentwurf wurde aktualisiert.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entwurf öffnen" }));
    expect(onOpenDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps the proposal on a save conflict and does not issue a second save", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    const onSaveVersion = vi.fn().mockRejectedValue(
      new ApplicationRepositoryError("conflict", "version_conflict")
    );
    renderComparison(application, { onSaveVersion });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    const editor = await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/zwischenzeitlich geändert/i);
    expect(editor).toHaveValue("IMPROVED LETTER");
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Anschreiben-Version erfolgreich gespeichert.")).toBeNull();
  });

  it("reports unsaved proposal state to the parent navigation guard", async () => {
    const onDirtyChange = vi.fn();
    const application = makeApplication([version("v1", "Version one")], "Draft");
    render(
      <LangProvider>
        <ApplicationLetterComparison
          application={application}
          models={models}
          defaultModel="model-a"
          recommendedModel="model-a"
          onDirtyChange={onDirtyChange}
        />
      </LangProvider>
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "Vorschlag verwerfen" }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("blocks double-click while saving a version", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    let resolveSave!: (value: SessionApplicationV1) => void;
    const onSaveVersion = vi.fn(() => new Promise<SessionApplicationV1>((resolve) => {
      resolveSave = resolve;
    }));
    renderComparison(application, { onSaveVersion });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    const saveButton = screen.getByRole("button", { name: "Als neue Version speichern" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
    resolveSave(application);
    await screen.findByText("Version 1 gespeichert.");
  });

  it("clears consent when the source version changes", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    renderComparison(application);
    const consent = screen.getByRole("checkbox");
    fireEvent.click(consent);
    expect(consent).toBeChecked();
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    await waitFor(() => expect(consent).not.toBeChecked());
  });

  it("shows the dedicated empty-answer message", async () => {
    vi.mocked(generateCoverLetter).mockResolvedValueOnce({ letter: "   " });
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/keinen verwendbaren Text/);
    expect(screen.queryByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).not.toBeInTheDocument();
  });

  it("marks a saved proposal and disables a repeated unchanged save", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    const onSaveVersion = vi.fn(async (nextVersion) => ({
      ...application,
      documents: {
        ...application.documents,
        coverLetterVersions: [...application.documents.coverLetterVersions, nextVersion],
      },
      version: application.version + 1,
    }));
    renderComparison(application, { onSaveVersion });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    await screen.findByText("Version 2 gespeichert.");
    expect(screen.getByRole("button", { name: "Als Version gespeichert" })).toBeDisabled();
    expect(screen.getByText(/Als Version 2 gespeichert\. Weitere Änderungen/)).toBeInTheDocument();
  });

  it("moves focus into and back out of the adoption confirmation", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    renderComparison(application, {
      onAdoptDraft: vi.fn(async () => application),
    });
    const trigger = screen.getByRole("button", { name: "Als aktuellen Entwurf übernehmen" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Ja, Entwurf ersetzen" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Als aktuellen Entwurf übernehmen" })).toHaveFocus()
    );
  });

  it("ignores a late save after an application switch and resets the save guard", async () => {
    const first = makeApplication([version("v1", "First"), version("v1b", "First two")], "First draft");
    const second = makeApplication([version("v2", "Second")], "Second draft", "local-2");
    let resolveFirst!: (value: SessionApplicationV1) => void;
    const onSaveVersion = vi.fn()
      .mockImplementationOnce(() => new Promise<SessionApplicationV1>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(async (nextVersion) => ({
        ...second,
        documents: {
          ...second.documents,
          coverLetterVersions: [...second.documents.coverLetterVersions, nextVersion],
        },
        version: second.version + 1,
      }));
    const view = renderComparison(first, { onSaveVersion });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    expect(onSaveVersion).toHaveBeenCalledTimes(1);

    view.rerender(
      <LangProvider>
        <ApplicationLetterComparison
          application={second}
          models={models}
          defaultModel="model-a"
          recommendedModel="model-a"
          onSaveVersion={onSaveVersion}
        />
      </LangProvider>
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    expect(onSaveVersion).toHaveBeenCalledTimes(2);

    resolveFirst({
      ...first,
      documents: {
        ...first.documents,
        coverLetterVersions: [...first.documents.coverLetterVersions, version("v-first-late", "Late first")],
      },
      version: first.version + 1,
    });
    await waitFor(() => expect(screen.queryByText("Version 3 gespeichert.")).not.toBeInTheDocument());
  });


  it("sends the explicitly selected language, style and length without an automatic request", async () => {
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));

    fireEvent.change(screen.getByLabelText("Sprache des Anschreibens"), { target: { value: "English" } });
    fireEvent.change(screen.getByLabelText("Art des Anschreibens"), { target: { value: "formal" } });
    fireEvent.change(screen.getByLabelText("Gewünschte Länge"), { target: { value: "short" } });
    expect(generateCoverLetter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });

    expect(vi.mocked(generateCoverLetter).mock.calls[0][0].options).toMatchObject({
      language: "English",
      style: "formal",
      length: "short",
      model: "model-a",
    });
  });

  it("keeps UI language and cover-letter language independent", async () => {
    localStorage.setItem("mj-lang", "en");
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    expect(screen.getByLabelText("Cover-letter language")).toHaveValue("English");
    fireEvent.change(screen.getByLabelText("Cover-letter language"), { target: { value: "German" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Suggest improvement" }));
    await screen.findByRole("textbox", { name: "Edit AI proposal" });
    expect(vi.mocked(generateCoverLetter).mock.calls[0][0].options.language).toBe("German");
  });

  it("uses a saved version's known language as the initial value", () => {
    renderComparison(
      makeApplication([version("v1", "German version", "de"), version("v2", "English version", "en")], "Draft")
    );
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v2" } });
    expect(screen.getByLabelText("Sprache des Anschreibens")).toHaveValue("English");
  });

  it("clears consent and preview when an improvement option changes", async () => {
    renderComparison(makeApplication([version("v1", "Version one")], "Draft"));
    const consent = screen.getByRole("checkbox");
    fireEvent.click(consent);
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.change(screen.getByLabelText("Art des Anschreibens"), { target: { value: "formal" } });
    expect(consent).not.toBeChecked();
    expect(screen.queryByRole("textbox", { name: "KI-Vorschlag bearbeiten" })).not.toBeInTheDocument();
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
  });

  it("stores the selected letter language on a saved version", async () => {
    const application = makeApplication([version("v1", "Version one")], "Draft");
    const onSaveVersion = vi.fn(async (nextVersion) => ({
      ...application,
      documents: {
        ...application.documents,
        coverLetterVersions: [...application.documents.coverLetterVersions, nextVersion],
      },
      version: application.version + 1,
    }));
    renderComparison(application, { onSaveVersion });
    fireEvent.change(screen.getByLabelText("Sprache des Anschreibens"), { target: { value: "English" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Verbesserung vorschlagen" }));
    await screen.findByRole("textbox", { name: "KI-Vorschlag bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    await screen.findByText("Version 2 gespeichert.");
    expect(onSaveVersion.mock.calls[0][0].language).toBe("en");
  });
});

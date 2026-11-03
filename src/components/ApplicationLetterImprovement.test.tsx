import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationLetterComparison from "./ApplicationLetterComparison";
import { generateCoverLetter } from "../api";
import { createSessionApplication, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
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

function version(id: string, content: string): CoverLetterVersionV1 {
  return {
    versionId: id,
    jobId: job.jobId,
    createdAt: NOW,
    content,
    source: "generated",
    language: "de",
    model: "model-old",
  };
}

function makeApplication(versions: CoverLetterVersionV1[] = [], draft = "Original letter"): SessionApplicationV1 {
  const base = createSessionApplication({ localId: "local-1", now: NOW, job, coverLetter: draft });
  return { ...base, documents: { ...base.documents, coverLetterDraft: draft, coverLetterVersions: versions } };
}

const models = [{ id: "model-a", name: "Model A" }];

function renderComparison(application: SessionApplicationV1) {
  return render(
    <LangProvider>
      <ApplicationLetterComparison
        application={application}
        models={models}
        defaultModel="model-a"
        recommendedModel="model-a"
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
    expect(screen.getAllByText(/Nicht als Version gespeichert/).length).toBeGreaterThan(0);
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
    const second = makeApplication([version("v2", "Second")], "Second draft");
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

});

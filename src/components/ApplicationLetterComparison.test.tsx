import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationLetterComparison from "./ApplicationLetterComparison";
import { createSessionApplication, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
import type { ApplicationJobReferenceV1, CoverLetterVersionV1 } from "../lib/applications/contractTypes";

const NOW = "2026-11-03T10:00:00.000Z";
const job: ApplicationJobReferenceV1 = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://example.invalid/job-1",
};

function version(id: string, content: string, source: CoverLetterVersionV1["source"], extra: Partial<CoverLetterVersionV1> = {}): CoverLetterVersionV1 {
  return { versionId: id, jobId: job.jobId, createdAt: NOW, content, source, ...extra };
}

function makeApplication(
  versions: CoverLetterVersionV1[] = [],
  draft = "CURRENT DRAFT",
  localId = "local-1"
): SessionApplicationV1 {
  const base = createSessionApplication({ localId, now: NOW, job, coverLetter: draft });
  return {
    ...base,
    documents: { ...base.documents, coverLetterDraft: draft, coverLetterVersions: versions },
  };
}

function renderComparison(application: SessionApplicationV1) {
  const view = render(
    <LangProvider>
      <ApplicationLetterComparison application={application} />
    </LangProvider>
  );
  return view;
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("LETTER-REVISION-01A ApplicationLetterComparison", () => {
  it("shows the empty state and the current draft when no version exists", () => {
    renderComparison(makeApplication());
    expect(screen.getByText("Für dieses Anschreiben wurden noch keine Versionen gespeichert.")).toBeInTheDocument();
    expect(screen.getByText("CURRENT DRAFT")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ausgangsversion")).not.toBeInTheDocument();
  });

  it("compares the current draft with the latest saved version by default", () => {
    const v1 = version("v1", "FIRST VERSION", "generated", { language: "de", model: "model-a" });
    const v2 = version("v2", "LATEST VERSION", "revised", { language: "en" });
    renderComparison(makeApplication([v1, v2]));

    expect(
      (screen.getAllByRole("option", { name: /Aktueller Entwurf/ })[0] as HTMLOptionElement).selected
    ).toBe(true);
    expect(screen.getByText("CURRENT DRAFT")).toBeInTheDocument();
    expect(screen.getByText("LATEST VERSION")).toBeInTheDocument();
    expect(screen.getByText("CURRENT DRAFT")).not.toBe(screen.getByText("LATEST VERSION"));
  });

  it("allows selecting any two versions and shows their metadata", () => {
    const v1 = version("v1", "FIRST VERSION", "generated", { language: "de", model: "model-a" });
    const v2 = version("v2", "SECOND VERSION", "revised", { language: "en" });
    const v3 = version("v3", "THIRD VERSION", "manual");
    renderComparison(makeApplication([v1, v2, v3]));

    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    fireEvent.change(screen.getByLabelText("Vergleichsversion"), { target: { value: "v2" } });

    expect(screen.getByText("FIRST VERSION")).toBeInTheDocument();
    expect(screen.getByText("SECOND VERSION")).toBeInTheDocument();
    expect(screen.getAllByText("KI-generiert").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Überarbeitet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("model-a").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EN").length).toBeGreaterThan(0);
  });

  it("explains when both sides use the same version", () => {
    const v1 = version("v1", "FIRST VERSION", "generated");
    renderComparison(makeApplication([v1]));
    fireEvent.change(screen.getByLabelText("Vergleichsversion"), { target: { value: "v1" } });
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    expect(screen.getByRole("status")).toHaveTextContent("Beide Seiten zeigen dieselbe Fassung.");
  });

  it("renders long text, special characters and empty content without truncation", () => {
    const long = `LONG START ${"äöü & <tag> \\n".repeat(200)} LONG END`;
    const app = makeApplication([version("v1", long, "manual")], "");
    const view = renderComparison(app);
    expect(screen.getByText("Kein Text vorhanden.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    expect(screen.getAllByText(long).length).toBeGreaterThan(0);

    view.rerender(
      <LangProvider>
        <ApplicationLetterComparison application={makeApplication([], "NEW DRAFT")} />
      </LangProvider>
    );
    expect(screen.getByText("NEW DRAFT")).toBeInTheDocument();
    expect(screen.queryByText(/LONG START/)).not.toBeInTheDocument();
  });

  it("resets the selection when switching applications", async () => {
    const first = makeApplication([version("v1", "FIRST", "generated")], "FIRST DRAFT");
    const second = makeApplication([version("v2", "SECOND", "generated")], "SECOND DRAFT", "local-2");
    const view = renderComparison(first);
    fireEvent.change(screen.getByLabelText("Ausgangsversion"), { target: { value: "v1" } });
    expect(screen.getAllByText("FIRST").length).toBeGreaterThan(0);

    view.rerender(
      <LangProvider>
        <ApplicationLetterComparison application={second} />
      </LangProvider>
    );
    await waitFor(() => expect(screen.getByText("SECOND DRAFT")).toBeInTheDocument());
    expect(screen.getByLabelText("Ausgangsversion")).toHaveValue("current");
    expect(screen.queryByText("FIRST")).not.toBeInTheDocument();
  });
});

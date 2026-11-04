import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationsSection from "./ApplicationsSection";
import { createSessionApplicationRepository } from "../lib/applications/sessionRepository";
import { createSessionApplication } from "../lib/applications/sessionApplications";
import { buildManualJob } from "../lib/applications/manualJob";
import {
  clearManualJobSession,
  saveManualJobSession,
} from "../lib/applications/manualJobSession";

const validDescription =
  "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.";

function renderSection(onOpenLetter = vi.fn()) {
  const repository = createSessionApplicationRepository();
  render(
    <LangProvider>
      <ApplicationsSection repository={repository} onOpenLetter={onOpenLetter} />
    </LangProvider>
  );
  return { onOpenLetter, repository };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  clearManualJobSession();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ApplicationsSection manual application entry", () => {
  it("opens the new application form and hands a complete manual job to LetterModal", async () => {
    const { onOpenLetter } = renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(onOpenLetter).toHaveBeenCalledTimes(1);
    const job = onOpenLetter.mock.calls[0][0];
    expect(job.description).toBe(validDescription);
    expect(job.source).toEqual(["manual"]);
    expect(job.url).toBe("");
    expect(job.slug).toMatch(/^manual:/);
  });

  it("keeps the form open and supports dirty cancel confirmation", async () => {
    const { onOpenLetter } = renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText("Diese ungespeicherte Stellenanzeige verwerfen?")).toBeInTheDocument();
    expect(onOpenLetter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(screen.queryByLabelText(/Stellenbeschreibung/)).toBeNull();
  });

  it("offers the draft action only to authenticated users", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    expect(screen.queryByRole("button", { name: "Als Entwurf anlegen" })).toBeNull();
    cleanup();

    render(
      <LangProvider>
        <ApplicationsSection
          repository={createSessionApplicationRepository()}
          onOpenLetter={vi.fn()}
          isAuthenticated
        />
      </LangProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    expect(screen.getByRole("button", { name: "Als Entwurf anlegen" })).toBeInTheDocument();
  });

  it("creates a session draft without a cover-letter version", async () => {
    const repository = createSessionApplicationRepository();
    const onOpenLetter = vi.fn();
    render(
      <LangProvider>
        <ApplicationsSection
          repository={repository}
          onOpenLetter={onOpenLetter}
          isAuthenticated
        />
      </LangProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Als Entwurf anlegen" }));
    await waitFor(() =>
      expect(screen.getByText("Bewerbungsentwurf für diese Sitzung angelegt.")).toBeInTheDocument()
    );
    const page = await repository.list();
    expect(page.items).toHaveLength(1);
    expect(page.items[0].documents.coverLetterDraft).toBe("");
    expect(page.items[0].documents.coverLetterVersions).toHaveLength(0);
    expect(page.items[0].documents.documentStatus).toBe("missing");
    expect(onOpenLetter).not.toHaveBeenCalled();
  });

  it("does not create a duplicate draft for an existing manual job", async () => {
    const uuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("duplicate");
    const built = buildManualJob({ description: validDescription }, "manual:duplicate");
    const existing = createSessionApplication({
      localId: "local-existing",
      now: "2026-11-04T10:00:00.000Z",
      coverLetter: "",
      job: built.reference!,
    });
    const repository = createSessionApplicationRepository({ initial: [existing] });
    render(
      <LangProvider>
        <ApplicationsSection
          repository={repository}
          onOpenLetter={vi.fn()}
          isAuthenticated
        />
      </LangProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Als Entwurf anlegen" }));
    await waitFor(() =>
      expect(screen.getByText("Für diese Stelle besteht bereits ein Bewerbungsentwurf.")).toBeInTheDocument()
    );
    expect((await repository.list()).items).toHaveLength(1);
    uuidSpy.mockRestore();
  });

  it("opens LetterModal for an existing draft with the session description", async () => {
    const built = buildManualJob({ description: validDescription }, "manual:context-1");
    expect(built.job).not.toBeNull();
    expect(built.reference).not.toBeNull();
    const application = createSessionApplication({
      localId: "local-context",
      now: "2026-11-04T10:00:00.000Z",
      coverLetter: "",
      job: built.reference!,
    });
    saveManualJobSession({
      id: "manual:context-1",
      job: built.job!,
      reference: built.reference!,
      updatedAt: "2026-11-04T10:00:00.000Z",
    });
    const repository = createSessionApplicationRepository({ initial: [application] });
    const onOpenLetter = vi.fn();
    render(
      <LangProvider>
        <ApplicationsSection
          repository={repository}
          onOpenLetter={onOpenLetter}
          isAuthenticated
        />
      </LangProvider>
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Dokumente" }));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben erstellen" }));
    expect(onOpenLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "manual:context-1",
        description: validDescription,
      })
    );
  });

  it("asks for the description again when the session context is missing", async () => {
    const built = buildManualJob({ description: validDescription }, "manual:missing-context");
    const application = createSessionApplication({
      localId: "local-missing-context",
      now: "2026-11-04T10:00:00.000Z",
      coverLetter: "",
      job: built.reference!,
    });
    clearManualJobSession();
    const repository = createSessionApplicationRepository({ initial: [application] });
    const onOpenLetter = vi.fn();
    render(
      <LangProvider>
        <ApplicationsSection
          repository={repository}
          onOpenLetter={onOpenLetter}
          isAuthenticated
        />
      </LangProvider>
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Dokumente" }));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben erstellen" }));
    expect(screen.getByText("Stellenbeschreibung erforderlich")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Stellenbeschreibung/ }), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben-Assistent öffnen" }));
    expect(onOpenLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "manual:missing-context",
        description: validDescription,
      })
    );
  });

  it("shows a manual source and renders no invalid URL link", async () => {
    const manualApplication = createSessionApplication({
      localId: "local-manual",
      now: "2026-11-04T10:00:00.000Z",
      coverLetter: "",
      job: {
        jobId: "manual:test-1",
        title: "Initiativbewerbung",
        companyName: "Unternehmen nicht angegeben",
        location: [],
        source: ["manual"],
        jobOrigin: "manual",
      },
    });
    const repository = createSessionApplicationRepository({ initial: [manualApplication] });
    render(
      <LangProvider>
        <ApplicationsSection repository={repository} />
      </LangProvider>
    );
    expect(await screen.findByText("Manuell hinzugefügt")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Originalanzeige öffnen" })).toBeNull();
  });

  it("reloads after adoption and can target the documents tab", async () => {
    const repository = createSessionApplicationRepository();
    const view = render(
      <LangProvider>
        <ApplicationsSection repository={repository} refreshToken={0} />
      </LangProvider>
    );
    expect(await screen.findByText("Noch keine Bewerbungen")).toBeInTheDocument();
    const application = await repository.create({
      job: {
        jobId: "manual:test-refresh",
        title: "Initiativbewerbung",
        companyName: "Unternehmen nicht angegeben",
        location: [],
        source: ["manual"],
        jobOrigin: "manual",
      },
      coverLetter: "Ein Anschreiben.",
    });
    view.rerender(
      <LangProvider>
        <ApplicationsSection
          repository={repository}
          refreshToken={1}
          navigationTarget={{ localId: application.localId, tab: "documents" }}
        />
      </LangProvider>
    );
    await waitFor(() => expect(screen.getAllByText("Initiativbewerbung").length).toBeGreaterThan(0));
    const documentsTab = await screen.findByRole("tab", { name: "Dokumente" });
    expect(documentsTab).toHaveAttribute("aria-selected", "true");
  });
});

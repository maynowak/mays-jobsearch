import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationsSection from "./ApplicationsSection";
import { createSessionApplicationRepository } from "../lib/applications/sessionRepository";
import { createSessionApplication } from "../lib/applications/sessionApplications";

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

  it("does not pretend to save an application in Phase B", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Neue Bewerbung/ }));
    expect(screen.queryByRole("button", { name: /Als Bewerbung speichern/ })).toBeNull();
    expect(screen.getByText(/Phase C/)).toBeInTheDocument();
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
});

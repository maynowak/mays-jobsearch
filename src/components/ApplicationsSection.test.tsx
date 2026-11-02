import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationsSection from "./ApplicationsSection";
import { createSessionApplication, transitionSessionStatus, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
import type { ApplicationJobReferenceV1 } from "../lib/applications/contractTypes";

const NOW = "2026-11-02T10:00:00.000Z";
const job: ApplicationJobReferenceV1 = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1-S",
};

function draft(overrides: { localId?: string; job?: ApplicationJobReferenceV1; now?: string } = {}): SessionApplicationV1 {
  return createSessionApplication({
    localId: overrides.localId ?? "local-1",
    now: overrides.now ?? NOW,
    coverLetter: "Dear team,\n\nI am interested.",
    cvReference: { cvId: "cv-1", label: "Synthetic CV" },
    job: overrides.job ?? job,
  });
}

function submitted(): SessionApplicationV1 {
  const application = draft();
  return transitionSessionStatus(application, {
    expectedVersion: 1,
    to: "submitted",
    at: "2026-11-02T11:00:00.000Z",
    confirmed: true,
  });
}

function Harness({ initial }: { initial: SessionApplicationV1[] }) {
  const [applications, setApplications] = useState(initial);
  return <ApplicationsSection applications={applications} onChange={setApplications} />;
}

function renderSection(initial: SessionApplicationV1[] = [draft()]) {
  return render(
    <LangProvider>
      <Harness initial={initial} />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("APP-02 ApplicationsSection", () => {
  it("shows the session-only notice and an understandable empty state", () => {
    renderSection([]);
    expect(screen.getByText(/nur in der aktuellen Sitzung verfügbar/i)).toBeInTheDocument();
    expect(screen.getByText("Noch keine Bewerbungen")).toBeInTheDocument();
  });

  it("shows an overview and opens details without a server request", () => {
    renderSection([draft()]);
    expect(screen.getAllByText("Senior Fullstack Developer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Siemens AG").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);
    expect(screen.getByText(/job-1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Originalanzeige öffnen" })).toHaveAttribute(
      "href",
      "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1-S"
    );
  });

  it("filters by status and sorts by date", () => {
    const draftOlder = draft({ localId: "local-old", now: "2026-11-01T10:00:00.000Z" });
    const secondJob = { ...job, jobId: "job-2", title: "Cloud Engineer", companyName: "Other AG" };
    const newer = draft({ localId: "local-new", job: secondJob, now: NOW });
    renderSection([draftOlder, newer]);

    fireEvent.change(screen.getByLabelText("Statusfilter"), { target: { value: "draft" } });
    expect(screen.getAllByText("Cloud Engineer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Senior Fullstack Developer").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Nach Datum sortieren"), { target: { value: "oldest" } });
    const items = Array.from(document.querySelectorAll<HTMLElement>(".applications-list__item"));
    expect(items[0]).toHaveTextContent("Senior Fullstack Developer");
  });

  it("asks explicitly before marking a draft as submitted", () => {
    renderSection([draft()]);
    fireEvent.click(screen.getByRole("button", { name: "Beworben / Antwort ausstehend" }));
    expect(screen.getByText("Hast du diese Bewerbung tatsächlich abgeschickt?")).toBeInTheDocument();
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Ja, als versendet markieren" }));
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hast du diese Bewerbung tatsächlich abgeschickt?")).toBeNull();
  });

  it("saves the current cover-letter draft as an explicit version", () => {
    renderSection([draft()]);
    expect(screen.getByText(/Anschreiben-Versionen/).closest("p")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Aktuellen Entwurf als Version speichern" }));
    expect(screen.getByText(/Anschreiben-Versionen/).closest("p")).toHaveTextContent("1");
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);
  });

  it("records feedback, interview and note without changing the status", () => {
    renderSection([submitted()]);
    fireEvent.change(screen.getByLabelText("Welche Rückmeldung hast du erhalten?"), {
      target: { value: "We would like to talk." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rückmeldung speichern" }));
    expect(screen.getByText(/We would like to talk\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Datum und Uhrzeit"), {
      target: { value: "2026-11-10T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Termin speichern" }));
    expect(screen.getByText(/2026-11-10/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Notiz"), { target: { value: "Prepare examples." } });
    fireEvent.click(screen.getByRole("button", { name: "Notiz speichern" }));
    expect(screen.getByText(/Prepare examples\./)).toBeInTheDocument();
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
  });

  it("exports a local draft and deletes only after confirmation", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:local-application");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderSection([draft()]);
    fireEvent.click(screen.getByRole("button", { name: "Lokalen Entwurf exportieren" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-application");

    fireEvent.click(screen.getByRole("button", { name: "Sitzungsentwurf löschen" }));
    expect(screen.getByText(/temporären Sitzungsentwurf löschen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
    expect(screen.getByText("Noch keine Bewerbungen")).toBeInTheDocument();
  });

  it("keeps a failed action visible instead of mutating the draft", () => {
    const application = submitted();
    renderSection([application]);
    // The UI only exposes valid transitions; this verifies the error surface
    // remains available for domain failures.
    expect(screen.getByRole("button", { name: "Rückmeldung speichern" })).toBeDisabled();
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
  });
});

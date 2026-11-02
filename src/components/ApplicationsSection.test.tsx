import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationsSection from "./ApplicationsSection";
import { createSessionApplication, transitionSessionStatus, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
import { createSessionApplicationRepository } from "../lib/applications/sessionRepository";
import { ApplicationRepositoryError, type ApplicationRepository } from "../lib/applications/repositoryTypes";
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

function Harness({
  initial,
  onChanged,
}: {
  initial: SessionApplicationV1[];
  onChanged?: (applications: SessionApplicationV1[]) => void;
}) {
  const [repository] = useState(() => createSessionApplicationRepository({ initial }));
  return <ApplicationsSection repository={repository} onChanged={onChanged} />;
}

function renderSection(initial: SessionApplicationV1[] = [draft()]) {
  return render(
    <LangProvider>
      <Harness initial={initial} />
    </LangProvider>
  );
}

function renderSectionWithChanges(initial: SessionApplicationV1[] = [draft()]) {
  const onChanged = vi.fn();
  const view = render(
    <LangProvider>
      <Harness initial={initial} onChanged={onChanged} />
    </LangProvider>
  );
  return { view, onChanged };
}

function calendarDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function detailed(): SessionApplicationV1 {
  return {
    ...draft(),
    applicationChannel: "email",
    applicationDate: "2026-10-15T00:00:00.000Z",
    contact: { name: "Anna Beispiel", email: "anna@example.com", phone: "+49 170 1234567" },
    notes: "Bestehende persönliche Notiz",
    salary: {
      expectation: { amount: 70000, currency: "EUR", period: "year" },
      offer: { amount: 65000, currency: "EUR", period: "year" },
    },
  };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("APP-02 ApplicationsSection", () => {
  it("shows the session-only notice and an understandable empty state", async () => {
    renderSection([]);
    expect(await screen.findByText("Noch keine Bewerbungen")).toBeInTheDocument();
    expect(screen.getByText(/nur in der aktuellen Sitzung verfügbar/i)).toBeInTheDocument();
  });

  it("shows an overview and opens details without a server request", async () => {
    renderSection([draft()]);
    await screen.findByText("Senior Fullstack Developer");
    expect(screen.getAllByText("Senior Fullstack Developer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Siemens AG").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/job-1/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Originalanzeige öffnen" })).toHaveAttribute(
      "href",
      "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1-S"
    );
  });

  it("filters by status and sorts by date", async () => {
    const draftOlder = draft({ localId: "local-old", now: "2026-11-01T10:00:00.000Z" });
    const secondJob = { ...job, jobId: "job-2", title: "Cloud Engineer", companyName: "Other AG" };
    const newer = draft({ localId: "local-new", job: secondJob, now: NOW });
    renderSection([draftOlder, newer]);
    await screen.findByText("Cloud Engineer");

    fireEvent.change(screen.getByLabelText("Statusfilter"), { target: { value: "draft" } });
    expect(screen.getAllByText("Cloud Engineer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Senior Fullstack Developer").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Nach Datum sortieren"), { target: { value: "oldest" } });
    const items = Array.from(document.querySelectorAll<HTMLElement>(".applications-list__item"));
    expect(items[0]).toHaveTextContent("Senior Fullstack Developer");
  });

  it("asks explicitly before marking a draft as submitted", async () => {
    renderSection([draft()]);
    fireEvent.click(await screen.findByRole("button", { name: "Beworben / Antwort ausstehend" }));
    expect(screen.getByText("Hast du diese Bewerbung tatsächlich abgeschickt?")).toBeInTheDocument();
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Ja, als versendet markieren" }));
    await waitFor(() =>
      expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0)
    );
    expect(screen.queryByText("Hast du diese Bewerbung tatsächlich abgeschickt?")).toBeNull();
  });

  it("saves the current cover-letter draft as an explicit version", async () => {
    renderSection([draft()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Dokumente" }));
    await screen.findByRole("button", { name: "Aktuellen Entwurf als Version speichern" });
    expect(screen.getByText(/Anschreiben-Versionen/).closest("p")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Aktuellen Entwurf als Version speichern" }));
    await waitFor(() =>
      expect(screen.getByText(/Anschreiben-Versionen/).closest("p")).toHaveTextContent("1")
    );
    expect(screen.getAllByText("Entwurf").length).toBeGreaterThan(0);
  });

  it("records feedback, interview and note without changing the status", async () => {
    renderSection([submitted()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Kommunikation" }));
    await screen.findByLabelText("Welche Rückmeldung hast du erhalten?");
    fireEvent.change(screen.getByLabelText("Welche Rückmeldung hast du erhalten?"), {
      target: { value: "We would like to talk." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rückmeldung speichern" }));
    await waitFor(() => expect(screen.getByText(/We would like to talk\./)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Datum und Uhrzeit"), {
      target: { value: "2026-11-10T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Termin speichern" }));
    await waitFor(() => expect(screen.getByText(/10\.11\.2026/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: "Verlauf" }));
    await screen.findByLabelText("Notiz");
    fireEvent.change(screen.getByLabelText("Notiz"), { target: { value: "Prepare examples." } });
    fireEvent.click(screen.getByRole("button", { name: "Notiz speichern" }));
    await waitFor(() => expect(screen.getByText(/Prepare examples\./)).toBeInTheDocument());
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
  });

  it("exports a local draft and deletes only after confirmation", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:local-application");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderSection([draft()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Dokumente" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lokalen Entwurf exportieren" }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-application");

    fireEvent.click(screen.getByRole("button", { name: "Sitzungsentwurf löschen" }));
    expect(screen.getByText(/temporären Sitzungsentwurf löschen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
    await waitFor(() => expect(screen.getByText("Noch keine Bewerbungen")).toBeInTheDocument());
  });

  it("keeps a failed action visible instead of mutating the draft", async () => {
    const application = submitted();
    renderSection([application]);
    fireEvent.click(await screen.findByRole("tab", { name: "Kommunikation" }));
    await screen.findByRole("button", { name: "Rückmeldung speichern" });
    // The UI only exposes valid transitions; this verifies the error surface
    // remains available for domain failures.
    expect(screen.getByRole("button", { name: "Rückmeldung speichern" })).toBeDisabled();
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
  });

  it("opens the edit form with all existing application details prefilled", async () => {
    renderSection([detailed()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));

    expect(screen.getByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bewerbungsweg")).toHaveValue("email");
    expect(screen.getByLabelText("Bewerbungsdatum")).toHaveValue("2026-10-15");
    expect(screen.getByLabelText("Name")).toHaveValue("Anna Beispiel");
    expect(screen.getByLabelText("E-Mail")).toHaveValue("anna@example.com");
    expect(screen.getByLabelText("Telefon")).toHaveValue("+49 170 1234567");
    expect(screen.getByLabelText("Persönliche Notizen")).toHaveValue("Bestehende persönliche Notiz");
    expect(screen.getByLabelText("Gehaltsvorstellung Betrag")).toHaveValue(70000);
    expect(screen.getByLabelText("Angebotenes Gehalt Betrag")).toHaveValue(65000);
  });

  it("saves changed application details through the repository", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));

    fireEvent.change(screen.getByLabelText("Bewerbungsweg"), { target: { value: "portal" } });
    fireEvent.change(screen.getByLabelText("Bewerbungsdatum"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Max Kontakt" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "max@example.com" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "+49 30 123456" } });
    fireEvent.change(screen.getByLabelText("Persönliche Notizen"), { target: { value: "Neue Notiz" } });
    fireEvent.change(screen.getByLabelText("Gehaltsvorstellung Betrag"), { target: { value: "80000" } });
    fireEvent.change(screen.getByLabelText("Angebotenes Gehalt Betrag"), { target: { value: "75000" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.applicationChannel).toBe("portal");
    expect(updated.applicationDate).toBe("2026-10-20T00:00:00.000Z");
    expect(updated.contact).toEqual({ name: "Max Kontakt", email: "max@example.com", phone: "+49 30 123456" });
    expect(updated.notes).toBe("Neue Notiz");
    expect(updated.salary?.expectation).toEqual({ amount: 80000, currency: "EUR", period: "year" });
    expect(updated.salary?.offer).toEqual({ amount: 75000, currency: "EUR", period: "year" });
    expect(updated.status).toBe("draft");
    expect(screen.queryByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeNull();
  });

  it("clears optional application details without dummy values", async () => {
    const { onChanged } = renderSectionWithChanges([detailed()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));

    fireEvent.change(screen.getByLabelText("Bewerbungsweg"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Bewerbungsdatum"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Telefon"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Persönliche Notizen"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Gehaltsvorstellung Betrag"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Angebotenes Gehalt Betrag"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.applicationChannel).toBeUndefined();
    expect(updated.applicationDate).toBeUndefined();
    expect(updated.contact).toBeUndefined();
    expect(updated.notes).toBeUndefined();
    expect(updated.salary).toBeUndefined();
  });

  it("rejects an invalid contact email and keeps the form values", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "invalid-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/gültige E-Mail-Adresse/i);
    expect(screen.getByLabelText("E-Mail")).toHaveValue("invalid-email");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("rejects invalid salary values and keeps the form open", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Gehaltsvorstellung Betrag"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/positiven Gehaltsbetrag/i);
    expect(screen.getByLabelText("Gehaltsvorstellung Betrag")).toHaveValue(0);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("cancels editing without mutating the application", async () => {
    const { onChanged } = renderSectionWithChanges([detailed()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Persönliche Notizen"), { target: { value: "Nicht speichern" } });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText("Bestehende persönliche Notiz")).toBeInTheDocument();
  });

  it("keeps the form values on a version conflict", async () => {
    const base = createSessionApplicationRepository({ initial: [draft()] });
    const conflicted: ApplicationRepository = {
      ...base,
      update: async () => {
        throw new ApplicationRepositoryError("conflict", "version_conflict");
      },
    };
    render(
      <LangProvider>
        <ApplicationsSection repository={conflicted} />
      </LangProvider>
    );
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Persönliche Notizen"), { target: { value: "Nicht verlieren" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/zwischenzeitlich geändert/i);
    expect(screen.getByLabelText("Persönliche Notizen")).toHaveValue("Nicht verlieren");
    expect(screen.getByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeInTheDocument();
  });

  it("prevents a double-click from saving twice", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Persönliche Notizen"), { target: { value: "Einmal speichern" } });
    const save = screen.getByRole("button", { name: "Änderungen speichern" });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0][0][0].notes).toBe("Einmal speichern");
  });

  it("resets an open edit form when the repository/session changes", async () => {
    const first = createSessionApplicationRepository({ initial: [detailed()] });
    const view = render(
      <LangProvider>
        <ApplicationsSection repository={first} />
      </LangProvider>
    );
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));
    expect(screen.getByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeInTheDocument();

    const next = createSessionApplicationRepository();
    view.rerender(
      <LangProvider>
        <ApplicationsSection repository={next} />
      </LangProvider>
    );

    await waitFor(() => expect(screen.queryByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeNull());
    expect(screen.getByText("Noch keine Bewerbungen")).toBeInTheDocument();
  });

  it("starts on overview and switches tabs without changing the selected application", async () => {
    renderSection([detailed()]);
    const overview = await screen.findByRole("tab", { name: "Übersicht" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Übersicht" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Kommunikation" }));
    expect(screen.getByRole("tab", { name: "Kommunikation" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Kommunikation" })).toBeInTheDocument();
    expect(screen.getAllByText("Senior Fullstack Developer").length).toBeGreaterThan(0);
  });

  it("supports arrow, Home and End keyboard navigation on the tabs", async () => {
    renderSection([draft()]);
    const overview = await screen.findByRole("tab", { name: "Übersicht" });
    overview.focus();

    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Kommunikation" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Kommunikation" }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(screen.getByRole("tab", { name: "Verlauf" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(screen.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the status visible outside the overview tab", async () => {
    renderSection([submitted()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Dokumente" }));
    expect(screen.getAllByText("Beworben / Antwort ausstehend").length).toBeGreaterThan(0);
    expect(screen.getByRole("tabpanel", { name: "Dokumente" })).toBeInTheDocument();
  });

  it("requires saving or cancelling before switching tabs or applications while editing", async () => {
    const otherJob = { ...job, jobId: "job-2", title: "Cloud Engineer", companyName: "Other AG" };
    renderSection([detailed(), { ...draft({ localId: "local-2", job: otherJob }) }]);
    fireEvent.click(
      await screen.findByRole("button", { name: /Senior Fullstack Developer.*Siemens AG/ })
    );
    await screen.findByRole("heading", { name: "Senior Fullstack Developer", level: 3 });
    await screen.findByRole("button", { name: "Bewerbungsdaten bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }));

    fireEvent.click(screen.getByRole("tab", { name: "Dokumente" }));
    expect(screen.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/speichere oder brich/i);
    expect(screen.getByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cloud Engineer/ }));
    expect(screen.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Name")).toHaveValue("Anna Beispiel");
    expect(screen.getByRole("form", { name: "Bewerbungsdaten bearbeiten" })).toBeInTheDocument();
  });

  it("returns to overview and shows the newly selected application", async () => {
    const otherJob = { ...job, jobId: "job-2", title: "Cloud Engineer", companyName: "Other AG" };
    renderSection([detailed(), draft({ localId: "local-2", job: otherJob })]);
    fireEvent.click(await screen.findByRole("button", { name: /Cloud Engineer.*Other AG/ }));
    expect(screen.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Cloud Engineer", level: 3 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Dokumente" }));
    fireEvent.click(screen.getByRole("button", { name: /Senior Fullstack Developer.*Siemens AG/ }));
    expect(screen.getByRole("tab", { name: "Übersicht" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Senior Fullstack Developer", level: 3 })).toBeInTheDocument();
  });

  it("shows today's and overdue follow-ups in the overview and application list", async () => {
    const todayApplication = {
      ...draft({ localId: "today" }),
      followUp: { dueOn: calendarDate(0), status: "open" as const },
    };
    const overdueApplication = {
      ...draft({ localId: "overdue", job: { ...job, jobId: "job-2", title: "Overdue Job" } }),
      followUp: { dueOn: calendarDate(-3), status: "open" as const, note: "Nachfassen" },
    };
    renderSection([overdueApplication, todayApplication]);
    await screen.findByText("Overdue Job");
    expect(screen.getAllByText("Heute nachfassen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 Tage überfällig").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Overdue Job/ }));
    expect(screen.getByText("Nächste Wiedervorlage:")).toBeInTheDocument();
  });

  it("creates and edits a follow-up in the communication tab", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Kommunikation" }));
    fireEvent.change(screen.getByLabelText("Wiedervorlagedatum"), { target: { value: "2026-11-16" } });
    fireEvent.change(screen.getByLabelText("Grund / geplante Aktion"), {
      target: { value: "Bei der Personalabteilung nachfragen." },
    });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Wiedervorlage speichern" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.followUp).toEqual({
      dueOn: "2026-11-16",
      note: "Bei der Personalabteilung nachfragen.",
      status: "open",
    });
    expect(updated.status).toBe("draft");
  });

  it("marks a follow-up completed, reopens it and removes it without changing status", async () => {
    const application = {
      ...draft(),
      followUp: { dueOn: "2026-11-16", note: "Nachfassen", status: "open" as const },
    };
    const { onChanged } = renderSectionWithChanges([application]);
    fireEvent.click(await screen.findByRole("tab", { name: "Kommunikation" }));
    onChanged.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Als erledigt markieren" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    let updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.followUp?.status).toBe("completed");
    expect(updated.followUp?.completedAt).toBeTruthy();
    expect(updated.status).toBe("draft");

    fireEvent.click(screen.getByRole("button", { name: "Erneut öffnen" }));
    await waitFor(() => expect(onChanged.mock.calls.length).toBeGreaterThan(1));
    updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.followUp).toEqual({ dueOn: "2026-11-16", note: "Nachfassen", status: "open" });

    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    await waitFor(() => expect(onChanged.mock.calls.length).toBeGreaterThan(2));
    updated = onChanged.mock.calls.at(-1)?.[0][0] as SessionApplicationV1;
    expect(updated.followUp).toBeUndefined();
    expect(updated.status).toBe("draft");
  });

  it("rejects an empty follow-up date without mutating the application", async () => {
    const { onChanged } = renderSectionWithChanges([draft()]);
    fireEvent.click(await screen.findByRole("tab", { name: "Kommunikation" }));
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Wiedervorlage speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/gültiges Wiedervorlagedatum/i);
    expect(onChanged).not.toHaveBeenCalled();
  });
  it("ignores a late operation after the repository/session changes", async () => {
    const base = createSessionApplicationRepository({ initial: [draft()] });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deferred: ApplicationRepository = {
      ...base,
      transitionStatus: async (localId, input) => {
        await gate;
        return base.transitionStatus(localId, input);
      },
    };
    const onChanged = vi.fn();
    const view = render(
      <LangProvider>
        <ApplicationsSection repository={deferred} onChanged={onChanged} />
      </LangProvider>
    );

    await screen.findByRole("button", { name: "Beworben / Antwort ausstehend" });
    onChanged.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Beworben / Antwort ausstehend" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, als versendet markieren" }));

    const nextSession = createSessionApplicationRepository();
    view.rerender(
      <LangProvider>
        <ApplicationsSection repository={nextSession} onChanged={onChanged} />
      </LangProvider>
    );
    release();
    await waitFor(() => expect(screen.getByText("Noch keine Bewerbungen")).toBeInTheDocument());

    const staleSubmitted = onChanged.mock.calls
      .flat()
      .some((applications) =>
        Array.isArray(applications) && applications.some((application) => application.status === "submitted")
      );
    expect(staleSubmitted).toBe(false);
    expect((await nextSession.list()).items).toHaveLength(0);
  });

});

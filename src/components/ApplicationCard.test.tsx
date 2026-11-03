import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import ApplicationCard from "./ApplicationCard";
import { createSessionApplication, type SessionApplicationV1 } from "../lib/applications/sessionApplications";
import type { ApplicationJobReferenceV1 } from "../lib/applications/contractTypes";

const NOW = "2026-11-03T10:00:00.000Z";
const job: ApplicationJobReferenceV1 = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://example.invalid/job-1",
};

function application(overrides: Partial<SessionApplicationV1> = {}): SessionApplicationV1 {
  return {
    ...createSessionApplication({
      localId: "local-1",
      now: NOW,
      job,
      coverLetter: "Dear team,",
    }),
    ...overrides,
  };
}

function renderCard(record: SessionApplicationV1, selected = false, onSelect = vi.fn()) {
  render(
    <LangProvider>
      <ApplicationCard application={record} selected={selected} onSelect={onSelect} />
    </LangProvider>
  );
  return onSelect;
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("UX-05B ApplicationCard", () => {
  it("renders job, employer, status, location and date", () => {
    renderCard(application());
    const card = screen.getByRole("button");
    expect(card).toHaveTextContent("Senior Fullstack Developer");
    expect(card).toHaveTextContent("Siemens AG");
    expect(card).toHaveTextContent("Entwurf");
    expect(card).toHaveTextContent("Frankfurt am Main");
    expect(card).toHaveTextContent("Erstellt:");
    expect(card).not.toHaveTextContent("Bewerbungsdatum:");
  });

  it("renders incomplete drafts without dummy values or errors", () => {
    renderCard(
      application({
        job: { ...job, location: [] },
        applicationDate: undefined,
        contact: undefined,
        salary: undefined,
      })
    );
    const card = screen.getByRole("button");
    expect(card).toHaveTextContent("Senior Fullstack Developer");
    expect(card).not.toHaveTextContent("Frankfurt am Main");
    expect(card).toHaveTextContent("Erstellt:");
  });

  it("keeps long titles accessible while clamping the visual title", () => {
    const longTitle = "Senior Fullstack Developer with an exceptionally long and descriptive job title for testing";
    renderCard(application({ job: { ...job, title: longTitle } }));
    const title = screen.getByTitle(longTitle);
    expect(title).toHaveAttribute("title", longTitle);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", expect.stringContaining(longTitle));
  });

  it("highlights the selected card without replacing its accessible name", () => {
    renderCard(application(), true);
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveClass("applications-card--selected");
    expect(card).toHaveTextContent("✓");
  });

  it("uses the existing follow-up calendar semantics in the card", () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderCard(application({ followUp: { dueOn: date, status: "open" } }));
    expect(screen.getByRole("button")).toHaveTextContent("Heute nachfassen");
    expect(screen.getByRole("button")).toHaveClass("applications-card");
  });

  it("selects a card through its native button action", () => {
    const onSelect = renderCard(application());
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

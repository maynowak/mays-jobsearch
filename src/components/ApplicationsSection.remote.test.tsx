import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ApplicationsSection from "./ApplicationsSection";
import { LangProvider } from "../i18n";
import { createSessionApplicationRepository } from "../lib/applications/sessionRepository";
import { createRemoteApplicationRepository } from "../lib/applications/remoteSessionRepository";
import type { ApplicationV1 } from "../lib/applications/contractTypes";
import type { ApplicationPersistencePort } from "../lib/applications/repositoryTypes";

const application: ApplicationV1 = {
  schemaVersion: 1,
  applicationId: "app-1",
  ownerId: "user-1",
  job: {
    jobId: "job-1",
    title: "Test Software Engineer",
    companyName: "Synthetic Test Company",
    location: ["Darmstadt"],
    source: ["synthetic"],
    jobOrigin: "source",
  },
  documents: { coverLetterDraft: "", coverLetterVersions: [], documentStatus: "missing" },
  status: "draft",
  statusHistory: [],
  history: [],
  version: 1,
  createdAt: "2026-11-05T10:00:00Z",
  updatedAt: "2026-11-05T10:00:00Z",
};

function port(): ApplicationPersistencePort {
  return {
    list: vi.fn(async () => ({ items: [application], nextCursor: null })),
    get: vi.fn(async () => application),
    create: vi.fn(async () => application),
    update: vi.fn(async () => application),
    transitionStatus: vi.fn(async () => application),
    addFeedback: vi.fn(async () => application),
    addInterview: vi.fn(async () => application),
    addNote: vi.fn(async () => application),
    addCoverLetterVersion: vi.fn(async () => application),
    export: vi.fn(async () => ({
      schemaVersion: 1 as const,
      exportedAt: "2026-11-05T12:00:00Z",
      application,
    })),
    delete: vi.fn(async () => ({
      schemaVersion: 1 as const,
      applicationId: "app-1",
      ownerId: "user-1",
      deletedAt: "2026-11-05T12:00:00Z",
    })),
  };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("ApplicationsSection remote preview", () => {
  it("zeigt im Remote-Modus den Remote-Hinweis und keine Session-Behauptung", async () => {
    render(
      <LangProvider>
        <ApplicationsSection
          repository={createRemoteApplicationRepository(port())}
          storageMode="remote"
        />
      </LangProvider>
    );

    expect(await screen.findByText(/über RIS in deinem Konto gespeichert/)).toBeTruthy();
    expect(screen.queryByText(/nur in der aktuellen Sitzung verfügbar/)).toBeNull();
  });

  it("behält im Session-Modus den bestehenden Session-Hinweis", async () => {
    render(
      <LangProvider>
        <ApplicationsSection repository={createSessionApplicationRepository()} />
      </LangProvider>
    );

    expect(await screen.findByText(/nur in der aktuellen Sitzung verfügbar/)).toBeTruthy();
    expect(screen.queryByText(/über RIS in deinem Konto gespeichert/)).toBeNull();
  });
});

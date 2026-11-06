import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ApplicationMigrationDialog from "./ApplicationMigrationDialog";
import { LangProvider } from "../i18n";
import type { ApplicationMigrationPortV1, ApplicationMigrationPreviewV1, ApplicationMigrationResultV1 } from "../lib/applications/repositoryTypes";
import { createSessionApplication, type SessionApplicationV1 } from "../lib/applications/sessionApplications";

const NOW = "2026-11-05T10:00:00Z";

function application(localId: string, title: string): SessionApplicationV1 {
  return createSessionApplication({
    localId,
    now: NOW,
    coverLetter: "Hello",
    job: {
      jobId: `job-${localId}`,
      title,
      companyName: "Synthetic Test Company",
      location: ["Darmstadt"],
      source: ["synthetic"],
      originalUrl: "https://example.invalid/job",
    },
  });
}

function port(): Pick<ApplicationMigrationPortV1, "preview" | "commit"> {
  return {
    preview: vi.fn(async (): Promise<ApplicationMigrationPreviewV1> => ({
      drafts: [application("local-1", "App One"), application("local-2", "App Two")],
      duplicateJobIds: [],
      warnings: [],
      items: [
        { localId: "local-1", status: "READY", reasons: [], duplicate: false },
        {
          localId: "local-2",
          status: "INCOMPATIBLE",
          reasons: ["location_not_single"],
          duplicate: false,
        },
      ],
    })),
    commit: vi.fn(async (): Promise<ApplicationMigrationResultV1> => ({
      succeeded: [{ localId: "local-1", applicationId: "remote-1", version: 1 }],
      failed: [],
    })),
  };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("ApplicationMigrationDialog", () => {
  it("zeigt kompatible und inkompatible Bewerbungen mit Grund", async () => {
    render(
      <LangProvider>
        <ApplicationMigrationDialog
          open
          applications={[application("local-1", "App One"), application("local-2", "App Two")]}
          port={port()}
          onClose={() => {}}
        />
      </LangProvider>
    );

    expect(await screen.findByText("App One")).toBeTruthy();
    expect(screen.getByText("App Two")).toBeTruthy();
    expect(screen.getByText("Nicht übertragbar")).toBeTruthy();
    expect(screen.getByText("Mehrere Standorte werden nicht unterstützt.")).toBeTruthy();
  });

  it("verlangt die ausdrückliche Bestätigung vor der Übertragung", async () => {
    const previewPort = port();
    render(
      <LangProvider>
        <ApplicationMigrationDialog
          open
          applications={[application("local-1", "App One"), application("local-2", "App Two")]}
          port={previewPort}
          onClose={() => {}}
        />
      </LangProvider>
    );

    await screen.findByText("App One");
    const transfer = screen.getByRole("button", { name: "Ausgewählte übertragen" });
    expect(transfer).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Ich bestätige/));
    expect(transfer).toBeEnabled();
    fireEvent.click(transfer);

    await waitFor(() =>
      expect(previewPort.commit).toHaveBeenCalledWith(
        { localIds: ["local-1"], confirmed: true },
        expect.stringMatching(/^migration-/)
      )
    );
    expect(await screen.findByText(/1 übertragen, 0 fehlgeschlagen/)).toBeTruthy();
  });
});

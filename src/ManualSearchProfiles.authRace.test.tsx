import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ModelsResponse } from "./types";

// JM-PROFILE-UI-HARDENING-05: a delayed manual-profile save must not restore
// state after the authenticated identity has changed.
const authState = { sub: "race-user-a" };
const gate: {
  resolve: (() => void) | null;
  manualRepository: { list: () => Array<{ name: string }> } | null;
  resolveExtract: ((text: string) => void) | null;
} = { resolve: null, manualRepository: null, resolveExtract: null };

vi.mock("./lib/pdf", () => ({
  extractPdfText: vi.fn(
    () =>
      new Promise<string>((resolve) => {
        gate.resolveExtract = resolve;
      })
  ),
}));

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    fetchJobs: vi.fn(async () => ({ jobs: [] })),
    fetchMatches: vi.fn(async () => ({ matches: [] })),
    fetchModels: vi.fn(),
    fetchModel: vi.fn(),
    createProfile: vi.fn(),
    analyzeATS: vi.fn(),
  };
});

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isLoading: false,
    error: undefined,
    isAuthenticated: true,
    user: { profile: { sub: authState.sub, email: "race@example.invalid", name: "Race User" } },
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  }),
}));

vi.mock("./lib/profiles/sessionRepositories", async () => {
  const actual = await vi.importActual<typeof import("./lib/profiles/sessionRepositories")>(
    "./lib/profiles/sessionRepositories"
  );
  return {
    ...actual,
    createSessionProfileRepositories: (options: Parameters<typeof actual.createSessionProfileRepositories>[0]) => {
      gate.manualRepository = options?.manualRepository ?? null;
      const repositories = actual.createSessionProfileRepositories(options);
      return {
        ...repositories,
        manualSearchProfiles: {
          ...repositories.manualSearchProfiles,
          async create(input: Parameters<typeof repositories.manualSearchProfiles.create>[0]) {
            await new Promise<void>((resolve) => {
              gate.resolve = resolve;
            });
            return repositories.manualSearchProfiles.create(input);
          },
        },
      };
    },
  };
});

const singleModel: ModelsResponse = {
  models: [{ id: "model-x", name: "Model X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

async function renderAt(path: string) {
  const App = (await import("./App")).default;
  const { LangProvider } = await import("./i18n");
  window.history.pushState({}, "", path);
  return render(
    <LangProvider>
      <App />
    </LangProvider>
  );
}

beforeEach(async () => {
  localStorage.setItem("mj-lang", "de");
  authState.sub = "race-user-a";
  gate.resolve = null;
  const { fetchModels } = await import("./api");
  vi.mocked(fetchModels).mockResolvedValue(singleModel);
  const { __resetModelsCacheForTests } = await import("./hooks/useAvailableModels");
  __resetModelsCacheForTests();
  Object.defineProperty(window, "scrollTo", { value: vi.fn(), configurable: true });
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/search");
  vi.clearAllMocks();
});

describe("JM-PROFILE-UI-HARDENING-05: session race isolation", () => {
  it("does not publish a delayed save after the user changes", async () => {
    const view = await renderAt("/profil");
    fireEvent.click(screen.getByRole("button", { name: "Job-Präferenzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Neues Suchprofil" }));
    fireEvent.change(screen.getByLabelText("Profilname"), { target: { value: "Stale profile" } });
    fireEvent.change(screen.getByLabelText("Skills / Keywords"), { target: { value: "AWS" } });
    fireEvent.click(screen.getByRole("button", { name: "Für diese Sitzung speichern" }));

    await waitFor(() => expect(gate.resolve).not.toBeNull());

    authState.sub = "race-user-b";
    const App = (await import("./App")).default;
    const { LangProvider } = await import("./i18n");
    view.rerender(
      <LangProvider>
        <App />
      </LangProvider>
    );

    gate.resolve?.();
    await waitFor(() => {
      expect(screen.queryByText("Stale profile")).toBeNull();
    });
    expect(document.querySelectorAll(".dashboard-v2__manual-item")).toHaveLength(0);
    // The old repository instance must not have written into the new session.
    expect(gate.manualRepository?.list() ?? []).toEqual([]);
    expect(screen.queryByText("Profil für diese Sitzung gespeichert.")).toBeNull();
  });

  it("does not publish CV extraction results after the user changes", async () => {
    const view = await renderAt("/search");
    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    const file = new File(["synthetic cv"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await screen.findByText("CV-Verarbeitung erlauben?");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Verarbeitung erlauben" }));
    await waitFor(() => expect(document.querySelector(".cv-anonymization-choice")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(document.getElementById("cv-model-selection-title")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(gate.resolveExtract).not.toBeNull());

    authState.sub = "race-user-b";
    const App = (await import("./App")).default;
    const { LangProvider } = await import("./i18n");
    view.rerender(
      <LangProvider>
        <App />
      </LangProvider>
    );

    gate.resolveExtract?.("React Developer with five years of experience in Berlin");
    await waitFor(() => {
      expect(screen.queryByText("Dein vorgeschlagenes Suchprofil")).toBeNull();
    });
  });
});

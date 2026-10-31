import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ModelsResponse } from "./types";

// JM-PROFILE-UI-HARDENING-05: a delayed manual-profile save must not restore
// state after the authenticated identity has changed.
const authState = { sub: "race-user-a" };
const gate: { resolve: (() => void) | null } = { resolve: null };

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
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import StorageConsentOverview from "./StorageConsentOverview";
import { APPLICATION_STORAGE_CONSENT_TEXT_SHA256, APPLICATION_STORAGE_CONSENT_TEXT_VERSION } from "../lib/applicationStorageConsent";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ user: { access_token: "test-token" } }),
}));

const fetchMock = vi.fn();

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function grantedState() {
  return {
    consent: {
      purpose: "application-storage",
      status: "GRANTED",
      noticeVersion: "1.0",
      grantedAt: "2026-11-08T08:22:27.433881+00:00",
      withdrawnAt: null,
      version: 2,
      specialCategoriesConsent: true,
      specialCategories: ["health"],
      externalTextVersion: APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
      externalTextSha256: APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
    },
    noticeVersion: "1.0",
    noticeState: "APPROVED",
    noticeApproved: true,
    acceptedForNewGrant: true,
    grantAllowed: true,
    noticeReason: null,
    textVersion: APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
    textHash: APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
    textState: "APPROVED",
    textMapped: true,
    textApproved: true,
    textReason: null,
  };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StorageConsentOverview", () => {
  it("uses the server-side granted status instead of the preparation card", async () => {
    fetchMock.mockResolvedValue(response(grantedState()));

    render(
      <LangProvider>
        <StorageConsentOverview
          identityVerified
          liveConsentEnabled
          onOpenSettings={vi.fn()}
        />
      </LangProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("Aktiv", { selector: ".ui-badge" })).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Die dauerhafte Speicherung deiner Bewerbungen ist über RIS/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Vorbereitung")).toBeNull();
  });

  it("keeps the preparation card when live consent is not enabled", () => {
    render(
      <LangProvider>
        <StorageConsentOverview
          identityVerified
          liveConsentEnabled={false}
          onOpenSettings={vi.fn()}
        />
      </LangProvider>
    );

    expect(screen.getByText("Vorbereitung", { selector: ".ui-badge" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

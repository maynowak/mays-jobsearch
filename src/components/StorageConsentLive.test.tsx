import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import StorageConsentLive from "./StorageConsentLive";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ user: { access_token: "test-token" } }),
}));

const fetchMock = vi.fn();

function consentResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StorageConsentLive", () => {
  it("sperrt die Zustimmung ohne serverseitig freigegebene Notice-Version", async () => {
    fetchMock.mockResolvedValue(
      consentResponse({
        consent: {
          purpose: "application-storage",
          status: "NOT_GRANTED",
          noticeVersion: null,
          grantedAt: null,
          withdrawnAt: null,
          version: 0,
        },
        noticeVersion: null,
        grantAllowed: false,
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByText(/nicht erteilt/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeDisabled();
    expect(screen.getByText(/noch nicht freigegeben/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verlauf anzeigen" })).toBeEnabled();
  });

  it("gibt die Zustimmung nur bei serverseitiger Freigabe frei", async () => {
    fetchMock.mockResolvedValue(
      consentResponse({
        consent: {
          purpose: "application-storage",
          status: "NOT_GRANTED",
          noticeVersion: "1.0",
          grantedAt: null,
          withdrawnAt: null,
          version: 0,
        },
        noticeVersion: "1.0",
        grantAllowed: true,
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByText(/Textversion 1.0/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeEnabled();
    expect(screen.queryByText(/noch nicht freigegeben/)).toBeNull();
  });
});

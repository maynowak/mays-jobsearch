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
    expect(
      screen.getByRole("link", { name: "Datenschutzhinweise zur Bewerbungsspeicherung" })
    ).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByText(/Angezeigte Textfassung: 2026-11-04-draft-1/)).toBeInTheDocument();
    expect(screen.getByText(/RIS-Textversion: 1.0/)).toBeInTheDocument();
  });

  it("erklärt eine gesperrte DRAFT-Notice mit ihrem RIS-Status", async () => {
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
        noticeVersion: "1.0",
        noticeState: "DRAFT",
        noticeApproved: false,
        acceptedForNewGrant: false,
        grantAllowed: false,
        noticeReason: "notice_not_active",
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByText(/nicht erteilt/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeDisabled();
    expect(screen.getByText(/noch nicht freigegeben/)).toBeInTheDocument();
    expect(screen.getByText(/RIS-Status: Entwurf \(DRAFT\)/)).toBeInTheDocument();
    expect(screen.getByText(/noch nicht aktiv/)).toBeInTheDocument();
    expect(screen.getByText(/RIS-Textversion: 1.0/)).toBeInTheDocument();
  });
});

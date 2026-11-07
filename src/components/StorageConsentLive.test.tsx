import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import StorageConsentLive from "./StorageConsentLive";
import {
  APPLICATION_STORAGE_CONSENT_PARAGRAPHS,
  APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
  APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
} from "../lib/applicationStorageConsent";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ user: { access_token: "test-token" } }),
}));

const fetchMock = vi.fn();

const SHORT_HASH = `${APPLICATION_STORAGE_CONSENT_TEXT_SHA256.slice(0, 12)}…${APPLICATION_STORAGE_CONSENT_TEXT_SHA256.slice(-8)}`;

function consentResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function consent(status: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN" = "NOT_GRANTED") {
  return {
    purpose: "application-storage",
    status,
    noticeVersion: "1.0",
    grantedAt: null,
    withdrawnAt: null,
    version: 0,
  };
}

function consentState(overrides: Record<string, unknown> = {}) {
  return {
    consent: consent(),
    noticeVersion: "1.0",
    noticeState: "ACTIVE",
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
    ...overrides,
  };
}

function mockState(state: Record<string, unknown>) {
  fetchMock.mockResolvedValue(consentResponse(state));
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
  it("zeigt die vollständige Einwilligungserklärung vor dem Zustimmungs-Button", async () => {
    mockState(consentState());

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(
      screen.getByRole("heading", {
        name: "Einwilligungserklärung zur dauerhaften Speicherung von Bewerbungen",
      })
    ).toBeInTheDocument();
    for (const paragraph of APPLICATION_STORAGE_CONSENT_PARAGRAPHS) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
    const button = screen.getByRole("button", { name: "Speicherung zustimmen" });
    const declaration = screen.getByRole("heading", {
      name: "Einwilligungserklärung zur dauerhaften Speicherung von Bewerbungen",
    });
    expect(
      declaration.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("zeigt Textversion, SHA-256 und Kandidatenstatus an", async () => {
    mockState(consentState());

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(screen.getByText(/application-storage-consent-2026-11-07-v2/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SHORT_HASH.replace("…", ".")))).toBeInTheDocument();
    expect(screen.getByText(/Textstatus: rechtlich freigegeben \(APPROVED\)/)).toBeInTheDocument();
    // The code constant is provenance only; an approved server state must not
    // be contradicted by a client-side DRAFT label.
    expect(screen.queryByText(/Entwurf \(DRAFT\)/)).toBeNull();
    expect(screen.queryByText(/Text-Kandidat/)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Datenschutzhinweise zur Bewerbungsspeicherung" })
    ).toHaveAttribute("href", "/datenschutz");
  });

  it("sperrt bei DRAFT-Textstatus, obwohl die Notice freigegeben ist", async () => {
    mockState(
      consentState({
        grantAllowed: false,
        textState: "DRAFT",
        textApproved: false,
        textReason: "consent_text_not_approved",
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeDisabled();
    expect(screen.getByText(/noch nicht freigegeben/)).toBeInTheDocument();
    expect(screen.getByText(/Einwilligungs-Textfassung ist noch nicht freigegeben/)).toBeInTheDocument();
    expect(screen.getByText(/Textstatus: Entwurf \(DRAFT\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/Text-Kandidat \(Kandidat für Betreiberfreigabe\)/)
    ).toBeInTheDocument();
  });

  it("sperrt ohne serverseitige Textzuordnung", async () => {
    mockState(
      consentState({
        grantAllowed: false,
        textVersion: null,
        textHash: null,
        textState: null,
        textMapped: false,
        textApproved: false,
        textReason: "consent_text_not_configured",
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeDisabled();
    expect(screen.getByText(/Textstatus: nicht konfiguriert/)).toBeInTheDocument();
    expect(
      screen.getByText(/Text-Kandidat \(Kandidat für Betreiberfreigabe\)/)
    ).toBeInTheDocument();
    expect(screen.getByText(/keine Einwilligungs-Textfassung konfiguriert/)).toBeInTheDocument();
  });

  it("sperrt bei abweichender Textversion oder abweichendem Hash", async () => {
    mockState(
      consentState({
        grantAllowed: true,
        textVersion: "application-storage-consent-other",
        textMapped: true,
        textApproved: true,
      })
    );

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeDisabled();
    expect(
      screen.getByText(/stimmt nicht mit der serverseitigen Zuordnung überein/)
    ).toBeInTheDocument();
  });

  it("gibt die Zustimmung nur bei übereinstimmendem, freigegebenem Mapping frei", async () => {
    mockState(consentState());

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    expect(screen.getByRole("button", { name: "Speicherung zustimmen" })).toBeEnabled();
    expect(screen.queryByText(/noch nicht freigegeben/)).toBeNull();
    expect(screen.getByText(/Textstatus: rechtlich freigegeben \(APPROVED\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Entwurf \(DRAFT\)/)).toBeNull();
    expect(screen.getByText(/Version\/Hash stimmen überein/)).toBeInTheDocument();
  });

  it("erlaubt den Widerruf weiterhin und ruft den BFF auf", async () => {
    const granted = consentState({ consent: consent("GRANTED") });
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("action=withdraw")) {
        return consentResponse({ consent: consent("WITHDRAWN") });
      }
      return consentResponse(granted);
    });

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: erteilt/));
    const withdraw = screen.getByRole("button", { name: "Einwilligung widerrufen" });
    expect(withdraw).toBeEnabled();
    withdraw.click();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: widerrufen/));
    const withdrawCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("action=withdraw")
    );
    expect(withdrawCall).toBeDefined();
  });
});

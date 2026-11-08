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
    specialCategoriesConsent: false,
    specialCategories: [],
    externalTextVersion: null,
    externalTextSha256: null,
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
    specialCategoriesConsent: false,
    specialCategories: [],
    externalTextVersion: null,
    externalTextSha256: null,
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
    expect(screen.getByText(/application-storage-consent-2026-11-07-v4/)).toBeInTheDocument();
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

  it("sperrt die Zustimmung, bis die Art.-9-Einwilligung ausdrücklich gesetzt ist", async () => {
    mockState(consentState());

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    const checkbox = screen.getByRole("checkbox", {
      name: /Art\. 9 Abs\. 2 lit\. a DSGVO/,
    });
    const button = screen.getByRole("button", { name: "Speicherung zustimmen" });
    expect(checkbox).not.toBeChecked();
    expect(button).toBeDisabled();
    expect(screen.getByText(/Textstatus: rechtlich freigegeben \(APPROVED\)/)).toBeInTheDocument();
    expect(screen.getByText(/Version\/Hash stimmen überein/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bitte bestätige die Art\.-9-Einwilligung ausdrücklich/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Die Einwilligungs-Textversion ist noch nicht freigegeben/)).toBeNull();

    checkbox.click();
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText(/noch nicht freigegeben/)).toBeNull();
    expect(
      screen.queryByText(/Bitte bestätige die Art\.-9-Einwilligung ausdrücklich/)
    ).toBeNull();
  });

  it("meldet den serverseitigen Status an die übergeordnete Ansicht", async () => {
    const onStateChange = vi.fn();
    mockState(consentState({ consent: { ...consent("GRANTED") } }));

    render(<StorageConsentLive onStateChange={onStateChange} />);

    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith({
        status: "GRANTED",
        loaded: true,
        error: false,
      })
    );
  });

  it("sendet nur die Art.-9-Entscheidung an den BFF, nicht Version, Hash oder Kategorien", async () => {
    const granted = {
      ...consent("GRANTED"),
      specialCategoriesConsent: true,
      specialCategories: ["health", "genetic_data"],
      externalTextVersion: APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
      externalTextSha256: APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
    };
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes("action=withdraw")) {
        return consentResponse({ consent: consent("WITHDRAWN") });
      }
      if (String(init?.method ?? "").toUpperCase() === "POST") {
        return consentResponse({ consent: granted });
      }
      return consentResponse(consentState());
    });

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    screen.getByRole("checkbox", { name: /Art\. 9 Abs\. 2 lit\. a DSGVO/ }).click();
    const button = screen.getByRole("button", { name: "Speicherung zustimmen" });
    await waitFor(() => expect(button).toBeEnabled());
    button.click();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: erteilt/));
    const grantCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(init?.method ?? "").toUpperCase() === "POST" &&
        !String(url).includes("action=")
    );
    expect(grantCall).toBeDefined();
    const body = JSON.parse(grantCall![1].body as string);
    expect(body).toEqual({
      purpose: "application-storage",
      specialCategoriesConsent: true,
    });
    expect(body.specialCategories).toBeUndefined();
    expect(body.externalTextVersion).toBeUndefined();
    expect(body.externalTextSha256).toBeUndefined();

    expect(screen.getByText(/Art\.-9-Einwilligung: erteilt/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nachweis-Textversion: application-storage-consent-2026-11-07-v4/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Kategorien: health, genetic_data/)).toBeInTheDocument();
  });

  it("erlaubt den Widerruf weiterhin, ruft den BFF auf und setzt die Art.-9-Einwilligung zurück", async () => {
    const granted = {
      ...consent("GRANTED"),
      specialCategoriesConsent: true,
      specialCategories: ["health"],
      externalTextVersion: APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
      externalTextSha256: APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
    };
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes("action=withdraw")) {
        return consentResponse({ consent: consent("WITHDRAWN") });
      }
      if (String(init?.method ?? "").toUpperCase() === "POST") {
        return consentResponse({ consent: granted });
      }
      return consentResponse(consentState());
    });

    render(<StorageConsentLive />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: nicht erteilt/));
    const checkbox = screen.getByRole("checkbox", {
      name: /Art\. 9 Abs\. 2 lit\. a DSGVO/,
    });
    const grantButton = screen.getByRole("button", { name: "Speicherung zustimmen" });
    expect(checkbox).not.toBeChecked();
    expect(grantButton).toBeDisabled();

    // grant with an explicit Art. 9 declaration
    checkbox.click();
    await waitFor(() => expect(checkbox).toBeChecked());
    await waitFor(() => expect(grantButton).toBeEnabled());
    grantButton.click();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: erteilt/));
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    // withdraw: the declaration must not survive into a regrant
    const withdraw = screen.getByRole("button", { name: "Einwilligung widerrufen" });
    expect(withdraw).toBeEnabled();
    withdraw.click();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Status: widerrufen/));
    const withdrawCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("action=withdraw")
    );
    expect(withdrawCall).toBeDefined();

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(checkbox).toBeEnabled();
    expect(grantButton).toBeDisabled();

    // only a fresh explicit check enables a regrant
    checkbox.click();
    await waitFor(() => expect(checkbox).toBeChecked());
    await waitFor(() => expect(grantButton).toBeEnabled());
  });
});

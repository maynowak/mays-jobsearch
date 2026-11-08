import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import StorageConsentSection from "./StorageConsentSection";
import type { StorageConsentLiveState } from "./StorageConsentLive";

const liveState = vi.hoisted(() => ({
  current: {
    status: "GRANTED",
    loaded: true,
    error: false,
  } as StorageConsentLiveState,
}));

vi.mock("./StorageConsentLive", () => ({
  default: ({ onStateChange }: { onStateChange?: (state: StorageConsentLiveState) => void }) => {
    useEffect(() => {
      onStateChange?.(liveState.current);
    }, [onStateChange]);
    return <div data-testid="live-consent" />;
  },
}));

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  liveState.current = { status: "GRANTED", loaded: true, error: false };
});

afterEach(() => {
  cleanup();
});

describe("StorageConsentSection with live application storage", () => {
  it("shows the server-side granted status and removes stale preparation hints", () => {
    render(
      <LangProvider>
        <StorageConsentSection identityVerified liveConsentEnabled />
      </LangProvider>
    );

    expect(screen.getByText("Aktiv", { selector: ".ui-badge" })).toBeInTheDocument();
    expect(
      screen.getByText(/Die dauerhafte Speicherung deiner Bewerbungen ist über RIS/)
    ).toBeInTheDocument();
    expect(screen.getByText("Freigegeben")).toBeInTheDocument();
    expect(screen.getAllByText("Nicht freigegeben")).toHaveLength(2);
    expect(screen.queryByText("Vorbereitung")).toBeNull();
    expect(screen.queryByText(/wird vorbereitet/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Datenkontrolle" })).toBeNull();
    expect(screen.queryByText(/backend_unavailable/)).toBeNull();
    expect(screen.getByText(/Aktive RIS-Speicherung/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bewerbungen werden mit deiner Einwilligung dauerhaft über RIS/)
    ).toBeInTheDocument();
  });

  it("shows a withdrawal and keeps application status distinct from CV/search", () => {
    liveState.current = { status: "WITHDRAWN", loaded: true, error: false };

    render(
      <LangProvider>
        <StorageConsentSection identityVerified liveConsentEnabled />
      </LangProvider>
    );

    expect(
      screen.getByText("Zustimmung erforderlich", { selector: ".ui-badge" })
    ).toBeInTheDocument();
    expect(screen.getByText("Widerrufen")).toBeInTheDocument();
    expect(screen.getAllByText("Nicht freigegeben")).toHaveLength(2);
    expect(
      screen.getByText(/Deine Einwilligung zur Speicherung von Bewerbungen ist widerrufen/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "RIS-Speicherung für Bewerbungen" })
    ).toBeInTheDocument();
  });

  it("shows checking instead of preparation before the server response", () => {
    liveState.current = { status: "NOT_GRANTED", loaded: false, error: false };

    render(
      <LangProvider>
        <StorageConsentSection identityVerified liveConsentEnabled />
      </LangProvider>
    );

    expect(
      screen.getByText("Status wird geprüft", { selector: ".ui-badge" })
    ).toBeInTheDocument();
    expect(screen.getByText("Wird geprüft")).toBeInTheDocument();
    expect(screen.queryByText("Vorbereitung")).toBeNull();
  });
});

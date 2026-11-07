import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Privacy from "./Privacy";
import { LangProvider } from "../i18n";

const PRIVACY_TEXT = [
  "DATENSCHUTZERKLÄRUNG – MAY’S JOB MATCHER",
  "Version 1.1 · Stand: 7. November 2026",
  "18. IHRE RECHTE",
].join("\n");

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    text: async () => PRIVACY_TEXT,
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Privacy", () => {
  it("lädt und zeigt die konsolidierte Datenschutzerklärung", async () => {
    render(
      <LangProvider>
        <Privacy />
      </LangProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/Version 1\.1 · Stand: 7\. November 2026/)).toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledWith("/legal/datenschutz.md");
  });

  it("zeigt Link zur Datenschutzerklärung und Prinzipien", () => {
    render(
      <LangProvider>
        <Privacy />
      </LangProvider>
    );
    expect(screen.getByRole("link", { name: /Datenschutzerklärung als Markdown öffnen/ })).toHaveAttribute(
      "href",
      "/legal/datenschutz.md"
    );
    expect(screen.getByRole("link", { name: /Klare Datenschutzprinzipien/ })).toHaveAttribute(
      "href",
      "/datenschutzprinzipien"
    );
  });
});

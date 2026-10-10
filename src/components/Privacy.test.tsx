import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Privacy from "./Privacy";
import { LangProvider } from "../i18n";

vi.stubGlobal("fetch", async () => ({
  ok: true,
  text: async () => "Test Datenschutz Inhalt",
}));

describe("Privacy", () => {
  it("lädt und zeigt Inhalt", async () => {
    render(
      <LangProvider>
        <Privacy />
      </LangProvider>
    );
    await waitFor(() => {
      expect(screen.getByText(/Test Datenschutz Inhalt/)).toBeTruthy();
    });
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Privacy from "./Privacy";
import { LangProvider } from "../i18n";

describe("Privacy", () => {
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

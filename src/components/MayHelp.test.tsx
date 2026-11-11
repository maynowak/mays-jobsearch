import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LangProvider } from "../i18n";
import MayHelp from "./MayHelp";

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("MayHelp", () => {
  it("starts with contextual CV help instead of a self-introduction", () => {
    render(
      <LangProvider>
        <MayHelp context="cv" />
      </LangProvider>
    );

    expect(screen.getByText("Hilfe zu diesem Bereich")).toBeInTheDocument();
    expect(screen.queryByText("Hallo, ich bin May! Ich helfe dir bei deinen Bewerbungen.")).toBeNull();
    expect(screen.getByText(/Speicherfreigabe ist keine KI-Einwilligung/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("can switch to the compact overview context", () => {
    render(
      <LangProvider>
        <MayHelp context="overview" compact />
      </LangProvider>
    );

    expect(screen.getByText(/Starte hier: Konto und nächster Schritt/)).toBeInTheDocument();
    expect(screen.getByLabelText("Hilfe zu diesem Bereich")).toHaveClass("may-help--compact");
  });
});

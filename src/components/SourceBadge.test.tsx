import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import SourceBadge from "./SourceBadge";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("SourceBadge", () => {
  it("labels a manual job without changing imported source labels", () => {
    const { rerender } = render(
      <LangProvider>
        <SourceBadge sources={["manual"]} />
      </LangProvider>
    );
    expect(screen.getByText(/Manuell hinzugefügt/)).toBeInTheDocument();

    rerender(
      <LangProvider>
        <SourceBadge sources={["arbeitsagentur"]} />
      </LangProvider>
    );
    expect(screen.getByText(/Arbeitsagentur/)).toBeInTheDocument();
    expect(screen.queryByText(/Manuell hinzugefügt/)).toBeNull();
  });
});

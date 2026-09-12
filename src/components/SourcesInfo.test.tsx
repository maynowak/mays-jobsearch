import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import SourcesInfo from "./SourcesInfo";

afterEach(cleanup);

describe("STEP 37G-1 - SourcesInfo", () => {
  it("renders info icon", () => {
    render(
      <LangProvider>
        <SourcesInfo />
      </LangProvider>
    );
    expect(screen.getByText("ⓘ")).toBeTruthy();
  });

  it("does not display provider names as partners", () => {
    render(
      <LangProvider>
        <SourcesInfo />
      </LangProvider>
    );
    const container = screen.getByText("ⓘ").parentElement;
    const text = container?.textContent || "";
    expect(text).not.toContain("Partner");
    expect(text).not.toContain("Sponsor");
  });

  it("has accessible label via aria-label", () => {
    render(
      <LangProvider>
        <SourcesInfo />
      </LangProvider>
    );
    expect(screen.getByLabelText("Datenquellen-Info")).toBeTruthy();
  });

  it("has title attribute for tooltip", () => {
    render(
      <LangProvider>
        <SourcesInfo />
      </LangProvider>
    );
    const container = screen.getByText("ⓘ").parentElement;
    expect(container?.getAttribute("title")).toContain("info");
  });
});

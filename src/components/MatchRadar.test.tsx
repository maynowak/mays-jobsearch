import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import MatchRadar, { layoutRadarLabels } from "./MatchRadar";

describe("JM-SEARCH-MATCH-RADAR-01 label layout", () => {
  it("keeps nearby labels separated", () => {
    const tops = layoutRadarLabels([40, 42, 45], 300, 30);
    expect(tops).toEqual([40, 70, 100]);
  });

  it("keeps labels inside the radar and separated near the bottom", () => {
    const tops = layoutRadarLabels([250, 260, 270, 280, 290], 300, 30);
    expect(tops).toHaveLength(5);
    expect(tops[0]).toBeGreaterThanOrEqual(0);
    expect(tops[tops.length - 1]).toBeLessThanOrEqual(300);
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index] - tops[index - 1]).toBeGreaterThanOrEqual(30);
    }
  });

  it("returns no labels when there are no results", () => {
    expect(layoutRadarLabels([], 300)).toEqual([]);
  });
});

describe("JM-SEARCH-MATCH-RADAR-01 accessibility", () => {
  beforeEach(() => localStorage.setItem("mj-lang", "de"));
  afterEach(() => {
    cleanup();
    localStorage.removeItem("mj-lang");
  });

  it("keeps the mobile panel closable with Escape and restores focus", async () => {
    render(
      <LangProvider>
        <MatchRadar radarKey="accessibility-test" onActivate={vi.fn()} />
      </LangProvider>
    );
    const toggle = screen.getByRole("button", { name: "Trefferübersicht" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "Treffer-Navigation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Treffer-Navigation" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });
});

import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MatchPulse, { MATCH_PULSE_EVENT, MATCH_PULSE_INTERVAL_MS } from "./MatchPulse";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MatchPulse (AI-MATCH-PULSE-01)", () => {
  it("rendert Punkt, Ring und 3 Satelliten (klickbar)", () => {
    render(<MatchPulse />);
    const root = document.querySelector(".mp") as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.tagName).toBe("BUTTON");
    expect(root.getAttribute("aria-label")).toBe("Mit KI pulsieren, Job-Stream aktualisieren");
    expect(root.querySelector(".mp-dot")).toBeTruthy();
    expect(root.querySelector(".mp-ring")).toBeTruthy();
    expect(root.querySelectorAll(".mp-sat").length).toBe(3);
  });

  it("ruft keine API auf", () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<MatchPulse />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispatcht periodisch das Kopplungs-Event (alle 6 s)", () => {
    vi.useFakeTimers();
    try {
      const seen: string[] = [];
      const handler = (e: Event) => seen.push(e.type);
      window.addEventListener(MATCH_PULSE_EVENT, handler);
      render(<MatchPulse />);
      expect(MATCH_PULSE_INTERVAL_MS).toBe(6000);
      vi.advanceTimersByTime(6000);
      expect(seen).toEqual([MATCH_PULSE_EVENT]);
      vi.advanceTimersByTime(6000);
      expect(seen).toEqual([MATCH_PULSE_EVENT, MATCH_PULSE_EVENT]);
      window.removeEventListener(MATCH_PULSE_EVENT, handler);
    } finally {
      vi.useRealTimers();
    }
  });
});

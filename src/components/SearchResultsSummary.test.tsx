import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import SearchResultsSummary from "./SearchResultsSummary";

function renderSummary(count: number, overrides: Partial<React.ComponentProps<typeof SearchResultsSummary>> = {}) {
  const onJump = vi.fn();
  const onMatch = vi.fn();
  const view = render(
    <LangProvider>
      <SearchResultsSummary count={count} matching={false} onJump={onJump} onMatch={onMatch} {...overrides} />
    </LangProvider>
  );
  return { view, onJump, onMatch };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SEARCH-RESULTS-MOBILE-UX-04 summary", () => {
  it("uses the singular count and action for one job", () => {
    const { onJump, onMatch } = renderSummary(1);
    expect(screen.getByText("1 Stelle gefunden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zu der Stelle" }));
    fireEvent.click(screen.getByRole("button", { name: "Mit KI bewerten" }));
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(document.getElementById("match-btn")).toBeInTheDocument();
  });

  it("uses the plural count and action for many jobs", () => {
    renderSummary(12);
    expect(screen.getByText("12 Stellen gefunden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zu den 12 Stellen" })).toBeInTheDocument();
  });

  it("disables the AI action while matching and exposes loading state", () => {
    const { onMatch } = renderSummary(4, { matching: true });
    const button = screen.getByRole("button", { name: "Bewerte mit KI…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector(".spinner")).not.toBeNull();
    fireEvent.click(button);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it("renders English labels without translating user-facing data", () => {
    localStorage.setItem("mj-lang", "en");
    renderSummary(2);
    expect(screen.getByText("2 jobs found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all 2 jobs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evaluate with AI" })).toBeInTheDocument();
  });
});

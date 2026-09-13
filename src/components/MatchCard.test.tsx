import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import MatchCard from "./MatchCard";
import { LangProvider } from "../i18n";
import type { Match, Job } from "../types";

const createTestJob = (overrides = {}): Job => ({
  slug: "test-job",
  title: "Software Engineer",
  company_name: "Test Company",
  location: ["Berlin"],
  remote: false,
  tags: ["JavaScript", "React"],
  url: "https://example.com/job",
  source: ["arbeitnow"],
  ...overrides,
});

const createTestMatch = (overrides = {}): Match => ({
  score: 85,
  why: "This job matches your skills in JavaScript and React.",
  prepare: "Prepare questions about React hooks.",
  job: createTestJob(),
  ...overrides,
});

function renderMatchCard(props: any, lang: "en" | "de" = "de") {
  try { localStorage.setItem("mj-lang", lang); } catch {}
  return render(
    <LangProvider>
      <MatchCard {...props} />
    </LangProvider>
  );
}

describe("MatchCard - ATS Evaluation Button", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ATS evaluate button when onAtsEvaluate is provided", () => {
    const match = createTestMatch();
    const onAtsEvaluate = vi.fn();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate,
    });

    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });

  it("does not render ATS evaluate button when onAtsEvaluate is not provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
    });

    expect(screen.queryByText("Mit ATS bewerten")).not.toBeInTheDocument();
  });

  it("calls onAtsEvaluate with the correct job when ATS button is clicked", () => {
    const match = createTestMatch();
    const onAtsEvaluate = vi.fn();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate,
    });

    fireEvent.click(screen.getByText("Mit ATS bewerten"));

    expect(onAtsEvaluate).toHaveBeenCalledTimes(1);
    expect(onAtsEvaluate).toHaveBeenCalledWith(match.job);
  });

  it("renders both ATS and Letter buttons when both handlers provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate: () => {},
    });

    expect(screen.getByText("Bewerbung generieren")).toBeInTheDocument();
    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });

  it("renders ATS button alongside Letter button when both handlers provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate: () => {},
    });

    expect(screen.getByText("Bewerbung generieren")).toBeInTheDocument();
    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });
});
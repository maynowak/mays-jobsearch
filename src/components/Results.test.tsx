import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Job, Match } from "../types";
import { LangProvider } from "../i18n";
import Results from "./Results";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

function makeJobs(n: number): Job[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `job-${i}`,
    title: `Job ${i}`,
    company_name: `Company ${i}`,
    location: ["Berlin"],
    remote: false,
    tags: ["react"],
    url: `https://example.com/${i}`,
    source: ["arbeitnow"],
  }));
}

function renderResults(matches: Match[], foundJobs: Job[]) {
  return render(
    <LangProvider>
      <Results matches={matches} foundJobs={foundJobs} onGenerateLetter={() => {}} />
    </LangProvider>
  );
}

describe("Results: gefunden / bewertet / angezeigt", () => {
  it("Test A: 66 gefunden / 3 bewertet → 3 MatchCards + 63 RemainingCards", () => {
    const jobs = makeJobs(66);
    const matches = jobs.slice(0, 3).map((job) => ({
      score: 90,
      why: "a. b.",
      prepare: "q?",
      job,
    }));
    renderResults(matches, jobs);

    expect(document.querySelectorAll(".match-card").length).toBe(3);
    expect(screen.getByText("63 weitere Stellen aus deiner Suche")).toBeTruthy();

    fireEvent.click(screen.getByText("Weitere gefundene Jobs ansehen →"));
    expect(document.querySelectorAll(".remaining-card").length).toBe(63);
  });

  it("Test B: 66 gefunden / 0 bewertet → alle 66 gefundenen Jobs sichtbar", () => {
    const jobs = makeJobs(66);
    renderResults([], jobs);

    expect(document.querySelectorAll(".match-card").length).toBe(0);
    expect(document.querySelectorAll(".remaining-card").length).toBe(66);
    expect(screen.getByText(/konnten aber gerade nicht per KI bewertet werden/)).toBeTruthy();
  });
});

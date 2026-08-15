import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Job, JobSource } from "../types";
import { LangProvider } from "../i18n";
import JobSources from "./JobSources";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

function makeJob(slug: string, source: JobSource): Job {
  return {
    slug,
    title: `Job ${slug}`,
    company_name: "Company",
    location: ["Berlin"],
    remote: false,
    tags: [],
    url: `https://example.com/${slug}`,
    source: [source],
  };
}

function renderSources(jobs: Job[]) {
  return render(
    <LangProvider>
      <JobSources jobs={jobs} />
    </LangProvider>
  );
}

describe("JobSources", () => {
  it("Test C: Anzahlen werden dynamisch aus den gelieferten Jobs berechnet", () => {
    const jobs = [
      ...Array.from({ length: 26 }, (_, i) => makeJob(`a${i}`, "existing")),
      ...Array.from({ length: 40 }, (_, i) => makeJob(`b${i}`, "apify-arbeitsagentur")),
    ];
    renderSources(jobs);

    expect(screen.getByText("Jobquellen")).toBeTruthy();
    expect(screen.getByText("Arbeitnow")).toBeTruthy();
    expect(screen.getByText("26 Stellen")).toBeTruthy();
    expect(screen.getByText("Arbeitsagentur")).toBeTruthy();
    expect(screen.getByText("40 Stellen")).toBeTruthy();
    expect(screen.getByText("Insgesamt")).toBeTruthy();
    expect(screen.getByText("66 Stellen")).toBeTruthy();
  });

  it("Test D: Eine Quelle mit 0 Ergebnissen wird nicht als liefernd angezeigt", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "existing"));
    renderSources(jobs);

    const rowCount = document.querySelector(".job-sources-count");
    expect(rowCount?.textContent).toContain("10");
    expect(screen.getByText("Arbeitnow")).toBeTruthy();
    expect(screen.queryByText("Arbeitsagentur")).toBeNull();
  });

  it("rendert nichts, wenn keine Jobs geliefert wurden", () => {
    const { container } = renderSources([]);
    expect(container.querySelector(".job-sources")).toBeNull();
  });
});

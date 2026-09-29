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
      ...Array.from({ length: 26 }, (_, i) => makeJob(`a${i}`, "arbeitnow")),
      ...Array.from({ length: 40 }, (_, i) => makeJob(`b${i}`, "arbeitsagentur")),
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
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
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

  it("zeigt liefernde, aber herausgefilterte Quellen zusätzlich an", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    render(
      <LangProvider>
        <JobSources jobs={jobs} deliveredCounts={{ arbeitnow: 40, jooble: 25, greenhouse: 0 }} />
      </LangProvider>
    );
    expect(screen.getByText("Arbeitnow")).toBeTruthy();
    expect(screen.getByText("Jooble")).toBeTruthy();
    const cutRow = document.querySelector(".job-sources-row--cut");
    expect(cutRow?.textContent).toContain("25 Stellen");
    expect(cutRow?.textContent).toContain("nicht angezeigt");
    expect(screen.queryByText("Greenhouse")).toBeNull();
  });

  it("ohne deliveredCounts bleibt das bisherige Verhalten", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    renderSources(jobs);
    expect(document.querySelector(".job-sources-row--cut")).toBeNull();
  });

  it("keine doppelte Zeile, wenn liefernde Quelle auch angezeigt wird", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    render(
      <LangProvider>
        <JobSources jobs={jobs} deliveredCounts={{ arbeitnow: 40 }} />
      </LangProvider>
    );
    expect(document.querySelectorAll(".job-sources-row").length).toBe(1);
    expect(document.querySelector(".job-sources-row--cut")).toBeNull();
  });
});

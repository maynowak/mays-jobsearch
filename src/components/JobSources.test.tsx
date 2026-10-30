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

  it("zeigt technische Angaben zu gelieferten, aber nicht angezeigten Treffern nicht öffentlich", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    render(
      <LangProvider>
        <JobSources jobs={jobs} deliveredCounts={{ arbeitnow: 40, jobspipe: 25, greenhouse: 0 }} />
      </LangProvider>
    );
    expect(screen.getByText("Arbeitnow")).toBeTruthy();
    expect(screen.queryByText("JobsPipe")).toBeNull();
    expect(document.querySelector(".job-sources-row--cut")).toBeNull();
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

  it("zeigt deaktivierte Quellen nicht in der öffentlichen Quellenliste", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    render(
      <LangProvider>
        <JobSources jobs={jobs} disabledSources={["adzuna", "jobspipe"]} />
      </LangProvider>
    );
    expect(screen.queryByText("Adzuna")).toBeNull();
    expect(screen.queryByText("JobsPipe")).toBeNull();
    const inactiveRows = document.querySelectorAll(".job-sources-row--inactive");
    expect(inactiveRows.length).toBe(0);
  });

  it("zeigt technische Quellengründe nicht öffentlich", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob(`a${i}`, "arbeitnow"));
    render(
      <LangProvider>
        <JobSources
          jobs={jobs}
          disabledSources={["adzuna"]}
          sourceReasons={{ adzuna: "missing_config", theirstack: "missing_config", jobspipe: "limit_reached", arbeitnow: null }}
        />
      </LangProvider>
    );
    expect(document.querySelectorAll(".job-sources-row--inactive").length).toBe(0);
    expect(screen.queryByText("Theirstack")).toBeNull();
    const rows = document.querySelector(".job-sources")?.textContent ?? "";
    expect(rows).not.toContain("inaktiv");
    expect(rows).not.toContain("nicht konfiguriert");
    expect(rows).not.toContain("Limit erreicht");
    // arbeitnow liefert und steht genau einmal drin
    expect(screen.getAllByText("Arbeitnow").length).toBe(1);
  });
});

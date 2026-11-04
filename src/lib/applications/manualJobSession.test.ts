import { describe, expect, it } from "vitest";
import {
  beginNewManualJobSession,
  clearManualJobSession,
  currentManualJobSessionGeneration,
  getManualJobSession,
  saveManualJobSession,
} from "./manualJobSession";
import type { Job } from "../../types";

const job: Job = {
  slug: "manual:test-session",
  title: "Initiativbewerbung",
  company_name: "Unternehmen nicht angegeben",
  location: ["Berlin"],
  remote: false,
  tags: [],
  url: "",
  source: ["manual"],
  description: "Eine lokale Stellenbeschreibung.",
  descriptionPlain: "Eine lokale Stellenbeschreibung.",
};

describe("manual job session store", () => {
  it("stores and returns a cloned entry", () => {
    clearManualJobSession();
    saveManualJobSession({
      id: job.slug,
      job,
      reference: {
        jobId: job.slug,
        title: job.title,
        companyName: job.company_name,
        location: job.location,
        source: ["manual"],
        jobOrigin: "manual",
      },
      updatedAt: "2026-11-04T10:00:00.000Z",
    });
    const stored = getManualJobSession(job.slug);
    expect(stored?.job.description).toBe("Eine lokale Stellenbeschreibung.");
    if (stored) stored.job.description = "mutated";
    expect(getManualJobSession(job.slug)?.job.description).toBe(
      "Eine lokale Stellenbeschreibung."
    );
  });

  it("clears all entries on a new session generation", () => {
    saveManualJobSession({
      id: job.slug,
      job,
      reference: {
        jobId: job.slug,
        title: job.title,
        companyName: job.company_name,
        location: job.location,
        source: ["manual"],
        jobOrigin: "manual",
      },
      updatedAt: "2026-11-04T10:00:00.000Z",
    });
    const before = currentManualJobSessionGeneration();
    expect(getManualJobSession(job.slug)).not.toBeNull();
    expect(beginNewManualJobSession()).toBeGreaterThan(before);
    expect(getManualJobSession(job.slug)).toBeNull();
  });
});

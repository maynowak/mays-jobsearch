import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvProfilesOverlay from "./CvProfilesOverlay";
import {
  assignCvAtsProfileToSearchProfile,
  resetCvProfileLists,
  saveCvAtsProfile,
  saveCvSearchProfile,
} from "../lib/cvProfileStore";
import type { Profile } from "../types";

const profile: Profile = {
  skills: "AWS, Terraform",
  targetRoles: ["Cloud Engineer"],
  city: "",
  radiusKm: null,
  workModes: [],
  employmentTypes: ["full_time"],
};

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  resetCvProfileLists();
});

afterEach(() => cleanup());

describe("JM-ATS-UNASSIGNED-UX-08: unassigned ATS recovery", () => {
  it("shows unassigned ATS profiles and re-assigns them after success", async () => {
    const search = saveCvSearchProfile("cv-hash", "Parent profile", profile)!;
    const orphan = saveCvAtsProfile("cv-hash", "Orphan ATS", ["AWS", "Cloud Architecture"], ["Cloud Engineer"], null)!;
    const onAssignUnassigned = vi.fn(async (atsId: string, targetId: string) => {
      assignCvAtsProfileToSearchProfile("cv-hash", atsId, targetId);
    });

    render(
      <LangProvider>
        <CvProfilesOverlay
          docName="cv.pdf"
          docHash="cv-hash"
          onClose={() => undefined}
          onAssignUnassigned={onAssignUnassigned}
        />
      </LangProvider>
    );

    expect(screen.getByRole("heading", { name: "Nicht zugeordnete ATS-Profile" })).toBeTruthy();
    expect(screen.getByText("Nicht zugeordnet")).toBeTruthy();
    expect(screen.getByText(/AWS · Cloud Architecture/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Zuordnen zu"), { target: { value: search.id } });
    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    await waitFor(() => expect(onAssignUnassigned).toHaveBeenCalledWith(orphan.id, search.id));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Nicht zugeordnete ATS-Profile" })).toBeNull());
    expect(screen.getByText("ATS-Profil zugeordnet.")).toBeTruthy();
  });

  it("shows a capacity error without hiding the unassigned entry", async () => {
    saveCvSearchProfile("cv-hash", "Parent profile", profile);
    saveCvAtsProfile("cv-hash", "Orphan ATS", ["AWS"], ["Cloud Engineer"], null);
    const onAssignUnassigned = vi.fn(async () => {
      throw Object.assign(new Error("full"), { code: "capacity_exceeded" });
    });

    render(
      <LangProvider>
        <CvProfilesOverlay
          docName="cv.pdf"
          docHash="cv-hash"
          onClose={() => undefined}
          onAssignUnassigned={onAssignUnassigned}
        />
      </LangProvider>
    );

    const select = screen.getByLabelText("Zuordnen zu") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.options[1].value } });
    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("bereits fünf ATS-Profile");
    });
    expect(screen.getByRole("heading", { name: "Nicht zugeordnete ATS-Profile" })).toBeTruthy();
  });

  it("disables assignment when no callback is available", () => {
    saveCvSearchProfile("cv-hash", "Parent profile", profile);
    saveCvAtsProfile("cv-hash", "Orphan ATS", ["AWS"], ["Cloud Engineer"], null);
    render(
      <LangProvider>
        <CvProfilesOverlay docName="cv.pdf" docHash="cv-hash" onClose={() => undefined} />
      </LangProvider>
    );

    const select = screen.getByLabelText("Zuordnen zu") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.options[1].value } });
    expect(screen.getByRole("button", { name: "Zuordnen" })).toBeDisabled();
  });

  it("asks for a parent search profile when none exists", () => {
    saveCvAtsProfile("cv-hash", "Orphan ATS", ["AWS"], ["Cloud Engineer"], null);
    render(
      <LangProvider>
        <CvProfilesOverlay docName="cv.pdf" docHash="cv-hash" onClose={() => undefined} />
      </LangProvider>
    );
    expect(screen.getByText(/Erstelle zuerst ein Suchprofil/)).toBeTruthy();
  });
});

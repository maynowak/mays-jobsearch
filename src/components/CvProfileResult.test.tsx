import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvProfileResult from "./CvProfileResult";
import type { SuggestedProfile } from "../types";

const suggested: SuggestedProfile = {
  skills: ["AWS", "Terraform"],
  experienceLevel: "Mid",
  targetRoles: ["Cloud Engineer"],
  location: "Frankfurt",
};

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("JM-PROFILE-CAPACITY-02-LIMIT: profile-ready feedback", () => {
  it("shows the capacity message without closing the step", () => {
    render(
      <LangProvider>
        <CvProfileResult
          suggested={suggested}
          busy={false}
          loadingLabel="Speichern…"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
          error="Für diesen CV können maximal zwei Suchprofile gespeichert werden."
        />
      </LangProvider>
    );

    expect(screen.getByRole("alert").textContent).toContain("maximal zwei Suchprofile");
    expect(screen.getByRole("button", { name: "Speichern" })).toBeTruthy();
    expect(screen.getByLabelText("Name für dieses Suchprofil")).toBeTruthy();
  });

  it("shows no alert on a normal profile-ready step", () => {
    render(
      <LangProvider>
        <CvProfileResult
          suggested={suggested}
          busy={false}
          loadingLabel="Speichern…"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />
      </LangProvider>
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers 5 km in the CV search profile and passes it through", () => {
    const onConfirm = vi.fn();
    render(
      <LangProvider>
        <CvProfileResult
          suggested={suggested}
          busy={false}
          loadingLabel="Speichern…"
          onConfirm={onConfirm}
          onBack={vi.fn()}
          defaultName="Cloud Profil"
        />
      </LangProvider>
    );
    const radius = screen.getByLabelText("Umkreis") as HTMLSelectElement;
    expect(Array.from(radius.options).map((option) => option.value)).toContain("5");
    fireEvent.change(radius, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Frankfurt", radiusKm: 5 }),
      "Cloud Profil"
    );
  });
});

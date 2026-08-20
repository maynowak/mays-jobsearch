import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { Profile } from "../types";
import { LangProvider } from "../i18n";
import SearchForm from "./SearchForm";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

function renderForm(value: Profile, onChange: (p: Profile) => void, onSubmit: (p: Profile) => void) {
  return render(
    <LangProvider>
      <SearchForm
        phase="idle"
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        model={null}
        availableModels={[]}
        recommendedModel={null}
      />
    </LangProvider>
  );
}

function baseProfile(
  overrides: Partial<Pick<Profile, "skills" | "targetRole" | "city">> = {}
): Profile {
  return {
    skills: "",
    targetRole: "",
    city: "",
    radiusKm: null,
    workModes: [],
    employmentTypes: ["full_time"],
    ...overrides,
  };
}

const empty: Profile = baseProfile();

function StatefulForm({ initial = empty }: { initial?: Profile }) {
  const [value, setValue] = useState<Profile>(initial);
  return (
    <LangProvider>
      <SearchForm
        phase="idle"
        value={value}
        onChange={setValue}
        onSubmit={() => undefined}
        model={null}
        availableModels={[]}
        recommendedModel={null}
      />
    </LangProvider>
  );
}

describe("SearchForm is a controlled component", () => {
  it("meldet Tippen über onChange mit dem aktualisierten Profil", () => {
    const onChange = vi.fn();
    renderForm(empty, onChange, vi.fn());

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    expect(onChange).toHaveBeenCalledWith(baseProfile({ skills: "aws" }));

    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Frontend" } });
    expect(onChange).toHaveBeenCalledWith(baseProfile({ targetRole: "Frontend" }));

    fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Berlin" } });
    expect(onChange).toHaveBeenCalledWith(baseProfile({ city: "Berlin" }));
  });

  it("sendet getrimmte Werte über onSubmit", () => {
    const onSubmit = vi.fn();
    renderForm(
      baseProfile({ skills: " aws ", targetRole: " Frontend ", city: " Berlin " }),
      vi.fn(),
      onSubmit
    );

    fireEvent.click(screen.getByText("Meine Treffer finden"));
    expect(onSubmit).toHaveBeenCalledWith(baseProfile({ skills: "aws", targetRole: "Frontend", city: "Berlin" }));
  });

  it("zeigt nach einem Remount weiterhin die Werte aus dem value-Prop", () => {
    const value: Profile = baseProfile({ skills: "aws", targetRole: "Frontend", city: "Berlin" });

    const first = renderForm(value, vi.fn(), vi.fn());
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    first.unmount();

    renderForm(value, vi.fn(), vi.fn());
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");
  });
});

describe("Suchparameter-Erweiterung (UI, Step 7)", () => {
  it("1: Umkreis-Dropdown mit 10/25/50/100 km wird angezeigt", () => {
    renderForm(empty, vi.fn(), vi.fn());
    const select = screen.getByLabelText("Umkreis") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "10", "25", "50", "100"]);
    expect(screen.getByText("10 km")).toBeTruthy();
    expect(screen.getByText("25 km")).toBeTruthy();
    expect(screen.getByText("50 km")).toBeTruthy();
    expect(screen.getByText("100 km")).toBeTruthy();
  });

  it("2-5: Umkreis 10/25/50/100 km sind auswählbar und werden per onChange gemeldet", () => {
    const onChange = vi.fn();
    renderForm(empty, onChange, vi.fn());
    for (const radius of ["10", "25", "50", "100"]) {
      fireEvent.change(screen.getByLabelText("Umkreis"), { target: { value: radius } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ radiusKm: Number(radius) })
      );
    }
  });

  it("6-8: Arbeitsmodell-Checkboxen Remote/Hybrid/Vor Ort vorhanden", () => {
    renderForm(empty, vi.fn(), vi.fn());
    expect(screen.getByLabelText("Remote")).toBeTruthy();
    expect(screen.getByLabelText("Hybrid")).toBeTruthy();
    expect(screen.getByLabelText("Vor Ort")).toBeTruthy();
  });

  it("9: Arbeitsmodell-Mehrfachauswahl funktioniert", () => {
    render(<StatefulForm />);
    fireEvent.click(screen.getByLabelText("Remote"));
    expect((screen.getByLabelText("Remote") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Hybrid"));
    expect((screen.getByLabelText("Remote") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Hybrid") as HTMLInputElement).checked).toBe(true);
  });

  it("10: Vollzeit ist standardmäßig aktiviert, Teilzeit nicht", () => {
    renderForm(empty, vi.fn(), vi.fn());
    expect((screen.getByLabelText("Vollzeit") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Teilzeit") as HTMLInputElement).checked).toBe(false);
  });

  it("11: Teilzeit ist auswählbar", () => {
    render(<StatefulForm />);
    fireEvent.click(screen.getByLabelText("Teilzeit"));
    expect((screen.getByLabelText("Teilzeit") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Vollzeit") as HTMLInputElement).checked).toBe(true);
  });

  it("12: Vollzeit + Teilzeit möglich; mindestens eine bleibt aktiv", () => {
    render(<StatefulForm />);
    fireEvent.click(screen.getByLabelText("Teilzeit"));
    expect((screen.getByLabelText("Vollzeit") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Teilzeit") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Vollzeit"));
    expect((screen.getByLabelText("Vollzeit") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Teilzeit") as HTMLInputElement).checked).toBe(true);
  });
});

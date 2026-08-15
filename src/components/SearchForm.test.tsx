import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const empty: Profile = { skills: "", targetRole: "", city: "" };

describe("SearchForm is a controlled component", () => {
  it("meldet Tippen über onChange mit dem aktualisierten Profil", () => {
    const onChange = vi.fn();
    renderForm(empty, onChange, vi.fn());

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "aws" } });
    expect(onChange).toHaveBeenCalledWith({ skills: "aws", targetRole: "", city: "" });

    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Frontend" } });
    expect(onChange).toHaveBeenCalledWith({ skills: "", targetRole: "Frontend", city: "" });

    fireEvent.change(screen.getByLabelText("Stadt"), { target: { value: "Berlin" } });
    expect(onChange).toHaveBeenCalledWith({ skills: "", targetRole: "", city: "Berlin" });
  });

  it("sendet getrimmte Werte über onSubmit", () => {
    const onSubmit = vi.fn();
    renderForm({ skills: " aws ", targetRole: " Frontend ", city: " Berlin " }, vi.fn(), onSubmit);

    fireEvent.click(screen.getByText("Meine Treffer finden"));
    expect(onSubmit).toHaveBeenCalledWith({ skills: "aws", targetRole: "Frontend", city: "Berlin" });
  });

  it("zeigt nach einem Remount weiterhin die Werte aus dem value-Prop", () => {
    const value: Profile = { skills: "aws", targetRole: "Frontend", city: "Berlin" };

    const first = renderForm(value, vi.fn(), vi.fn());
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    first.unmount();

    renderForm(value, vi.fn(), vi.fn());
    expect((screen.getByLabelText("Skills") as HTMLInputElement).value).toBe("aws");
    expect((screen.getByLabelText("Zielrolle") as HTMLInputElement).value).toBe("Frontend");
    expect((screen.getByLabelText("Stadt") as HTMLInputElement).value).toBe("Berlin");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LangProvider } from "../i18n";
import SkillChips from "./SkillChips";

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("SkillChips", () => {
  it("shows chips, trims display quotes and expands/collapses long lists", () => {
    const skills = ["React", "\"TypeScript\"", "„Node.js“", "SQL", "AWS", "Docker", "Python", "Go"];
    render(
      <LangProvider>
        <SkillChips skills={skills} max={4} />
      </LangProvider>
    );

    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.queryByText("Go")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Weitere anzeigen" }));
    expect(screen.getByText("Go")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weniger anzeigen" }));
    expect(screen.queryByText("Go")).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LangProvider } from "../i18n";
import ProfileStorageChoice from "./ProfileStorageChoice";

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("ProfileStorageChoice", () => {
  it("defaults to session and keeps durable disabled without consent", () => {
    render(
      <LangProvider>
        <ProfileStorageChoice
          value="session"
          onChange={vi.fn()}
          persistentAvailable={false}
          persistentUnavailableReason="Separate Freigabe fehlt."
        />
      </LangProvider>
    );

    expect(screen.getByRole("radio", { name: /Nur für diese Sitzung/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Dauerhaft in meinem RIS-Konto/ })).toBeDisabled();
    expect(screen.getByText("Separate Freigabe fehlt.")).toBeInTheDocument();
    expect(screen.getByText(/May: Wähle bewusst/)).toBeInTheDocument();
  });

  it("reports a deliberate durable selection", () => {
    const onChange = vi.fn();
    render(
      <LangProvider>
        <ProfileStorageChoice value="session" onChange={onChange} persistentAvailable />
      </LangProvider>
    );

    fireEvent.click(screen.getByRole("radio", { name: /Dauerhaft in meinem RIS-Konto/ }));
    expect(onChange).toHaveBeenCalledWith("persistent");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import NewApplicationForm from "./NewApplicationForm";
import { MANUAL_COMPANY_FALLBACK, MANUAL_TITLE_FALLBACK } from "../lib/applications/manualJob";

const validDescription =
  "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.";

function renderForm(onGenerate = vi.fn(), onCancel = vi.fn()) {
  render(
    <LangProvider>
      <NewApplicationForm onGenerate={onGenerate} onCancel={onCancel} />
    </LangProvider>
  );
  return { onGenerate, onCancel };
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NewApplicationForm", () => {
  it("focuses the description and makes no network request on open", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderForm();
    expect(screen.getByLabelText(/Stellenbeschreibung/)).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires a description", () => {
    const { onGenerate } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(screen.getByText("Bitte gib eine Stellenbeschreibung ein.")).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("passes a manual job without URL to the existing letter flow", () => {
    const { onGenerate } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const job = onGenerate.mock.calls[0][0];
    expect(job.source).toEqual(["manual"]);
    expect(job.url).toBe("");
    expect(job.slug).toMatch(/^manual:/);
    expect(job.description).toContain("React-Anwendungen");
    expect(job.descriptionPlain).toBe(job.description);
  });

  it("uses neutral fallbacks for missing title and company", () => {
    const { onGenerate } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const job = onGenerate.mock.calls[0][0];
    expect(job.title).toBe(MANUAL_TITLE_FALLBACK);
    expect(job.company_name).toBe(MANUAL_COMPANY_FALLBACK);
  });

  it("accepts a real URL and rejects an invalid URL", () => {
    const { onGenerate } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: validDescription },
    });
    fireEvent.change(screen.getByLabelText("Original-URL (optional)"), {
      target: { value: "https://example.com/jobs/42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(onGenerate.mock.calls[0][0].url).toBe("https://example.com/jobs/42");

    fireEvent.change(screen.getByLabelText("Original-URL (optional)"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(screen.getByText(/gültige HTTP\(S\)-URL/)).toBeInTheDocument();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("removes HTML before handing the description to the modal", () => {
    const { onGenerate } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: `<p>${validDescription}</p><script>alert('x')</script>` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const job = onGenerate.mock.calls[0][0];
    expect(job.description).not.toContain("<");
    expect(job.description).not.toContain("alert");
  });

  it("rejects an oversized description without truncating it", () => {
    const { onGenerate } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: "x".repeat(20001) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    expect(screen.getByText(/zu lang/)).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("asks before discarding dirty input", () => {
    const { onCancel } = renderForm();
    fireEvent.change(screen.getByLabelText(/Stellenbeschreibung/), {
      target: { value: "Eine ungespeicherte Stellenanzeige." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText("Diese ungespeicherte Stellenanzeige verwerfen?")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

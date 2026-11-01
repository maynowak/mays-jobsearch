import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LetterModal from "./LetterModal";
import { generateCoverLetter, withModelFallback } from "../api";
import type { Job, Profile } from "../types";

vi.mock("../api", () => ({
  generateCoverLetter: vi.fn(),
  withModelFallback: vi.fn(),
  isFreeQuotaExceeded: vi.fn(() => false),
  isModelUnavailable: vi.fn(() => false),
}));

const job: Job = {
  slug: "job-1",
  title: "Frontend Engineer",
  company_name: "Example GmbH",
  location: ["Berlin"],
  remote: true,
  tags: ["React"],
  url: "https://example.com/job-1",
  source: ["arbeitnow"],
};

const fullDescription =
  "Du entwickelst React-Anwendungen und betreust unsere Frontend-Plattform. " +
  "Du hast mindestens 3 Jahre Erfahrung mit TypeScript und React. " +
  "Kenntnisse in CSS und barrierefreiem Webdesign sind erforderlich.";

const reviewedJob: Job = {
  ...job,
  description: `<p>${fullDescription}</p>`,
  descriptionPlain: fullDescription,
};

const profile: Profile = {
  skills: "React, TypeScript",
  targetRoles: ["Frontend Engineer"],
  city: "Berlin",
  radiusKm: 25,
  workModes: ["remote"],
  employmentTypes: ["full_time"],
};

const defaultProps = {
  job,
  prepare: "Ask about the team.",
  profile,
  model: "model-x",
  availableModels: ["model-x", "model-y"],
  recommendedModel: "model-x",
  onClose: vi.fn(),
};

function renderModal(overrides: Partial<typeof defaultProps> = {}, lang: "de" | "en" = "de") {
  try {
    localStorage.setItem("mj-lang", lang);
  } catch {
    // ignore
  }
  return render(
    <LangProvider>
      <LetterModal {...defaultProps} {...overrides} />
    </LangProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    localStorage.setItem("mj-lang", "de");
  } catch {
    // ignore
  }
  vi.mocked(generateCoverLetter).mockResolvedValue("Dear hiring team,");
  vi.mocked(withModelFallback).mockImplementation(async ({ request }) => ({
    data: await request("model-x", 1),
    usedFallback: false,
    attempts: [],
  }));
});

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe("CL-01 LetterModal: explicit start, no automatic AI call", () => {
  it("opens with a preparation view and sends no AI request", () => {
    renderModal();

    expect(screen.getByText("Vorläufige Version")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Example GmbH")).toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    expect(screen.getByText(/keine KI-Anfrage gesendet/i)).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("does not generate on re-render", () => {
    const view = renderModal();
    view.rerender(
      <LangProvider>
        <LetterModal {...defaultProps} />
      </LangProvider>
    );

    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("does not generate when closing the dialog", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("closes on Escape without starting generation", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("starts generation only after an explicit user action and uses the selected job", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" }));

    await waitFor(() => expect(screen.getByText("Dear hiring team,")).toBeInTheDocument());
    expect(withModelFallback).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledWith(
      profile,
      job,
      "Ask about the team.",
      "German",
      "model-x",
      1
    );
  });

  it("does not start a second request while the first one is loading", async () => {
    let resolveGeneration: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      resolveGeneration = resolve;
    });
    vi.mocked(withModelFallback).mockImplementation(async () => ({
      data: await pending,
      usedFallback: false,
      attempts: [],
    }));

    renderModal();
    const start = screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(withModelFallback).toHaveBeenCalledTimes(1);
    resolveGeneration("Done");
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("supports English labels", () => {
    renderModal({}, "en");

    expect(screen.getByText("Preliminary version")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate preliminary cover letter" })).toBeInTheDocument();
  });

  it("resets to the preparation view when the job changes", () => {
    const view = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" }));

    view.rerender(
      <LangProvider>
        <LetterModal
          {...defaultProps}
          job={{ ...job, slug: "job-2", title: "Backend Engineer", company_name: "Other AG" }}
        />
      </LangProvider>
    );

    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Other AG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" })).toBeInTheDocument();
  });

  it("shows an error state and allows an explicit retry", async () => {
    vi.mocked(withModelFallback).mockRejectedValueOnce(new Error("provider down"));

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("provider down");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
    expect(withModelFallback).toHaveBeenCalledTimes(1);
  });

  it("focuses the start action on open and returns focus to the trigger on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <LangProvider>
          <button type="button" onClick={() => setOpen(true)}>
            Trigger
          </button>
          {open && <LetterModal {...defaultProps} onClose={() => setOpen(false)} />}
        </LangProvider>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(trigger).toHaveFocus();
  });

  it("shows a deterministic review with no AI call during the check", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      {
        target: {
          value:
            "Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript.",
        },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Plausibel")).toBeInTheDocument();
    expect(screen.getByText("Ergänzt")).toBeInTheDocument();
    expect(screen.getByText("Vorgesehene Beschreibung für die spätere Generierung")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });

  it("falls back to the original description on a clear mismatch", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      {
        target: {
          value:
            "Position als Backend Engineer bei Other AG. Du entwickelst Java-Anwendungen.",
        },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Deutlicher Widerspruch")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText(/Die vorhandene Beschreibung bleibt ausgewählt/)).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("requires and accepts confirmation for an uncertain enrichment", () => {
    renderModal({ job: reviewedJob });

    fireEvent.change(
      screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"),
      { target: { value: "Wir suchen eine motivierte Person mit Erfahrung und Teamgeist." } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));

    expect(screen.getByText("Zuordnung unklar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Diesen Text trotzdem verwenden" }));

    expect(screen.getByText("Vom Benutzer ergänzt")).toBeInTheDocument();
    expect(screen.getByText("Für die spätere Verwendung bestätigt.")).toBeInTheDocument();
    expect(withModelFallback).not.toHaveBeenCalled();
  });

  it("discards review input after closing and reopening", () => {
    const first = renderModal({ job: reviewedJob });
    fireEvent.change(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen"), {
      target: { value: "Some text" },
    });
    first.unmount();

    renderModal({ job: reviewedJob });
    expect(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen")).toHaveValue("");
    expect(screen.queryByText("Prüfergebnis")).not.toBeInTheDocument();
  });

  it("resets the review input when the selected job changes", () => {
    const view = renderModal({ job: reviewedJob });
    const textarea = screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen");
    fireEvent.change(textarea, { target: { value: "Some text" } });
    fireEvent.click(screen.getByRole("button", { name: "Beschreibung prüfen" }));
    expect(screen.getByText("Prüfergebnis")).toBeInTheDocument();

    view.rerender(
      <LangProvider>
        <LetterModal
          {...defaultProps}
          job={{ ...reviewedJob, slug: "job-2", title: "Backend Engineer" }}
        />
      </LangProvider>
    );

    expect(screen.getByLabelText("Weitere Informationen zur Stellenanzeige einfügen")).toHaveValue("");
    expect(screen.queryByText("Prüfergebnis")).not.toBeInTheDocument();
  });

  it("keeps the copy action usable after generation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" }));
    await screen.findByText("Dear hiring team,");

    fireEvent.click(screen.getByRole("button", { name: "Kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Dear hiring team,"));
    expect(screen.getByText("Kopiert ✓")).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LetterModal from "./LetterModal";
import { ApiError, generateCoverLetter } from "../api";
import { extractPdfText } from "../lib/pdf";
import type { CvDocument, Job, Profile } from "../types";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, generateCoverLetter: vi.fn() };
});

vi.mock("../lib/pdf", () => ({ extractPdfText: vi.fn(async () => "Synthetic CV text") }));

const job: Job = {
  slug: "fallback-job",
  title: "Senior Fullstack Developer",
  company_name: "Siemens AG",
  location: ["Frankfurt am Main"],
  remote: false,
  tags: ["Python", "Angular", "AWS"],
  url: "https://example.com/job",
  source: ["arbeitsagentur"],
  description: "Fullstack role with Python, Angular and AWS.",
  descriptionPlain: "Fullstack role with Python, Angular and AWS.",
};

const profile: Profile = {
  skills: "Python, AWS",
  targetRoles: ["Fullstack Developer"],
  city: "Frankfurt",
  radiusKm: 25,
  workModes: ["hybrid"],
  employmentTypes: ["full_time"],
};

beforeEach(() => {
  vi.clearAllMocks();
  try {
    localStorage.setItem("mj-lang", "de");
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  cleanup();
});

describe("cover-letter fallback integration", () => {
  it("uses a successful intermediate fallback response instead of requesting another model", async () => {
    let calls = 0;
    vi.mocked(generateCoverLetter).mockImplementation(async (_request, attempt) => {
      calls += 1;
      if (calls < 2) {
        throw new ApiError("This model is temporarily unavailable.", 502, "model_unavailable");
      }
      expect(attempt).toBe(2);
      return { letter: "FALLBACK LETTER", meta: { operation: "generate" } };
    });

    render(
      <LangProvider>
        <LetterModal
          job={job}
          prepare=""
          profile={profile}
          model="model-a"
          modelsState="ready"
          models={[
            { id: "model-a", name: "Model A" },
            { id: "model-b", name: "Model B" },
            { id: "model-c", name: "Model C" },
          ]}
          defaultModel="model-a"
          availableModels={["model-a", "model-b", "model-c"]}
          recommendedModel="model-a"
          onClose={vi.fn()}
        />
      </LangProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    await waitFor(() => expect(editor).toHaveValue("FALLBACK LETTER"));
    expect(generateCoverLetter).toHaveBeenCalledTimes(2);
  });

  it("processes a successful fallback even when the request used a selected CV", async () => {
    let calls = 0;
    vi.mocked(generateCoverLetter).mockImplementation(async (_request, attempt) => {
      calls += 1;
      if (calls < 3) {
        throw new ApiError("This model is temporarily unavailable.", 502, "model_unavailable");
      }
      expect(attempt).toBe(3);
      return { letter: "CV FALLBACK LETTER", meta: { operation: "generate" } };
    });
    const cv: CvDocument = {
      id: "cv-1",
      name: "my-cv.pdf",
      size: 1024,
      selected: false,
      file: new File(["synthetic"], "my-cv.pdf", { type: "application/pdf" }),
      processedAt: Date.now(),
      hash: "a".repeat(64),
    };

    render(
      <LangProvider>
        <LetterModal
          job={job}
          prepare=""
          profile={profile}
          model="model-a"
          modelsState="ready"
          models={[
            { id: "model-a", name: "Model A" },
            { id: "model-b", name: "Model B" },
            { id: "model-c", name: "Model C" },
          ]}
          defaultModel="model-a"
          availableModels={["model-a", "model-b", "model-c"]}
          recommendedModel="model-a"
          cvDocuments={[cv]}
          onClose={vi.fn()}
        />
      </LangProvider>
    );

    fireEvent.click(screen.getByLabelText(/my-cv\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Anschreiben generieren" }));
    const editor = await screen.findByRole("textbox", { name: "Bearbeitbares Anschreiben" });
    await waitFor(() => expect(editor).toHaveValue("CV FALLBACK LETTER"));
    expect(extractPdfText).toHaveBeenCalledTimes(1);
    expect(generateCoverLetter).toHaveBeenCalledTimes(3);
  });

});

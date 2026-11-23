import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import MatchCard from "./MatchCard";
import { LangProvider } from "../i18n";
import { fetchJobDetails } from "../api";
import type { Match, Job } from "../types";

vi.mock("../api", () => ({ fetchJobDetails: vi.fn() }));

const createTestJob = (overrides = {}): Job => ({
  slug: "test-job",
  title: "Software Engineer",
  company_name: "Test Company",
  location: ["Berlin"],
  remote: false,
  tags: ["JavaScript", "React"],
  url: "https://example.com/job",
  source: ["arbeitnow"],
  ...overrides,
});

const createTestMatch = (overrides = {}): Match => ({
  score: 85,
  why: "This job matches your skills in JavaScript and React.",
  prepare: "Prepare questions about React hooks.",
  job: createTestJob(),
  ...overrides,
});

function renderMatchCard(props: any, lang: "en" | "de" = "de") {
  try { localStorage.setItem("mj-lang", lang); } catch {}
  return render(
    <LangProvider>
      <MatchCard {...props} />
    </LangProvider>
  );
}

describe("MatchCard - ATS Evaluation Button", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ATS evaluate button when onAtsEvaluate is provided", () => {
    const match = createTestMatch();
    const onAtsEvaluate = vi.fn();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate,
    });

    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });

  it("does not render ATS evaluate button when onAtsEvaluate is not provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
    });

    expect(screen.queryByText("Mit ATS bewerten")).not.toBeInTheDocument();
  });

  it("calls onAtsEvaluate with the correct job when ATS button is clicked", () => {
    const match = createTestMatch();
    const onAtsEvaluate = vi.fn();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate,
    });

    fireEvent.click(screen.getByText("Mit ATS bewerten"));

    expect(onAtsEvaluate).toHaveBeenCalledTimes(1);
    expect(onAtsEvaluate).toHaveBeenCalledWith(match.job);
  });

  it("renders both ATS and Letter buttons when both handlers provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate: () => {},
    });

    expect(screen.getByText("Anschreiben erstellen")).toBeInTheDocument();
    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });

  it("renders ATS button alongside Letter button when both handlers provided", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate: () => {},
    });

    expect(screen.getByText("Anschreiben erstellen")).toBeInTheDocument();
    expect(screen.getByText("Mit ATS bewerten")).toBeInTheDocument();
  });

  it("loads short Arbeitsagentur details before ATS", async () => {
    const job = createTestJob({
      source: ["arbeitsagentur"],
      description: "",
      descriptionPlain: "",
    });
    const match = createTestMatch({ job });
    const enriched = {
      ...job,
      description: "<p>Vollständige Beschreibung</p>",
      descriptionPlain:
        "Vollständige Beschreibung mit AWS. Wir entwickeln Systeme und suchen Erfahrung mit Requirements.",
    };
    const onAtsEvaluate = vi.fn();
    vi.mocked(fetchJobDetails).mockReset();
    vi.mocked(fetchJobDetails).mockResolvedValue({ jobs: { [job.slug]: enriched } });

    renderMatchCard({ match, index: 0, onGenerateLetter: () => {}, onAtsEvaluate });
    fireEvent.click(screen.getByText("Mit ATS bewerten"));

    await waitFor(() =>
      expect(onAtsEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({ descriptionPlain: enriched.descriptionPlain }),
        "reloaded"
      )
    );
    expect(fetchJobDetails).toHaveBeenCalledTimes(1);
  });

  it("keeps the original posting link in the shared action bar", () => {
    const match = createTestMatch();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter: () => {},
      onAtsEvaluate: () => {},
    });

    const link = screen.getByRole("link", { name: /Original-Anzeige ansehen/ });
    expect(link).toHaveAttribute("href", "https://example.com/job");
    expect(link.closest(".job-actions")).not.toBeNull();
  });

  it("passes the selected job and prepare text to the letter callback", () => {
    const match = createTestMatch();
    const onGenerateLetter = vi.fn();

    renderMatchCard({
      match,
      index: 0,
      onGenerateLetter,
      onAtsEvaluate: () => {},
    });

    fireEvent.click(screen.getByText("Anschreiben erstellen"));

    expect(onGenerateLetter).toHaveBeenCalledTimes(1);
    expect(onGenerateLetter).toHaveBeenCalledWith(match.job, match.prepare);
  });
});
describe("MatchCard - Match Radar identity", () => {
  afterEach(() => cleanup());

  it("exposes the stable job slug and title for the result radar", () => {
    const { container } = renderMatchCard({
      match: createTestMatch(),
      index: 3,
      onGenerateLetter: () => {},
    });
    const card = container.querySelector("[data-radar-job-id]");
    expect(card).toHaveAttribute("data-radar-job-id", "test-job");
    expect(card).toHaveAttribute("data-radar-job-title", "Software Engineer");
  });
});

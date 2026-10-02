import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Job, Profile } from "../types";
import { LangProvider } from "../i18n";
import { analyzeATS, type AtsAnalysisResponse } from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    analyzeATS: vi.fn(),
    fetchModels: vi.fn(),
  };
});

// Import after mock to ensure mocked dependencies
import AtsOverlay from "./AtsOverlay";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

const baseJob: Job = {
  slug: "test-job-1",
  title: "Frontend Developer",
  company_name: "Acme Corp",
  tags: ["React", "TypeScript", "AWS"],
  location: ["Berlin"],
  remote: true,
  url: "https://example.com/job",
  description: "We need React and TypeScript experience.",
  descriptionPlain: "We need React and TypeScript experience.",
  created_at: new Date().toISOString(),
};

const baseProfile: Profile = {
  skills: "React, TypeScript, AWS, Docker",
  targetRoles: ["Frontend Developer"],
  city: "Berlin",
  radiusKm: 25,
  workModes: ["remote"],
  employmentTypes: ["full_time"],
};

function createMockAnalysis(overrides: Partial<AtsAnalysisResponse> = {}): AtsAnalysisResponse {
  const base: AtsAnalysisResponse = {
    analysis: {
      score: 75,
      keywordCoverage: { overall: 75 },
      criticalGaps: [],
      requirements: [
        { id: "req-1", text: "React", category: "skill", importance: "high" },
        { id: "req-2", text: "TypeScript", category: "skill", importance: "high" },
        { id: "req-3", text: "AWS", category: "skill", importance: "medium" },
        { id: "req-4", text: "Kubernetes", category: "skill", importance: "medium" },
        { id: "req-5", text: "5+ years", category: "experience", importance: "high" },
      ],
      matches: [
        { requirementId: "req-1", status: "MATCHED", confidence: "HIGH" },
        { requirementId: "req-2", status: "MATCHED", confidence: "HIGH" },
        { requirementId: "req-3", status: "PARTIAL", confidence: "MEDIUM" },
        { requirementId: "req-4", status: "UNKNOWN", confidence: "LOW" },
        { requirementId: "req-5", status: "UNKNOWN", confidence: "LOW" },
      ],
    },
    recommendations: [
      { requirementId: "req-3", changeType: "EVIDENCE_CLARIFICATION", priority: "medium", proposedChange: "AWS deutlicher hervorheben", rationale: "Teilweise Erfüllung", relatedCVEvidence: "AWS" },
      { requirementId: "req-4", changeType: "UNKNOWN_REVIEW", priority: "medium", proposedChange: "CV-Evidenz prüfen für Kubernetes", rationale: "Kein Nachweis", relatedCVEvidence: null },
      { requirementId: "req-5", changeType: "UNKNOWN_REVIEW", priority: "high", proposedChange: "CV-Evidenz prüfen für 5+ years", rationale: "Kein Nachweis", relatedCVEvidence: null },
    ],
    ai: {
      requested: false,
      executed: false,
      consentRequired: true,
      consentGiven: false,
      provider: undefined,
      model: undefined,
      externalProcessing: false,
      dataMinimized: false,
      privacyStatus: undefined,
      privacyPolicy: undefined,
      dataCategories: [],
      formulations: [],
    },
  };
  return { ...base, ...overrides };
}

describe("ATS-UI-IMPROVEMENT-01: AtsOverlay user-facing presentation", () => {
  it("zeigt deutsche user-facing Status-Labels statt technischer Begriffe", async () => {
    const analysis = createMockAnalysis();
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS-Bewertung");
    
    // Technische Begriffe dürfen NICHT erscheinen
    expect(screen.queryByText("MATCHED")).not.toBeInTheDocument();
    expect(screen.queryByText("PARTIAL")).not.toBeInTheDocument();
    expect(screen.queryByText("UNKNOWN")).not.toBeInTheDocument();
    expect(screen.queryByText("GAP")).not.toBeInTheDocument();
    
    // Stattdessen user-facing Labels (mindestens einmal)
    expect(screen.getAllByText("Passt").length).toBeGreaterThan(0); // MATCHED
    expect(screen.getAllByText("Teilweise passend").length).toBeGreaterThan(0); // PARTIAL
    expect(screen.getAllByText("Nicht eindeutig belegt").length).toBeGreaterThan(0); // UNKNOWN
  });

  it("zeigt vier thematische Sektionen mit Überschriften und Annotationen", async () => {
    const analysis = createMockAnalysis();
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS-Bewertung");
    
    // Vier Haupt-Sektionen
    expect(screen.getByText("ATS-Bewertung")).toBeInTheDocument();
    expect(screen.getByText("Anforderungen der Stelle")).toBeInTheDocument();
    expect(screen.getByText("Was bereits passt")).toBeInTheDocument();
    expect(screen.getByText("Wo noch etwas fehlt")).toBeInTheDocument();
    
    // Annotationen unter den Überschriften (Teiltext reicht)
    expect(screen.getByText(/Wie gut dein ausgewähltes ATS-Profil/i)).toBeInTheDocument();
    expect(screen.getByText(/Welche Anforderungen aus der Stellenanzeige/i)).toBeInTheDocument();
    expect(screen.getByText(/Anforderungen, die durch dein Profil belegt sind/i)).toBeInTheDocument();
    expect(screen.getByText(/keinen eindeutigen Nachweis enthält/i)).toBeInTheDocument();
  });

  it("zeigt keine leeren Sektionen (z.B. 'Was bereits passt' bei 0 MATCHED)", async () => {
    const analysis = createMockAnalysis({
      analysis: {
        score: 25,
        keywordCoverage: { overall: 25 },
        criticalGaps: [],
        requirements: [
          { id: "req-1", text: "Kubernetes", category: "skill", importance: "high" },
          { id: "req-2", text: "Docker", category: "skill", importance: "medium" },
        ],
        matches: [
          { requirementId: "req-1", status: "UNKNOWN", confidence: "LOW" },
          { requirementId: "req-2", status: "UNKNOWN", confidence: "LOW" },
        ],
      },
    });
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS-Bewertung");
    
    // "Was bereits passt" darf NICHT angezeigt werden (0 MATCHED)
    expect(screen.queryByText("Was bereits passt")).not.toBeInTheDocument();
    // Aber "Wo noch etwas fehlt" soll angezeigt werden
    expect(screen.getByText("Wo noch etwas fehlt")).toBeInTheDocument();
  });

  it("zeigt Bewerbungshinweise (Tips) thematisch gruppiert mit eigenen Karten", async () => {
    const analysis = createMockAnalysis();
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS-Bewertung");
    
    // Tips-Sektion
    expect(screen.getByText("Bewerbungshinweise")).toBeInTheDocument();
    expect(screen.getByText("Diese Hinweise helfen dir dabei, die ATS-relevanten Punkte deiner Bewerbung gezielt zu prüfen.")).toBeInTheDocument();
    
    // Drei Tip-Kategorien (nur wenn Daten vorhanden)
    expect(screen.getByText("Profil schärfen")).toBeInTheDocument(); // matched requirements
    expect(screen.getByText("Nachweise prüfen")).toBeInTheDocument(); // partial requirements
    expect(screen.getByText("Lebenslauf anpassen")).toBeInTheDocument(); // unknown + gap
    
    // Beschreibungen
    expect(screen.getByText("Passende Skills im Lebenslauf deutlicher hervorheben.")).toBeInTheDocument();
    expect(screen.getByText("Prüfen, ob teilweise passende Skills im Lebenslauf ausreichend sichtbar sind.")).toBeInTheDocument();
    expect(screen.getByText("Fehlende Nachweise für als nicht eindeutig belegte Anforderungen ergänzen.")).toBeInTheDocument();
  });

  it("unterscheidet Deterministische ATS-Bewertung von KI-formulierter Erläuterung", async () => {
    const analysis = createMockAnalysis({
      ai: {
        requested: true,
        executed: true,
        consentRequired: true,
        consentGiven: true,
        provider: "OpenRouter",
        model: "test-model",
        externalProcessing: true,
        dataMinimized: true,
        privacyStatus: "VERIFIED",
        privacyPolicy: "https://openrouter.ai/privacy",
        dataCategories: ["job requirement", "matched keyword", "change type"],
        formulations: [
          { changeType: "EVIDENCE_CLARIFICATION", proposedText: "AWS experience highlighted", rationale: "Better visibility" },
        ],
      },
    });
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS-Bewertung");
    
    // Deterministisches Label NICHT als KI gekennzeichnet
    expect(screen.getByText("Deterministische ATS-Bewertung")).toBeInTheDocument();
    // KI-Sektion deutlich gekennzeichnet (mindestens einmal)
    expect(screen.getAllByText("KI-formulierte Erläuterung").length).toBeGreaterThan(0);
    expect(screen.getByText("Diese Erläuterung wurde anhand der ATS-Analyse formuliert.")).toBeInTheDocument();
  });

  it("englische Labels bei EN-Sprache", async () => {
    localStorage.setItem("mj-lang", "en");
    const analysis = createMockAnalysis();
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );

    await screen.findByText("ATS Evaluation");
    
    // Englische user-facing Labels (mindestens einmal)
    expect(screen.getAllByText("Matches").length).toBeGreaterThan(0); // MATCHED
    expect(screen.getAllByText("Partially matches").length).toBeGreaterThan(0); // PARTIAL
    expect(screen.getAllByText("Not clearly evidenced").length).toBeGreaterThan(0); // UNKNOWN
    
    // Englische Sektionen
    expect(screen.getByText("ATS Evaluation")).toBeInTheDocument();
    expect(screen.getByText("Job Requirements")).toBeInTheDocument();
    expect(screen.getByText("What Already Matches")).toBeInTheDocument();
    expect(screen.getByText("Where Evidence Is Missing")).toBeInTheDocument();
    expect(screen.getByText("Application Tips")).toBeInTheDocument();
  });
});
describe("ATS-UI-DATA-01: Keyword Coverage ist Prozent, kein Ratio", () => {
  // Produktions-Einheit ist 0..100 (Prozent). overall 50 darf nie zu 5000 % werden.
  async function renderWithCoverage(overall: number) {
    const { analyzeATS } = await import("../api");
    vi.mocked(analyzeATS).mockResolvedValue(
      createMockAnalysis({ analysis: {
        score: 50,
        keywordCoverage: { overall },
        criticalGaps: [],
        requirements: [],
        matches: [],
      } })
    );
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );
    await screen.findByText("ATS-Bewertung");
    return document.body.textContent ?? "";
  }

  it("TEST 1: coverage 0 ist gültig (0 %)", async () => {
    const text = await renderWithCoverage(0);
    expect(text).toContain("0%");
    cleanup();
  });

  it("TEST 3: coverage 50 wird als 50 % angezeigt (nie 5000 %)", async () => {
    const text = await renderWithCoverage(50);
    expect(text).toContain("50%");
    expect(text).not.toContain("5000%");
    cleanup();
  });

  it("TEST 4: coverage 100 ist gültig (100 %)", async () => {
    const text = await renderWithCoverage(100);
    expect(text).toContain("100%");
    cleanup();
  });

  it("TEST 5: coverage > 100 wird gekappt (kein ungültiger Wert)", async () => {
    const text = await renderWithCoverage(150);
    expect(text).toContain("100%");
    expect(text).not.toContain("150%");
    cleanup();
  });
});

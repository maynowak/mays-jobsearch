import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  description:
    "We are looking for a Frontend Developer. You will build reliable React and TypeScript applications with AWS. Requirements: 3 years experience and strong communication.",
  descriptionPlain:
    "We are looking for a Frontend Developer. You will build reliable React and TypeScript applications with AWS. Requirements: 3 years experience and strong communication.",
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

describe("JM-ATS-MATCHING-QUALITY-01: payload", () => {
  it("sends the full description and ATS profile fields to the existing API", async () => {
    vi.mocked(analyzeATS).mockClear();
    vi.mocked(analyzeATS).mockResolvedValue(createMockAnalysis());
    render(
      <LangProvider>
        <AtsOverlay
          job={baseJob}
          profile={baseProfile}
          criteria={{ schemaVersion: 1, requiredSkills: ["React"], preferredSkills: [], excludedTerms: [] }}
          onClose={vi.fn()}
        />
      </LangProvider>
    );
    await screen.findByText("ATS-Bewertung");
    expect(vi.mocked(analyzeATS)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: baseJob.title,
        tags: baseJob.tags,
        slug: baseJob.slug,
        descriptionPlain: baseJob.descriptionPlain,
        description: baseJob.description,
      }),
      expect.objectContaining({
        skills: baseProfile.skills,
        targetRoles: baseProfile.targetRoles,
        criteria: expect.objectContaining({ requiredSkills: ["React"] }),
      }),
      { enabled: false }
    );
  });
});

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
    expect(screen.getByText(/Anforderungsabdeckung auf Basis der tatsächlichen Stellenanzeige/i)).toBeInTheDocument();
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

  it("zeigt bei fehlender Anforderungsbasis keine 100-%-Zahl", async () => {
    const analysis = createMockAnalysis({
      analysis: {
        score: 0,
        keywordCoverage: { overall: 0 },
        analysisStatus: "insufficient",
        requirementCoverage: 0,
        roleMatch: 100,
        basis: { requirementCount: 0, titleRequirementCount: 2, hasDescription: false, roleMatchAvailable: true },
        criticalGaps: [],
        requirements: [],
        matches: [],
      },
    });
    vi.mocked(analyzeATS).mockResolvedValue(analysis);
    render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );
    await screen.findByText("Nicht ausreichend bewertbar");
    expect(screen.queryByText("0/100")).not.toBeInTheDocument();
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

describe("ATS-TABLE-LAYOUT-01: Anforderungs-Tabellen trennen Text und Status", () => {
  // Regression: In "Was bereits passt" lagen Text und Status als direkte
  // Inline-Children in einem Block-Container. Sie liefen ohne Abstand
  // zusammen ("devopsPasst"). Beide Tabellen brauchen denselben
  // Flex-Wrapper .ats-requirement-row.
  const layoutAnalysis = createMockAnalysis({
    analysis: {
      score: 90,
      keywordCoverage: { overall: 90 },
      criticalGaps: [],
      requirements: [
        { id: "req-devops", text: "devops", category: "skill", importance: "high" },
        { id: "req-engineer", text: "engineer", category: "skill", importance: "high" },
        { id: "req-cloud", text: "cloud-architect", category: "skill", importance: "high" },
      ],
      matches: [
        { requirementId: "req-devops", status: "MATCHED", confidence: "HIGH" },
        { requirementId: "req-engineer", status: "MATCHED", confidence: "HIGH" },
        { requirementId: "req-cloud", status: "MATCHED", confidence: "HIGH" },
      ],
    },
  });

  async function renderLayout() {
    vi.mocked(analyzeATS).mockResolvedValue(layoutAnalysis);
    const { container } = render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );
    await screen.findByText("ATS-Bewertung");
    return container;
  }

  it("rendert Anforderungstext und Status als getrennte Elemente", async () => {
    await renderLayout();

    // Wichtig: textContent ist hier KEIN gueltiger Indikator. Adjazente
    // Elemente werden dort immer verkettet ("devopsPasst") - unabhaengig
    // vom CSS-Layout. Der Bug war rein visuell (Inline-Elemente ohne
    // Abstand). Nachweis daher ueber getrennte Element-Knoten:
    // getByText("devops") matcht nur ein Element mit EXAKT diesem Text.
    // Waere der Text mit dem Status verschmolzen, schlaegt das fehl.
    expect(screen.getAllByText("devops")).toHaveLength(1);
    expect(screen.getAllByText("engineer")).toHaveLength(1);
    expect(screen.getAllByText("cloud-architect")).toHaveLength(1);
    expect(screen.getAllByText("Passt").length).toBeGreaterThan(0);
    cleanup();
  });

  it("gibt jeder Anforderungszeile einen Flex-Wrapper (.ats-requirement-row)", async () => {
    const container = await renderLayout();

    // Each requirement is rendered once; the former second table was
    // replaced by a compact summary to avoid repeating the same keywords.
    const rows = container.querySelectorAll(".ats-requirement-row");
    expect(rows.length).toBeGreaterThanOrEqual(3); // individual requirements are rendered once

    // Wrapper beinhaltet getrennte Text- und Status-Spalten.
    const first = rows[0];
    expect(first?.querySelector(".ats-requirement-text")).not.toBeNull();
    expect(first?.querySelector(".ats-requirement-status")).not.toBeNull();
    cleanup();
  });

  it("bietet bei fehlender Beschreibung die manuelle ATS-Eingabe an", async () => {
    const noDescriptionJob = {
      ...baseJob,
      description: "",
      descriptionPlain: "",
    };
    const incompleteAnalysis = createMockAnalysis({
      analysis: {
        score: 0,
        keywordCoverage: { overall: 0 },
        requirementCoverage: 0,
        analysisStatus: "insufficient",
        criticalGaps: [],
        requirements: [],
        matches: [],
      },
    });
    vi.mocked(analyzeATS).mockClear();
    vi.mocked(analyzeATS).mockResolvedValue(incompleteAnalysis);

    render(
      <LangProvider>
        <AtsOverlay job={noDescriptionJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );
    await screen.findByText("ATS-Bewertung");

    fireEvent.click(screen.getByRole("button", { name: "Stellenbeschreibung manuell einfügen" }));
    const textarea = screen.getByLabelText("Stellenbeschreibung");
    fireEvent.change(textarea, {
      target: {
        value:
          "We are looking for a Frontend Developer. You will build reliable React and TypeScript applications. Requirements: 3 years experience and strong communication.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mit dieser Beschreibung bewerten" }));

    await waitFor(() => expect(analyzeATS).toHaveBeenCalledTimes(2));
    const lastJob = vi.mocked(analyzeATS).mock.calls.at(-1)?.[0];
    expect(lastJob).toMatchObject({
      description:
        "We are looking for a Frontend Developer. You will build reliable React and TypeScript applications. Requirements: 3 years experience and strong communication.",
      descriptionPlain:
        "We are looking for a Frontend Developer. You will build reliable React and TypeScript applications. Requirements: 3 years experience and strong communication.",
    });
    expect(noDescriptionJob.description).toBe("");
    expect(noDescriptionJob.descriptionPlain).toBe("");
  });

  it("rendert jede Anforderungszeile einmal mit der identischen Zeilen-Struktur", async () => {
    const container = await renderLayout();

    // "Anforderungen der Stelle" und "Was bereits passt" muessen beide
    // ueber .ats-requirement-row verfuegen - genau das war der Unterschied,
    // durch den nur die untere Tabelle fehlerhaft rendete.
    const requirementRows = container.querySelectorAll(
      ".ats-requirement .ats-requirement-row"
    );
    expect(requirementRows.length).toBeGreaterThanOrEqual(3); // matched rows are summarised, not repeated as a second table

    // Keine Anforderungszeile darf ohne Wrapper auskommen.
    const orphanRows = Array.from(
      container.querySelectorAll(".ats-requirement")
    ).filter((row) => !row.querySelector(".ats-requirement-row"));
    expect(orphanRows).toHaveLength(0);
    cleanup();
  });
});

describe("JM-ATS-METADATA-RECOVERY-02: non-redundant requirement view", () => {
  it("zeigt Requirements einmal, Metadaten separat und keine Metadaten als Luecke", async () => {
    const analysis = createMockAnalysis({
      analysis: {
        score: 40,
        keywordCoverage: { overall: 40 },
        requirementCoverage: 40,
        criticalGaps: [],
        metadata: {
          title: "Solutions Architect (Remote)",
          titleTokens: ["solutions", "architect", "(remote)"],
          language: "de",
          workMode: "onsite",
          jobTypes: ["full_time"],
          contractType: null,
          contractTypeNoData: true,
        },
        requirements: [
          { id: "req-devops", text: "DevOps", category: "skill", importance: "high", source: "tags" },
          { id: "req-k8s", text: "Kubernetes", category: "skill", importance: "high", source: "description" },
        ],
        matches: [
          { requirementId: "req-devops", status: "UNKNOWN", confidence: "LOW" },
          { requirementId: "req-k8s", status: "UNKNOWN", confidence: "LOW" },
        ],
      },
    });
    vi.mocked(analyzeATS).mockResolvedValue(analysis);

    const { container } = render(
      <LangProvider>
        <AtsOverlay job={baseJob} profile={baseProfile} onClose={vi.fn()} />
      </LangProvider>
    );
    await screen.findByText("ATS-Bewertung");

    expect(screen.getAllByText("DevOps")).toHaveLength(1);
    expect(screen.getAllByText("Kubernetes")).toHaveLength(1);
    expect(screen.getByText("Stellenkontext")).toBeInTheDocument();
    expect(screen.getByText("Arbeitsmodell: onsite")).toBeInTheDocument();
    expect(screen.getByText("Sprache: de")).toBeInTheDocument();
    expect(screen.queryByText("KEINE_ANGABE")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ats-gap-item")).toHaveLength(0);
    expect(screen.getAllByText(/2 Anforderungen brauchen eine genauere Prüfung/i).length).toBeGreaterThan(0);
  });
});

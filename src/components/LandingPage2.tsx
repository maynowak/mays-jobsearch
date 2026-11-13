import { useEffect, useState } from "react";
import heroImage from "../assets/images/Futuristische_Stadt_im_blauen_Abendlicht2.png";
import JobStream from "./JobStream";
import MatchPulse from "./MatchPulse";
import Footer from "./Footer";
import Navbar from "./Navbar";
import { useLang } from "../i18n";

// ---------------------------------------------------------------------------
// PRODUKTIONS-LANDINGPAGE — diese Komponente rendert "/" (Root-Domain).
// Bitte NICHT mehr suchen: Dies ist die aktuelle, sichtbare Landingpage.
//
// HISTORIE (TOP-MENU-01, geprüft 2026-10-06):
//   b12529c  LANDINGPAGE-02      neue Datei LandingPage2.tsx unter "/landingspage2"
//   6efc1b3  LANDINGPAGE-SWAP-01 Tausch "/" <-> "/landingspage2"
//   Ergebnis: seit 6efc1b3 ist LandingPage2 die Landingpage auf "/".
//   Der Name "LandingPage2" stammt aus der Prototyp-Phase und wurde NIE
//   umbenannt (git log --diff-filter=R auf *anding* ist leer). Die alte
//   Landingpage läuft weiterhin unter "/landingspage2" (App, Route "landing").
//   Dateien bleiben absichtlich unbenannt, damit die Branch-Historie stimmt.
// ---------------------------------------------------------------------------
// JM-MARKETING-02: Positionierung als individuelle Jobsuche mit KI-
// Unterstützung. Aussagen sind bewusst an den tatsächlichen Funktionsumfang
// gebunden: Quellen je nach Verfügbarkeit, KI-Bewertung auf Wunsch,
// Suchprofile sitzungsbasiert oder mit Konto, Bewerbungen standardmäßig
// sitzungsbasiert. Keine Garantien, keine „alle Jobbörsen“-Aussagen.
type Lp2Lang = "de" | "en";

interface Lp2Step {
  title: string;
  text: string;
}

interface Lp2Card {
  title: string;
  text: string;
}

interface Lp2Copy {
  eyebrow: string;
  titleA: string;
  titleAccent: string;
  subtitle: string;
  findJobs: string;
  learnMore: string;
  heroNote: string;
  heroAria: string;
  backgroundAlt: string;
  matchPulseLabel: string;
  howEyebrow: string;
  howTitle: string;
  howLead: string;
  steps: Lp2Step[];
  benefitsEyebrow: string;
  benefitsTitle: string;
  benefitsLead: string;
  cards: Lp2Card[];
  notesEyebrow: string;
  notesTitle: string;
  notesLead: string;
  notes: Lp2Card[];
}

const STRINGS: Record<Lp2Lang, Lp2Copy> = {
  de: {
    eyebrow: "MAY'S JOB MATCHER",
    titleA: "Finde Jobs,",
    titleAccent: "die wirklich zu dir passen.",
    subtitle:
      "Entdecke Stellen aus mehreren Quellen, definiere eigene Suchprofile und vergleiche Anforderungen mit deinen Qualifikationen – auf Wunsch mit KI-Unterstützung.",
    findJobs: "Jetzt passende Jobs finden",
    learnMore: "So funktioniert's",
    heroNote:
      "Ohne Anmeldung starten. Dauerhafte Suchprofile brauchen ein Konto und eine Einwilligung.",
    heroAria: "Visuelle Bühne",
    backgroundAlt: "Futuristische Stadt im blauen Abendlicht mit blauen Lichtlinien",
    matchPulseLabel: "KI-Puls auslösen und Job-Stream aktualisieren",
    howEyebrow: "IN VIER SCHRITTEN",
    howTitle: "So funktioniert's",
    howLead: "Von der ersten Suche bis zur organisierten Bewerbung – du behältst die Kontrolle.",
    steps: [
      {
        title: "Suchprofil festlegen",
        text: "Berufsbezeichnung, Skills, Ort und Umkreis festlegen – manuell oder per PDF-Lebenslauf.",
      },
      {
        title: "Stellen entdecken",
        text: "Verfügbare Stellen aus den angebundenen Quellen finden – je nach Quelle und Verfügbarkeit.",
      },
      {
        title: "Passung vergleichen",
        text: "Auf Wunsch bewertet die KI Stellenanforderungen gegen dein Profil – mit Score und Begründung.",
      },
      {
        title: "Bewerbung organisieren",
        text: "Interessante Stellen und Bewerbungsstatus in der aktuellen Sitzung bündeln.",
      },
    ],
    benefitsEyebrow: "DEINE VORTEILE",
    benefitsTitle: "Mehr als eine Jobsuche",
    benefitsLead:
      "Alles, was du für einen strukturierten Bewerbungsprozess brauchst – an einem Ort.",
    cards: [
      {
        title: "Stellensuche",
        text: "Mehrere Quellen, eine Suche: Stellen aus den verfügbaren Job-Quellen entdecken.",
      },
      {
        title: "Individuelle Suchprofile",
        text: "Eigene Anforderungen und Skills festlegen. Ohne Konto für die Sitzung, mit Konto dauerhaft speicherbar.",
      },
      {
        title: "KI-Matching",
        text: "Qualifikationen mit Stellenanforderungen vergleichen – auf Wunsch mit Score, Begründung und Vorbereitungsfrage.",
      },
      {
        title: "Bewerbungsorganisation",
        text: "Bewerbungen und Status übersichtlich verwalten – standardmäßig in der aktuellen Sitzung.",
      },
    ],
    notesEyebrow: "TRANSPARENZ",
    notesTitle: "Gut zu wissen",
    notesLead: "Was du vor dem Start wissen solltest.",
    notes: [
      {
        title: "Ohne Anmeldung starten",
        text: "Suche und KI-Bewertung startest du ohne Konto. Für dauerhaft gespeicherte Suchprofile brauchst du ein Konto und eine separate Einwilligung.",
      },
      {
        title: "Dein Lebenslauf",
        text: "Die PDF wird lokal im Browser gelesen. Für die Profilerstellung kann der extrahierte Text an einen KI-Dienst übermittelt werden.",
      },
      {
        title: "Deine Bewerbungen",
        text: "Bewerbungsdaten bleiben standardmäßig in der aktuellen Sitzung. Dauerhafte Speicherung nur mit entsprechender Freigabe.",
      },
    ],
  },
  en: {
    eyebrow: "MAY'S JOB MATCHER",
    titleA: "Find jobs",
    titleAccent: "that really fit you.",
    subtitle:
      "Discover jobs from multiple sources, define your own search profiles and compare requirements with your skills – with optional AI support.",
    findJobs: "Find matching jobs now",
    learnMore: "How it works",
    heroNote:
      "Start without an account. Permanently saved profiles require an account and consent.",
    heroAria: "Visual stage",
    backgroundAlt: "Futuristic city in blue evening light with blue light trails",
    matchPulseLabel: "Trigger AI pulse and refresh job stream",
    howEyebrow: "IN FOUR STEPS",
    howTitle: "How it works",
    howLead: "From the first search to an organized application – you stay in control.",
    steps: [
      {
        title: "Define your search profile",
        text: "Set your target role, skills, location and radius – manually or from a PDF CV.",
      },
      {
        title: "Discover jobs",
        text: "Find available jobs from connected sources, depending on source and availability.",
      },
      {
        title: "Compare the fit",
        text: "Optionally, AI compares job requirements with your profile – including a score and reasoning.",
      },
      {
        title: "Organize applications",
        text: "Collect interesting jobs and application status in the current session.",
      },
    ],
    benefitsEyebrow: "YOUR BENEFITS",
    benefitsTitle: "More than a job board",
    benefitsLead: "Everything you need for a structured application process – in one place.",
    cards: [
      {
        title: "Job search",
        text: "Multiple sources, one search: discover jobs from the available job sources.",
      },
      {
        title: "Individual search profiles",
        text: "Set your own requirements and skills. Session-based without an account; permanently saved with an account.",
      },
      {
        title: "AI matching",
        text: "Compare your skills with job requirements – optionally with a score, reasoning and a prep question.",
      },
      {
        title: "Application organization",
        text: "Manage applications and status in one place – by default in the current session.",
      },
    ],
    notesEyebrow: "TRANSPARENCY",
    notesTitle: "Good to know",
    notesLead: "What you should know before you start.",
    notes: [
      {
        title: "Start without an account",
        text: "Search and AI evaluation start without an account. Permanently saved search profiles require an account and separate consent.",
      },
      {
        title: "Your CV",
        text: "The PDF is read locally in your browser. To create your profile, the extracted text may be sent to an AI service.",
      },
      {
        title: "Your applications",
        text: "Application data stays in the current session by default. Permanent storage only with the corresponding consent.",
      },
    ],
  },
};

export default function LandingPage2(): React.ReactElement {
  const { lang } = useLang();
  // HERO-ANIMATION-03: Stream startet erst nach dem Opening (~1,4 s).
  const [streamLive, setStreamLive] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStreamLive(true), 1400);
    return () => window.clearTimeout(id);
  }, []);
  const t = STRINGS[lang];

  return (
    <div className="lp2">
      <section className="lp2-hero" aria-label={t.heroAria}>
        <div
          className="lp2-background"
          role="img"
          aria-label={t.backgroundAlt}
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="lp2-overlay" aria-hidden="true" />
        {/* Opening-Layer (Phase A): Lichtpunkt → Expansion, danach unsichtbar. */}
        <div className="hero-opening-layer" aria-hidden="true">
          <span className="hero-opening-dot" />
        </div>
        {/* Job-Stream-Layer (Phase B): bewusst nur Dummy-Noten, startet
            erst nach dem Opening (is-live); liegt über dem Hintergrund,
            unter dem Content. */}
        <div className={`job-stream-layer${streamLive ? " is-live" : ""}`} aria-hidden="true">
          <JobStream />
        </div>
        <Navbar route="landing" glass />
        <div className="lp2-hero-content">
          <p className="lp2-kicker">{t.eyebrow}</p>
          <h1 className="lp2-title">
            {t.titleA}
            <br />
            <span className="lp2-title-accent">{t.titleAccent}</span>{" "}
            <MatchPulse label={t.matchPulseLabel} />
          </h1>
          <p className="lp2-subtitle">{t.subtitle}</p>
          <div className="lp2-cta-row">
            <a className="lp2-cta-primary" href="/search">
              {t.findJobs}
            </a>
            <a className="lp2-cta-secondary" href="#lp2-how">
              {t.learnMore}
            </a>
          </div>
          <p className="lp2-hero-note">{t.heroNote}</p>
        </div>
      </section>

      <main className="lp2-content" id="lp2-content">
        <section className="lp2-section" id="lp2-how" aria-labelledby="lp2-how-title">
          <div className="lp2-section-head">
            <p className="lp2-eyebrow">{t.howEyebrow}</p>
            <h2 id="lp2-how-title">{t.howTitle}</h2>
            <p className="lp2-section-lead">{t.howLead}</p>
          </div>
          <ol className="lp2-steps">
            {t.steps.map((step, index) => (
              <li className="lp2-step" key={step.title}>
                <span className="lp2-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="lp2-section"
          id="lp2-benefits"
          aria-labelledby="lp2-benefits-title"
        >
          <div className="lp2-section-head">
            <p className="lp2-eyebrow">{t.benefitsEyebrow}</p>
            <h2 id="lp2-benefits-title">{t.benefitsTitle}</h2>
            <p className="lp2-section-lead">{t.benefitsLead}</p>
          </div>
          <div className="lp2-cards">
            {t.cards.map((card) => (
              <article className="lp2-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="lp2-section lp2-section-notes"
          aria-labelledby="lp2-notes-title"
        >
          <div className="lp2-section-head">
            <p className="lp2-eyebrow">{t.notesEyebrow}</p>
            <h2 id="lp2-notes-title">{t.notesTitle}</h2>
            <p className="lp2-section-lead">{t.notesLead}</p>
          </div>
          <div className="lp2-notes">
            {t.notes.map((note) => (
              <div className="lp2-note" key={note.title}>
                <h3>{note.title}</h3>
                <p>{note.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

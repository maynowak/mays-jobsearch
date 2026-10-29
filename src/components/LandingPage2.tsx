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
// LANDINGPAGE-02-HERO-COMPOSITION-02 — reines Hintergrundbild + darüber
// positionierte HTML/CSS-Ebenen (Glass-Nav, zentrierter Hero-Content).
// Kein Text im Bild; keine Zettel/Animation (folgen in LANDINGPAGE-03/04).
// Lokale Landing-Texte verwenden den globalen App-Sprachkontext.
type Lp2Lang = "de" | "en";

const STRINGS: Record<Lp2Lang, Record<string, string>> = {
  de: {
    cta: "Zum Job-Matcher",
    "nav.search": "Suche",
    "nav.alerts": "Benachrichtigungen",
    eyebrow: "MAY'S JOB MATCHER",
    titleA: "Dein nächster Karriereschritt",
    titleAccent: "mit KI",
    subA: "Stellenangebote aus mehreren Quellen,",
    subB: "Persönlich auf dich abgestimmt.",
    findJobs: "Jobs finden →",
    learnMore: "Mehr erfahren",
    card1t: "Mehrere Quellen",
    card1p: "Arbeitnow, Arbeitsagentur, Adzuna, JobsPipe, Theirstack und ATS-Boards — eine Suche, ein Ergebnis.",
    card2t: "KI-Bewertung",
    card2p: "Jede Stelle erhält einen Match-Score mit Begründung und Vorbereitungsfrage.",
    card3t: "CV-Upload",
    card3p: "Lebenslauf hochladen, Profil prüfen, passende Jobs finden — alles im Browser beginnend.",
    footer: "May's Job Matcher · Landingpage",
  },
  en: {
    cta: "Open Job Matcher",
    "nav.search": "Search",
    "nav.alerts": "Alerts",
    eyebrow: "MAY'S JOB MATCHER",
    titleA: "Your next career move",
    titleAccent: "with AI",
    subA: "Job postings from multiple sources,",
    subB: "personally matched to you.",
    findJobs: "Find jobs →",
    learnMore: "Learn more",
    card1t: "Multiple sources",
    card1p: "Arbeitnow, Arbeitsagentur, Adzuna, JobsPipe, Theirstack and ATS boards — one search, one result.",
    card2t: "AI scoring",
    card2p: "Every job gets a match score with reasoning and a prep question.",
    card3t: "CV upload",
    card3p: "Upload your CV, review the profile, find matching jobs — starting right in the browser.",
    footer: "May's Job Matcher · Landingpage",
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
      <section className="lp2-hero" aria-label="Visuelle Bühne">
        <div
          className="lp2-background"
          role="img"
          aria-label="Futuristische Stadt im blauen Abendlicht mit blauen Lichtlinien"
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
            <MatchPulse />
          </h1>
          <p className="lp2-subtitle">
            {t.subA}
            <br />
            {t.subB}
          </p>
          <div className="lp2-cta-row">
            <a className="lp2-cta-primary" href="/search">
              {t.findJobs}
            </a>
            <a className="lp2-cta-secondary" href="#lp2-content">
              {t.learnMore}
            </a>
          </div>
        </div>
      </section>

      <main className="lp2-content" id="lp2-content">
        <section className="lp2-cards" aria-label="Highlights">
          <article className="lp2-card">
            <h2>{t.card1t}</h2>
            <p>{t.card1p}</p>
          </article>
          <article className="lp2-card">
            <h2>{t.card2t}</h2>
            <p>{t.card2p}</p>
          </article>
          <article className="lp2-card">
            <h2>{t.card3t}</h2>
            <p>{t.card3p}</p>
          </article>
        </section>
      </main>

      <Footer />
    </div>
  );
}

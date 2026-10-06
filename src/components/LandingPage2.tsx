import { useEffect, useState } from "react";
import heroImage from "../assets/images/Futuristische_Stadt_im_blauen_Abendlicht2.png";
import JobStream from "./JobStream";
import MatchPulse from "./MatchPulse";
import { navLinksFor } from "../navLinks";

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
// Sprache (EN/DE) bleibt komponentenlokal (lp2-lang), kein App-i18n-Eingriff.
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

function initialLang(): Lp2Lang {
  try {
    return window.localStorage.getItem("lp2-lang") === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

export default function LandingPage2(): React.ReactElement {
  const [lang, setLang] = useState<Lp2Lang>(initialLang);
  // HERO-ANIMATION-03: Stream startet erst nach dem Opening (~1,4 s).
  const [streamLive, setStreamLive] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStreamLive(true), 1400);
    return () => window.clearTimeout(id);
  }, []);
  const t = STRINGS[lang];
  const switchLang = (next: Lp2Lang) => {
    setLang(next);
    try {
      window.localStorage.setItem("lp2-lang", next);
    } catch {
      /* ignore */
    }
  };
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
        <header className="lp2-header">
          <div className="lp2-bar" role="navigation" aria-label="Landingpage 2">
            <a className="lp2-brand" href="/">
              May&apos;s Job Matcher
            </a>
            {/* TOP-MENU-02: Reihenfolge Landingpage = Brand → EN/DE → Suche → Login.
                EN/DE mittig via Grid, rechte Gruppe rechts. */}
            <div className="lp2-lang" role="group" aria-label="Language / Sprache">
              <button
                type="button"
                className={lang === "en" ? "lp2-lang-btn lp2-lang-active" : "lp2-lang-btn"}
                aria-pressed={lang === "en"}
                onClick={() => switchLang("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={lang === "de" ? "lp2-lang-btn lp2-lang-active" : "lp2-lang-btn"}
                aria-pressed={lang === "de"}
                onClick={() => switchLang("de")}
              >
                DE
              </button>
            </div>
            {/* TOP-MENU-01: Links aus dem zentralen Modul (sichtbar auf dieser
                Route). "Benachrichtigungen" ist hier bewusst NICHT freigeschaltet:
                ohne Anmeldung führt der Link nur auf die Suchmaske und ist nicht
                nützlich — bleibt erhalten auf /search, /registrieren, /anmelden. */}
            <div className="lp2-right">
              <nav className="lp2-nav" aria-label="Bereiche">
                {navLinksFor("landing").map((link) => (
                  <a key={link.id} className="lp2-nav-link" href={link.href}>
                    {t[link.labelKey]}
                  </a>
                ))}
              </nav>
              {/* Login noch ohne Funktion (Prototype) */}
              <button type="button" className="lp2-login" aria-disabled="true">
                Login
              </button>
            </div>
          </div>
        </header>
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

      <footer className="lp2-footer">
        <span>{t.footer}</span>
        <a href="/search">{t.cta}</a>
      </footer>
    </div>
  );
}

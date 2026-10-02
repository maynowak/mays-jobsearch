import { useState } from "react";
import heroImage from "../assets/images/Futuristische_Stadt_im_blauen_Abendlicht2.png";

// LANDINGPAGE-02-HERO-COMPOSITION-02 — reines Hintergrundbild + darüber
// positionierte HTML/CSS-Ebenen (Glass-Nav, zentrierter Hero-Content).
// Kein Text im Bild; keine Zettel/Animation (folgen in LANDINGPAGE-03/04).
// Sprache (EN/DE) bleibt komponentenlokal (lp2-lang), kein App-i18n-Eingriff.
type Lp2Lang = "de" | "en";

const STRINGS: Record<Lp2Lang, Record<string, string>> = {
  de: {
    cta: "Zum Job-Matcher",
    navSearch: "Suche",
    navAlerts: "Benachrichtigungen",
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
    footer: "May's Job Matcher · Prototype Landingpage 2",
  },
  en: {
    cta: "Open Job Matcher",
    navSearch: "Search",
    navAlerts: "Alerts",
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
    footer: "May's Job Matcher · Prototype landing page 2",
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
        {/* Job-Stream-Layer: bewusst leer — spätere Zettel-Animation
            (LANDINGPAGE-03/04); liegt über dem Hintergrund, unter dem Content. */}
        <div className="job-stream-layer" aria-hidden="true" />
        <header className="lp2-header">
          <div className="lp2-bar" role="navigation" aria-label="Landingpage 2">
            <a className="lp2-brand" href="/">
              May&apos;s Job Matcher
            </a>
            <nav className="lp2-nav" aria-label="Bereiche">
              <a className="lp2-nav-link" href="/top">
                {t.navSearch}
              </a>
              <a className="lp2-nav-link" href="/top">
                {t.navAlerts}
              </a>
            </nav>
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
            {/* Login noch ohne Funktion (Prototype) */}
            <button type="button" className="lp2-login" aria-disabled="true">
              Login
            </button>
          </div>
        </header>
        <div className="lp2-hero-content">
          <p className="lp2-kicker">{t.eyebrow}</p>
          <h1 className="lp2-title">
            {t.titleA}
            <br />
            <span className="lp2-title-accent">{t.titleAccent}</span>
          </h1>
          <p className="lp2-subtitle">
            {t.subA}
            <br />
            {t.subB}
          </p>
          <div className="lp2-cta-row">
            <a className="lp2-cta-primary" href="/top">
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
        <a href="/top">{t.cta}</a>
      </footer>
    </div>
  );
}

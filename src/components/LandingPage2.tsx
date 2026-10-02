import heroImage from "../assets/images/Futuristische_Stadt_im_blauen_Abendlicht.png";

// LANDINGPAGE-02 — visueller Prototype (visuelle Bühne, keine App-Logik).
// Hinweis: Das Task-Asset `hero-bg-jobstream.jpg` existiert im Repo nicht;
// verwendet wird das am 2026-10-02 abgelegte Bild (identisches Motiv:
// blaue Lichtlinien, Baumkonturen, Stadt im blauen Abendlicht).
// Schichten: BackgroundLayer < BackgroundOverlay < JobStreamLayer (leer,
// für spätere Zettel-Animation vorbereitet) < ContentLayer.
export default function LandingPage2(): React.ReactElement {
  return (
    <div className="lp2">
      <header className="lp2-header">
        <a className="lp2-brand" href="/">
          May&apos;s Job Matcher
        </a>
        <nav className="lp2-nav" aria-label="Landingpage 2">
          <a className="lp2-nav-link" href="/">
            Start
          </a>
          <a className="lp2-nav-cta" href="/top">
            Zum Job-Matcher
          </a>
        </nav>
      </header>

      <section className="lp2-hero" aria-label="Visuelle Bühne">
        <div
          className="lp2-background"
          role="img"
          aria-label="Futuristische Stadt im blauen Abendlicht mit blauen Lichtlinien"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="lp2-overlay" aria-hidden="true" />
        {/* Job-Stream-Layer: bewusst leer (LANDINGPAGE-02 §8/§9) — spätere
            Zettel-Animation; liegt über dem Hintergrund, unter dem Content. */}
        <div className="job-stream-layer" aria-hidden="true" />
        <div className="lp2-hero-content">
          <p className="lp2-kicker">Jobsearch</p>
          <h1 className="lp2-title">
            Dein nächster Karriereschritt
            <br />
            <span className="lp2-title-accent">mit KI</span>
            <br />
            <span className="lp2-title-sub">die zu dir passen</span>
          </h1>
          <p className="lp2-subtitle">
            Stellenangebote aus mehreren Quellen,
            <br />
            Persönlich auf dich abgestimmt.
          </p>
          <div className="lp2-cta-row">
            <a className="lp2-cta-primary" href="/top">
              Jobs finden
            </a>
            <a className="lp2-cta-secondary" href="#lp2-content">
              Mehr erfahren
            </a>
          </div>
        </div>
      </section>

      <main className="lp2-content" id="lp2-content">
        <section className="lp2-cards" aria-label="Highlights">
          <article className="lp2-card">
            <h2>Mehrere Quellen</h2>
            <p>Arbeitnow, Arbeitsagentur, Adzuna, JobsPipe, Theirstack und ATS-Boards — eine Suche, ein Ergebnis.</p>
          </article>
          <article className="lp2-card">
            <h2>KI-Bewertung</h2>
            <p>Jede Stelle erhält einen Match-Score mit Begründung und Vorbereitungsfrage.</p>
          </article>
          <article className="lp2-card">
            <h2>CV-Upload</h2>
            <p>Lebenslauf hochladen, Profil prüfen, passende Jobs finden — alles im Browser beginnend.</p>
          </article>
        </section>
      </main>

      <footer className="lp2-footer">
        <span>May&apos;s Job Matcher · Prototype Landingpage 2</span>
        <a href="/top">Zum Job-Matcher</a>
      </footer>
    </div>
  );
}

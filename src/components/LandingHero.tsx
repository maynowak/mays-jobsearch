import { useLang } from "../i18n";

// Alte Landingpage — sichtbar auf "/landingspage2" (App-Route "landing").
// Die PRODUKTIONS-Landingpage auf "/" ist LandingPage2.tsx (siehe dort die
// Historie; TOP-MENU-01).

export default function LandingHero() {
  const { t } = useLang();
  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <h1>May&rsquo;s Job Matcher</h1>
        <p className="landing-claim">{t("landing.claim")}</p>
        <p className="landing-text">{t("landing.text")}</p>
        <a className="landing-cta" href="/search">
          {t("landing.cta")}
        </a>
      </div>
    </section>
  );
}
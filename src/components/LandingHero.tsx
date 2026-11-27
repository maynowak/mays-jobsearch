import { useState, useEffect } from "react";
import { useLang } from "../i18n";

// Alte Landingpage — sichtbar auf "/landingspage2" (App-Route "landing").
// Die PRODUKTIONS-Landingpage auf "/" ist LandingPage2.tsx (siehe dort die
// Historie; TOP-MENU-01).

const MAY_HELP_STORAGE_KEY = "mj-may-help-open";
const DEMO_STORAGE_KEY = "mj-demo-mode-open";

function initialMayOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MAY_HELP_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function initialDemoOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function navigateInApp(href: string) {
  if (window.location.pathname + window.location.search === href) return;
  window.history.pushState({}, "", href);
}

export default function LandingHero() {
  const { t } = useLang();
  const [isDemo, setIsDemo] = useState(() => initialMayOpen() || initialDemoOpen());

  useEffect(() => {
    setIsDemo(initialMayOpen() || initialDemoOpen());
  }, []);

  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <h1>May&rsquo;s Job Matcher</h1>
        <p className="landing-claim">{t("landing.claim")}</p>
        <p className="landing-text">{t("landing.text")}</p>

        {isDemo ? (
          <div className="demo-notice">
            <p>{t("dashboard.demoNote.text")}</p>
            <p>{t("dashboard.demoNote.title")} {t("dashboard.demo")}</p>
          </div>
        ) : (
          <a className="landing-cta" href="/search">
            {t("landing.cta")}
          </a>
        )}

        <button
          className="landing-cta-demo"
          onClick={() => {
            window.localStorage.setItem(DEMO_STORAGE_KEY, "true");
            setIsDemo(true);
            navigateInApp("/dashboard?tab=profile");
          }}
          aria-label={t("demo.accessibilityLabel")}
        >
          {t("demo.buttonLabel")}
        </button>
      </div>
    </section>
  );
}

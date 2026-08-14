import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useLang } from "../i18n";
import type { Lang } from "../i18n";

function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label={t("lang.aria")}>
      {(["en", "de"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? "active" : ""}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export type NavbarRoute = "landing" | "matcher";

interface Props {
  route: NavbarRoute;
}

export default function Navbar({ route }: Props) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  const isLanding = route === "landing";
  const links: Array<[string, string]> = isLanding
    ? [[t("nav.search"), "/top"]]
    : [
        [t("nav.search"), "top"],
        [t("nav.alerts"), "#alerts"],
      ];

  const scrollToTopSlow = () => {
    const start = window.scrollY;
    if (start === 0) return;
    const duration = 1200;
    const startTime = performance.now();
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, Math.round(start * (1 - easeInOut(progress))));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (target === "top") {
      event.preventDefault();
      scrollToTopSlow();
    } else if (target.startsWith("#")) {
      event.preventDefault();
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    close();
  };

  return (
    <header className="navbar">
      <nav className="nav-inner" aria-label={t("nav.aria")}>
        <a href={isLanding ? "/" : "#search-form"} className="navbar-title">
          May&rsquo;s Job Matcher
        </a>

        <div className="nav-links">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={(e) => handleClick(e, href)}>
              {label}
            </a>
          ))}
          <LangToggle />
        </div>

        <button
          type="button"
          className={`burger${isOpen ? " burger-open" : ""}`}
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-label={isOpen ? t("nav.menuClose") : t("nav.menuOpen")}
        >
          <span />
          <span />
          <span />
        </button>

        {isOpen && (
          <div className="mobile-overlay" onClick={close}>
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              {links.map(([label, href], i) => (
                <a
                  key={href}
                  href={href}
                  className="mobile-link"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={(e) => handleClick(e, href)}
                >
                  {label}
                </a>
              ))}
              <div className="mobile-lang">
                <LangToggle />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
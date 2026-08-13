import { useCallback, useEffect, useState } from "react";
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

export default function Navbar() {
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

  const links: Array<[string, string]> = [
    [t("nav.search"), "#search-form"],
    [t("nav.matches"), "#matches"],
    [t("nav.alerts"), "#alerts"],
  ];

  return (
    <header className="navbar">
      <nav className="nav-inner" aria-label={t("nav.aria")}>
        <a href="#search-form" className="navbar-title">
          May&rsquo;s Job Matcher
        </a>

        <div className="nav-links">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
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
                  onClick={close}
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
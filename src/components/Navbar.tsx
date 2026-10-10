import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useLang } from "../i18n";
import type { Lang } from "../i18n";
import { navLinksFor } from "../navLinks";
import type { NavRoute } from "../navLinks";
import { useAuth } from "react-oidc-context";

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

// TOP-MENU-01: Die Routen-Menge liegt zentral in src/navLinks.ts — hier
// weiterhin als NavbarRoute exportiert, damit App.tsx unverändert importiert.
export type NavbarRoute = NavRoute;

interface Props {
  route: NavbarRoute;
}

export default function Navbar({ route }: Props) {
  const { t } = useLang();
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  // Mobile navbar scroll behavior
  useEffect(() => {
    let lastScroll = window.scrollY;
    let ticking = false;
    const threshold = 50;

    const updateScroll = () => {
      const currentScroll = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(() => {
          if (currentScroll > lastScroll && currentScroll > threshold) {
            // Scrolling down past threshold
            setIsScrolled(true);
          } else if (currentScroll < lastScroll && currentScroll < threshold) {
            // Scrolling up past threshold
            setIsScrolled(false);
          }
          lastScroll = currentScroll <= 0 ? 0 : currentScroll;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScroll);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // TOP-MENU-01: Linkliste kommt aus dem zentralen Modul. Pro Route sind nur
  // die dort freigegebenen Links sichtbar (Landingpage z.B. ohne Alerts).
  const links = navLinksFor(route);

  const scrollToTopSmooth = () => {
    const start = window.scrollY;
    if (start === 0) return;
    const duration = 500;
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

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, href: string, inPage?: string) => {
    const onTargetPage = window.location.pathname === href.split("#")[0];
    if (inPage === "top" && onTargetPage) {
      event.preventDefault();
      scrollToTopSmooth();
    } else if (inPage === "alerts" && onTargetPage) {
      event.preventDefault();
      document.querySelector("#alerts")?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    close();
  };

  // TOP-MENU-02: Glass-Look auf Suchmaske sowie Auth-Seiten für visuelle Konsistenz
  const isGlass = route === "matcher" || route === "register" || route === "login";

  return (
    <header className={`navbar${isGlass ? " navbar-glass" : ""}`}>
      {/* TOP-MENU-02: Reihenfolge
          Glass-Mode (/search): Brand links, rechte Gruppe mit EN/DE zuerst,
          dann Links, dann Login. EN/DE hat margin-left:auto.
          Nicht-Glass: Brand links, EN/DE zentriert, Links + Login rechts. */}
      <nav className="nav-inner" aria-label={t("nav.aria")}>
        <a href="/" className="navbar-title navbar-title-left">
          May&rsquo;s Job Matcher
        </a>

        {/* TOP-MENU-02: Reihenfolge für Glass-Mode (/search) = Brand → EN/DE → Links → Login,
            EN/DE hat margin-left:auto und schiebt die rechte Gruppe.
            Für alle anderen Routen bleibt die bisherige Zentrierung erhalten. */}
        {isGlass ? (
          <>
            <div className="nav-lang">
              <LangToggle />
            </div>
            <div className="nav-right">
              <div className="nav-links">
                {links.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    onClick={(e) => handleClick(e, link.href, link.inPage)}
                  >
                    {t(link.labelKey)}
                  </a>
                ))}
                {auth?.isAuthenticated && (
                  <a href="/profil" className="nav-link">
                    Profil
                  </a>
                )}
              </div>
              {auth?.isAuthenticated ? (
                <button
                  type="button"
                  className="nav-login"
                  onClick={() => auth.signoutRedirect({ post_logout_redirect_uri: "https://www.mays-job-matcher.app/" })}
                >
                  Logout
                </button>
              ) : (
                <a href="/anmelden" className="nav-login">
                  Login
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="nav-center">
              <LangToggle />
            </div>
            <div className="nav-links">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href, link.inPage)}
                >
                  {t(link.labelKey)}
                </a>
              ))}
              <a href="/anmelden" className="nav-login">
                Login
              </a>
            </div>
          </>
        )}

        <button
          type="button"
          className={`burger${isOpen ? " burger-open" : ""} ${isScrolled ? "hamburger-small" : ""}`}
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
              {links.map((link, i) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="mobile-link"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={(e) => handleClick(e, link.href, link.inPage)}
                >
                  {t(link.labelKey)}
                </a>
              ))}
              <div className="mobile-lang">
                <LangToggle />
              </div>
              {auth?.isAuthenticated && (
                <a href="/profil" className="mobile-link" onClick={close}>
                  Profil
                </a>
              )}
              {auth?.isAuthenticated ? (
                <button className="nav-login" onClick={() => auth.signoutRedirect({ post_logout_redirect_uri: "https://www.mays-job-matcher.app/" })}>
                  Logout
                </button>
              ) : (
                <a href="/anmelden" className="nav-login" onClick={close}>
                  Login
                </a>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
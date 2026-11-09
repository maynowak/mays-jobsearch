import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../i18n";
import type { Lang } from "../i18n";
import { navLinksFor } from "../navLinks";
import type { NavRoute } from "../navLinks";
import { useAuth } from "react-oidc-context";
import { signOut } from "../lib/authFlow";
import { acquireBodyScrollLock, releaseBodyScrollLock } from "../lib/scrollLock";

function useMobileNav() {
  const query = "(max-width: 900px)";
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setIsMobile(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return isMobile;
}

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
  /** Use the glass presentation on routes with a visual hero background. */
  glass?: boolean;
  /** JM-NAV-SCROLL-UX-02: direction-aware hide-on-scroll is enabled by
      default; `false` opts a route out of the smart scroll behavior. */
  hideOnScroll?: boolean;
  onNavigate?: (href: string) => void;
}

export default function Navbar({ route, glass = false, hideOnScroll = true, onNavigate }: Props) {
  const { t } = useLang();
  const auth = useAuth();
  const isMobile = useMobileNav();
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const previousAuthRef = useRef(auth?.isAuthenticated);
  const isOpenRef = useRef(isOpen);
  const smartScrollEnabled = hideOnScroll !== false;

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () => {
      header.style.setProperty("--navbar-height", `${header.offsetHeight}px`);
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const close = useCallback(() => {
    setIsOpen((open) => {
      if (open) {
        window.requestAnimationFrame(() => burgerRef.current?.focus());
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false);
      return;
    }
  }, [isMobile]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) setIsHidden(false);
  }, [isOpen]);

  useEffect(() => {
    if (previousAuthRef.current === auth?.isAuthenticated) return;
    previousAuthRef.current = auth?.isAuthenticated;
    setIsOpen(false);
  }, [auth?.isAuthenticated]);

  useEffect(() => {
    if (!isOpen) return;
    const first = menuRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    acquireBodyScrollLock();
    return () => {
      document.removeEventListener("keydown", handler);
      releaseBodyScrollLock();
    };
  }, [isOpen, close]);

  // JM-NAV-SCROLL-UX-02: direction-aware navigation. Down hides after a
  // deliberate distance; a small upward movement reveals it again, regardless
  // of the absolute scroll position. The listener is passive and coalesces
  // updates through one animation frame.
  useEffect(() => {
    if (!smartScrollEnabled) return;
    let lastScroll = Math.max(0, window.scrollY);
    let frame: number | null = null;

    const updateScroll = () => {
      frame = null;
      const currentScroll = Math.max(0, window.scrollY);
      const delta = currentScroll - lastScroll;
      lastScroll = currentScroll;

      const pageIsLong = document.documentElement.scrollHeight > window.innerHeight * 1.5;
      setShowBackToTop(pageIsLong && currentScroll > 480);

      if (isOpenRef.current || headerRef.current?.contains(document.activeElement)) {
        setIsHidden(false);
        return;
      }
      if (currentScroll <= 0) {
        setIsHidden(false);
        return;
      }
      if (delta >= 12 && currentScroll > 80) {
        setIsHidden(true);
        return;
      }
      if (delta <= -6) {
        setIsHidden(false);
      }
    };

    const handleScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(updateScroll);
    };

    // Browser scroll restoration / deep links: start in the appropriate state
    // without waiting for the next scroll event.
    if (window.scrollY > 80) setIsHidden(true);
    setShowBackToTop(
      document.documentElement.scrollHeight > window.innerHeight * 1.5 && window.scrollY > 480
    );

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [smartScrollEnabled]);

  const toggleMenu = () => {
    setIsOpen((open) => {
      if (!open) setIsHidden(false);
      return !open;
    });
  };

  const scrollToTop = () => {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    brandRef.current?.focus({ preventScroll: true });
  };

  // TOP-MENU-01: Linkliste kommt aus dem zentralen Modul. Pro Route sind nur
  // die dort freigegebenen Links sichtbar (Landingpage z.B. ohne Alerts).
  const links = navLinksFor(route);
  const activeHref = route === "matcher" ? "/search" : route === "profil" ? "/profil" : null;

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
    if (onNavigate && (href === "/search" || href === "/profil")) {
      event.preventDefault();
      onNavigate(href);
      close();
      return;
    }
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

  const handleLogout = () => {
    close();
    void signOut(auth);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !menuRef.current) return;
    const focusable = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // TOP-MENU-02: Glass-Look auf Suchmaske, Auth-Seiten und visuellen Hero-Routen
  const isGlass = glass || route === "matcher" || route === "register" || route === "login";

  return (
    <>
    <header
      ref={headerRef}
      className={`navbar${isGlass ? " navbar-glass" : ""}${smartScrollEnabled && isHidden && !isOpen ? " scrolled" : ""}`}
      onFocusCapture={() => setIsHidden(false)}
    >
      {/* TOP-MENU-02: Reihenfolge
          Glass-Mode (/search): Brand links, rechte Gruppe mit EN/DE zuerst,
          dann Links, dann Login. EN/DE hat margin-left:auto.
          Nicht-Glass: Brand links, EN/DE zentriert, Links + Login rechts. */}
      <nav className="nav-inner" aria-label={t("nav.aria")}>
        <a ref={brandRef} href="/" className="navbar-title navbar-title-left">
          May&rsquo;s Job Matcher
        </a>

        {!isMobile && (isGlass ? (
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
                    className={activeHref === link.href ? "nav-link-active" : undefined}
                    aria-current={activeHref === link.href ? "page" : undefined}
                    onClick={(e) => handleClick(e, link.href, link.inPage)}
                  >
                    {t(link.labelKey)}
                  </a>
                ))}
                {auth?.isAuthenticated && (
                  <a href="/profil" className={`nav-link${activeHref === "/profil" ? " nav-link-active" : ""}`} aria-current={activeHref === "/profil" ? "page" : undefined} onClick={(event) => handleClick(event, "/profil")}>
                    {t("profile.title")}
                  </a>
                )}
              </div>
              {auth?.isLoading ? (
                <span className="nav-login" aria-busy="true">
                  {t("nav.signingIn")}
                </span>
              ) : auth?.isAuthenticated ? (
                <button
                  type="button"
                  className="nav-login"
                  onClick={handleLogout}
                >
                  {t("auth.logout")}
                </button>
              ) : (
                <a href="/anmelden" className="nav-login">
                  {t("auth.loginTitle")}
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
                  className={activeHref === link.href ? "nav-link-active" : undefined}
                  aria-current={activeHref === link.href ? "page" : undefined}
                  onClick={(e) => handleClick(e, link.href, link.inPage)}
                >
                  {t(link.labelKey)}
                </a>
              ))}
              {auth?.isAuthenticated && (
                <a href="/profil" className={`nav-link${activeHref === "/profil" ? " nav-link-active" : ""}`} aria-current={activeHref === "/profil" ? "page" : undefined} onClick={(event) => handleClick(event, "/profil")}>
                  {t("profile.title")}
                </a>
              )}
              {auth?.isLoading ? (
                <span className="nav-login" aria-busy="true">
                  {t("nav.signingIn")}
                </span>
              ) : auth?.isAuthenticated ? (
                <button
                  type="button"
                  className="nav-login"
                  onClick={handleLogout}
                >
                  {t("auth.logout")}
                </button>
              ) : (
                <a href="/anmelden" className="nav-login">
                  {t("auth.loginTitle")}
                </a>
              )}
            </div>
          </>
        ))}

        {isMobile && (
          <>
            <button
              ref={burgerRef}
              type="button"
              className={`burger${isOpen ? " burger-open" : ""} ${isHidden && !isOpen ? "hamburger-small" : ""}`}
              onClick={toggleMenu}
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              aria-haspopup="dialog"
              aria-label={isOpen ? t("nav.menuClose") : t("nav.menuOpen")}
            >
              <span />
              <span />
              <span />
            </button>

            {isOpen &&
              createPortal(
                <div className="mobile-overlay" onClick={close}>
                  <div
                    id="mobile-navigation"
                    ref={menuRef}
                    className="mobile-menu"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("nav.aria")}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={handleMenuKeyDown}
                  >
                    {links.map((link, i) => (
                      <a
                        key={link.id}
                        href={link.href}
                        className={`mobile-link${activeHref === link.href ? " nav-link-active" : ""}`}
                        aria-current={activeHref === link.href ? "page" : undefined}
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
                      <a href="/profil" className={`mobile-link${activeHref === "/profil" ? " nav-link-active" : ""}`} aria-current={activeHref === "/profil" ? "page" : undefined} onClick={(event) => handleClick(event, "/profil")}>
                        {t("profile.title")}
                      </a>
                    )}
                    {auth?.isLoading ? (
                      <span className="nav-login" aria-busy="true">
                        {t("nav.signingIn")}
                      </span>
                    ) : auth?.isAuthenticated ? (
                      <button type="button" className="nav-login" onClick={handleLogout}>
                        {t("auth.logout")}
                      </button>
                    ) : (
                      <a href="/anmelden" className="nav-login" onClick={close}>
                        {t("auth.loginTitle")}
                      </a>
                    )}
                  </div>
                </div>,
                document.body
              )}
          </>
        )}
      </nav>
    </header>
    {showBackToTop && !isOpen && createPortal(
      <button
        type="button"
        className="back-to-top"
        onClick={scrollToTop}
        aria-label={t("nav.backToTop")}
      >
        <span aria-hidden="true">↑</span>
        <span>{t("nav.backToTop")}</span>
      </button>,
      document.body
    )}
    </>
  );
}

// TOP-MENU-01 — Zentrale Top-Menü-Linkliste.
//
// Einzige Quelle für "welche Links gibt es im Top-Menü, wohin führen sie,
// auf welchen Routen sind sie sichtbar und was passiert beim Klick".
// Genutzt von:
//   - src/components/Navbar.tsx        (App-Navbar, alle App-Routen)
//   - src/components/LandingPage2.tsx  (Glass-Bar der Produktions-Landingpage)
//
// NEUEN LINK ERGÄNZEN: Eintrag in NAV_LINKS mit einer neuen, stabilen `id`,
// `labelKey` (i18n-Key, s.u.) und `visibleOn` (pro-Route-Freigabe).
// Kein Eingriff in Navbar/LandingPage2 nötig — beide rendern die Liste.
//
// NEUES VERHALTEN ERGÄNZEN: `inPage` um einen weiteren Fall in
// `NavLinkInPage` erweitern und in Navbar.tsx handleClick() behandeln.
// Bewusst offen gehalten, damit zukünftige Links (z.B. nach Login) hier
// andocken können, ohne das Modul umzubauen.
//
// LABELS: Der Modul-Layer hält bewusst nur den i18n-Key. Aufgelöst wird
// beim Konsumenten, weil es zwei unabhängige Sprachsysteme gibt:
//   - App:     useLang() aus src/i18n.tsx (mj-lang)  -> t(link.labelKey)
//   - Landing: lokaler lp2-lang-State (LandingPage2 STRINGS) -> t[link.labelKey]
// Beide nutzen denselben Key-Namensraum ("nav.search", "nav.alerts").

/** Routen, für die ein Link freigeschaltet werden kann. */
export type NavRoute = "landing" | "matcher" | "impressum" | "register" | "login";

/**
 * Verhalten, wenn der Link bereits auf seiner Ziel-Route zeigt
 * (also keine Navigation nötig ist).
 *  - "top":    weich nach oben scrollen (Suchmaske wieder von vorn)
 *  - "alerts": weich zum Abschnitt #alerts scrollen (Tages-Job-Benachrichtigungen)
 * Ohne `inPage` greift die normale Navigation auf `href`.
 */
export type NavLinkInPage = "top" | "alerts";

export interface NavLink {
  /** Stabiler Schlüssel — nicht für die Anzeige, sondern für Tests/Erweiterung. */
  id: string;
  /** i18n-Key, z.B. "nav.search" (siehe Kopfkommentar). */
  labelKey: string;
  /** Ziel-URL. Absolut, damit sie unabhängig von der aktuellen Route gilt. */
  href: string;
  /** Route, auf der `inPage` greift (Pfad-Teil von `href` ohne Hash). */
  targetRoute: string;
  /** Optional: In-Page-Verhalten statt Navigation, wenn man schon dort ist. */
  inPage?: NavLinkInPage;
  /** Auf welchen Routen der Link angezeigt wird. */
  visibleOn: readonly NavRoute[];
}

/**
 * Die komplette Top-Menü-Linkliste (Linkablauf).
 *
 * Reihenfolge = Anzeigereihenfolge rechts in der Menüleiste.
 */
export const NAV_LINKS: readonly NavLink[] = [
  {
    id: "search",
    labelKey: "nav.search",
    href: "/search",
    targetRoute: "/search",
    inPage: "top",
    // Bewusst überall sichtbar: Landingpage, Suchmaske, Impressum, Registrierung, Anmeldung.
    visibleOn: ["landing", "matcher", "impressum", "register", "login"],
  },
  {
    id: "alerts",
    labelKey: "nav.alerts",
    // #alerts wird beim App-Start entfernt (App.tsx, Hash-Aufräumen) — der
    // Anker kodiert trotzdem die Absicht; Landing und Impressum zeigen den
    // Link nicht (siehe visibleOn), damit er dort nicht ins Leere führt.
    href: "/search#alerts",
    targetRoute: "/search",
    inPage: "alerts",
    // Auf der Landingpage ausgeblendet (User-Entscheidung TOP-MENU-01):
    // ohne Anmeldung nur ein Anker auf die Suchmaske, dort nicht nützlich.
    visibleOn: ["matcher", "register", "login"],
  },
];

/** Links, die auf der gegebenen Route angezeigt werden. */
export function navLinksFor(route: NavRoute): NavLink[] {
  return NAV_LINKS.filter((link) => link.visibleOn.includes(route));
}

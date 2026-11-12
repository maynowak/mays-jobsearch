// SEO-GUARD (JM-MARKETING-01A): The landing page is the only indexable route.
// Application routes are served with `app.html` (no canonical link) and an
// `X-Robots-Tag: noindex` header. This helper keeps client-side transitions and
// the Vite development fallback (which serves index.html for every route) from
// leaking the landing-page canonical into private routes.
export const HOME_URL = "https://www.mays-job-matcher.app/";
export const INDEX_ROBOTS = "index,follow,max-image-preview:large";
export const PRIVATE_ROBOTS = "noindex,nofollow";

// Routes that must never be indexed. Each one is served through app.html and
// receives an X-Robots-Tag header in vercel.json.
export const APP_ROUTES = [
  "/search",
  "/cv-builder/workspace",
  "/landingspage2",
  "/registrieren",
  "/anmelden",
  "/auth/callback",
  "/profil",
  "/email-bestaetigen",
  "/impressum",
  "/datenschutz",
  "/datenschutzprinzipien",
] as const;


export function applyRouteSeoHead(pathname: string, doc?: Document): void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target) return;

  const isHome = (pathname || "/") === "/" || pathname === "/index.html";
  let robots = target.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robots) {
    robots = target.createElement("meta");
    robots.setAttribute("name", "robots");
    target.head.appendChild(robots);
  }

  if (isHome) {
    robots.setAttribute("content", INDEX_ROBOTS);
    let canonical = target.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = target.createElement("link");
      canonical.setAttribute("rel", "canonical");
      canonical.setAttribute("href", HOME_URL);
      target.head.appendChild(canonical);
    } else if (canonical.getAttribute("href") !== HOME_URL) {
      canonical.setAttribute("href", HOME_URL);
    }
    return;
  }

  robots.setAttribute("content", PRIVATE_ROBOTS);
  target.head.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
}

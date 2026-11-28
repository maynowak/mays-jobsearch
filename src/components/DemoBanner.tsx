import { useState, useEffect } from "react";
import { useLang } from "../i18n";

/**
 * Global Demo-Banner für TOUR-01A.
 * 
 * - Erscheint bei aktivem Demo-Modus auf `/profil` und `/search`.
 * - Erscheint NICHT auf `/` (Startseite).
 * - Kompaktes, schwebendes Aurora-Glass-Design, einblenkbar.
 * - Bleibt im Viewport, auch beim Scrollen.
 * - Einklappbar: `[−]` = ausgeklappt, `[+]` = eingeschlagen.
 * - Zustand persistenter Speicherung und bei Reload erhalten.
 * - DE/EN über useLang()/translations integriert.
 * - Sicherer Exit via window.location.replace("/").
 * - Excludes authentifizierte Benutzer und Startseite.
 */
export function DemoBanner() {
  const { t } = useLang();

  const demoMode = typeof window !== "undefined" && window.localStorage.getItem("mj-demo-mode-open") === "true";
  if (!demoMode) return null;

  // Bestimme die Route: Demo erscheint auf /profil ODER /search, NICHT auf /
  const isProfileRoute = typeof window !== "undefined" && window.location.pathname === "/profil";
  const isSearchRoute = typeof window !== "undefined" && window.location.pathname === "/search";
  const isDemoRoute = isProfileRoute || isSearchRoute;

  // Startseite und authentifizierte Users ausschließen
  const isHomeRoute = typeof window !== "undefined" && window.location.pathname === "/";
  const isAuthenticated =
    typeof window !== "undefined" && localStorage.getItem("mj-auth-token") !== null;

  // Demo-Banner nur auf erlaubten Routen und bei anonymem User zeigen
  if (!isDemoRoute || isHomeRoute || isAuthenticated) return null;

  // Einklappzustand direkt aus localStorage lesen (lazy Initialisierung)
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("tour-01a-banner-expanded");
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "boolean") return parsed;
      }
    } catch {
      /* invalid localStorage value - fall back to default */
    }
    return true; // default: expanded
  });

  // persistentere Speicherung beim Ändern (ohne den Initialisierungs-Effekt zu überschreiben)
  useEffect(() => {
    try {
      localStorage.setItem("tour-01a-banner-expanded", JSON.stringify(expanded));
    } catch {
      /* noop */
    }
  }, [expanded]);

  // Demo-Ausstieg
  const handleExit = () => {
    window.localStorage.removeItem("mj-demo-mode-open");
    window.location.replace("/");
  };

  // Texte über t()-Funktion holen
  const demoModeKey = expanded ? "tour.01a.banner.expanded" : "tour.01a.banner.collapsed";
  const exitKey = "demo.exitLabel";
  const demoModeText = t(demoModeKey) || "DEMO-MODUS";
  const exitLabel = t(exitKey) || "Exit";

  // Farben: Aurora-Glass
  const bgColor = "rgba(0, 150, 200, 0.95)";
  const glassEffect = "0 4px 20px rgba(0, 0, 0, 0.3), 0 0 10px rgba(0, 150, 200, 0.1)";

  return (
    <div
      className="demo-banner"
      aria-label={exitLabel}
      role="banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: bgColor,
        color: "white",
        margin: "0.5rem",
        maxWidth: "20rem",
        width: "100%",
        maxHeight: "min(30vh, 15rem)",
        padding: expanded ? "0.5rem 0.75rem" : "0.25rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: glassEffect,
        borderRadius: "0.3rem",
      }}
    >
      <span style={{ flex: 1, marginRight: "0.5rem" }}>
        {expanded
          ? demoModeText
          : `● DEMO [+]`}
      </span>

      {/* Kollabierbarer Bereich als Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? t("banner einklappen") : t("banner ausklappen")}
        style={{
          flex: "0 0 auto",
          marginLeft: "0.5rem",
          cursor: "pointer",
          background: "none",
          border: "none",
          color: "rgba(255, 255, 255, 0.7)",
          fontStyle: "italic",
          padding: 0,
          outline: "none",
        }}
      >
        −
      </button>

      {/* Eigenständiger Demo-Exit-Button */}
      <button
        onClick={handleExit}
        aria-label={exitLabel}
        style={{
          background: "none",
          border: "none",
          color: "white",
          fontSize: "1rem",
          cursor: "pointer",
          marginLeft: "0.5rem",
          outline: "2px solid white",
          outlineOffset: "2px",
        }}
      >
        ✕
      </button>
    </div>
  );
}
import { createRoot } from "react-dom/client";
import App from "./App";
import LandingPage2 from "./components/LandingPage2";
import { LangProvider } from "./i18n";
import { rootComponentFor } from "./rootRoute";
import { AuthProvider } from "react-oidc-context";
import { oidcConfig } from "./lib/oidcConfig";

// LANDINGPAGE-SWAP: "/" rendert LandingPage2 (PRODUKTIONS-Landingpage,
// OHNE App-Logik; Historie siehe LandingPage2.tsx Kopfkommentar), alles
// andere die Job-Matcher-App (alte Landing unter "/landingspage2",
// Matcher unter "/search" [TOP-MENU-01, vorher "/top"], Impressum).
// Entscheidung testbar in rootRoute.ts.
const rootComponent =
  typeof window !== "undefined" ? rootComponentFor(window.location.pathname) : "app";

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    {rootComponent === "landing2" ? (
      <LandingPage2 />
    ) : (
      <AuthProvider {...oidcConfig}>
        <App />
      </AuthProvider>
    )}
  </LangProvider>
);
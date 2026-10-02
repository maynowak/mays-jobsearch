import { createRoot } from "react-dom/client";
import App from "./App";
import LandingPage2 from "./components/LandingPage2";
import { LangProvider } from "./i18n";
import { rootComponentFor } from "./rootRoute";

// LANDINGPAGE-SWAP: "/" rendert die visuelle LandingPage2 (OHNE App-Logik),
// alles andere die Job-Matcher-App (alte Landing unter "/landingspage2",
// Matcher unter "/top", Impressum). Entscheidung testbar in rootRoute.ts.
const rootComponent =
  typeof window !== "undefined" ? rootComponentFor(window.location.pathname) : "app";

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    {rootComponent === "landing2" ? <LandingPage2 /> : <App />}
  </LangProvider>
);
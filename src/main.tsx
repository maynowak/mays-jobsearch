import { createRoot } from "react-dom/client";
import App from "./App";
import LandingPage2 from "./components/LandingPage2";
import { LangProvider } from "./i18n";

// LANDINGPAGE-02: separater Prototype unter /landingspage2 — rendert OHNE
// die Job-Matcher-App (keine Änderung an bestehenden Routen/Features).
const isLandingPage2 =
  typeof window !== "undefined" && window.location.pathname === "/landingspage2";

createRoot(document.getElementById("root")!).render(
  <LangProvider>
    {isLandingPage2 ? <LandingPage2 /> : <App />}
  </LangProvider>
);
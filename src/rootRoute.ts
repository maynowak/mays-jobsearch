// LANDINGPAGE-SWAP: Welche Wurzel-Komponente zu welchem Pfad gehört.
// "/" → LandingPage2 (PRODUKTIONS-Landingpage, Historie siehe LandingPage2.tsx);
// alles andere → App (alte Landing unter "/landingspage2", Matcher unter
// "/search" [TOP-MENU-01, vorher "/top"], Impressum).
// Reine Funktion, damit der Swap unit-testbar bleibt (main.tsx hat
// Seiteneffekte beim Import und ist nicht direkt testbar).
export type RootComponent = "landing2" | "app";

export function rootComponentFor(pathname: string): RootComponent {
  return pathname === "/" ? "landing2" : "app";
}

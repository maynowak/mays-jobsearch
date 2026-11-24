# JM-PROFILE-NAVBAR-GLASS-01

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `feature/jm-profile-navbar-glass-01`

**Implementation commit:** `c68b919`

**Base:** `origin/main` `91f92a4`

## 1. Ziel

Die Navigation auf `/profil` verwendet dieselbe schwebende Glass-Pille wie auf
`/search`. Die bestehende `Navbar`-Komponente bleibt die einzige Navigation;
die Suchseite ist unverändert die visuelle Referenz.

## 2. Umsetzung

- Alle Profil-Navbar-Instanzen in `App.tsx` erhalten den vorhandenen
  `glass`-Prop: reguläre Profilroute, Dev-Preview-Routen und der
  `isProfile`-Branch.
- Keine zweite Navbar, kein neuer Glass-Modus und keine Änderung an
  `/search`-Styling.
- Breite, Zentrierung, Rundung, Transparenz, Backdrop-Blur, Innenabstände,
  EN/DE-Position, aktive Links, Login/Logout und Mobile-Menü kommen
  unverändert aus der bestehenden Navbar.
- Das besondere Scroll-Verhalten der Bewerbungsverwaltung bleibt erhalten:
  `body:has(.dashboard-v2--applications) .navbar` ist weiterhin
  `position: relative`.
- Der Profilinhalt erhält auf Tablet/Mobile etwas mehr Abstand unter der
  schwebenden Pille (`padding-top` min. 28 px, mobil 24 px), damit Globus und
  Wellen nicht berührt oder überdeckt werden.

## 3. Visuelle und funktionale Prüfung

Chromium-E2E `tests/e2e/profile-navbar-glass-01.mjs` mit synthetischer
Authentifizierung und gemockten APIs.

| Breite | Navbar | Suche = Profil | Header-Abstand | Overflow |
|---|---:|---|---:|---:|
| 1920 px | 1180 × 62 px, x=370 | Ja | 20 px | 0 |
| 1440 px | 1180 × 62 px, x=130 | Ja | 20 px | 0 |
| 768 px | 721,9 × 62 px, x=23 | Ja | 16 px | 0 |
| 390 px | 366,6 × 62 px, x=11,7 | Ja | 12 px | 0 |

Verglichen wurden pro Breite Position, Breite, Border-Radius,
Hintergrundfarbe, Backdrop-Filter und Innenabstände. Zusätzlich geprüft:

- Navigation `/profil` → `/search` → `/profil`;
- aktive Menüpunkte „Profil“ bzw. „Suche“;
- Mobile-Menü öffnen/schließen per Burger und Escape;
- Ausblenden der Navbar beim Scrollen nach unten;
- Bewerbungsverwaltung: Navbar `position: relative`, kein Overflow;
- keine Konsolenfehler und keine horizontalen Überläufe.

Screenshots lagen lokal unter `/tmp/opencode/profile-navbar-glass-01/`:
`profile-*`, `search-*`, `profile-menu-390` und `applications-1440`.

## 4. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Navbar/App-Tests | **124 PASS** |
| Volle Vitest-Suite, seriell | **2029 PASS / 11 skipped** |
| Production build | PASS |
| Visuelles E2E 1920/1440/768/390 | PASS |
| `git diff --check` | PASS |
| Secret-Scan | PASS |

## 5. Grenzen

- Keine Änderung an der Suchseiten-Navbar oder deren Design.
- Keine Änderung an Navigation, aktiven Zuständen, Logout, Mobile-Menü oder
  Anwendungs-Scroll-Logik außer der gezielten Profil-Glass-Aktivierung und
  des Profil-Abstands.
- Keine RIS-/AWS-/Terraform-/Cognito-/Consent-/Storage-Änderung.
- Kein Main-Merge und kein Production-Deployment.

`READY FOR VISUAL REVIEW`

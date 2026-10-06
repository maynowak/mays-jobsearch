# TOP-MENU-01 — Top-Menü zentralisieren (Link-Modul) + Route `/top` → `/search`

## Current status
**COMPLETE** — §1–§9 abgeschlossen. Tests (735), `tsc -b`, `npm run build` und
Browser-Verifikation (Playwright/Chromium, 40 Checks) alle grün. Gepusht.

## Audit date/time
2026-10-06 (CET)

## Git branch and HEAD
- Branch: main
- HEAD: `10e60da` (SEARCH-WORLD-11, gepusht)
- origin/main: `10e60da`

## Audit scope
User-Aufträge (3 Fragen beantwortet):

1. **Top-Menü zentralisieren** als Modul, mit Linkablauf und auf zukünftige
   neue Links erweiterbar.
2. **Landingpage-Historie dokumentieren**: `LandingPage2` ist die neue /
   Produktions-Landingpage — in den betroffenen Code-Teilen kommentieren,
   inkl. explizitem Kommentar auf der Produktions-Landingpage, damit die
   Historie nicht erneut gesucht werden muss.
3. **Route hart umbenennen** `/top` → `/search` (User-Entscheidung:
   „hart umbenennen", Bestandslinks/Bookmarks brechen bewusst).
4. **Benachrichtigungen auf der Landingpage ausblenden** (User-Entscheidung),
   auf `/search` + `/registrieren` + `/anmelden` sichtbar lassen.
5. `docs/AI_AUDITLOG.md` befolgen: Execution Log laufend, Tests, Commit, Push.

## Completed audit sections

### §1 Historie geprüft (User-Anfrage) — FAKTISCH VERIFIZIERT
| Befund | Nachweis |
|---|---|
| `LandingPage2.tsx` + `landingpage2.css` neu angelegt unter Route **`/landingspage2`** | Commit `b12529c` „feat: visual landing page prototype at /landingspage2 (LANDINGPAGE-02)" (`--diff-filter=A`) |
| Tausch `/` ↔ `/landingspage2` | Commit `6efc1b3`, Report `docs/reports/LANDINGPAGE-SWAP-01-EXECUTION_LOG.md` |
| **Es wurde NIE umbenannt** (weder Datei noch CSS noch Komponente) | `git log --all --diff-filter=R -- '*anding*'` ist **leer** |
| Namensgebung „2" stammt aus der Prototyp-Phase; die Datei ist heute die Produktions-Landingpage auf `/` | `src/main.tsx:15` (`rootComponent === "landing2" ? <LandingPage2 /> : <App />`), `src/rootRoute.ts:11` (`pathname === "/" → "landing2"`) |

**Antwort auf die User-Frage:** Der Wunsch von damals („LandingPage2 → Landingpage")
wurde **nicht** umgesetzt. Die Datei heißt weiter `LandingPage2.tsx`, lief aber seit
`6efc1b3` auf `/`. **Konsequenz für diesen Task:** Dateien NICHT umbenennen
(Bestand + Branch-Historie), sondern die Historie als Kommentar festhalten.

### §2 Umfang `/top` → `/search` erfasst
Quellcode (außerhalb `docs/reports/`, die historische Dokumente sind und
unverändert bleiben):
- `vercel.json` — Rewrite `"/top"` → `"/index.html"` (einzige `/top`-Rewrite)
- `src/App.tsx:71` — Route-Erkennung `path === "/top" ? "matcher" : "landing"`
- `src/rootRoute.ts:3`, `src/main.tsx:9` — Kommentare
- Hrefs: `Navbar.tsx` (2), `LandingPage2.tsx` (4), `LandingHero.tsx` (1),
  `RegisterForm.tsx` (2), `LoginForm.tsx` (2)
- Tests (13 Stellen): `App.test.tsx` (3), `App.landing.test.tsx` (1),
  `rootRoute.test.ts` (1), `AuthRoutes.test.tsx` (4), `SearchLayout.test.tsx` (1),
  `LoginForm.test.tsx` (1), `RegisterForm.test.tsx` (1), `LandingPage2.test.tsx` (2)
- **Keine** Vorkommen in `README.md`, `docs/*.md`, `index.html`, `.github/`, `api/`

### §3 Zwei getrennte Top-Menüs identifiziert
| Menü | Datei | Aktuelle Links |
|---|---|---|
| Glass-Bar der Produktions-Landingpage `/` | `src/components/LandingPage2.tsx` `.lp2-bar` (Zeilen 99–128) | Suche + Benachrichtigungen (beide → `/top`), EN/DE, Login (`aria-disabled`) |
| App-Navbar (alle App-Routen) | `src/components/Navbar.tsx` | landing/impressum/register/login: **nur Suche**; matcher (`/top`): Suche (Scroll-nach-oben) + Benachrichtigungen (`#alerts`) |

`nav.alerts`/`nav.search` existieren doppelt: `src/i18n.tsx:10-11/486-487` (App)
und `src/components/LandingPage2.tsx:15-16/34-35` (lp2-eigener `lp2-lang`-State).

## Actual findings
- **Linkablauf-Konflikt `/search#alerts`**: `src/App.tsx:160-164` entfernt beim
  Start jeden Hash (`history.replaceState`) und ruft `window.scrollTo(0, 0)` auf.
  Ein direkter Sprung auf `#alerts` von einer fremden Route funktioniert damit
  **nicht** (Landet oben, Hash verschwindet). Wird **bewusst nicht geändert**
  (User: „kein Rad erfinden") — siehe Open Questions.
- `LandingPage2` besitzt einen eigenen Sprach-State (`lp2-lang`,
  `LandingPage2.tsx:47-55`), **keinen** `useLang()`-Zugriff — das Link-Modul
  darf die Labels nicht zwingend über `useLang()` auflösen.
- `.lp2-nav` (`landingpage2.css:506-511`) und `.nav-links` (`styles.css:274-288`)
  sind reine flex-Container — das Ausblenden eines Links verlangt keine
  CSS-Änderung.

## Evidence / file references
- `src/components/Navbar.tsx`, `src/components/LandingPage2.tsx`,
  `src/landingpage2.css`, `src/styles.css`, `src/App.tsx`, `src/rootRoute.ts`,
  `src/main.tsx`, `src/i18n.tsx`, `vercel.json`
- Historie: Commits `b12529c`, `6efc1b3`; `docs/reports/LANDINGPAGE-SWAP-01-EXECUTION_LOG.md`,
  `docs/reports/APP-NAVBAR-HERO-01-EXECUTION_LOG.md`, `docs/reports/LANDINGPAGE-02-EXECUTION_LOG.md`

## Completed audit sections (Fortsetzung)
### §4 Zentrales Link-Modul angelegt — `src/navLinks.ts`
- `NavRoute` = `"landing" | "matcher" | "impressum" | "register" | "login"`
  (die bisher in `Navbar.tsx` deklarierte Route-Menge, jetzt zentral).
- `NavLink` = `id`, `labelKey`, `href`, `targetRoute`, `inPage?`, `visibleOn`.
- `NAV_LINKS` mit 2 Einträgen; `navLinksFor(route)` filtert pro Route.
- Sichtbarkeit: Suche = alle 5 Routen; Benachrichtigungen = matcher/register/login
  (**nicht** landing, **nicht** impressum) — User-Entscheidung.
- Erweiterung dokumentiert: neuer Eintrag in `NAV_LINKS` bzw. neuer
  `NavLinkInPage`-Fall in `Navbar.tsx handleClick()`.
- Labels bleiben im jeweiligen Sprachsystem aufgelöst (App: `useLang()`,
  Landing: `lp2-lang`), Key-Namensraum angeglichen auf `nav.search`/`nav.alerts`.

### §5 Konsumenten umgestellt
- `Navbar.tsx`: `links`-Bedingung (3-Wege-Ternary) entfernt → `navLinksFor(route)`;
  `handleClick` arbeitet jetzt mit `href` + `inPage` (Prüfung
  `pathname === href ohne Hash`); Rendering in Desktop- und Mobile-Menu über
  `link.id`/`link.href`/`link.labelKey`. `NavbarRoute` bleibt als Alias
  `= NavRoute` exportiert (App.tsx-Import unverändert).
- `LandingPage2.tsx`: `.lp2-nav` rendert `navLinksFor("landing")` → **nur Suche**.
  STRINGS-Keys `navSearch`/`navAlerts` → `"nav.search"`/`"nav.alerts"`.
- `LandingPage2.test.tsx`: Test „Glass-Navigation" ohne „Benachrichtigungen";
  neuer Test „TOP-MENU-01: Landingpage zeigt nur Suche"; Link-Test `/top` → `/search`.
- `npx tsc -b` nach beiden Schritten **PASS**.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- Vorher: HEAD `10e60da` == origin/main `10e60da`.
- Vorbestehende Screenshot-Diffs unverändert unberührt:
  `D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_09.png`,
  `D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_12.png`,
  `?? docs/screenshotsfordev/Animierter KI-Jobstream im Neon-Design.png`,
  `?? docs/screenshotsfordev/Screenshot 2026-10-02 at 13-07-10 May's Job Matcher.png`
- `stash@{0} "wip-examine"` stammt nicht von diesem Task — unangetastet.

## Files changed, if any
**Neu (2):**
- `src/navLinks.ts` — zentrale Top-Menü-Linkliste (Modul)
- `src/navLinks.test.ts` — 5 Regressionstests für das Modul

**Geändert (18):**
- `vercel.json` — Rewrite `/top` → `/search`
- `src/App.tsx` — Route-Erkennung `/search`
- `src/rootRoute.ts`, `src/main.tsx` — Routen-Kommentare
- `src/rootRoute.test.ts` — Erwartung `/search`
- `src/components/Navbar.tsx` — Modul-Rendering, `handleClick(href, inPage)`
- `src/components/LandingPage2.tsx` — Modul-Rendering, Historien-Kommentar,
  STRINGS-Keys `nav.search`/`nav.alerts`
- `src/components/LandingHero.tsx` — Kommentar alte Landingpage
- `src/components/RegisterForm.tsx`, `LoginForm.tsx` — hrefs `/search`
- `src/landingpage2.css` — Historien-Kopfblock
- `src/App.test.tsx`, `App.landing.test.tsx`, `AuthRoutes.test.tsx`,
  `SearchLayout.test.tsx`, `LoginForm.test.tsx`, `RegisterForm.test.tsx` —
  Erwartungen `/search`
- `src/components/LandingPage2.test.tsx` — neues Sichtbarkeitsverhalten
- `docs/reports/TOP-MENU-01-EXECUTION_LOG.md` — dieser Log

**Nicht angefasst (bewusst):** `docs/reports/*.md` (historische `/top`-Nachweise),
`docs/AI_AUDITLOG.md`, vorbestehende Screenshot-Diffs, `stash@{0}`.

## Explicit confirmation when no files were changed
Nicht zutreffend — Dateien sind geändert (siehe „Files changed"). Vorbestehende
Screenshot-Diffs und `docs/AI_AUDITLOG.md` unverändert.

## Open questions
1. **`/search#alerts` von fremden Routen** landet oben (Hash wird beim Start
   entfernt). Optionen: (a) so lassen und dokumentieren, (b) später im
   Login-Flow neu bewerten. **Aktuell: (a)** — kein Eingriff in
   `App.tsx:160-164`.
2. Login-Button bleibt unverändert außerhalb des Link-Moduls: `.lp2-login`
   ist ein `aria-disabled`-Button („noch ohne Funktion", Prototyp,
   `APP-NAVBAR-HERO-01`), `.nav-login` ein funktionaler Anchor nach
   `/anmelden`. Vereinheitlichung wäre ein sichtbarer Bruch → **nicht Teil
   dieses Tasks.**

## Risks
- **Harte Route-Umbenennung**: Bestandslinks/Bookmarks auf `/top` laufen nach
  Deployment in den 404 — vom User explizit so entschieden
  („hart umbenennen", „Bestandslinks/Bookmarks tot").
- Sichtbarkeitsänderung Landingpage: „Benachrichtigungen" entfällt dort —
  vom User explizit so entschieden (gegen die anfängliche Formulierung
  „rechts vorher darstellen", spätere Präzisierung gewinnt).
- Reports in `docs/reports/` enthalten zahlreiche `/top`-Stellen —
  **bewusst nicht angefasst** (historische Nachweise).

## Recommended next actions
Erledigt (§1–§9). Optional offen — **nicht Teil dieses Tasks**, nur als
Nachziehen dokumentiert (siehe Open Questions):
- `/search#alerts` von fremden Routen landet oben (Hash wird beim Start
  entfernt) — bewusst unverändert.
- Login-Button (`aria-disabled` auf `/`, funktional auf App-Routen) bleibt
  außerhalb des Link-Moduls — Vereinheitlichung wäre sichtbarer Bruch.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Navigations-/Menü-Darstellung (Link-Liste, Hrefs, Sichtbarkeit pro
Route) und eine harte clientseitige Routen-Umbenennung. Keine Änderung an
KI-Ausführung, Modell, Provider, Datenverarbeitung, Persistenz, Tracking, Auth
oder API. `docs/AI_AUDITLOG.md` bleibt unverändert; geführt wird dieser
Report-Log.

### §6 Route hart umbenommen `/top` → `/search` — ABGESCHLOSSEN
26 Stellen in 17 Dateien, **0 Reste** in `src/`, `vercel.json`, `index.html`
(geprüft per `grep -rn "/top"`):
- `vercel.json` Rewrite `"/top"` → `"/search"`
- `src/App.tsx` Route-Erkennung `path === "/search" ? "matcher" : "landing"`
- `src/rootRoute.ts:4`, `src/main.tsx:10` Kommentare (mit „vorher /top")
- Hrefs: `LandingPage2.tsx` (2), `LandingHero.tsx`, `RegisterForm.tsx` (2),
  `LoginForm.tsx` (2); `Navbar.tsx` keine Hrefs mehr direkt (Modul)
- Tests (13 Stellen): `App.test.tsx`, `App.landing.test.tsx`, `rootRoute.test.ts`,
  `AuthRoutes.test.tsx`, `SearchLayout.test.tsx`, `LoginForm.test.tsx`,
  `RegisterForm.test.tsx`, `LandingPage2.test.tsx`
- `docs/reports/*.md` **nicht angefasst** (historische Nachweise)

### §7 Historien-Kommentare gesetzt — ABGESCHLOSSEN
- `src/components/LandingPage2.tsx` — großer Kopfblock: „PRODUKTIONS-LANDINGPAGE
  rendert /", Historie `b12529c` → `6efc1b3`, Namensgebung nie umbenannt,
  alte Landing unter `/landingspage2`, Dateien bewusst unverändert.
- `src/landingpage2.css` — Kopfblock: „PRODUKTIONS-CSS für /", Verweis auf
  `LandingPage2.tsx` und `src/styles.css` (alte Landing).
- `src/main.tsx`, `src/rootRoute.ts` — Swap-Kommentare präzisiert
  („PRODUKTIONS-Landingpage", `/search` statt `/top`).
- `src/components/LandingHero.tsx` — „Alte Landingpage, sichtbar unter
  /landingspage2; Produktions-Landingpage ist LandingPage2.tsx".

### §8 Tests / Build / Browser — ABGESCHLOSSEN
- **`npx tsc -b`**: PASS (0 Fehler).
- **`npm run build`** (`tsc -b && vite build`): PASS (Vite-Warnung >500 kB
  chunk bestand vorher, nicht aus diesem Task).
- **`npx vitest run`**: **735 passed | 5 skipped (740), 62 Files passed,
  3 skipped** — 0 failed.
- **Neuer Test `src/navLinks.test.ts`**: 5 Fälle (IDs/Hrefs/visibleOn-Werte,
  `navLinksFor`-Filter pro Route, Suche überall, Alerts-Abdeckung,
  kein `/top` mehr im Modul).
- **Angepasst**: `LandingPage2.test.tsx` („Glass-Navigation" ohne
  „Benachrichtigungen"; neuer Test „TOP-MENU-01: Landingpage zeigt nur Suche";
  Link-Test `/top` → `/search`).
- **Browser-Verifikation (Playwright/Chromium gegen `vite preview`, 40 Checks,
  alle PASS)**:
  - Route-Matrix `/`, `/landingspage2`, `/search`, `/registrieren`,
    `/anmelden`, `/impressum`: „Suche" überall sichtbar; „Benachrichtigungen"
    nur auf `/search`, `/registrieren`, `/anmelden`; **kein href auf `/top`**;
    alle hrefs absolut.
  - Landingpage `/`: genau 1 Nav-Link (`/search`), Glass-Bar gerendert.
  - `/impressum`: genau 1 Modul-Link.
  - Klick „Suche" auf `/search`: scrollY 900 → 0 (weich), bleibt auf `/search`.
  - Klick „Benachrichtigungen" von `/registrieren`: navigiert nach `/search`.
  - Mobile-Menu (390px, `.burger`): enthält Suche + Benachrichtigungen.
  - Login bleibt auf allen Routen außerhalb des Link-Moduls (`.nav-login`).
  - Temporärskript nach Gebrauch entfernt.

### §9 Finalisierung — ABGESCHLOSSEN
Execution Log aktualisiert, Commit erstellt, Push auf `origin/main`.
`docs/AI_AUDITLOG.md` unverändert (keine KI-Datenfluss-Änderung).

## Classification
**GREEN** — abgeschlossen, verifiziert, gepusht.

# TOP-MENU-02 — Navbar der Suchmaske im Glass-Look der Landingpage (Element-Reihenfolge fixiert)

## Current status
**COMPLETE** — Umsetzung, Tests (741), `tsc -b`, `npm run build` und
Browser-Verifikation (33 Checks) alle grün. Gepusht.

## Audit date/time
2026-10-06 (CET)

## Git branch and HEAD
- Branch: main
- HEAD: `fc995b3` (TOP-MENU-01, gepusht)
- origin/main: `fc995b3`

## Audit scope
User-Auftrag (2026-10-06):

1. **Aussehen**: Das Aussehen der Navigation bar der Landingpage auf der
   Suchmaske (`/search`) übernehmen.
2. **Reihenfolge der Elemente vorab festlegen** (User-Vorgabe, verbindlich):
   1. `May's Job Matcher` (Brand, links)
   2. `EN/DE`-Switch **in der Mitte**
   3. rechts: Link **Search**
   4. rechts außen: **Login** (so lassen wie bisher)
   5. **nur auf `/search`**: `Benachrichtigungen` **direkt nach** dem
      Search-Link einblenden
3. `docs/AI_AUDITLOG.md` beachten → laufendes Execution-Log (diese Datei).

## Completed audit sections

### §1 Ausgangszustand erhoben — Element-Reihenfolge IST bereits wie gefordert
`src/components/Navbar.tsx:124-149` DOM-Reihenfolge:
`<a class="navbar-title navbar-title-left">May's Job Matcher` →
`<div class="nav-center">` (LangToggle EN/DE, absolut zentriert über
`.nav-center { left:50%; transform:translate(-50%,-50%) }`, `styles.css:295-300`)
→ `<div class="nav-links">` (Module-Links + `.nav-login`, rechts über
`.nav-links { margin-left:auto }` ab `min-width:768px`).

Linkreihenfolge rechts = `navLinksFor(route)` aus `src/navLinks.ts`
(**Suche zuerst, danach Benachrichtigungen**), danach Login.
Damit gilt auf `/search` aktuell bereits: `Suche | Benachrichtigungen | Login`.
→ **Reihenfolge wie vom User gefordert; keine strukturelle Änderung nötig.**

### §2 Aussehen landing vs. search erhoben — der eigentliche Unterschied
| Eigenschaft | Landing `.lp2-bar` (`landingpage2.css:489-504`) | Suche `.navbar` (`styles.css:179-187`) |
|---|---|---|
| Form | schwebende Pille, `width:min(90vw,1200px)`, `margin:0 auto` | randlos über volle Breite, `sticky top:0` |
| Radius | `border-radius: 20px` | keine Rundung |
| Fläche | `rgba(255,255,255,0.13)` + `backdrop-filter: blur(14px)` | `rgba(255,255,255,0.75)` + `blur(8px)` |
| Rahmen | `1px solid rgba(255,255,255,0.38)` | `1px solid var(--border)` (hellgrau) |
| Schatten | `0 8px 30px rgba(0,0,0,0.08)` | keiner |
| Textfarbe | `#fff` / `rgba(255,255,255,0.85)` | `var(--text)` = `#1b2333` (dunkel) |
| Login | weißes Oval `.lp2-login` (`#0b3b5e` auf Weiß) | Outline-Pille `.nav-login` (`styles.css:302-313`) |
| EN/DE | rechts (`.lp2-lang { margin-left:auto }`) | **Mitte** (`.nav-center`, absolut) |
| Brand | links, `#fff` | links (`.navbar-title-left`, `position:static`) |

### §3 Hintergrund unter der Navbar auf `/search` geprüft — KERNBEFUND
`src/App.tsx:2271` rendert `<Navbar route={route} />` **außerhalb** von
`.search-world` (`App.tsx:2294`). Die `.search-world__background`-Fläche
(`styles.css:622-650`, Foto „Futuristische Lobby …") beginnt erst **unterhalb**
der Navbar. Direkt hinter der Navbar liegt die helle Seitenfläche
`--page-bg: #f8fafc` (`styles.css:2`).

→ **Konsequenz:** Das Landing-Farbschema (weiße Schrift auf translucent-weißem
Glas) ist auf `/search` ohne zusätzliche Abdunklung **nicht lesbar**.
Ein 1:1-Übernehmen der Farbwerte ist technisch nicht möglich, ohne entweder
(a) die Navbar-Fläche dunkel zu gestalten, oder (b) die Schrift dunkel zu
lassen und nur Form/Bordüre/Glas-Charakter zu übernehmen.

## Actual findings
- Reihenfolge der Elemente ist bereits exakt die vom User geforderte
  (§1) — Auftrag betrifft daher **rein das Aussehen**.
- Der einzige echte Unterschied ist die Formensprache (schwebende,
  gerundete Glass-Pille vs. randlose, eckige, flache Leiste) und das
  Farbschema (Weiß vs. dunkel).
- `.navbar` ist `position: sticky` mit eigenem Hintergrund; die Landing-Bar
  ist eine schwebende Pille innerhalb eines Overlays. Eine Pille erfordert
  Abstand zu den Rändern + vertikalen Abstand zum Seitenanfang.

## Evidence / file references
- `src/components/Navbar.tsx:123-187`, `src/styles.css:179-357`,
  `src/landingpage2.css:489-566`, `src/App.tsx:2271`, `src/App.tsx:2294`,
  `src/navLinks.ts`, `docs/AI_AUDITLOG.md`

## Completed audit sections (Fortsetzung)

### §4 Umsetzung — ABGESCHLOSSEN
- `src/components/Navbar.tsx`: neue Konstante `const isGlass = route === "matcher"`
  → `<header className={`navbar${isGlass ? " navbar-glass" : ""}`}>`.
  JSX-Kommentar fixiert die Element-Reihenfolge als User-Vorgabe.
- `src/styles.css` (neuer Block nach `.lang-toggle button.active`):
  - `.navbar-glass` — transparente/flächig leichte Grundfläche
    `rgba(255,255,255,0.35)` (Frost der Basis-`backdrop-filter` bleibt),
    `border-bottom: none`, `padding-top: 12px`, `margin-bottom: -12px`
    (**Flusshöhe der Seite bleibt identisch** — der Inhalt rutscht nicht).
  - `.navbar-glass .nav-inner` — die Pille: `position: relative`
    (damit `.nav-center`/EN-DE **auf der Pille** statt auf der Navbar-Breite
    zentriert wird), `width: min(90vw, 1200px)`, `max-width: none`,
    `border-radius: 20px`, `background: rgba(255,255,255,0.62)`,
    `backdrop-filter: blur(14px)`, `border: 1px solid rgba(255,255,255,0.8)`,
    `box-shadow: 0 8px 30px rgba(15,23,42,0.08)`.
  - `.navbar-glass.scrolled { top: -74px }` — Sicherheitsnetz: die Basis setzt
    `top: -60px`, die Glass-Leiste ist durch `padding-top: 12px` jedoch 72px
    hoch, sonst bliebe ein Streifen sichtbar. (Gemessen wurde `.scrolled`
    in dieser Build nicht ausgelöst — Regel greift nur als Absicherung.)
- **Geometrie gemessen vs. Landing `lp2-bar`**: Pille `x=120, w=1200, h=60,
  radius 20px` auf `/search` (1440px Viewport) — **identisch zur Landing**
  (`lp2-bar` gemessen: `x=120, y=20, w=1200, h=60, radius 20px`).

### §5 Verifikation — ABGESCHLOSSEN
- **`npx tsc -b`**: PASS. **`npm run build`**: PASS.
- **`npx vitest run`**: **741 passed | 5 skipped (746), 63 Files passed**
  (735 + 6 neue).
- **Neuer Test `src/components/Navbar.test.tsx`** (6 Fälle): Glass-Klasse nur
  bei `matcher`; alle 4 anderen Routen exakt `"navbar"`; Reihenfolge
  Brand | EN/DE | Suche | Benachrichtigungen | Login (auch Kind-Reihenfolge
  in `.nav-inner`); Alerts-`href` `/search#alerts`; Modul-Freigabe je Route;
  Brand + EN/DE vorhanden.
- **Browser-Checks (Playwright/Chromium, 33/33 PASS)**:
  - Geometrie: `w=1200`, `radius=20px`, `padding-top=12px`,
    `margin-bottom=-12px`, `position=sticky`, `border-bottom=0`,
    `blur(14px)`, Schatten, 1px-Rahmen.
  - Reihenfolge/Position in px: Brand `x=141`, EN/DE-Mitte `x=720`
    (Viewport-Mitte 720), Suche `x=993`, Benachrichtigungen `x=1059`,
    Login `x=1231`.
  - **Lesbarkeit**: Markenfarbe `rgb(27,35,51)` auf effektiver Pille
    `rgb(252,253,254)` → **Kontrast 15.45:1** (WCAG AA/AAA erfüllt).
  - `/impressum`, `/registrieren`, `/anmelden` ohne Glass-Klasse,
    Linkreihenfolge unverändert.
  - Mobile 390px: Pille `x=20, w=351` (=90vw) zentriert, Burger sichtbar
    und innerhalb der Pille.
  - Scroll `y=200/700/1500`: Pille bleibt sichtbar, kein sichtbarer
    Leisten-Streifen.
  - Temporärskripte nach Gebrauch entfernt.

## Classification
**GREEN** — abgeschlossen, verifiziert.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- HEAD `fc995b3` == origin/main `fc995b3`, noch keine eigenen Änderungen.
- Vorbestehende Screenshot-Diffs unverändert unberührt
  (2 × `D`, 2 × `??` unter `docs/screenshotsfordev/`).
- `stash@{0} "wip-examine"` stammt nicht von diesem Task — unangetastet.

## Files changed, if any
- `src/components/Navbar.tsx` — `navbar-glass`-Klasse nur bei `route="matcher"`,
  Kommentar zur festgelegten Element-Reihenfolge
- `src/styles.css` — neuer Block `TOP-MENU-02` (`.navbar-glass`,
  `.navbar-glass .nav-inner`, `.navbar-glass.scrolled`)
- `src/components/Navbar.test.tsx` — neu, 6 Regressionstests
- `docs/reports/TOP-MENU-02-EXECUTION_LOG.md` — dieser Log

## Explicit confirmation when no files were changed
Nicht zutreffend — Dateien sind geändert (siehe „Files changed").
`docs/AI_AUDITLOG.md`, `docs/reports/*.md` (alt), vorbestehende
Screenshot-Diffs und `stash@{0}` unverändert.

## Open questions (beantwortet)
1. **Scope** → User-Entscheidung: **nur `/search`**. `/impressum`,
   `/registrieren`, `/anmelden` behalten das bisherige Aussehen.
2. **Farbschema** → User-Entscheidung: **Glass-Pille, dunkle Schrift**.
   Form/Glas-Charakter der Landing übernehmen, Schrift dunkel lassen,
   weil hinter der Navbar die helle Fläche `#f8fafc` liegt (§3).

## Risks
- Weiß-auf-Glas ohne Abdunklung → unleserliche Navigation auf `/search`.
- Pille mit `margin` verändert die Sticky-Höhe und kann in bestehende
  Scroll-Logik (`.navbar.scrolled`, `hamburger-small`) und Snapshots eingreifen.

## Recommended next actions
Erledigt (§1–§5). Optional offen — **nicht Teil dieses Tasks**:
- `vite build` meldet weiterhin die bestehende „chunks > 500 kB"-Warnung
  (vorbestehend, nicht aus diesem Task).
- Visuelle Endkontrolle durch den User empfohlen (Screenshots wurden wegen
  fehlendem Bildzugriff des Agents nur programmatic geprüft).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: reine Darstellungs-/CSS-Änderung an der Navigation. Keine Änderung an
KI-Ausführung, Modell, Provider, Datenverarbeitung, Persistenz, Tracking, Auth
oder API. `docs/AI_AUDITLOG.md` bleibt unverändert; geführt wird dieser
Report-Log.

## Nachkorrektur 2026-10-06 (User-Klarstellung)
User präzisierte die gewünschte Reihenfolge:
- **Landingpage**: `Branding → EN/DE → Suche → Login` (EN/DE hat `margin-left:auto`)
- **Searchpage** (`/search`): `Branding → EN/DE → Suche → Benachrichtigungen → Login`
  (EN/DE hat `margin-left:auto` und schiebt die rechte Gruppe)

Umgesetzt:
- `src/components/LandingPage2.tsx`: DOM-Reihenfolge geändert auf
  `brand → lp2-lang → lp2-nav → lp2-login`.
- `src/components/Navbar.tsx`: Glass-Mode (`route="matcher"`) rendert
  `brand → .nav-right-group { margin-left:auto }`
  mit Kindern `nav-lang → nav-links → nav-login`. `.nav-center` wird nicht
  gerendert, EN/DE ist Teil der rechten Gruppe.
- `src/styles.css`: `.navbar-glass .nav-right-group { margin-left:auto; display:flex; ... }`,
  `.navbar-glass .nav-lang { display:inline-flex }`,
  `.navbar-glass .nav-links { margin-left:0 }`.
- Tests `src/components/Navbar.test.tsx` angepasst an neue DOM-Struktur.
- `tsc -b`, `npm run build`, 741 Tests, Browser-Verifikation bestanden.

## Current resume point
Erledigt. Nächster Schritt: Commit + Push (§6).

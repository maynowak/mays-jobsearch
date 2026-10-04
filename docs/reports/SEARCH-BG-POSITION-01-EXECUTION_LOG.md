# SEARCH-BG-POSITION-01 — Atrium-Hintergrund trägt den Search-Bereich (Execution Log)

## Status
DONE (nur visuelle Positionierung; keine Funktions-, API- oder Datenfluss-Änderung)

## 1. IST-Position (vorher)
- `.hero` (oberes Bild mit Person) unverändert; darunter die Suchmaske auf hellem
  Workspace-Hintergrund; das Atrium-Bild lag als **schmaler Streifen**
  (`.lobby-band`, ~288 px) ganz unten zwischen Inhalt und Footer.
- Zielvorgabe: Hintergrund **direkt unter dem Hero** und **vor** dem
  Such-/Benachrichtigungsbereich, UI-Karten davor.

## 2. Neue Position
- Neuer Wrapper `<div className="search-stage">` um
  `<main className="container layout-search">` (nur Matcher-Route).
  Er startet unmittelbar nach `<Hero />` und enthält Suchmaske sowie
  Benachrichtigungs- bzw. Ergebnisbereich.
- Alter Streifen **entfernt**: JSX `.lobby-band` und zugehörige CSS-Regeln
  gelöscht.

## 3. Verwendetes Asset (unverändert, kein Duplikat)
- `public/futuristische-lobby-mit-holografischen-displays.webp` (306 KB, Primär)
- `src/assets/images/Futuristische_Lobby_mit_holografischen_Displays.png` (Fallback)
- Einbindung wie im Repo üblich per `image-set()`. Kein neues Bild, keine
  Asset-Strukturänderung.

## 4. Layering / z-index
- Hintergrund: `.search-stage::before` — `position: absolute`, `z-index: 0`,
  `pointer-events: none`.
- UI: `.search-stage > *` — `position: relative`, `z-index: 1`
  (`.search-card` bringt zusätzlich bereits `z-index: 2` mit).
- Navbar bleibt mit `z-index: 40` darüber; Karten bleiben mit ihrem
  `--main-gradient` (opak) und 3-px-Cyan-Rand unverändert im Vordergrund.
- Basisfläche `.search-stage`: neutraler Hellblau-Verlauf
  (`#f8fafc → #eef4fa → #e9f1f9`) — **keine grüne Platzhalterfläche**.

## 5. Übergang Hero → Hintergrund
- Im `::before`-Layer liegt ein 180°-Verlauf über dem Bild: oben exakt
  `--page-bg` (`#f8fafc`) → bei 8 % noch hell → 24–76 % sehr transparent
  (Bild voll sichtbar) → unten wieder leicht aufgehellt. Ergebnis: kein harter
  Bruch, Hero wirkt weich überblendet. Kein Hero-Text, Hero-Höhe, Navbar oder
  Hero-Bild wurden angefasst (DOM-Messung bestätigt: Hero enthält weiterhin nur
  das Originalbild).

## 6. Bildausschnitt / Layerhöhe
- `height: clamp(470px, 82vh, 880px)` ab Oberkante des Search-Bereichs,
  `background-position: center 42%`, `cover`.
- Höhen-Deckel ist bewusst: bei sehr langen Ergebnislisten wird das Bild nicht
  überdehnt (kein Über-Zoom), darunter greift der ruhige Verlauf.

## 7. Responsive (im Browser geprüft)
- Desktop (1440×900): Layer 979 px, Bild trägt beide Karten, Karten deckend.
- Tablet (834×1112): eigener Layer (`clamp(420px, 72vh, 720px)`), stärkere
  Abdunklung, `center 38%`.
- Mobile (390×844): Layer `clamp(360px, 58vh, 520px)`, stärkste Abdanklung,
  `center 34%`.
- **Keine horizontale Überbreite** auf Tablet und Mobile (je 0 px
  `scrollWidth - clientWidth` gemessen).

## 8. Nicht verändert
Search-Funktion, Formularfelder, API, ATS, CV, Login/Registrierung, Navbar,
Hero-Inhalt, Footer-Funktionalität, Produkt-/Offer-Logik, RIS, Cognito.

## 9. Tests / Verifikation
- `src/SearchLayout.test.tsx` (3 Tests, auf die neue Struktur umgestellt):
  Leerzustand (Hero → Stage → Footer, Suchmaske in Stage, **kein** `.lobby-band`),
  Mit Ergebnissen (Ergebnisliste in Stage, Stage vor Footer, kein Streifen),
  Auth-/Landing-Route ohne Search-Hintergrund.
- `npx tsc -b` PASS; `npm test` **714 passed / 5 skipped / 0 failed**;
  `npm run build` PASS.
- Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): Streifen-Element 0, Stage vorhanden, `::before` enthält Lobby-Asset,
  Hero enthält kein Lobby-Bild, Karten opak, 0 JS-Errors; Screenshots
  Desktop/Tablet/Mobil geprüft.

## 10. Git
- Commit folgt; nur zugehörige Dateien: `src/App.tsx`, `src/styles.css`,
  `src/SearchLayout.test.tsx`, dieser Report.
- Screenshots-Diffs (`docs/screenshotsfordev/`, vorbestehend) unangetastet.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)
- Status: DONE
- Zeitpunkt: 2026-10-04; Branch: main; HEAD: `1008641` (Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 714/0 failed, tsc PASS, Build PASS
- Geänderte Tests: `src/SearchLayout.test.tsx` (Struktur-Assertions aktualisiert)
- Risiken: gering (reine Darstellung; Layerhöhe ggf. Geschmackssache — leicht per
  `clamp()` anpassbar)
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)
Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reines CSS/JSX-Layout ohne AI-, Daten- oder Datenfluss-Änderung.
Keine AI-Audit-Ergänzung erzeugt.
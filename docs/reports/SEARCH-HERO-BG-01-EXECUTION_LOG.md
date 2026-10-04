# SEARCH-HERO-BG-01 — Lobby-Motiv als Hintergrund der Search-Seite (Execution Log)

## Status
DONE (reines Styling + Asset; keine Logik-, API- oder Datenfluss-Änderung)

## Scope
- Datum: 2026-10-04; Branch: main; HEAD: `e9b60a6`
- Auftrag: `src/assets/images/Futuristische_Lobby_mit_holografischen_Displays.png`
  als Hintergrund der Search-Seite (`/top`).
- Nur CSS + Bild-Asset. Keine Komponenten-, API-, State- oder Testlogik geändert.

## Ist-Bestand (vor Änderung)
- Die Search-Seite rendert `<Hero />` mit Klasse `.hero`; **`.search-hero` ist tote CSS**
  (nur in einem Testkommentar und einer Landing-Assertion referenziert, kein JSX).
- Hintergrund bisher: `image-set(/job-matcher-next-step-searchpage.webp,
  assets/images/job-matcher-next-step-searchpage.png)` mit hellem 90°-Verlauf
  (`src/styles.css`, `.hero`).
- Repo-Konvention: WebP in `public/` (primär) + PNG in `src/assets/images` (Fallback),
  `image-set()` im CSS.

## Umsetzung
- `.hero` nutzt jetzt das Lobby-Motiv:
  `image-set(url("/futuristische-lobby-mit-holografischen-displays.webp"),
  url("assets/images/Futuristische_Lobby_mit_holografischen_Displays.png")) center / cover`.
- Neues Asset `public/futuristische-lobby-mit-holografischen-displays.webp`
  (sharp, q82, **306 KB** statt 2,6 MB PNG → ca. 88 % kleiner im Hauptpfad).
- Overlay angepasst: heller 90°-Verlauf (0.92 → 0.34 deckend), damit der dunkle Text
  (`--text`) und die Suchkarte über dem hellen Motiv lesbar bleiben — wie im
  vorherigen Hero-Motiv, nur etwas stärker, weil das Lobby-Bild heller ist.
- Altes Bild aus `.hero` entfernt (kein Zombie-Asset; die Datei selbst bleibt für
  `.search-hero` erhalten, damit die tote Regel unverändert bleibt).

## Verifikation
- `npx tsc -b` PASS; `npm test` **711 passed / 5 skipped / 0 failed**;
  `npm run build` PASS.
- Live-Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): computed `background-image` enthält WebP + PNG der Lobby, altes
  Suchseiten-Bild ist nicht mehr referenziert; Screenshots Desktop 1440×900 und
  Mobil 390×844 geprüft — Überschrift, Tagline und Suchkarte bleiben klar lesbar,
  keine JS-Errors.

## Hinweise / Risiken
- Der PNG-Fallback (2,6 MB) landet wie bei den bestehenden Motiven im Bundle
  (`dist/assets/…png`); alle modernen Browser laden die 306-KB-WebP. Optimierung der
  Fallback-Größe wäre ein separates, nicht beauftragtes Thema.
- Landing (`/`) und Impressum/Auth-Masken unverändert.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)
- Status: DONE
- Zeitpunkt: 2026-10-04; Branch: main
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 711/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css`, `public/futuristische-lobby-mit-holografischen-displays.webp`
  (neu), `src/assets/images/Futuristische_Lobby_mit_holografischen_Displays.png`
  (unverändert übernommen, neu im CSS referenziert), dieser Report
- Geänderte Tests: keine
- Risiken: gering (reine Darstellung)
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)
Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reines CSS/Asset ohne AI-, Daten- oder Datenfluss-Änderung.
Keine AI-Audit-Ergänzung erzeugt.
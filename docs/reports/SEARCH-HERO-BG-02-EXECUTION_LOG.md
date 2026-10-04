# SEARCH-HERO-BG-02 — Lobby-Band zwischen Inhalt und Footer (Execution Log)

## Status
DONE (reines Styling/Asset; Hero-Hintergrund wiederhergestellt)

## Scope
- Datum: 2026-10-04; Branch: main; HEAD: `fb85b50`
- Korrektur zu SEARCH-HERO-BG-01: Das Lobby-Bild war **nicht** als Hero-Hintergrund
  gewünscht. Der Hero behält sein bisheriges Motiv; das Lobby-Bild sitzt jetzt als
  eigener Hintergrund-Abschnitt zwischen Hauptinhalt und Footer.
- Nur CSS + ein JSX-Element (`aria-hidden`, ohne Inhalt/Logik). Keine API-, State-
  oder Datenfluss-Änderung.

## Korrektur
1. `.hero` vollständig auf den Vorzustand zurückgesetzt (Originalbild
   `job-matcher-next-step-searchpage.webp` + Original-Verlauf, wieder `center 55%`).
2. Neues, rein dekoratives Band `<section className="lobby-band" aria-hidden="true" />`
   in `App.tsx` direkt **vor** `<Footer />`, nur auf der Search-Seite
   (`route === "matcher"`). Bewusst ohne Textinhalt, um keine Produktinhalte zu
   erfinden.
3. CSS `.lobby-band`: `min-height: clamp(220px, 32vh, 420px)`, Lobby-Motiv via
   `image-set()` (WebP 306 KB primär, PNG-Fallback), weicher 180°-Verlauf für eine
   saubere Überblendung zum Inhalt oben und zum Footer unten; mobil
   `clamp(160px, 22vh, 260px)`.

## Verifikation
- `npx tsc -b` PASS; `npm test` **711 passed / 5 skipped / 0 failed**;
  `npm run build` PASS.
- Live-Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): Elementreihenfolge auf `/top` = `hero` → `container` → `lobby-band` →
  `footer`; Hero-Hintergrund enthält wieder das alte Motiv und **kein** Lobby-Bild;
  Band-Hintergrund enthält die Lobby (WebP), Höhe 288 px; Band erscheint **nicht**
  auf `/anmelden`; Screenshots Desktop 1440×900 und Mobil 390×844 geprüft — Bild gut
  sichtbar, weiche Übergänge, 0 JS-Errors.

## Bewusst nicht gemacht
- Kein Text-/CTA-Inhalt im Band (nicht beauftragt; neutrale, rein visuelle Fläche).
- Landing (`/`), Impressum, Login/Registrierung unverändert.
- Keine Änderung an Bildern selbst, keine neuen Dependencies.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)
- Status: DONE
- Zeitpunkt: 2026-10-04; Branch: main; HEAD: `fb85b50` (Korrektur-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 711/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (Hero zurück + `.lobby-band` ergänzt),
  `src/App.tsx` (ein dekoratives Element), dieser Report
- Geänderte Tests: keine
- Risiken: gering (reine Darstellung)
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)
Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reines CSS/JSX-Markup ohne AI-, Daten- oder Datenfluss-Änderung.
Keine AI-Audit-Ergänzung erzeugt.
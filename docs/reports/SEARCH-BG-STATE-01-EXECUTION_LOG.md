# SEARCH-BG-STATE-01 — Warum wird der Search-Background nach der Suche matt? (Audit + Minimalfix)

## Status
DONE (Ursache belegt, minimaler Fix umgesetzt — nur CSS, keine Logik-/API-Änderung)

## 1. Befund (gemessen, nicht vermutet)

**Es gibt kein Overlay, keinen Opacity-Bug und keinen weißen Schleier aus der
Ergebnis-Komponente.** Belege:

- `.results`, `.results-workspace`, `.results-header`, `.match-card` u. a. haben
  **keinen** Hintergrund und keine Deckfläche (CSS geprüft).
- Der Farbverlauf des Atrium-Overlays (`.search-world::before`) hatte in beiden
  Zuständen **identische** Werte (`0.82 → 0.34 → 0.14 → 0.2 → 0.46 → 0.9` alpha).
- Pixelvergleich identischer Bildschirmpunkte (x=1360) Leerzustand vs. Ergebnisse:

| Punkt | vorher (L / S) idle → results | Bewertung |
|---|---|---|
| y=420 (Atrium oben) | 215/13 % → 219/11 % | nahezu identisch |
| y=560 (Atrium Mitte) | 156/39 % → 168/33 % | nahezu identisch |
| y=700 (Atrium Reflexion) | 115/46 % → 122/43 % | nahezu identisch |

→ **Im Bildbereich wird nach der Suche nichts ausgewaschen.** Die „Milchigkeit"
entstand woanders.

## 2. Tatsächliche Ursachen

Messwerte: Section-Höhe **1206 px (idle) → 1378 px (mit Ergebnissen, +172 px)**;
Bild-Layer `__background` **konstant 774 px** (`clamp(620px, 86vh, 1020px)`).

| # | Ursache | Wirkung |
|---|---|---|
| U1 | Der tonale Verlauf lag auf `.search-world::before` und damit **prozentual zur Section-Höhe**. Mit wachsender Section dehnte sich sein hinterer, heller Bereich (84 % → 100 %) über die ganze untere Hälfte. | Abschwächung/Verwaschung der unteren Welt, wächst mit dem Ergebniszustand. |
| U2 | Der Verlauf überlagerte **auch das Bild** mit 0.14–0.46 alpha. | Das Atrium war bereits im Leerzustand entsättigt (S = 46 % statt 66 %). |
| U3 | Die Section wächst mit den Ergebnissen, das **Bild-Layer bleibt bei 774 px**. Unterhalb davon steht nur der Basisverlauf, der Near-White endete (`#e9f1f8`). | Im Ergebniszustand ist ein deutlich größerer Anteil der Seite „unterhalb des Bildes" = flaches helles Plateau (gemessen y=1150–1450: L ≈ 226–231, S ≈ 13–15 %). |
| U4 | Das Intelligence-Deck war an `top: 54 %` der Section verankert. Bei +172 px Section-Höhe driftete es um ~92 px nach unten. | AI-/JOBS-/INTELLIGENCE-Elemente rutschen aus dem Bild — „Tafeln verschwinden". |
| U5 | Der Fade startete sofort aus fast Weiß. | „Weißes Loch"-Eindruck kurz vor dem Footer. |

## 3. Minimaler Fix (4 CSS-Änderungen, keine Struktur-/Logikänderung)

| Fix | Änderung | Adresse |
|---|---|---|
| F1 | Tonaler Verlauf **auf die Bildfläche** verschoben (zweite `background-image`-Ebene mit `background-size: cover, cover`). Skala ist jetzt die Bildhöhe, nicht die Section-Höhe; Alphawerte im Bildbereich deutlich niedriger (0.06–0.34 statt 0.14–0.46). | `.search-world__background` |
| F2 | `.search-world::before` macht **nur noch den Hero-Übergang** (`height: clamp(200px, 30vh, 380px)`, Verlauf nach unten transparent). | `.search-world::before` |
| F3 | Basisverlauf der Section endet nicht mehr in Near-White, sondern in ruhigem Blau (`#c7e2f2 72 % → #bcd9ec 88 % → #d9e9f4 100 %`). | `.search-world` |
| F4 | Intelligence-Deck **unten verankert** (`top: auto; bottom: clamp(230px, 32vh, 360px)`) + feste Höhe `clamp(300px, 36vh, 440px)`, damit die prozentual positionierten Kinder einen Koordinatenraum haben. Fade startet aus der blauen Zone. | `.search-world__intelligence`, `.search-world__fade` |

Bewusst **nicht** geändert: Suchlogik, Ergebnisdarstellung, Karten-Styles, Texte,
Formularfelder, API, ATS, CV, Login/Registrierung, Hero, Navbar, Footer-Logik,
Layer-Reihenfolge (z-index), Bild-Asset.

## 4. Nachher-Messung (identische Punkte, Pixelanalyse)

| Zone | vorher idle → results | nachher idle → results |
|---|---|---|
| Atrium Reflexion (y=700) | L 115/S 46 % → L 122/S 43 % | **L 83/S 66 % → L 83/S 66 %** (kräftiger, state-unabhängig) |
| Bild-Unterkante (y=1000) | — | **L 82/S 70 % → L 82/S 70 %** |
| unter Bild (y=1150) | L 228/S 17 % → L 231/S 15 % | L 228/S 15 % → L 228/S 15 % |
| Deck-Zone (y=1300) | L 231/S 11 % → L 226/S 15 % | **L 216/S 19 % → L 222/S 17 %** |
| Bodenzone (y=1450) | L 246/S 3 % | **L 233/S 10 % → L 216/S 19 %** |

Ergebnis: Das Atrium ist jetzt **kräftiger** (S 43–46 % → 66 %) und **in beiden
Zuständen identisch** — genau die geforderte Invariante „Future-Welt bleibt nach der
Suche erhalten". Die untere Zone ist ruhiges Blau statt weißer Schleier.

## 5. Sichtprüfung
- **Desktop Leerzustand** und **Desktop mit Ergebnissen**: kräftiges Atrium in beiden
  Fällen, AI · JOBS → INTELLIGENCE sowie MATCH/ATS/PROFILE/SKILLS sichtbar
  (6/6 Labels mit Höhe > 0 gemessen), Bodenbogen sichtbar, kein weißes Loch.
- **Tablet 834×1112**: Section 1674 px, Bild 845 px, Deck 400 px, Boden 122 px,
  0 px Überbreite, 0 JS-Errors.
- **Mobile 390×844**: Section 1724 px, Bild 523 px, Deck 304 px, Boden 76 px,
  Deko wie vorgesehen reduziert, 0 px Überbreite, 0 JS-Errors.
- Suchkarten in allen Zuständen opak (kein Transparenz-Pendant im Ergebniszustand).

## 6. Tests / Build
- Bestehende Regressionstests unverändert gültig: `npx tsc -b` PASS,
  `npm test` **714 passed / 5 skipped / 0 failed**, `npm run build` PASS.
- Keine Testanpassung nötig, da keine Struktur- oder Logikänderung erfolgte.

## 7. Offen / Empfehlung
- Die Bildhöhe ist weiterhin bewusst gedeckelt (Schutz vor Über-Zoom bei sehr langen
  Ergebnislisten). Falls die Atrium-Welt bei sehr langen Listen noch tiefer wirken
  soll, ist das eine bewusste Design-Entscheidung (Höhe/Deckel), kein Bug.
- Animationen bleiben ein separater Task.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE (Ursache gemessen und behoben; Invariante „Welt bleibt nach Suche
  erhalten" jetzt messbar erfüllt)
- Zeitpunkt: 2026-10-05; Branch: main; HEAD: `42da25b` (Commit offen — Freigabe ausstehend)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 714/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (nur `.search-world`-Layer), dieser Report
- Geänderte Tests: keine
- Risiken: gering (reine Darstellung; Sättigungs-/Höhenwerte per CSS justierbar)
- Nächste Schritte: Commit erst nach Freigabe (Working Agreement: keine Commits ohne
  ausdrückliche Zustimmung)
- Resume-Punkt: Analyse + Fix abgeschlossen, Report geschrieben, Commit offen

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — Audit und Fix betreffen ausschließlich CSS-Darstellung (Hintergrundfarben,
Verlaufsbezug, Layer-Verankerung). Keine AI-Anfrage, keine Datenverarbeitung, keine
Persistenz, keine API-/Datenfluss-Änderung, keine Consent-Relevanz. Keine
AI-Audit-Ergänzung erzeugt.
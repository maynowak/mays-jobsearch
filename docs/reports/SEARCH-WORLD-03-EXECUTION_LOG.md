# SEARCH-WORLD-03 — Drei vertikale Intelligence Columns (AI / MATCH / ATS)

## Status
DONE (rein statische Visualisierung; KEINE Animation, keine Logik-/API-Änderung)

## 1. Ausgangslage
- Search World bestand aus: Hero → Portal-Light → Atrium (Search-UI vorn) →
  Intelligence Deck (dekorative Labels) → halbrunder Boden → Fade → Footer.
- Die Verbindung Deck → Boden war flach: nur ein Farbverlauf, keine Architektur.

## 2. Drei Intelligence Columns

Neue Markup-Struktur in `src/App.tsx` (ein Container, drei Spans — keine neue
Komponentenhierarchie, keine neue Datei):

```jsx
<div className="search-world__columns" aria-hidden="true">
  <span className="intelligence-column intelligence-column--ai">AI</span>
  <span className="intelligence-column intelligence-column--match">MATCH</span>
  <span className="intelligence-column intelligence-column--ats">ATS</span>
</div>
```

- **Genau drei** Säulen, Breite `clamp(74px, 8.5vw, 132px)`, gleich hoch
  (`align-items: stretch`), Abstand via `justify-content: space-around` +
  `gap: clamp(16px, 4vw, 64px)`.
- **Zuordnung** (gemessen): `--ai` → „AI", `--match` → „MATCH", `--ats` → „ATS".

## 3. Optik: transparentes Glas statt Masse
- `background`: Weiß → Cyan/Blau-Verlauf (alpha 0.34 → 0.06), **kein** 3D-Körper.
- `border: 1px solid rgba(125,211,252,0.34)` mit `border-bottom: 0`,
  `border-radius: 16px 16px 0 0` → keine geschlossene Box, kein Sockel.
- `box-shadow`: weicher Glow + zwei `inset`-Lichtkanten (Glas-Kante).
- `opacity: 0.72` (Desktop) — dezent genug, um nie mit der UI zu konkurrieren.
- Beschriftung klein, technisch, elegant: `clamp(0.58rem, 0.85vw, 0.7rem)`,
  `letter-spacing: 0.3em`, uppercase, Farbe `rgba(11,92,122,0.62)` — gleiche
  Sprache wie die bestehenden INTELLIGENCE/JOBS/PROFILE/SKILLS-Labels.

## 4. Innere Datenstruktur (abstrakt, keine Daten)
- `::before`: vertikale Lichtspur + feine horizontale Linien
  (`repeating-linear-gradient`, 18-px-Raster).
- `::after`: vier Radial-Punkte als geometrische Verbindungen
  (z. B. `circle at 50% 30%`), bewusst ohne Zahlen, Namen, Kennzahlen oder
  Jobdaten.

## 5. Übergang in den Boden (kein harter Schnitt)
- Columns-Box: `bottom: clamp(140px, 22vh, 230px)`,
  `height: clamp(360px, 46vh, 560px)`. Die Boden-Oberkante liegt desktop bei
  ~216 px, das Columns-Ende bei ~198 px → die Säulen enden **innerhalb** der
  Bodenzone.
- `mask-image: linear-gradient(180deg, #000 0 56%, rgba(0,0,0,0.4) 80%, transparent 100%)`
  → unteres Einschmelzen, keine harte Unterkante.
- `.search-world__columns::after`: elliptischer Reflexionssee
  (`radial-gradient`, rgba(34,211,238,0.16)) dort, wo die Säulen auf den Boden
  treffen.
- **Verifikation:** `columnsStartInDeck: true` und `columnsReachFloor: true` in
  allen vier geprüften Zuständen (Desktop, Desktop+Ergebnisse, Tablet, Mobile).

## 6. Layering (exakt wie vorgegeben, per Browser-Messung bestätigt)

| Layer | z-index |
|---|---|
| `.search-world__background` | 0 |
| `.search-world::before` (Background-Overlays) | 1 |
| `.search-world__top-light` | 2 |
| **`.search-world__columns` (neu)** | **3** |
| `.search-world__intelligence` (Deck) | 4 |
| `.search-world__floor` (Boden) | 5 |
| `.search-world__fade` | 6 |
| `.search-world__content` (Search UI) | 10 |

Anpassungen nur an den drei bestehenden Deko-Layern (Deck 3→4, Boden 4→5,
Fade 5→6). Die Search-UI blieb unverändert bei 10.

## 7. Verhältnis zum Intelligence Deck
- Der Deck bleibt vollständig erhalten: **alle 7 bisherigen Labels** weiterhin
  vorhanden (Desktop gemessen: 7/7 — AI, JOBS, INTELLIGENCE, MATCH, ATS,
  PROFILE, SKILLS). Nichts entfernt.
- Die Columns ergänzen die bisherige Ebene um vertikale Architektur:
  AI → KI/Intelligence, MATCH → Job-Matching, ATS → ATS-Bewertung.

## 8. Sichtachse frei / UI dominant
- Desktop: Columns-Box beginnt bei x=518 px, die Suchkarte endet bei x=488 px →
  **keine Überlappung** (`columnsBehindCard: false`).
- Tablet/Mobile (Einspalten-Layout): Columns starten vertical **unterhalb** der
  Suchkarte (Tablet 1367 px vs. Kartenende 1254 px; Mobile 1588 px vs. 1308 px).
  Sie liegen dort hinter dem transparenten Ergebnis-Container, nie vor der
  Suchkarte; alle Karten bleiben opak (`uiOpaque: true`).

## 9. Responsive (gemessen, Chromium)

| Viewport | Column-Breite | Opacity | Höhe | Innendetails | Überbreite |
|---|---|---|---|---|---|
| Desktop 1440×900 | 122 px | 0.72 | 414 px | vollständig | 0 px |
| Desktop + Ergebnisse | 122 px | 0.72 | 414 px | vollständig | 0 px |
| Tablet 834×1112 | 58 px | 0.50 | 440 px | Punkte aus (`::after` off) | 0 px |
| Mobile 390×844 | 51 px | 0.38 | 270 px | Punkte + Reflexionssee aus, engere Spur | 0 px |

Auf allen Größen bleiben **drei** Columns vorhanden (nur schmaler/transparenter).

## 10. Bewusst NICHT implementiert (separater Task SEARCH-WORLD-04)
Scroll-Parallax, Scroll-driven transforms, Pulsieren, wanderndes Licht,
Partikelbewegung, animierte AI-Panels, jede Form von Animation.
**Verifiziert:** `animation-name: none` an allen drei Columns, keine
`@keyframes`, keine Transitions im neuen Bereich.

## 11. Nicht verändert (Scope-Schutz)
Hero, Portal-Light, Search UI, Search Fields, Search API, Results-Darstellung,
CV, ATS-Logik, Notifications-Logik, Login, Registrierung, Cognito, RIS,
Platform API, Offers, Entitlements, Datenmodell, Footer-Funktion, Screenshots,
bestehende Search-World-Struktur (Layer und Inhalte bleiben, nur z-index-Nummer
der drei Deko-Layer angepasst).

## 12. Tests / Build
- Keine Testanpassung nötig (rein deklarativ, keine Struktur-/Logikänderung).
- `npx tsc -b` PASS; `npm test` **714 passed / 5 skipped / 0 failed**;
  `npm run build` PASS.
- Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): 3 Columns, Labels korrekt, z-index 0/1/2/3/4/5/6/10, Deck→Floor
  überbrückt, `columnsBehindCard: false` (Desktop), 0 JS-Errors, Screenshots
  Desktop / Desktop+Ergebnisse / Tablet / Mobile geprüft.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; HEAD: `e7c69bb` (Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 714/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/App.tsx` (3 dekorative Elemente), `src/styles.css`
  (Columns-CSS + z-index-Nummerierung), dieser Report
- Geänderte Tests: keine
- Risiken: gering (reine Darstellung; Opacity/Breiten per CSS justierbar)
- Nächste Schritte: Bewegung/Animation als SEARCH-WORLD-04 (bewusst offen)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — rein dekoratives CSS/Markup. Die Begriffe AI/MATCH/ATS sind **reine
Atmosphären-Labels ohne Datenbezug**: keine echten Scores, keine Kennzahlen, keine
Jobdaten, keine API-Anbindung, keine Klickhandler (Container `aria-hidden`,
`pointer-events: none`). Keine Änderung am AI-Datenfluss, an der KI-Ausführung oder
an der Datenspeicherung. Keine AI-Audit-Ergänzung erzeugt.

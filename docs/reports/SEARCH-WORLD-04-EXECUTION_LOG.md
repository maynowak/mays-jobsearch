# SEARCH-WORLD-04 — Scroll Motion für Intelligence Deck und Columns

## Status
DONE (scroll-driven, rein dekorativ; keine Logik-/API-Änderung)

## 1. Ausgangszustand
- SEARCH-WORLD-03 hatte eine vollständige, rein **statische** Komposition:
  Hero → Portal-Light → Atrium → Intelligence Deck → Columns (AI/MATCH/ATS) →
  Boden → Fade → Footer.
- Keine Bewegung; `--sw-progress` existierte nicht; keine Reduced-Motion-Regel im Projekt.

## 2. Gewählte Motion-Technik (begründet)
**Custom Property + rAF-gedrosselter Listener** — bewusst *keine*
Scroll-Driven-Animation-API (`animation-timeline: view()`):

| Kriterium | gewählte Lösung |
|---|---|
| Browser-Support | einheitlich (Chrome/Safari/Firefox), keine Feature-Detection-Abhängigkeit |
| React-Kosten | **kein State, kein Re-Render** — es wird nur eine CSS-Property am DOM-Element geschrieben |
| Lifecycle | ein passiver `scroll`-Listener + `resize`, Cleanup beim Unmount/Route-Wechsel |
| Reduced Motion | Listener schibt nichts + CSS neutralisiert alles |
| Testing | Fortschritts-Berechnung als reine, DOM-freie Funktion direkt testbar |

Neue Dateien:
- `src/lib/searchWorldScroll.ts` — `computeSearchWorldProgress()` (rein, geklemmt 0…1)
- `src/hooks/useSearchWorldMotion.ts` — Listener-Lifecycle, schreibt `--sw-progress`

Verdrahtung: `ref={searchWorldRef}` an `.search-world` (`App.tsx`), Ref-Callback-Hook
`useSearchWorldMotion()`.

## 3. Scroll-Bereich
`progress = (scrollY + viewportHeight − worldTop) / (viewportHeight + worldHeight)`, geklemmt auf 0…1.
- **0**, sobald die Search World gerade in den Viewport eintritt (vorher keine Bewegung).
- **1**, sobald sie den Viewport vollständig verlassen hat (danach statisch).
- Gemessen: `--sw-progress` 0.2695 → 0.6583 über die gesamte Seitendurchfahrt
  (maxScroll 847 px) — Bewegung ist auf den Search-World-Bereich begrenzt, das
  Dokument wird **nicht** global animiert. Der Footer selbst bewegt sich nicht.

## 4. Background Motion
`transform: translate3d(0, calc(var(--sw-progress) * −18px), 0) scale(1.06)`,
`transform-origin: center top`.
- Amplitude klein (gemessen −4.9 px → −11.8 px über die volle Durchfahrt).
- **`scale(1.06)` verhindert einen neuen Bildrand**: das Layer hat ~20 % Überstand an
  oben/unten, die Verschiebung bleibt innerhalb dieses Überstands. Visuell geprüft
  (Screenshots oben/unten): keine neue Kante, kein Spalt.

## 5. Column Motion (differenziert)
| Column | Faktor | gemessene Bewegung |
|---|---|---|
| AI | −24 px | −6.5 px → −15.8 px |
| MATCH | −14 px | −3.8 px → −9.2 px |
| ATS | −8 px | −2.2 px → −5.3 px |

AI am stärksten/frühesten, ATS am schwächsten/spätesten → Tiefegefühl. Keine Rotation,
keine Skalierung, keine 3D-Transformationen. Alle innerhalb der geforderten 8–24 px
(eine rel. Bewegung von max. 24 px wird nur am Progress-Ende erreicht).

## 6. Deck Motion
`translate3d(0, calc(var(--sw-progress) * −10px), 0)` + `opacity: calc(0.88 + progress * 0.12)`
(0.88 → 1.0). Gemessen −2.7 px → −6.6 px. Kein „Herausspringen", keine Blur-Kosten.

## 7. Floor Motion
`translate3d(0, calc(var(--sw-progress) * −6px), 0)` — langsame räumliche Reaktion
(−1.6 px → −3.9 px). **Keine** Skalierung, **keine** Rotation; die Bogenform bleibt
unverändert.

## 8. Label Motion
Chips −6 px, Micro-Labels −4 px, INTELLIGENCE-Label −8 px — „sehr leichte zusätzliche
Tiefe", unterschiedlich, rein dekorativ. Keine neuen Labels, keine Daten.

## 9. Visuelle Grenzen (alle geprüft)
- **Search UI bleibt stabil:** `.search-card` bewegt sich exakt 1:1 mit dem Scroll
  (gemessen 356 px → −491 px bei maxScroll 847 px = genau der Scrollweg), **kein
  zusätzlicher Transform**. Header/Footer ebenfalls unverändert.
- **Kein Layout-Shift:** `document.scrollHeight` konstant 1747 px über alle
  Scrollstufen; alle Bewegungen ausschließlich `transform`/`opacity`.
- **Keine horizontale Überbreite:** 0 px auf Desktop, Tablet und Mobile.
- **Keine verdeckten Cards**, Boden nicht aus dem Viewport gedrängt, UI-Controls
  bleiben bedienbar (kein `pointer-events`-Eingriff, nur Deko-Layer).

## 10. Reduced Motion
`@media (prefers-reduced-motion: reduce)` setzt `transform: none !important` auf allen
bewegten Layern und `opacity: 1 !important` auf dem Deck. Zusätzlich schreibt der
Hook bei gesetztem Reduced-Motion **gar keine** Property.
Browser-Verifiziert (`reducedMotion: 'reduce'`): `--sw-progress` leer,
`transform: none` für Background/Columns/Deck/Boden, Deck-Opacity 1 — die statische
SEARCH-WORLD-03-Darstellung bleibt vollständig erhalten.

## 11. Mobile
Amplituden auf ~40 % reduziert (eigener Media-Block): Background −7 px,
AI −10 px, MATCH −6 px, ATS −3 px, Deck −4 px, Boden −3 px.
Gemessen bei `progress = 0.4466`: Background −3.1 px, AI −4.5 px, MATCH −2.7 px,
ATS −1.3 px; 0 px Überbreite; Suchkarte bewegt sich nur mit dem Scroll.

## 12. Performance-Entscheidungen
- **Kein** `setState` pro Scroll-Event, **kein** Re-Rendering der App.
- Pro Frame höchstens **ein** rAF-Callback (`frameRef`-Guard gegen Mehrfachplanung).
- Pro Update: **eine** `getBoundingClientRect`-Messung + **ein** Property-Write.
- Nur `transform` und `opacity` → kein Layout-Reflow durch die Motion selbst.
- Kein Canvas, kein WebGL, keine Animations-Library, keine neue Dependency,
  keine IntersectionObserver-Kaskade.

## 13. Keine automatische Animation
Es wurde **keine** `@keyframes`, keine `infinite`-Animation, kein Pulsieren und kein
Floating ergänzt. Die Bewegung entsteht ausschließlich aus der Scroll-Position.
(Im Projekt existierende `@keyframes` betreffen nur das vorbestehende Navbar-Menü und
wurden nicht angefasst.)

## 14. Tests
- `src/lib/searchWorldScroll.test.ts` (5 Tests): 0 vor dem Eintritt, 1 nach dem
  Austritt, ~0.5 bei halber Durchfahrt, monoton über 30 Scroll-Stufen, Klemmung
  außerhalb, robuste Behandlung von `worldHeight = 0` und `NaN`.
- `src/hooks/useSearchWorldMotion.test.tsx` (3 Tests): Property wird beim Scroll
  geschrieben (exakter Wert 0.4286), bei `prefers-reduced-motion` **nicht**
  geschrieben, Scroll-Listener wird beim Unmount mit demselben Handler entfernt.
- Bestehende Tests unverändert: **722 passed / 5 skipped / 0 failed** (vorher 714,
  +8 neue). `npx tsc -b` PASS, `npm run build` PASS.
- Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): 0 %, 25 %, 50 %, 75 %, Ende, wieder nach oben (Reversibilität),
  Reduced Motion, Mobile; Screenshots geprüft; 0 JS-Errors.

## 15. Nebenaufgabe (Label)
Auf ausdrücklichen Wunsch: sichtbare Beschriftung in `src/components/LandingPage2.tsx`
von „Prototype Landingpage 2" → **„Landingpage"** (DE und EN).
Nicht geändert: das `aria-label="Landingpage 2"` der Navbar (Zeile 99) — es ist kein
sichtbares Label und wurde nicht beauftragt; Entscheidung liegt beim Product Owner.

## 16. Nicht verändert (Scope-Schutz)
Search-Logik, Search-API, Results-Darstellung, CV, ATS-Logik, Notifications-Logik,
Login, Registrierung, Cognito, RIS, Platform API, Offers, Entitlements,
Datenmodell, Footer-Funktion, Hero, Portal-Light, Screenshots, Referenzassets.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; HEAD: `3742801` (Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 722/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/lib/searchWorldScroll.ts` (neu),
  `src/hooks/useSearchWorldMotion.ts` (neu), + 2 Testdateien (neu),
  `src/App.tsx` (Import + Hook + Ref), `src/styles.css` (Motion + Reduced Motion),
  `src/components/LandingPage2.tsx` (Label), dieser Report
- Geänderte Bestandstests: keine
- Risiken: gering (reine Darstellung). Ein `getBoundingClientRect`-Read pro Frame ist
  die einzige Messung — bewusst gewählt für korrekte Werte bei wechselnder
  Section-Höhe (z. B. nach Ergebnissen).
- Nächste Schritte: keine (Animationen außerhalb dieses Scopes wurden nicht begonnen)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — die Änderung betrifft ausschließlich Scroll-Motion von Deko-Layern
(`transform`/`opacity`) sowie ein sichtbares Textlabel. Keine Änderung an
KI-Ausführung, Datenverarbeitung, Persistenz, API, Auth oder Consent. Die
bewegten Layer sind `aria-hidden` und tragen keine Daten. Keine AI-Audit-Ergänzung
erzeugt.

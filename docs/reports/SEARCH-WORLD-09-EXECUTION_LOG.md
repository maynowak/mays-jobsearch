# SEARCH-WORLD-09 — Halbrundes Podium hinter/unter dem Footer als letzter Abschluss

## Status
DONE (ausschließlich räumliche Anordnung und Layering bestehender Deko-Elemente;
keine Logik-, API-, Daten- oder Farbänderung)

## 1. Ausgangsgeometrie (gemessen, vor der Änderung)
Viewport 1440×900, Zustand „12 Results". Werte aus dem Browser, nicht geschätzt:

| Element | Ist-Wert |
|---|---|
| Search World (Top / Höhe) | 332 / **2825** |
| **untere World** (Columns-Beginn → Footer-Top) | **684** |
| Columns | 2474 – 2726 (252) |
| Deck | 2724 – 2949 (225) |
| **Floor (letztes Kind der World)** | 2950 – 3031 (**81**) |
| Fade | 3032 – 3158 (126) |
| Footer | 3158 – 3323 (165) |
| Dokumenthöhe | 3323 |
| z-index Footer / Floor | `auto` / `5` |

Mobile 390×844: untere World **481**, Floor 4496 – 4572 (76), Fade 4572 – 4656 (84),
Footer 4656 – 4864 (208), Dokumenthöhoe 4864.

## 2. Ausgangslage und Ursachen
1. **Das Podium war kein Abschluss.** Der Floor war letztes Kind der `.search-world`,
   der Fade lag mit `z-index: 6` **darüber** — der untere Teil der Kuppel wurde
   vom Fade weichgezeichnet und las sich nie als eigene Form.
2. **Der Footer stand davor.** Kettenreihenfolge war … Deck → Floor → Fade → Footer,
   die Seite endete mit der Fußzeile statt mit dem Podium.
3. **Die World clippt.** `.search-world` hat `overflow: hidden` + `isolation: isolate`,
   das Podium konnte die World also nicht verlassen, ohne abgeschnitten zu werden.
4. **`--sw-progress` lebt auf der World.** `useSearchWorldMotion` schreibt die
   Custom Property ausschließlich auf `.search-world` (Element, nicht Dokument).

## 3. Änderungen (minimal, wiederverwendend — kein neues Element, keine neue Klasse)
| Datei | Änderung |
|---|---|
| `src/App.tsx` | Das **bestehende** `<div className="search-world__floor" aria-hidden="true" />` aus `.search-world` herausgenommen und direkt hinter `<Footer />` wieder eingefügt — gated über `showsSearchWorld`, dieselbe Bedingung wie der World-Zweig. Dieselbe Klasse, dieselbe Markup-Form, kein SVG, keine neue Komponente, keine neue Grafik. |
| `src/styles.css` | `.footer`: `position: relative; z-index: 1` (eigener Stacking-Kontext **über** dem Podium). |
| `src/styles.css` | `.search-world__floor`: `z-index: 5 → 0`, `width: calc(100% + 4%) → 100%`, `margin: 0 -2% → 0`, neu `margin-top: calc(-1 * clamp(24px, 4vh, 44px))`. Mobile-Block: `width: calc(100% + 10%) → 100%`, `margin: 0 -5%` entfernt. |
| `src/SearchLayout.test.tsx` | 4 bestehende Invarianten auf die neue Reihenfolge umgestellt (Floor nicht mehr in der World, Floor **nach** Footer, Floor nicht mehr Teil des SW-05-Weltflusses) + **1** neuer SW-09-Test. |

**Bewusst nicht gemacht:** keine neue SVG/Illustration, keine 3D-Darstellung, keine
Farb- oder Gradientenänderung, keine Animation, kein Umbau des Footers, keine Änderung
an `useSearchWorldMotion`, `MatchCard`, `Results` oder der Sidebar.

## 4. Warum `width: 100%` statt des bisherigen Überstands
Die Kuppel entsteht aus `::before`/`::after` mit `inset: 0` — sie füllt die Box
**exakt**. Der Überstand `width: calc(100% + 4%)` bei `margin: 0 -2%` lag daher
nie sichtbar im Bild: er wurde von `overflow: hidden` der World vollständig
abgeschnitten, die sichtbare Kuppel war schon damals exakt viewport-breit
(gemessen vorher: Box `l = −29`, `w = 1498` bei 1440 px, sichtbar 0 → 1440).

Außerhalb der World wäre derselbe Überstand echter Overflow. Gemessen mit
unverändertem Überstand: **29 px @1440**, **20 px @390**, **38 px @1920**.

Mit `width: 100%` ist das Bild identisch und der Overflow deterministisch 0
(gemessen: Podium `l = 0`, `r = 1440`, exakt Viewportbreite, `overflowX = 0` in
allen 8 Zuständen). Kein Feature-Verlust, keine Rundungs-Kante, kein neuer Bug.

## 5. Neue Geometrie (gemessen, Zustand „12 Results")
| Zustand / Viewport | untere World | Footer | Podium (Top – Bottom) | Höhe | Überlappung | Rest hinter Podium | Overflow | JS-Errors |
|---|---|---|---|---|---|---|---|---|
| A idle @1440 | 603 | 1912 – 2077 | 2041 – 2122 | 81 | **true** | 0 | 0 | 0 |
| B 3 Results @1440 | 603 | 2242 – 2408 | 2372 – 2453 | 81 | **true** | 0 | 0 | 0 |
| C 12 Results @1440 | **603** | 3077 – 3242 | 3206 – 3287 | 81 | **true** | 0 | 0 | 0 |
| C @1920 | 723 | 3205 – 3371 | 3328 – 3425 | 97 | **true** | 0 | 0 | 0 |
| C @1280 | 536 | 3005 – 3171 | 3139 – 3211 | 72 | **true** | 0 | 0 | 0 |
| C @1024 | 527 | 3115 – 3281 | 3250 – 3319 | 69 | **true** | 0 | 0 | 0 |
| C Tablet 834 | 622 | 4084 – 4271 | 4227 – 4316 | 89 | **true** | 0 | 0 | 0 |
| C Mobile 390 | 406 | 4581 – 4788 | 4754 – 4830 | 76 | **true** | 0 | 0 | 0 |

- **Untere World 684 → 603** bei 1440 px: exakt −81 px, also exakt die Höhe, die
  das Podium als World-Kind belegte. Die World wird dadurch **nicht** größer.
- **Mobile 481 → 406** (−75 px, exakt die dortige Podiumhöhe).
- **Dokumenthöhe 1440/12 Results: 3323 → 3287** (−36 px) und **Mobile 4864 → 4830**
  (−34 px): die Seite wird durch das negative `margin-top` sogar minimal kürzer,
  es entsteht **kein zusätzlicher Leerraum** am Seitenende.
- `rest hinter Podium = 0` in allen Zuständen: die Seite endet exakt mit der
  Podium-Unterkante, kein nachlaufender weißer Block.

## 6. Layering: Footer über Podium, Podium hinten ✅
| Prüfung | Erwartung | Ist |
|---|---|---|
| DOM-Reihenfolge | Fade → **Footer → Podium** | ✅ in allen 8 Zuständen |
| Podium in `.search-world` | nein | ✅ `false` |
| z-index Footer > Podium | ja | ✅ `1` > `0` |
| `pointer-events` Podium | `none` | ✅ `none` |
| `aria-hidden` Podium | `true` | ✅ `true` |
| Überlappung Footer/Podium | gewünscht | ✅ `true` (auch mobil) |
| z-index Podium | untere Deko-Ebene | ✅ `0` |

Überlappungstiefe = negatives `margin-top`, viewport-abhängig kompakt:
**−36 px** @1440, −43 @1920, −32 @1280, −31 @1024, −44 Tablet, −34 Mobile.
Der Footer drängt das Podium nicht weg (er bleibt im eigenen Fluss, nur darüber
gezeichnet) — gewünschter Zustand `footerOverlapsPodium = true` und
`podiumIsLastVisualLayer = true`.

## 7. Footer-Inhalt unverändert und vollständig lesbar
Footer-Text bleibt oberhalb der Podium-Oberkante (Zustand idle @1440):
letztes Footer-Element (`Version 2.0.0 …`) endet bei **2068**, Podium beginnt bei
**2084** — `textUeberPodium: false`. Die 36 px Überlappung liegt vollständig in der
unteren Footer-Padding-Zone, also im leeren Bereich unter dem Text, nicht auf Text
oder Links.

## 8. Sichtprüfung (Pixel, 1440 px, 12 Results)
| y | Mitte-RGB | Sättigung | Zone |
|---|---|---|---|
| 3037 | rgb(230, 241, 248) | max 18 | Fade-Ende → Footer |
| 3160 | rgb(248, 250, 252) | max 4 | Footer-Mitte (Textzone) |
| **3206** | **rgb(175, 239, 249)** | **max 74** | **Podium-Oberkante = Kuppel-Lichtkante** |
| 3233 | rgb(237, 246, 251) | max 46 | Podium-Dome 1/3 |
| 3286 | rgb(237, 244, 249) | max 13 | Seitenende (letzte Zeile) |

Die cyanfarbene Lichtkante der Kuppel ist exakt an der Box-Oberkante sichtbar
(Sättigung 74, an den geprüften Punkten deutlich höher als im Glasverlauf darunter),
der Glasverlauf läuft weich aus, die letzte Zeile ist **kein reines Weiß**
(`rgb(236, 243, 249)`, Sättigung 13). Vorher lag die Kuppel unter dem Fade und war
dadurch im unteren Bereich weichgezeichnet.

## 9. Entscheidung: Podium als statischer Abschluss (bewusst)
`--sw-progress` wird **unverändert** nur auf `.search-world` gesetzt; der Hook ist
nicht angefasst. Die Floor-Transform-Formel bleibt als Formel im CSS bestehen, löst
außerhalb der World aber auf 0 auf — gemessen `matrix(1, 0, 0, 1, 0, 0)`.

Das ist beabsichtigt und kein Verlust: das Podium ist der ruhige Abschluss am
Ende der Seite; die Bewegungsebene der World (Background, AI/MATCH/ATS, Deck,
Labels) bleibt unverändert. Eine Scope-Erweiterung des Hooks auf `document.body`
wäre eine Verhaltensänderung und damit außerhalb dieses rein visuellen Tasks.

## 10. SW-05 Regression ✅ GREEN
Kettenreihenfolge 1440 px / 12 Results: Content → Results → Columns (2474) →
Deck (2724) → Fade (2951) → **Footer (3077)** → **Podium (3206)**.
Dokumentfluss unverändert, nichts section-verankert: `position: relative` und
**kein** `bottom:` für `search-world__floor` (neu als Test abgesichert),
`cols/deck/floorOverlapsCards = false` in allen 8 Messzuständen.

## 11. SW-06 Regression ✅ GREEN
`.results-workspace`: `background: rgba(0, 0, 0, 0)`, `border: 0px` — weiterhin
offen, keine gemeinsame Results-Box. MatchCard unverändert.

## 12. SW-07 Regression ✅ GREEN
`.container.layout-search` **1400 px**, Sidebar **360 px**, Results **968 px**,
MatchCard **968 px**. SW-07 nicht angetastet.

## 13. SW-04 Regression ✅ GREEN
| Scrollposition | `--sw-progress` | AI | MATCH | ATS |
|---|---|---|---|---|
| top | 0.1558 | −4 | −2 | −1 |
| Mitte | 0.6069 | **−15** | **−8** | **−5** |
| bottom | 0.8108 | **−19** | **−11** | **−6** |

Custom Property wird weiterhin gesetzt und ist messbar; AI > MATCH > ATS bleibt
differenziert. Background-Transform aktiv (`scale(1.06)`, translate −10.9 px).
**Reduced Motion**: AI `none`, Deck `none`, Podium `none`, Podium weiterhin
vorhanden — Deko bleibt vollständig statisch.

## 14. SW-08 Regression ✅ GREEN
AI / MATCH / ATS x-Mitte bei 1440 px: **585 / 720 / 855** → Gruppenmitte **720** =
Viewportmitte, Offset **0**. Höhen der World unverändert (Columns 252, Deck 225,
Fade 126, Podium 81 @1440). Die Kompaktheit aus SW-08 bleibt erhalten.

## 15. BG-STATE-01 Regression ✅ GREEN
Background-Layer unangetastet (Position, Größe, `background-size`, `::before`-Overlay);
es wurde **keine** hellere Fläche, kein Gradient, keine Opacity-Lösung eingeführt.
Die untere World wurde nicht nachgebessert, sondern das Podium ist aus ihr
herausgenommen — der Hintergrund selbst bleibt unangetastet.

## 16. Nicht-Search-Routen ✅ GREEN
`landing`, `login`, `register`, `impressum`: jeweils **0** Podium, **0** `.search-world`,
0 JS-Errors. Das Podium existiert ausschließlich dort, wo es die Search World gibt
(`showsSearchWorld`), inklusive Landing-mit-Suche (`route === "landing"` und
`isSearching`).

## 17. Tests / TSC / Build / Browser
- `src/SearchLayout.test.tsx`: **1 Test ergänzt** — „SEARCH-WORLD-09: Halbrundes
  Podium liegt als letzter Abschluss hinter dem Footer": Fade → Footer → Podium,
  Podium nicht mehr in der World, `z-index(footer) > z-index(floor)`,
  `pointer-events: none`, negatives `margin-top`, `width: 100%` ohne `calc()`.
  Bewusst **ein** Test, keine künstliche Erhöhung der Zahl.
- **727 passed / 5 skipped / 0 failed** (vorher 726).
- `npx tsc -b` PASS · `npm run build` PASS (nur die vorbestehende Chunk-Size-Warnung).
- Browser: **0 JS-Errors** in allen 8 Messzuständen, in den Regressionsläufen und
  auf allen vier Nicht-Search-Routen.

## 18. Scope — nicht verändert
`useSearchWorldMotion` · `searchWorldScroll` · `MatchCard` · `Results` · `Footer`-Markup,
-Text, Links und Navigation · Sidebar · Hintergrund-Layer · alle Farben und Verläufe ·
Columns/Deck/Fade-Maße · `landingpage2.css` · Screenshot-Dateien (vorbestehende
Diffs unangetastet) · keine API-, Daten-, Auth- oder KI-Änderung.

## 19. AWS / Terraform
Nicht anwendbar — keine Infrastrukturänderung. Keine AWS-/Terraform-Checks ausgeführt.

## 20. Git
Branch `main`, Ausgangs-HEAD `cb78b9a`. Geänderte Dateien: `src/App.tsx`,
`src/styles.css`, `src/SearchLayout.test.tsx`, dieser Report. Die vier
vorbestehenden Screenshot-Diffs wurden nicht angefasst und nicht mit committed.

## 21. Resume Point
Abgeschlossen. Keine weiteren SEARCH-WORLD-Änderungen in diesem Task.

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `cb78b9a`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 727/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/App.tsx` (bestehendes Podium-Element hinter den Footer
  verschoben, per `showsSearchWorld` auf die Search World begrenzt),
  `src/styles.css` (`.footer` `position: relative` + `z-index: 1`,
  `.search-world__floor` `z-index: 0`, `width: 100%`, negatives `margin-top`, Mobile-
  Überstand entfernt), `src/SearchLayout.test.tsx` (4 Invarianten umgestellt,
  1 neuer Test), dieser Report
- Risiken: gering (räumliche Anordnung dekorativer, `aria-hidden`-markierter Layer).
  Überbreite 0 px in allen 8 Zuständen/Viewports, Reihenfolge, Layering,
  Footer-Lesbarkeit, Nicht-Search-Routen, Reduced Motion und alle SW-04/05/06/07/08-
  Invarianten geprüft.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung
dokumentiert: **NEIN** — es wurde ausschließlich die räumliche Anordnung und das
Layering zweier bereits bestehender Deko-Elemente geändert. Keine Änderung an
KI-Ausführung, Modellnutzung, Provider, Datenverarbeitung, Persistenz, Tracking,
Auth oder API. `AI_AUDITLOG.md` bleibt daher unverändert.
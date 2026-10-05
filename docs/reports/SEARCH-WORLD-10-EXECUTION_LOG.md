# SEARCH-WORLD-10 — Finale Kompression der unteren Intelligence World

## Status
DONE (ausschließlich Höhen-/Abstandsparameter rein dekorativer Layer; keine
Struktur-, Logik-, API-, Daten- oder Farbänderung)

Gemäß `docs/AI_AUDITLOG.md` wird dieser Execution Log fortlaufend gepflegt und
enthält ausschließlich verifizierte Fakten.

## Audit-Metadaten
- Datum: 2026-10-05
- Branch: `main`
- Ausgangs-HEAD: `34472dc` (SEARCH-WORLD-09)
- Audit-Scope: rein visuelle Geometrie der unteren Future Intelligence World
- Terraform-Checks: **nicht anwendbar** (keine Infrastruktur, keine ausgeführt)
- Klassifikation gesamt: **GREEN**

## 1. Ausgangsgeometrie (gemessen, Zustand „12 Results")
Viewport 1440×900. Werte aus dem Browser, nicht geschätzt:

| Element | Ist-Wert |
|---|---|
| letzte Job Card, Bottom | 2373 |
| Content-Bottom | 2433 |
| Results → Columns | **101** (davon `margin-top` der Columns 40.5) |
| Columns-Höhe | **252** (28vh) |
| Columns → Deck | −2 (Sub-Pixel-Rundung, keine Card-Überlappung) |
| Deck-Höhe | **225** (25vh) |
| Deck → Footer (= Fade) | **128** |
| Fade-Höhe | **126** (14vh) |
| **untere World (Columns → Footer)** | **603** |
| **untere World inkl. Übergang (Card → Footer)** | **704** |
| Search-World-Box | 332 / 2744 |
| Footer | 3077 – 3242 (165) |
| Podium | 3206 – 3287 (81) |
| Dokumenthöhe | 3287 |

Weitere Viewports (untere World Columns → Footer): 1920 **723**, 1280 **536**,
1024 **527**, Tablet 834 **622**, Mobile 390 **406**.

## 2. Ursache der verbleibenden Überdimensionierung
Nach SW-08 war die World zwar um 36–44 % geschrumpft, die **Proportion** blieb aber
unverändert: die untere World war weiterhin **603 px hoch bei 1440 px** und damit
länger als die komplette Results-Liste in Zustand A (idle). Vier `vh`-Flächen
standen hintereinander:

| Fläche | Anteil an 603 px |
|---|---|
| Columns 252 | 42 % |
| Deck 225 | 37 % |
| Fade 126 | 21 % |

Dazu kam der Übergang Results → Columns mit 101 px. Die World las sich dadurch
noch als **zweite Hauptsektion** (eigene Etage mit 6 sichtbaren Etappen) statt als
Abschluss. Die eigentliche Search-/Results-Welt war bei 12 Results 2433 px hoch —
die Deko war mit 704 px fast ein Drittel davon.

Ursache war **ausschließlich Geometrie**: keine Overlay-Opacity, kein globales Weiß,
keine Gradient-Streckung, keine Hintergrund-Ebene war beteiligt (siehe §11).

## 3. Änderungen (11 Deklarationen, alle bestehende Parameter)
Nur Höhen und der Übergangsabstand der bereits vorhandenen Intelligence-World-Parameter.
Keine neuen Elemente, keine Grafik, keine Farbe, keine Animation.

| Element | Basis (Desktop) | Tablet ≤900 | Mobile ≤560 |
|---|---|---|---|
| `.search-world__columns` height | 28vh/340 → **23vh/300** (min 220→190) | 22vh/280 → **19vh/240** (min 190→165) | 20vh/220 → **17vh/195** (min 160→140) |
| `.search-world__columns` margin-top | 4.5vh/56 → **3vh/40** (min 28→22) | 4vh/48 → **2.8vh/34** (min 24→18) | 3.5vh/40 → **2.6vh/30** (min 20→16) |
| `.search-world__intelligence` height | 25vh/300 → **21vh/260** (min 200→175) | 22vh/260 → **19vh/235** (min 180→160) | 18vh/210 → **16vh/190** (min 150→132) |
| `.search-world__fade` height | 14vh/168 → **11vh/140** (min 96→84) | 10vh/118 → **9vh/108** (min 72→68) | 8.5vh/104 → **7.5vh/96** (min 62→58) |

Kumulative Historie der Columns: 46vh/414 (SEARCH-WORLD-03) → 28vh/252 (SW-08) →
**23vh/207 (SW-10)**. Deck: 36vh/440 → 25vh/225 → **21vh/189**. Fade: 24vh/280 →
14vh/168 → **11vh/140**.

**Nicht angefasst:** `.search-world__floor` (Podium, komplett), `.footer`,
`.search-world__background`, `.search-world::before`, `useSearchWorldMotion`,
`useSearchWorldMotion`-Ampliuden, `.intelligence-column`-Optik, Deck-Kindelemente,
MatchCard, Results, Sidebar, alle Farben/Verläufe/Masken.

Zwei Stufen statt einer: Der erste Durchgang (Basis + Tablet + Mobile) erreichte
−17.9/−14.1/−13.8 %. Tablet und Mobile lagen damit knapp unter dem Zielband, und
auf Mobile sind außer den Glas-Panels ohnehin alle Deck-Kindelemente
`display: none` — der Rest der Etage war reiner Luftraum. Deshalb wurde dort nur
der **Fade** nachgezogen (9vh bzw. 7.5vh). Desktop blieb unangetastet, weil
−17.9 % bereits im Ziel lag.

## 4. Vorher / Nachher (gemessen, Zustand „12 Results")
| Zustand / Viewport | untere World (Cols→Footer) | Δ | inkl. Übergang (Card→Footer) | Δ | Results→Columns | Columns | Deck | Fade |
|---|---|---|---|---|---|---|---|---|
| A idle @1440 | 603 → **495** | **−17.9 %** | 644 → 522 | −18.9 % | 41 → 27 | 252 → **207** | 225 → **189** | 126 → **99** |
| B 3 Results @1440 | 603 → **495** | −17.9 % | 703 → 582 | −17.2 % | 100 → 87 | 252 → 207 | 225 → 189 | 126 → 99 |
| C 12 Results @1440 | 603 → **495** | −17.9 % | 704 → 582 | −17.3 % | 101 → **87** | 252 → 207 | 225 → 189 | 126 → 99 |
| C @1920 | 723 → **593** | −18.0 % | 832 → 686 | −17.5 % | 109 → 93 | 302 → 248 | 270 → 227 | 151 → 119 |
| C @1280 | 536 → **453** | −15.5 % | 632 → 537 | −15.0 % | 96 → 84 | 224 → 190 | 200 → 175 | 112 → 88 |
| C @1024 | 527 → **450** | −14.6 % | 622 → 533 | −14.3 % | 95 → 83 | 220 → 190 | 200 → 175 | 108 → 84 |
| C Tablet 834 | 622 → **523** | −15.9 % | 727 → 614 | −15.5 % | 105 → 91 | 245 → 211 | 245 → 211 | 133 → 100 |
| C Mobile 390 | 406 → **342** | −15.8 % | 495 → 424 | −14.3 % | 89 → 82 | 169 → 143 | 152 → 135 | 84 → 63 |

**Ergebnis: −14.6 % bis −18.0 %** (untere World), **−14.3 % bis −18.9 %** inklusive
Übergang. Alle Viewports im geforderten Korridor, kein Viewport über-komprimiert.

World-Box und Dokumenthöhe (Zustand C):
| Viewport | World-Höhe | Dokumenthöhe | Footer-Top | Podium |
|---|---|---|---|---|
| 1440 | 2744 → 2623 | 3287 → 3166 | 3077 → 2955 | 3206 → 3085 |
| 1920 | 2873 → 2727 | 3425 → 3279 | 3205 → 3059 | 3328 → 3182 |
| 1280 | 2673 → 2578 | 3211 → 3116 | 3005 → 2910 | 3139 → 3044 |
| 1024 | 2783 → 2693 | 3319 → 3229 | 3115 → 3026 | 3250 → 3160 |
| Tablet | 3761 → 3659 | 4316 → 4214 | 4084 → 3982 | 4227 → 4125 |
| Mobile | 4320 → 4258 | 4830 → 4768 | 4581 → 4518 | 4754 → 4692 |

Der Footer rückt um 62–146 px nach oben. `min-height: clamp(880px, 116vh, 1380px)`
der World greift in keinem Zustand (idle @1440: 1458 px > 1044 px) — die World
wächst rein aus Dokumenthöhe, kein Platzhalter.

## 5. Results → Columns (Ziel: klar wahrnehmbar, nicht verschwunden)
`margin-top` 40.5 → **27 px**; inklusive Container-Padding bleibt der Übergang bei
**87 px** (vorher 101). Gemessen: idle 41 → 27, 3 Results 100 → 87,
12 Results 101 → 87, 1920 109 → 93, Mobile 89 → 82. Der Atemraum bleibt deutlich
wahrnehmbar, das „riesige Leerfeld" aus der Vor-Ära (63 px eigene Etage plus
riesige World) ist nicht vorhanden. Untergrenze `clamp(22px, 3vh, 40px)` ist im
Test festgeschrieben, damit der Übergang nicht still verschwindet.

## 6. Columns (drei eigenständige Intelligence-Strukturen)
Höhe 252 → **207 px** (1440), 302 → 248 (1920), 245 → 211 (Tablet), 169 → 143 (Mobile).

Unverändert: dieselben drei Elemente, dieselbe zentrale Gruppierung, gleiche
visuelle Sprache, gleiche relative Differenzierung, gleiche Motion-Formeln.
Zentrierung nachgemessen (Gruppenmitten x, Soll = Viewportmitte):
1440 **585 / 720 / 855** (0), 1920 **804 / 960 / 1116** (0), 1280 520/640/760 (+1),
1024 416/512/608 (0), Tablet 336/417/498 (0), Mobile 135/195/255 (+1).

Die Säulen bleiben klar erkennbar — verifiziert über die Text-Boxen:
`AI`, `MATCH`, `ATS` liegen bei allen 6 Viewports vollständig innerhalb ihrer
Säule (`textInside: true`), Säulenhöhe 143–248 px, Label y 15–30 px ab Oberkante.

## 7. Deck-Clipping-Prüfung ✅ GREEN
Alle **14 sichtbaren Kindelemente** (15 im Markup, `particles` überlappt die Box
vollflächig) nach **jeder** Höhenänderung geometrisch geprüft, relativ zur
Deck-Box. Deck-Höhe 225 → 189 px @1440:

| Element | vorher y | nachher y | inside |
|---|---|---|---|
| chip--ai | 13–46 | 10–44 | ✅ |
| chip--jobs | 13–46 | 10–44 | ✅ |
| connector | 25–88 | 21–84 | ✅ |
| label (INTELLIGENCE) | 87–108 | 82–104 | ✅ |
| micro--match | 35–52 | 30–46 | ✅ |
| micro--ats | 67–84 | 56–73 | ✅ |
| micro--profile | 139–156 | 117–133 | ✅ |
| micro--skills | 148–165 | 124–141 | ✅ |
| panel--a | 77–149 | 64–136 | ✅ |
| panel--b | 104–185 | 87–168 | ✅ |
| panel--c | 167–168 | 140–141 | ✅ |
| panel--d | 117–180 | 98–161 | ✅ |
| lines | 27–147 | 23–143 | ✅ |
| particles | 0–225 | 0–189 | ✅ |

`deckClipped = []` und `deckMissing = []` in **allen 8** Messzuständen. Tiefstes
Element `panel--b` bei 168/189 px = **89 %** der Box (Tablet 197/211 = 93 %,
1024 151/175 = 86 %) — es bleibt Reserve, das Deck ist nicht an seiner Untergrenze.
Alle Inhalte skalieren proportional mit, weil sie prozentual positioniert sind;
**kein Element entfernt, kein Label geändert**. `overflow: hidden` des Decks
bleibt unangetastet und greift in keinem Zustand.

## 8. Fade (weicher Übergang, kein weißes Loch)
Höhe 126 → **99 px** @1440 (151 → 119 @1920, 133 → 100 Tablet, 84 → 63 Mobile).
Verlauf unverändert (`transparent → #f0f6fb 82 % → #f8fafc 100 %`).

Nahtprüfung Pixel (letzte Fade-Zeile vs. erste Footer-Zeile):
| | letzte Fade-Zeile | erste Footer-Zeile | Stufe |
|---|---|---|---|
| vorher | rgb(248, 250, 252) | rgb(248, 250, 252) | **0** |
| nachher | rgb(248, 250, 252) | rgb(248, 250, 252) | **0** |

Kein weißes Loch, keine harte Linie, keine Änderung der Nahtqualität. Der größte
Zeilensprung im Bereich Fade + Anfang Footer liegt bei **36** — vor wie nach der
Änderung identisch, und er liegt in der Footer-Textzeile, nicht an der Grenze.
Das Seitenende ist in keinem Zustand reines Weiß (`istReinweiss` überall false).

## 9. Podium — UNVERÄNDERT ✅ GREEN
Vorher/Nachher-Vergleich der Computed Styles (Identitätsbeweis, nicht nur Diff):

| Eigenschaft | vorher | nachher |
|---|---|---|
| width / height | 1440px / 81px | 1440px / 81px |
| margin-top / margin-left | −36px / 0px | −36px / 0px |
| z-index / position | 0 / relative | 0 / relative |
| pointer-events | none | none |
| transform | matrix(1, 0, 0, 1, 0, 0) | matrix(1, 0, 0, 1, 0, 0) |
| `::before` / `::after` border-radius | 50% 50% 0 0 / 100% 100% 0 0 | identisch |

Podium-Höhe in allen 8 Zuständen unverändert (81 / 97 / 72 / 69 / 89 / 76 px),
Breite = Viewportbreite, `left = 0`. Im Diff von `src/styles.css` kommt **keine
Zeile** mit `search-world__floor` vor. Die Footer-Beziehung bleibt: Podium hinter
Footer, `z-index` 1 > 0, Überlappung 129–174 px, `restAfterPodium = 0` in allen
Zuständen (die Seite endet exakt mit der Podium-Unterkante).

## 10. Footer — funktional und visuell unverändert
`z-index 1`, `position relative`, `padding 24px 20px 40px`, `font-size 14.08px`,
`color rgb(107, 98, 85)` — vorher wie nachher identisch. Text, Links,
Navigation und Inhalte unverändert. Nur die Position folgt der komprimierten
World (Footer-Top rückt 62–146 px nach oben).

## 11. BG-STATE-01 Regression ✅ GREEN
| Merkmal | vorher | nachher |
|---|---|---|
| `background-size` | cover, cover | cover, cover |
| `background-position` | 50% 0%, 50% 0% | identisch |
| Background-Opacity | 1 | 1 |
| Background-Box | 820 px hoch | 820 px hoch |
| `.search-world::before` Overlay-Farbe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) |
| `.search-world::before` Höhe | 270px | 270px |
| `.search-world` min-height / overflow | 1044px / hidden | identisch |
| Atrium-Zone links (L / S) | 125 / 28 % | **125 / 28 %** |
| Atrium-Zone rechts (L / S) | 158 / 62 % | **158 / 62 %** |

Keine Overlay-Opacity, kein globales Weiß, keine Gradient-Streckung, keine neue
Hintergrundebene. Die Kompression erfolgte **real über Geometrie**.

## 12. SW-05 Regression ✅ GREEN
Dokumentfluss unverändert, nichts section-verankert, keine dynamische
Platzhalterhöhe. Kettenreihenfolge @1440 / 12 Results:
Content → Results → Columns (2474 → 2348) → Deck → Fade → **Footer 2955** →
**Podium 3085**. `colsWithCards = false` und `deckWithCards = false` in allen 8
Zuständen. Alle vier unteren Layer sind `position: relative` **ohne** `bottom:`
(im Test festgeschrieben). `min-height` der World greift nirgends.

## 13. SW-06 Regression ✅ GREEN
`.results-workspace`: `background: rgba(0, 0, 0, 0)`, `border: 0px` — weiterhin
keine gemeinsame Results-Box, keine Änderung. MatchCard trägt die Optik
allein (968 px @1440, `cardsPerRow = 1`).

## 14. SW-07 Regression ✅ GREEN
`.container.layout-search` 1400 px unverändert, Sidebar **360 px** (Desktop),
MatchCard einspaltig (`cardsPerRow = 1`, `.match-list` `display: flex`,
`grid-template-columns: none`). Nichts angetastet.

## 15. SW-08 Regression ✅ GREEN
Gruppe zentral (siehe §6, Offset 0 bei 1440/1920/1024/Tablet), World-Höhe
unverändert proportional kompakter, Columns/Deck/Fade-Maße konsistent
proportional reduziert. Die Einheitlichkeit der drei Säulen bleibt.

## 16. SW-09 Regression ✅ GREEN
Footer vor Podium (`footerBeforePodium: true` in allen 8 Zuständen), Podium ganz
unten (`restAfterPodium = 0`), Podium hinter Footer
(`z-index` Footer 1 > Podium 0, `pointer-events: none`, `aria-hidden: true`),
Podium **nicht** Teil der World-Höhenberechnung
(`search-world .search-world__floor === null`, `floorInsideWorld: false`).
Identitätsbeweis der Computed Styles in §9.

## 17. SW-04 Regression ✅ GREEN
| Viewport | `--sw-progress` | AI | MATCH | ATS | Podium | Background |
|---|---|---|---|---|---|---|
| 1440 | 0.1611 → 0.8044 | **−19.3** | **−11.3** | **−6.4** | 0 | scale 1.06 / −14.48 |
| 1920 | 0.1964 → 0.7740 | −18.6 | −10.8 | −6.2 | 0 | scale 1.06 / −13.93 |
| Mobile | 0.1146 → 0.8834 | −8.8 | −5.3 | −2.7 | 0 | scale 1.03 / −6.18 |

`--sw-progress` besteht, AI > MATCH > ATS bleibt differenziert, Search-UI
transform-stabil (keine UI-Animation), **keine neue Animation**.
**Reduced Motion:** `--sw-progress` leer, alle Transforms `none`
(AI, Deck, Columns, Fade, Podium), Deko vollständig vorhanden.

## 18. Nicht-Search-Routen ✅ GREEN
`landing`, `login`, `register`, `impressum`: jeweils **0** Podium, **0**
`.search-world`, **0** Columns, 0 JS-Errors — identisch zu SW-09.

## 19. Tests / TSC / Build / Browser
- `src/SearchLayout.test.tsx`: **1 Test ergänzt** — „SEARCH-WORLD-10: untere
  World bleibt kompakt, Podium bleibt unberührt": die vier Stellschrauben
  (Columns-Höhe, Columns-Übergang, Deck-Höhe, Fade-Höhe) werden als Obergrenze
  (vh-Anteil und max) **und** Untergrenze festgeschrieben, der
  Results→Columns-Atemraum muss ≥ 22 px bleiben, nichts der unteren World darf
  `position: absolute` oder ein `bottom:` bekommen, und die Podium-Regel muss
  exakt auf dem SW-09-Stand bleiben (max 104 px, `width: 100%`, `z-index: 0`,
  negatives `margin-top`, `pointer-events: none`). Bewusst **ein** Test.
- **728 passed / 5 skipped / 0 failed** (vorher 727).
- `npx tsc -b` **PASS**.
- `npm run build` **PASS** (nur die vorbestehende Chunk-Size-Warnung).
- Browser: **0 JS-Errors** in allen 8 Messzuständen, im Reduced-Motion-Lauf und
  auf allen vier Nicht-Search-Routen.

## 20. Git
Branch `main`, Ausgangs-HEAD `34472dc`. Geänderte Dateien: `src/styles.css`
(11 Deklarationen in 6 Regeln), `src/SearchLayout.test.tsx` (1 Test), dieser
Report. Die vier vorbestehenden Screenshot-Diffs wurden nicht angefasst und nicht
mit committed.

## 21. Working Tree
Nach Commit/Push enthält der Working Tree ausschließlich die vier vorbestehenden,
nicht zu diesem Task gehörenden Screenshot-Diffs:
`D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_09.png`,
`D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_12.png`,
`?? docs/screenshotsfordev/Animierter KI-Jobstream im Neon-Design.png`,
`?? docs/screenshotsfordev/Screenshot 2026-10-02 at 13-07-10 May's Job Matcher.png`

## 22. Offene Fragen
Keine. Der einzige Ermessensspielraum — ob Tablet/Mobile noch etwas stärker
komprimiert werden — ist entschieden: sie lagen zunächst knapp unter dem
Zielband und wurden deshalb ausschließlich über den Fade nachgezogen; Desktop
blieb unangetastet, weil −17.9 % dem Ziel entspricht.

## 23. Risiken
Gering. Reine Geometrie dekorativer, `aria-hidden`-markierter Layer ohne
Interaktionsfunktion. Abgesichert durch: 8 Zustände × 6 Viewports gemessen,
14 Deck-Kindelemente geometrisch verifiziert, Podium per Computed-Style-Vergleich
als unverändert bewiesen, Background-Modell und Atrium-Zonen pixelweise
verglichen, Naht Fade→Footer mit Stufe 0, Reduced Motion und Routen geprüft.

## 24. Empfohlene nächste Schritte
Keine. **HARD STOP** nach SEARCH-WORLD-10: keine weiteren SEARCH-WORLD-Änderungen
automatisch beginnen.

## 25. Resume Point
Abgeschlossen, committed und gepusht. Fortsetzung nur auf ausdrückliche neue
Anweisung.

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `34472dc`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 728/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (Columns-Höhe und -Übergang, Deck-Höhe,
  Fade-Höhe in Basis + Tablet + Mobile), `src/SearchLayout.test.tsx` (1 Test),
  dieser Report
- Risiken: gering (Geometrie dekorativer Layer). Überbreite 0 px in allen 8
  Zuständen, Deck-Clipping GREEN, Podium per Computed Style identisch,
  Background-Modell unverändert.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung
dokumentiert: **NEIN** — es wurden ausschließlich Höhen- und Abstandsparameter
bereits bestehender, rein dekorativer und `aria-hidden`-markierter Layer
geändert. Keine Änderung an KI-Ausführung, Modellnutzung, Provider,
Datenverarbeitung, Persistenz, Tracking, Auth oder API.
`docs/AI_AUDITLOG.md` bleibt daher unverändert.
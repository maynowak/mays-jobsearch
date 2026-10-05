# SEARCH-WORLD-07 — Results-Komposition: großzügige offene Fläche statt schmaler Datenstreifen

## Status
DONE (eine CSS-Zeile plus Test; keine Suchlogik-, API- oder Datenänderung)

## 1. Befund — tatsächliche Ursache gemessen
Die Card selbst war **nicht** begrenzt (`max-width: none` auf `.match-card`,
`.results` und `.match-list`). Die Ursache lag in einer Breiten-Obergrenze
**d darüber**:

```css
.container            { max-width: 820px; }
.container.layout-search { max-width: 1220px; }   /* ← der Verursacher */
@media (min-width: 900px) {
  .container.layout-search { display: grid; grid-template-columns: 360px 1fr; gap: 32px; }
}
```

Gemessen im Zustand „12 Results" vor der Änderung:

| Viewport | Container | Sidebar | Grid | Results | MatchCard | Card-Anteil am Viewport | Card-Seitenverhältnis (H/B) | freier Rand rechts |
|---|---|---|---|---|---|---|---|---|
| 1920 | 1220 | 360 | `360px 788px` | 788 | **788×349** | 41 % | 0.44 | 370 px |
| 1440 | 1220 | 360 | `360px 788px` | 788 | **788×349** | 55 % | 0.44 | 130 px |
| 1280 | 1220 | 360 | `360px 788px` | 788 | **788×349** | 62 % | 0.44 | 50 px |
| 1024 | 1024 | 360 | `360px 592px` | 592 | 592×373 | 58 % | 0.63 | 20 px |

→ Auf einem 1440-px-Viewport blieben **45 % der Breite ungenutzt** (110 px Rand
links + 130 px Rand rechts). Die Results bekamen 788 px = 65 % des Containers,
und weil die Card 349 px hoch bei 788 px breit ist (Seitenverhältnis 0.44),
entstand die Wirkung einer **hohen, schmalen Säule**. Zusätzlich ist der Container
auf **1920 px hart gedeckelt** — die Breite stagnierte also unabhängig vom
Viewport.

## 2. Änderung — eine Zeile
```diff
 .container.layout-search {
-  max-width: 1220px;
+  max-width: 1400px;
```

Bewusst **nicht** geändert:
- `.search-sidebar` bleibt `flex: 0 0 360px` — die Sidebar bleibt eine kompakte
  Steuerzentrale (kein Verbreitern, kein Form-Redesign, keine Feldabstände).
- `grid-template-columns: 360px 1fr` und `gap: 32px` bleiben unverändert — die
  Results erhalten weiterhin den **Rest**, jetzt aber von einer breiteren Basis.
- `.container` (820 px, alle anderen Seiten), `.search-hero-inner`, `.nav-inner`
  und die Basisklasse bleiben unangetastet.

1400 px statt „voller Viewportbreite", damit ein sauberer Rand zum Viewport
erhalten bleibt (40 px je Seite bei 1440 px) und die Cards nicht an den
Bildschirmrand kleben.

## 3. Neue Breiten (gemessen, Zustand „12 Results")
| Viewport | Container | Sidebar | Results | MatchCard | Card-Anteil | Seitenverhältnis (H/B) | Rand L/R | Überbreite |
|---|---|---|---|---|---|---|---|---|
| 1920 | 1400 | 360 | **968** | **968×349** | 50 % | **0.36** | 672 / 280 | **0 px** |
| 1440 | 1400 | 360 | **968** | **968×349** | **67 %** | **0.36** | 432 / 40 | **0 px** |
| 1280 | 1280 | 360 | 848 | 848×349 | 66 % | 0.41 | 412 / 20 | **0 px** |
| 1024 | 1024 | 360 | 592 | 592×373 | 58 % | 0.63 | 412 / 20 | **0 px** |
| Tablet 834 | 834 | 794 (gestapelt) | 794 | 794×349 | 95 % | 0.44 | 20 / 20 | **0 px** |
| Mobile 390 | 390 | 350 (gestapelt) | 350 | 350×480 | 90 % | 1.37 | 20 / 20 | **0 px** |

**Desktop-Gewinn bei 1440 px:** Card **788 → 968 px (+23 %)**, Card-Anteil am
Viewport **55 % → 67 %**, Results-Anteil am Container **65 % → 69 %**,
Seitenverhältnis **0.44 → 0.36** (flacher, weniger streifenartig). Sidebar
unverändert 360 px. Der bisherige Cap ist damit Geschichte: bei 1920 px ist die
Card-Breite jetzt identisch zu 1440 px (968 px) — **stabile Breite statt Stagnation**.

## 4. Vertikale Komposition (Zustände A/B/C, 1440 px)
| Zustand | Cards | Card-Breite | Card-Höhe | Card-Gaps | Columns nach letzter Card | `cols/deck/floorOverlapsCards` |
|---|---|---|---|---|---|---|
| A) keine Results | — | — | — | — | 63 px Content→Columns | false / false / false |
| B) 3 Results | 3 | 968 px | 349 px | 28 px | 123 px | false / false / false |
| C) 12 Results | 5 + Restliste | 968 px | 349 px | 28 px | 123 px | false / false / false |

→ Die Liste bleibt beliebig lang, **nur die Höhe wächst**; die Breite ist in B
und C identisch (968 px). Keine Kürzung, keine Pagination, keine ausgeblendeten
Cards, kein Truncation — die Anzahl Results ist unverändert.

## 5. Übergang Results → Intelligence
SW-06-Übergang unverändert: `margin-top: clamp(40px, 7vh, 96px)` auf
`.search-world__columns`. Gemessen bleibt der Abstand Content → Columns exakt bei
**63 px** (Desktop), 67 px Tablet, 42 px Mobile. **Keine zusätzliche Leerfläche
und keine neuen dekorativen Elemente** — die breitere Results-Fläche balanciert
die Komposition bereits.

## 6. Einspaltigkeit
`.match-list` bleibt `display: flex; flex-direction: column` mit `gap: 28px`
(SW-06-Abstand erhalten). Keine `grid-template-columns`, keine Spaltenzahl, kein
Masonry, kein horizontales Raster, kein Karussell — als Test abgesichert.
Eine Jobstelle bleibt ein klar lesbares Einzelobjekt.

## 7. SW-05 Regression ✅ GREEN
| Invariante | Messung |
|---|---|
| Results im normalen Dokumentfluss | ✓ `container` bleibt Flex-Column, Grid unverändert |
| Columns nach vollständigem Content | ✓ 1440 px: content.b 2433 → cols.t 2496 |
| Deck danach | ✓ deck.t 2909 |
| Floor danach | ✓ floor.t 3233 |
| Footer danach | ✓ footer.t 3567 |
| keine Überlappung | ✓ `cols/deck/floorOverlapsCards = false` (echte Schnittprüfung) |

## 8. SW-06 Regression ✅ GREEN
| Invariante | Messung |
|---|---|
| Workspace visuell offen | ✓ `background: rgba(0,0,0,0)`, `border: 0px`, `radius: 0px`, `box-shadow: none`, `padding: 0px` |
| Card behält eigenes Design | ✓ `border: 3px`, eigener Verlauf vorhanden |
| keine gemeinsame Results-Box | ✓ kein Hintergrund/Rahmen am Workspace |
| Card-Abstände | ✓ `row-gap: 28px` |
| Übergang erhalten | ✓ 63 px |

## 9. SW-04 Regression ✅ GREEN
| Invariante | idle | 12 Results |
|---|---|---|
| `--sw-progress` gesetzt | 0.4942 | 0.3550 |
| AI > MATCH > ATS | −11.9 > −6.9 > −4.0 | −8.5 > −5.0 > −2.8 |
| Background / Deck / Floor | −8.9 / −4.9 / −3.0 | −6.4 / −3.5 / −2.1 |
| Search UI stabil | ✓ identische Position | ✓ |
| **Reduced Motion** | `--sw-progress` leer, **alle Transforms = 0** | ✓ |

## 10. BG-STATE-01 Regression ✅ GREEN
Atrium-Zone **außerhalb** des Containers gemessen (x 6–32 und x 1414–1440,
y 300–700), damit die Zone garantiert Welt und nicht Card-Fläche ist:

| Zustand | linke Zone L / S | rechte Zone L / S |
|---|---|---|
| idle | 180 / 16 % | 163 / 35 % |
| 3 Results | 178 / 15 % | 162 / 35 % |
| 12 Results | 178 / 15 % | 163 / 35 % |

→ Die Welt-Pixel sind zwischen idle und Results praktisch **identisch**
(ΔL ≤ 2, ΔS ≤ 1). Zusätzlich geprüft:
- `background-size: cover, cover`, Bild vorhanden — **keine Gradient-Streckung**
  über die wachsende Section: Background-Maße in allen Zuständen identisch
  (820 × 1526 px).
- `::before`-Overlay: `rgba(0, 0, 0, 0)` — **keine milchige globale Overlay-Fläche**.

Hinweis zur Methodik: ein erster Sample bei x = 1300 war im Ergebniszustand
**verworfen**, weil die Card (x 432–1400) dort selbst die Fläche bildet
(Card-Füllung L ≈ 245) — das ist die beabsichtigte Card-Oberfläche, keine
Verschlechterung des Atriums. Maßgeblich sind deshalb die welt-only Zonen oben.

## 11. Tests / tsc / Build / Browser
- `src/SearchLayout.test.tsx`: **1 Test ergänzt** — „SEARCH-WORLD-07: Results
  bekommen den größeren Breitenanteil, Sidebar bleibt kompakt". Prüft an
  `src/styles.css`: `max-width ≥ 1400px` am Workspace-Container,
  `flex: 0 0 360px` an der Sidebar, `grid-template-columns: 360px 1fr` im
  Desktop-Grid, **kein** `max-width` an `.results-workspace` und `.match-card`
  (genau die Ursache der Säulenwirkung), keine Mehrspalten-/Raster-Regel an
  `.match-list`.
- **725 passed / 5 skipped / 0 failed** (vorher 724).
- `npx tsc -b` PASS · `npm run build` PASS · Browser **0 JS-Errors** in allen
  8 Messzuständen.

## 12. Scope — nicht verändert
`fetchJobs`, `fetchMatches`, `SearchForm`, Results-API, ATS, CV, Notifications,
Login, Registration, Cognito, RIS, Datenmodell, Persistence, Business Logic.
Keine neuen Dependencies, kein Canvas, kein WebGL, keine neue Animationslogik.
Screenshots und Referenzassets unangetastet.

## 13. Git
Ausgangs-HEAD: `e25b97d`. Commit + Push auf `main`; Working Tree enthält danach
nur die vorbestehenden, nicht angefassten Screenshot-Diffs.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `e25b97d`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 725/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (eine Zeile: `max-width` am
  `.container.layout-search`), `src/SearchLayout.test.tsx` (1 zusätzliche
  Invariante), dieser Report
- Risiken: sehr gering. Reine Breiten-Obergrenze; keine Änderung an Grid,
  Sidebar, Card-Design, Farbsystem, Reihenfolge oder Deko-Layern. Überbreite in
  allen Viewports 0 px geprüft.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung
dokumentiert: **NEIN** — eine CSS-Breiten-Obergrenze plus ein Strukturtest.
Keine Änderung an KI-Ausführung, Modellnutzung, Datenverarbeitung, Persistenz,
API, Auth, Tracking oder Consent; `SearchForm`, `Results` und die Suchlogik
bleiben unverändert. Keine AI-Audit-Ergänzung erzeugt.
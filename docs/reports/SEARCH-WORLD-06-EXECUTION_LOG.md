# SEARCH-WORLD-06 — Results als offene Job-Liste statt vertikaler Säule

## Status
DONE (reine Präsentationsänderung; keine Suchlogik-, API- oder Datenänderung)

## 1. Befund (Nutzer-Korrektur zu SEARCH-WORLD-05)
`.results-workspace` aus SW-05 umschloss die **gesamte** Ergebnisliste mit
`--main-gradient` + `3px` Cyan-Rand + Radius + Schatten + `24px` Padding. Gemessen:
`bg = main-gradient`, `border = 3px`, `radius = var(--radius)`, `shadow = present`.

Optik: eine hohe, durchgehende vertikale Fläche mit zwei durchlaufenden Cyan-Seitenkanten
über die gesamte Listenlänge — die Jobstellen wirkten wie Inhalt eines Containers/Turms,
obwohl die Stellen selbst keine Säule sind. Zusätzlich waren AI/MATCH/ATS die **einzigen**
vertikalen Elemente der Seite — die Results konkurrierten darum falsch.

## 2. Umsetzung
### (a) Results-Bereich visuell offen
`.results-workspace` ist **strukturell unverändert** der Flow-Container
(`flex: 1; min-width: 0`) und behält Position und Reihenfolge aus SW-05. Visuell ist er
jetzt **transparent und offen**:

| Eigenschaft | SW-05 | SW-06 |
|---|---|---|
| `background` | `var(--main-gradient)` | `none` |
| `border` | `3px solid var(--border-primary)` | `0` |
| `border-radius` | `var(--radius)` | `0` |
| `box-shadow` | `var(--shadow)` | `none` |
| `padding` | `24px` | `0` |

Damit: keine Fläche, **keine durchgehenden seitlichen Cyan-Kanten**, kein gemeinsamer
Container, der die Cards einschließt, kein Radius/Schatten-Rahmen. Bewusst **kein**
neuer Hintergrund und **keine** neue Farbe — die Future World scheint zwischen und um
die Cards herum durch.

### (b) Job Cards als eigenständige Objekte
Das bestehende Card-Design bleibt **unverändert** und ist jetzt die einzige Trägerin der
Optik: `.match-card` behält `background: var(--main-gradient)`,
`border: 3px solid var(--border-primary)`, `border-radius: var(--radius)`,
`box-shadow`, `padding: 24px`. Gemessen bestätigt: `border = 3px` weiterhin aktiv.

### (c) Klare Zwischenräume
`.match-list` `gap: 20px → 28px`. Da es keinen gemeinsamen Container mehr gibt, ist der
Abstand das, was die Cards als eigenständige Objekte trennt.

### (d) Kurzer räumlicher Übergang
`margin-top` auf `.search-world__columns`:
`clamp(40px, 7vh, 96px)` (Tablet `clamp(32px, 6vh, 72px)`, Mobile `clamp(28px, 5vh, 56px)`).
Kein Absender, sondern Luft, in der die Welt sichtbar bleibt.

## 3. Gewünschte Hierarchie — verifiziert
| Zustand | Search UI | offene Results | Übergang | Columns | Deck | Floor | Footer |
|---|---|---|---|---|---|---|---|
| A) keine Ergebnisse | 356 | — | 63 px | 1331 | 1743 | 2068 | 2402 |
| B) 3 Ergebnisse | 356 | 3 Cards | 63 px | 1662 | 2074 | 2399 | 2733 |
| C) 12 Ergebnisse | 356 | 5 Cards + Rest | 63 px | 2496 | 2909 | 3233 | 3567 |
| Tablet | ✓ | ✓ | 67 px | 3484 | 3922 | 4323 | 4713 |
| Mobile | ✓ | ✓ | 42 px | 4188 | 4458 | 4762 | 5040 |

→ **Search UI → offene Job-Results → kurzer Übergang → AI/MATCH/ATS → INTELLIGENCE DECK
→ FLOOR**. Genau die geforderte Reihenfolge; die Columns sind die einzigen vertikalen
Elemente.

## 4. Unbedingt Erhaltenes — geprüft
| Vorgabe | Ergebnis |
|---|---|
| Normaler Dokumentfluss aus SW-05 | ✓ `.search-world` bleibt Flex-Column, Reihenfolge-Invariante besteht (Test) |
| Results nach Search Content | ✓ `contentBottom ≤ columnsTop` in allen 5 Zuständen |
| Keine Überlappung mit AI/MATCH/ATS | ✓ `colsOverlapsCards / deckOverlapsCards / floorOverlapsCards = false` (echte Schnittprüfung) in allen Zuständen |
| Results vollständig sichtbar | ✓ alle Cards gerendert (3 / 5 + Restliste), nichts abgeschnitten |
| Card-Design der einzelnen Stellen | ✓ `.match-card` unverändert, weiterhin 3-px-Rand + Verlauf + Radius + Schatten |
| Card-Auflösung | ✓ 0 px horizontale Überbreite auf Desktop/Tablet/Mobile |
| JS-Errors | ✓ 0 |

## 5. Pixel-/Geometrie-Nachweis „kein Turm"
Messung im vollen 12-Ergebnis-Zustand (Desktop):

- **Welt zwischen den Cards sichtbar:** Pixel in der Mitte jedes Card-Gaps
  `[233,220,196] / [220,230,235] / [213,227,235] / [205,224,233]` gegenüber Card-Innenfläche
  `[222,246,253]` — Abweichung ΔRGB **24–64**, d. h. in jedem Zwischenraum liegt die
  Future World, nicht die Card-Füllung.
- **Farbverlauf läuft hinter der Liste weiter:** Die Gap-Pixel variieren mit der Tiefe
  (hell oben → kühler unten) → der Weltverlauf ist durchgehend sichtbar.
- **Keine durchgehende Seitenkante:** Spaltenprobe links/rechts der Liste über die gesamte
  Listenhöhe → **nicht uniform** (Farbwechsel vorhanden), nur 27/74 bzw. 21/74 Proben
  cyan-artig — das sind Weltverlauf, keine Kante.
- **Workspace-Stile im Browser:** `background: rgba(0,0,0,0)`, `border: 0px`,
  `radius: 0px`, `shadow: none`, `padding: 0px` — in allen Ergebniszuständen identisch.

## 6. Bewusst nicht geändert
- `.results-header` behält seine **horizontale** Trennlinie und
  `.results-remaining` seine gestrichelte **horizontale** Oberkante: das sind
  Hierarchie-Linien quer, keine umschließende Säule. Sie erzeugen keine Seitenkanten.
- Ergebnisdarstellung als Komponente, ATS/CV/Notifications/Auth/RIS, API, Datenmodell,
  Screenshots, Referenzassets — unangetastet.

## 7. Tests / tsc / Build
- `src/SearchLayout.test.tsx`: **1 Test ergänzt** — „SEARCH-WORLD-06: Results-Workspace
  ist visuell OFFEN". Prüft an `src/styles.css`: `background: none`, `border: 0`,
  `border-radius: 0`, `box-shadow: none`, `padding: 0`, kein Verlauf, keine
  `border-left/right/top/bottom`, `flex: 1` erhalten; zusätzlich dass `.match-card` sein
  eigenes Design behält und `.match-list` `gap ≥ 24px` hat.
- **724 passed / 5 skipped / 0 failed** (vorher 723).
- `npx tsc -b` PASS · `npm run build` PASS.

## 8. Offen
Keine. Der Nutzerhinweis ist vollständig umgesetzt und gemessen.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `24387cb`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 724/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (`.results-workspace` transparent,
  `.match-list` gap, `.search-world__columns` margin-top in 3 Breakpoints),
  `src/SearchLayout.test.tsx` (1 zusätzliche Invariante), dieser Report
- Risiken: sehr gering (reine CSS-Optik). Bewusst keine Änderung an Card-Design,
  Farbsystem oder Layout-Struktur, damit die eigenständige Card-Optik und der
  Dokumentfluss aus SW-05 exakt erhalten bleiben.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — ausschließlich Präsentations-/Layout-Änderungen (CSS) plus ein Strukturtest.
Keine Änderung an KI-Ausführung, Datenverarbeitung, Persistenz, API, Auth oder Consent;
`Results`, `MatchCard` und die Suchlogik bleiben unverändert. Keine AI-Audit-Ergänzung
erzeugt.
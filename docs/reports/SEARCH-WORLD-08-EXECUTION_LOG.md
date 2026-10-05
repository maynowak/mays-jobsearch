# SEARCH-WORLD-08 — Intelligence World: kompakter, zentriert, ausgewogen

## Status
DONE (ausschließlich räumliche Deko-Parameter; keine Logik-, API- oder Datenänderung)

## 1. Ausgangsgeometrie (gemessen, vor der Änderung)
Viewport 1440×900, Zustand „12 Results". Werte aus dem Browser, nicht geschätzt:

| Element | Ist-Wert |
|---|---|
| letzte Job Card, Bottom | 2373 |
| Content-Bottom | 2433 |
| Columns-Beginn | 2496 |
| Columns-Höhe | **414** |
| Deck-Beginn / Höhe | 2909 / **324** |
| Floor-Beginn / Höhe | 3233 / **117** |
| Fade-Beginn / Höhe | 3351 / **216** |
| Footer-Position | 3567 |
| **Gesamthöhe der unteren World** (Columns-Beginn → Footer) | **1071** |
| Results → Columns | 63 |
| AI / MATCH / ATS x-Mitte | 646 / 958 / 1270 |
| Gruppen-Bounding-Box | 506 → 1252 (**Spreizung 746**) |
| Gruppenmitte / Viewportmitte | 957 / 720 → **+237 px rechtslastig** |

Weitere Viewports: 1920 px World **1285** (Offset +317), 1280 px **964** (+211),
1024 px **944** (+169), Tablet **1229** (+117), Mobile **852** (+20).

## 2. Ursachen
1. **Überdimensionierung:** vier aufeinanderfolgende vh-Flächen addierten sich zu
   1071 px (bei 1920 px sogar 1285 px) — Columns 46vh + Deck 36vh + Floor 13vh +
   Fade 24vh plus 7vh Übergang. Die untere World war damit größer als der
   eigentliche Search-Bereich und wirkte als zweite Hauptseite.
2. **Rechtslastige Columns:** `padding-left: 36% / padding-right: 3%` (asymmetrisch)
   kombiniert mit `justify-content: space-around`. Die Asymmetrie stammte aus der
   Annahme, die Search Card stehe links — die untere Welt liegt inzwischen aber
   **unterhalb aller Inhalte**, diese Begründung ist entfallen.
3. **Zu weite Spreizung:** `space-around` verteilte drei 122-px-Säulen über 746 px.

## 3. Änderungen (nur räumliche Parameter, visuelle Sprache erhalten)
| Element | vorher | nachher |
|---|---|---|
| Columns `padding-left` / `padding-right` | 36 % / 3 % | **4 % / 4 %** (symmetrisch) |
| Columns `justify-content` | `space-around` | **`center`** |
| Columns `gap` | `clamp(16px, 4vw, 64px)` | `clamp(18px, 2.4vw, 40px)` |
| Columns `height` | `clamp(360px, 46vh, 560px)` | **`clamp(220px, 28vh, 340px)`** |
| Columns `margin-top` (SW-06-Übergang) | `clamp(40px, 7vh, 96px)` | **`clamp(28px, 4.5vh, 56px)`** |
| `.intelligence-column` `flex-basis` | `clamp(74px, 8.5vw, 132px)` | `clamp(70px, 7vw, 116px)` |
| Deck `height` | `clamp(300px, 36vh, 440px)` | **`clamp(200px, 25vh, 300px)`** |
| Floor `height` | `clamp(86px, 13vh, 158px)` | **`clamp(64px, 9vh, 104px)`** |
| Fade `height` | `clamp(150px, 24vh, 280px)` | **`clamp(96px, 14vh, 168px)`** |
| Tablet: Columns | `30%/2%`, 40vh, 6vh Übergang | `4%/4%`, `clamp(190px,22vh,280px)`, `clamp(24px,4vh,48px)` |
| Tablet: Deck / Floor / Fade | Basis / 11vh / Basis | `clamp(180px,22vh,260px)` / `clamp(58px,8vh,92px)` / `clamp(84px,12vh,140px)` |
| Mobile: Columns | `12%/2%`, 32vh, 5vh Übergang | `3%/3%`, `clamp(160px,20vh,220px)`, `clamp(20px,3.5vh,40px)` |
| Mobile: Deck / Fade | Basis / Basis | `clamp(150px,18vh,210px)` / `clamp(72px,10vh,120px)` |

**Unverändert:** Glasstruktur, Cyan-Edge, interne Lichtlinien, Licht-Trail, Labels
AI/MATCH/ATS, Deck-Elemente AI/JOBS/MATCH/ATS/PROFILE/SKILLS/INTELLIGENCE, Floor-Bogen,
Fade-Verlauf, Boden-Reflexion, alle SW-04-Transform-Regeln, Reduced-Motion-Block.
Keine neue Deko-Fläche, keine neue Komponente, keine neue Animationslogik.

## 4. Neue Geometrie (gemessen)
| Viewport | World-Höhe | Columns | Deck | Floor | Fade | Results→Cols | Gruppen-Offset | Spreizung | Footer | Overflow |
|---|---|---|---|---|---|---|---|---|---|---|
| 1440 (A/B/C) | **684** | 252 | 225 | 81 | 126 | 40–41 | **0** | 372 | 1993 / 2323 / 3158 | 0 px |
| 1920 | **820** | 302 | 270 | 97 | 151 | 49 | **0** | 428 | 3302 | 0 px |
| 1280 | **608** | 224 | 200 | 72 | 112 | 36 | **+1** | 331 | 3077 | 0 px |
| 1024 | **596** | 220 | 200 | 69 | 108 | 35 | **0** | 264 | 3184 | 0 px |
| Tablet 834 | **711** | 245 | 245 | 89 | 133 | 45 | **0** | 218 | 4173 | 0 px |
| Mobile 390 | **481** | 169 | 152 | 76 | 84 | 29 | **+1** | 171 | 4656 | 0 px |

**Reduktion:** 1440/1920 **−36 %**, 1280/1024 −37 %, Tablet **−42 %**,
Mobile **−44 %**. Der Footer rückt um 367–540 px nach oben.

## 5. Zentrierung der AI/MATCH/ATS-Gruppe
Die **Gruppe als Ganzes** hat nun eine Achse auf der Viewportmitte — nicht jede
Säule einzeln:

| Viewport | AI | MATCH | ATS | Gruppenmitte | Viewportmitte | Offset |
|---|---|---|---|---|---|---|
| 1440 | 585 | **720** | 855 | **720** | 720 | **0** |
| 1920 | 804 | **960** | 1116 | **960** | 960 | **0** |
| 1280 | 520 | 640 | 760 | 641 | 640 | +1 |
| 1024 | 416 | 512 | 608 | 512 | 512 | 0 |
| Tablet | 336 | **417** | 498 | 417 | 417 | 0 |
| Mobile | 135 | 195 | 255 | 196 | 195 | +1 |

MATCH steht damit exakt auf der Mittelachse, AI und ATS symmetrisch links/rechts
(Abstand 135 px / 135 px bei 1440). Spreizung 746 → 372 px: die drei Säulen lesen
sich als **Einheit** statt als auseinandergezogene Reihe. Keine Kopplung an die
Results-Spalte, nicht unter der Search Sidebar.

## 6. Deck: kompakter, nichts abgeschnitten
Deck 324 → **225 px**. Alle 15 Kindelemente geprüft — **alle vollständig sichtbar
und innerhalb der Box** (`insideX`/`insideY` = true), inklusive:
- AI/JOBS-Chips: 13–46
- Connector: 25–88 · INTELLIGENCE-Label: 87–108
- MATCH 35–52 · ATS 67–84 · PROFILE 139–156 · SKILLS 148–165
- Glas-Panels a 77–149 · b 104–185 · c 167–168 · d 117–180
- Lichtlinien 27–147

Die Innenelemente positionieren prozentual und skalieren dadurch sauber mit; nur die
Etagenhöhe schrumpft. Kein Clipping, keine verlorenen Labels.

## 7. Floor und Fade
Floor **117 → 81 px**, Fade **216 → 126 px**. Bogenform und Verlauf unverändert.
Übergang zum Footer geprüft: Fade-Bottom = Footer-Top (**Lücke 0 px**), letzte
Fade-Zeile `[245,249,252]` vs. erste Footer-Zeile `[248,250,252]` → **nahtlos**,
kein weißes Loch, kein abrupter Sprung.

## 8. SW-05 Regression ✅ GREEN
Dokumentfluss unverändert, keine Verankerung. Kette bei 1440 px / 12 Results:
Content 2433 → Columns 2496 → Deck 2748 → Floor 2973 → Fade 3054 → Footer 3158.
`cols/deck/floorOverlapsCards = false` in **allen 8** Messzuständen (A/B/C +
6 Viewports). Neu als Test abgesichert: alle vier unteren Layer sind
`position: relative` und enthalten **kein** `bottom:`.

## 9. SW-06 Regression ✅ GREEN
`.results-workspace`: `background: rgba(0,0,0,0)`, `border: 0px`,
`border-radius: 0px`, `box-shadow: none`, `padding: 0px`. Card weiterhin mit eigenem
3-px-Rand. Keine gemeinsame Results-Box.

## 10. SW-07 Regression ✅ GREEN
Sidebar **360 px** (unverändert), Results **968 px**, MatchCard **968 px**,
Card-Rand 3 px, `.match-list` weiterhin `display: flex` mit
`grid-template-columns: none` → **einspaltig**. SW-07 nicht angetastet.

## 11. SW-04 Regression ✅ GREEN
| | Wert |
|---|---|
| `--sw-progress` | 0.5282 gesetzt |
| Differenzierung | AI **−12.7** > MATCH **−7.4** > ATS **−4.2** |
| Background / Deck / Floor | −9.5 / −5.3 / −3.2 |
| Search-UI-Transform | **0** (unberührt) |
| Reduced Motion | `--sw-progress` leer, **alle Transforms 0** |

Die gleiche relative Bewegungslogik wie zuvor; die Amplituden sind unverändert in
der CSS-Formel (die kleineren Ausgangswerte ergeben sich aus der kompakteren World).

## 12. BG-STATE-01 Regression ✅ GREEN
| Zone | SW-07-Baseline | SW-08 |
|---|---|---|
| linke Atrium-Zone (x 6–32) | L 178 / S 15 % | **L 178 / S 15 %** |
| rechte Atrium-Zone (x 1414–1440) | L 163 / S 35 % | **L 163 / S 35 %** |

Background-Layer unverändert: 820 × 1526 px, `background-size: cover, cover`,
`::before`-Overlay `rgba(0,0,0,0)`. Keine Overlay-/Opacity-Lösung, keine
Gradient-Streckung. Die kleinere World wurde **nicht** mit einer helleren Fläche
„simuliert", sondern echt über Höhen reduziert.

## 13. Tests / TSC / Build / Browser
- `src/SearchLayout.test.tsx`: **1 Test** ergänzt — „SEARCH-WORLD-08: Column-Gruppe
  ist zentriert, untere Welt bleibt im Fluss und kompakt": linkes/rechtes
  `padding` der Columns müssen symmetrisch sein, `justify-content: center`, und
  `search-world__columns/__intelligence/__floor/__fade` müssen `position: relative`
  ohne `bottom:` bleiben. Bewusst **ein** Test, keine künstliche Erhöhung der Zahl.
- **726 passed / 5 skipped / 0 failed** (vorher 725).
- `npx tsc -b` PASS · `npm run build` PASS · Browser **0 JS-Errors** in allen
  8 Messzuständen sowie in den Regressionsläufen.

## 14. Scope — nicht verändert
Search Form, Search Sidebar, Results/MatchCards, Results-API, ATS, CV,
Notifications, Login, Registration, Cognito, RIS, Datenmodell, Persistence,
Business Logic. Keine neuen Dependencies, kein Canvas, kein WebGL, keine neue
Animations-Engine, keine neuen Komponenten. Screenshots unangetastet.

## 15. AWS / Terraform
n/a — keine Infrastruktur geändert, keine AWS-/Terraform-Ressourcen betroffen,
keine Checks ausgeführt.

## 16. Git
Ausgangs-HEAD: `cfc12c4`. Commit + Push auf `main`; Working Tree enthält danach
nur die vorbestehenden, nicht angefassten Screenshot-Diffs.

## 17. Resume Point
SEARCH-WORLD-08 abgeschlossen und auf `main` gepusht. Keine offenen Punkte. Nächster
Schritt liegt beim Auftraggeber.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `cfc12c4`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 726/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (Columns symmetrisch/zentriert/kompakter in
  Basis + Tablet + Mobile, `.intelligence-column` flex-basis, Deck-/Floor-/Fade-Höhen
  in Basis + Tablet + Mobile), `src/SearchLayout.test.tsx` (1 zusätzliche
  Invariante), dieser Report
- Risiken: gering (reine Geometrie der Deko-Layer). Überbreite 0 px in allen
  Viewports, Kettenreihenfolge und SW-04-Motion geprüft, Reduced Motion verifiziert.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung
dokumentiert: **NEIN** — ausschließlich Höhen-, Padding- und Flex-Parameter rein
dekorativer, `aria-hidden`-markierter Layer sowie ein Strukturtest. Keine Änderung
an KI-Ausführung, Modellnutzung, Datenverarbeitung, Persistenz, API, Auth, Tracking
oder Consent. Keine AI-Audit-Ergänzung erzeugt.
# SEARCH-WORLD-11 — Blue Podium Integration & Bottom Space Compression

## Status
DONE (ausschließlich Geometrie und Farbwirkung des bestehenden, rein
dekorativen `.search-world__floor` plus Verkürzung des bestehenden Fade;
keine Struktur-, Logik-, Daten-, API- oder Footer-Änderung)

Gemäß `docs/AI_AUDITLOG.md` wird dieser Execution Log fortlaufend gepflegt und
enthält ausschließlich verifizierte Fakten.

## Audit-Metadaten
- Datum: 2026-10-05
- Branch: `main`
- Ausgangs-HEAD: `d3c1fe2` (SEARCH-WORLD-10)
- Audit-Scope: unterer Seitenabschnitt (Fade → Footer → Podium) der Future
  Search World: Sichtbarkeit, Blau-Integration, Bottom Space, Gesamthöhe
- Terraform-Checks: **nicht anwendbar** (keine Infrastruktur, keine ausgeführt)
- Klassifikation gesamt: **GREEN**

---

## 1. Ausgangsproblem (gemessen, Zustand „12 Results", `/top`)

Route `/top` rendert die Search World unabhängig von `isSearching` und ist
deshalb der Messpfad für alle drei Zustände (A = 0 Results, B = 3, C = 12).

Die Kuppel war **farblich faktisch nicht vorhanden**. Median-Farbe des
sichtbaren Podiumbereichs über alle 6 Viewports:

| Kennzahl (Zustand C) | Wert vorher |
|---|---|
| Farbbereich unter dem Footer | `rgb(235, 244, 249)` |
| Sättigung dort | **6 %** |
| maximale Sättigung im Podium | **6 %** |
| Zeilen mit Sättigung ≥ 18 % | **0 px** |
| max. Kanalabstand zur Seitenhintergrundfarbe `#f8fafc` | **15** |
| Seitenende (letzte Zeile) | `rgb(236, 244, 249)` |

Damit war das Podium optisch eine blass-graue Glasfläche, die als
„dünne helle Linie am untersten Rand" las — genau der in der Aufgabe
beschriebene Zustand. Zusätzlich:

| Kennzahl (Zustand C) | 1440 | 1920 | 1280 | 1024 | 834 | 390 |
|---|---|---|---|---|---|---|
| Fade-Höhe | 99 | 119 | 88 | 84 | 100 | 63 |
| Footer-Höhe | 165 | 165 | 165 | 165 | 187 | 208 |
| Podium-Höhe | 81 | 97 | 72 | 69 | 89 | 76 |
| Überdeckung in den Footer | 36 | 43 | 32 | 30 | 44 | 33 |
| **sichtbare Kuppel unter Footer** | **45** | **54** | **40** | **39** | **44** | **43** |
| Bottom-Space (Footer-Bottom → Seitenende) | 45 | 54 | 40 | 39 | 44 | 43 |
| Dokumenthöhe | 2462 | 2575 | 2412 | 2405 | 3498 | 3798 |

**Ursache (drei, rein geometrisch/visuell):**

1. **Der Podium-Verlauf war zu hell und zu schwach.** `::before` mixes
   `rgba(255,255,255,0.52)` → `rgba(162,206,231,0.14)` über `#f8fafc`. Die
   Alphawerte fallen nach unten, wodurch die untere Hälfte der Kuppel — also
   genau der Teil, der unterhalb des Footers sichtbar wird — am wenigsten
   Farbe trug. Ergebnis: Sättigung 6 %.
2. **Die Lichtkante des Bogens war fast unsichtbar.** `::after` nutzte
   `rgba(34,211,238,0.36)` und eine Maske, die nach 24 % Boxhöhe ausblendete.
   Bei einer 81 px hohen Kuppel blieb nur die oberste Mitte der Kurve als
   1px-Linie lesbar.
3. **Die sichtbare Kuppel war zu kurz.** 45 px bei 1440 px Breite — ein
   Verhältnis von 32:1, das eher als Streifen denn als Podium liest. Der
   untere Leerraum wurde zusätzlich vom 40-px-Bottom-Padding des Footers
   dominiert, das als reine Weißfläche endete.

**Entscheidender Befund für die Lösung:** `.footer` hat **keinen Hintergrund**
(`background: rgba(0, 0, 0, 0)`). Die Kuppel kann deshalb ohne jede Änderung
an Inhalt, Typografie, Padding oder Struktur des Footers hinter die Fußzeile
wachsen und dort sichtbar werden. Das Podium liegt hinter dem Footer
(`z-index` 0 vs. 1), der Text bleibt also immer vorn.

---

## 2. Änderungen (8 Deklarationen, ausschließlich bestehende Parameter)

Keine neue Grafik, keine neue Komponente, kein neues SVG, keine neue Farbpalette.
Die Form (`border-radius: 50% 50% 0 0 / 100% 100% 0 0` auf `::before` und
`::after`) und die Breite (`width: 100%`) bleiben unverändert.

### 2.1 `.search-world__floor` — Höhe

| Breakpoint | vorher | nachher | bei 1440/900 |
|---|---|---|---|
| Basis | `clamp(64px, 9vh, 104px)` | `clamp(80px, 11vh, 124px)` | 81 → **99** |
| ≤ 900 | `clamp(58px, 8vh, 92px)` | `clamp(76px, 10vh, 112px)` | — |
| ≤ 560 | `clamp(58px, 9vh, 92px)` | `clamp(68px, 9.5vh, 100px)` | — |

Historie der Bodenhöhe: 46vh/414 → 25vh/300 → 9vh/104 (SW-08) → 11vh/124 (SW-11).
Die Obergrenze bleibt bewusst moderat, damit 1920 keine erneute
Überdimensionierung erzeugt (119 px statt z. B. 160 px).

### 2.2 `.search-world__floor` — vertikale Position (Überdeckung)

| Breakpoint | vorher | nachher | bei 1440/900 |
|---|---|---|---|
| Basis | `calc(-1 * clamp(24px, 4vh, 44px))` | `calc(-1 * clamp(40px, 5.6vh, 68px))` | 36 → **50** |
| ≤ 560 | (Basis) | `calc(-1 * clamp(32px, 4vh, 48px))` | — |

Mobile erhält bewusst eine **kleinere** Überdeckung: der Mobile-Footer ist
208 px hoch und die Kuppel nur 80 px; mit der Basis-Überdeckung blieben sonst
nur ~33 px sichtbar, mit der eigenen Überdeckung bleiben es ~46 px.

### 2.3 `.search-world__floor::before` — Farbwirkung

```
vorher                                    nachher
rgba(255, 255, 255, 0.52)   0%           rgba(255, 255, 255, 0.5)    0%
rgba(219, 239, 250, 0.36)  30%           rgba(203, 234, 250, 0.5)  22%
rgba(190, 224, 242, 0.24)  62%           rgba(133, 196, 238, 0.42) 54%
rgba(162, 206, 231, 0.14) 100%           rgba(70,  150, 205, 0.3) 100%
```

Gleiche Richtung (180deg), gleiche Glas-/Reflexionsästhetik, gleiche
`border-radius`. Verwendet werden ausschließlich **bereits im Podium und im
World-Farbraum vorhandene Blautöne** — kein neuer Farbwert, keine neue Palette.
Der Bogen-Glanz oben bleibt bewusst hell, damit die Fußzeilentexte darauf
lesbar bleiben (nachgemessener Kontrast §7).

### 2.4 `.search-world__floor::after` — Lichtkante

| Eigenschaft | vorher | nachher |
|---|---|---|
| `border-top` | `1px solid rgba(34, 211, 238, 0.36)` | `1px solid rgba(34, 211, 238, 0.55)` |
| `box-shadow` | `0 -16px 44px rgba(34, 211, 238, 0.14)` | `0 -16px 44px rgba(34, 211, 238, 0.2)` |
| `mask-image` | `#000 0 24%, transparent 66%` | `#000 0 34%, transparent 72%` |

`rgba(34, 211, 238)` ist das bestehende `--accent` der World. Die Maske reicht
weiter nach unten, weil die Kuppel höher ist und sonst nur die oberste Mitte
der Kurve sichtbar bliebe.

### 2.5 `.search-world__fade` — Bottom Space

| Breakpoint | vorher | nachher | bei 1440/900 |
|---|---|---|---|
| Basis | `clamp(84px, 11vh, 140px)` | `clamp(72px, 8.5vh, 112px)` | 99 → **77** |
| ≤ 900 | `clamp(68px, 9vh, 108px)` | `clamp(60px, 7vh, 92px)` | — |
| ≤ 560 | `clamp(58px, 7.5vh, 96px)` | `clamp(52px, 6vh, 80px)` | — |

Der **Verlauf selbst bleibt byte-identisch** (`transparent → rgba(214,233,244,.72)
→ #f0f6fb 82% → #f8fafc 100%`). Nur die Höhe ändert sich, damit die World
weniger „eigene Etage" wirkt und das Seitenende nach oben rückt.

**Nicht angefasst:** `.search-world__content`, `.results`, `.results-workspace`,
`.match-list`, `.match-card`, `.intelligence-column*`, `.search-world__background`,
`.search-world::before`, `.search-world__fade`-Verlauf, `.footer` (komplett),
`useSearchWorldMotion`, `searchWorldScroll.ts`, `App.tsx`, alle API-/Datenpfade.

---

## 3. Podium Before/After (gemessen, Zustand C)

| Kennzahl | 1440 | 1920 | 1280 | 1024 | 834 | 390 |
|---|---|---|---|---|---|---|
| Podium-Höhe vorher → nachher | 81 → **99** | 97 → **119** | 72 → **88** | 69 → **84** | 89 → **111** | 76 → **80** |
| sichtbare Zeilen im Podium | 76 → **99** | 91 → **118** | 67 → **88** | 65 → **84** | 83 → **111** | 71 → **80** |
| sichtbare Kuppel unter Footer | 45 → **49** | 54 → **58** | 40 → **43** | 39 → **41** | 44 → **49** | 42 → **47** |
| max. Sättigung | 6 % → **19 %** | 6 % → **19 %** | 6 % → **19 %** | 6 % → **19 %** | 6 % → **19 %** | 6 % → **19 %** |
| Zeilen mit Sättigung ≥ 18 % | 0 → **49 px** | 0 → **59 px** | 0 → **44 px** | 0 → **42 px** | 0 → **55 px** | 0 → **39 px** |
| max. Abstand zu `#f8fafc` | 15 → **54** | 15 → **54** | 15 → **54** | 15 → **54** | 15 → **54** | 15 → **54** |
| Farbe unter dem Footer | `235,244,249` → **`198,224,242`** | → `197,224,242` | → `197,224,242` | → `198,224,242` | → `196,223,241` | → `197,223,242` |
| Seitenende (letzte Zeile) | `236,244,249` → **`195,220,238`** | → `195,220,239` | → `195,220,239` | → `195,220,239` | → `194,220,238` | → `195,220,239` |

**Blaue Integration: GREEN.** Die Sättigung verdreifacht sich (6 → 19 %),
der Kontrast zur Seitenhintergrundfarbe verdreifacht sich nahezu (15 → 54),
und 39–59 px der Kuppel tragen jetzt sichtbares Blau (vorher 0 px). Das
Seitenende ist mit `rgb(195, 220, 238)` ein ruhiges, eindeutig blaues Powder-Blue.

**Weichheit gewahrt:** maximale Sättigung 19 % bei ~87 % Helligkeit — kein
kräftiger oder gesättigter Block. Der größte Zeilensprung **innerhalb** des
Podium-Bereichs liegt bei **2–5** (von 255), d. h. zwischen benachbarten
Bildzeilen gibt es keine sichtbare Kante. Zum Vergleich: die Textzeilen des
Footers erzeugen Sprünge von 3–167 — die Podium-Fläche ist damit deutlich
weicher als der Footertext und kann keine harte blaue Fläche sein.

---

## 4. Bottom Space Before/After

Bottom-Space = Abstand `Footer-Bottom` → Seitenende, d. h. exakt die sichtbare
Kuppel. Werte in px, Zustand C:

| Viewport | Fade vorher → nachher | sichtbare Kuppel vorher → nachher | Dokumenthöhe vorher → nachher |
|---|---|---|---|
| 1440 | 99 → 77 (**−22**) | 45 → 49 | 2462 → 2443 (**−19**) |
| 1920 | 119 → 92 (**−27**) | 54 → 58 | 2575 → 2552 (**−23**) |
| 1280 | 88 → 72 (**−16**) | 40 → 43 | 2412 → 2399 (**−13**) |
| 1024 | 84 → 72 (**−12**) | 39 → 41 | 2405 → 2396 (**−9**) |
| 834 | 100 → 78 (**−22**) | 44 → 49 | 3498 → 3480 (**−18**) |
| 390 | 63 → 52 (**−11**) | 42 → 47 | 3798 → 3791 (**−7**) |

**Gesamthöhe in allen 18 gemessenen Zuständen (A/B/C × 6 Viewports) kleiner,
nie größer.** Werte: −19, −23, −13, −9, −18, −7 px (Zustand C), entsprechend
in A und B. `restAfterPodium = 0` in allen 18 Zuständen: die Seite endet exakt
mit der Podium-Unterkante, kein zusätzlicher Leerraum darunter.

---

## 5. Kein weißer Nachlauf

`istReinweiss` (Seitenende ≥ 250 in allen Kanälen) ist in allen 18 Zuständen
**vorher wie nachher `false`**. Die letzte Zeile ist nachher `rgb(195, 220, 238)`
— also eindeutig nicht weiß, sondern das ruhige Blau der Kuppel. Vorher war sie
`rgb(236, 244, 249)`, also ein sehr heller Rest. Der Bereich unterhalb des
Footers ist damit von „weiß" zu „Podium" gewechselt.

Zusätzlich: die 40 px `padding-bottom` des Footers werden jetzt vom Anstieg
der Kuppel (50 px bei 1440) eingenommen, statt als leere Weißfläche zu enden.

---

## 6. Zustände A / B / C

Alle drei Zustände wurden in allen 6 Viewports vermessen (18 Läufe). Die
Bottom-Geometrie ist in allen drei Zuständen nahezu identisch, weil Footer und
Podium unabhängig von der Zahl der Results immer dieselbe Höhe haben:

| Zustand | Viewport | sichtbare Kuppel | Dokumenthöhe | Δ |
|---|---|---|---|---|
| A (0 Results) | 1440 | 49 | 1982 | −19 |
| B (3 Results) | 1440 | 48 | 2231 | −19 |
| C (12 Results) | 1440 | 49 | 2443 | −19 |
| A | 390 | 46 | 2237 | −8 |
| B | 390 | 47 | 3131 | −7 |
| C | 390 | 47 | 3791 | −7 |

Vollständige Matrix (sichtbare Kuppel / Dokumenthöhe vorher → nachher):

| Viewport | A | B | C |
|---|---|---|---|
| 1440 | 45→49 / 2001→1982 | 45→48 / 2250→2231 | 45→49 / 2462→2443 |
| 1920 | 54→58 / 2114→2091 | 54→58 / 2364→2341 | 54→58 / 2575→2552 |
| 1280 | 40→43 / 1951→1938 | 40→44 / 2200→2188 | 40→43 / 2412→2399 |
| 1024 | 39→41 / 1945→1935 | 38→42 / 2194→2185 | 38→41 / 2405→2396 |
| 834 | 44→49 / 2310→2292 | 44→49 / 2983→2965 | 45→49 / 3498→3480 |
| 390 | 43→46 / 2245→2237 | 42→47 / 3138→3131 | 42→47 / 3798→3791 |

`overflowX = 0` und **0 JS-Errors** in allen 18 Zuständen, vorher wie nachher.

---

## 7. Footer unverändert ✅ GREEN

Vorher/Nachher-Vergleich, alle 6 Viewports, jeweils **identisch**:

| Prüfung | Ergebnis |
|---|---|
| `innerText` komplett | **identisch** |
| alle inneren Elemente (Tag, Klasse, y, h, w relativ zum Footer-Oberrand) | **identisch** |
| `getComputedStyle` des Footers (`color`, `font-size`, `padding`, `position`, `z-index`, `text-align`, `line-height`, `background-color`) | **identisch** |
| Footer-Höhe | 165 / 165 / 165 / 165 / 187 / 208 — **unverändert** |
| `padding` | `24px 20px 40px` — unverändert |
| `color` / `font-size` | `rgb(107, 98, 85)` / `14.08px` — unverändert |
| `background-color` | `rgba(0, 0, 0, 0)` — unverändert (transparent) |

Footertext (vorher wie nachher, wörtlich):
`Impressum · Datenschutz Jobangebote Arbeitnow · Arbeitsagentur. Bewertungen
sind KI-generierte Vorschläge — prüfe immer die Original-Anzeige. Version
2.0.0 · development · cb78b9a`

Innere Struktur bei 1440 (vorher wie nachher): `nav.footer-links` y 24,
`p` y 59, `p.footer-version` y 94 — es hat sich **nur die absolute Position**
verschoben (durch die kürzere World), nicht das interne Layout.

**Lesbarkeit auf der Podium-Atmosphäre:** WCAG-Kontrast zwischen dunkelstem
Textpixel und hellstem Pixel im Textband: **7.24:1 vorher → 7.32:1 nachher**
(bei 1024 und 390 unverändert 7.24:1). Keine Verschlechterung — der
dunkelste Textpixel ist `[27, 35, 51]` (WCAG AAA für Fließtext).

---

## 8. Naht Fade → Footer

| Viewport | letzte Fade-Zeile | erste Footer-Zeile | Stufe |
|---|---|---|---|
| 1440 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |
| 1920 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |
| 1280 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |
| 1024 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |
| 834 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |
| 390 | `rgb(248, 250, 252)` | `rgb(248, 250, 252)` | **0** |

Unverändert 0, weil der Fade-Verlauf byte-identisch geblieben ist und weiterhin
exakt auf `#f8fafc` endet. Kein weisses Loch, keine harte Linie.

---

## 9. Responsive (§9)

| Viewport | Podium-Höhe | sichtbare Kuppel | Sättigung | Δ Dokumenthöhe | Overflow |
|---|---|---|---|---|---|
| 1440 | 99 | 49 | 19 % | −19 | 0 |
| 1920 | 119 | 58 | 19 % | −23 | 0 |
| 1280 | 88 | 43 | 19 % | −13 | 0 |
| 1024 | 84 | 41 | 19 % | −9 | 0 |
| 834 | 111 | 49 | 19 % | −18 | 0 |
| 390 | 80 | 47 | 19 % | −7 | 0 |

- **Desktop 1440:** Podium deutlich sichtbar (49 px Kuppel, 19 % Sättigung).
- **1920:** keine erneute Überdimensionierung — die Podium-Höhe steigt
  proportional zum Desktop, aber der Bottom-Space sinkt um 23 px, die
  Dokumenthöhe ist **kleiner** als vorher.
- **1280 / 1024:** gleiche visuelle Idee, Sättigung identisch 19 %.
- **Tablet 834:** kompakt — Podium 111 px, sichtbare Kuppel 49 px,
  Dokumenthöhe −18 px.
- **Mobile 390:** weiterhin sichtbar und kompakter als Desktop — Podium
  80 px (Basis wäre 99 px), sichtbare Kuppel 47 px, Dokumenthöhe −7 px.
  Kein horizontaler Overflow.

---

## 10. Invarianten

### SW-05 — Content / Results / Intelligence im normalen Flow ✅ GREEN
- Dokumentreihenfolge in allen 6 Viewports geprüft und korrekt:
  `content → results → columns → intelligence → fade → footer → floor`.
- Kein `position: absolute` und kein `bottom:` an `.search-world__columns`,
  `.search-world__intelligence`, `.search-world__fade`, `.search-world__floor`
  (im Test festgeschrieben).
- Keine Overlaps: der einzige Überlapp ist die bereits in SW-09 etablierte
  Kopplung Footer ↔ Podium; alle übrigen Elemente sind streng aufeinander
  folgend (Reihenfolge-Test bestanden).
- `min-height` der World greift in keinem Viewport (1896 > 1044,
  1996 > 1252.8, 1858 > 928, 1857 > 890.88, 2922 > 1180, mobil 0) — kein
  dynamischer Platzhalter.

### SW-06 — Results Workspace offen ✅ GREEN
`background: rgba(0, 0, 0, 0)`, `border-top-width: 0px` in allen 6 Viewports —
vorher wie nachher identisch. Keine gemeinsame Results-Box.

### SW-07 — Results breit, Sidebar unverändert ✅ GREEN
`sidebar = 360 px` bei 1440/1920/1280/1024, Karten 968 px (1440),
`cardsPerRow = 1`, `.match-list` `display: flex` — vorher wie nachher
identisch in allen Viewports.

### SW-08 — Intelligence World kompakt + zentral ✅ GREEN
- Columns-Höhe **unverändert**: 207 / 248 / 190 / 190 / 211 / 143 px.
- Zentrierung: Gruppenmitte exakt auf der Viewportmitte, Offset **0** in
  allen 6 Viewports (vorher wie nachher).
- Deck-Höhe **unverändert**: 189 / 227 / 175 / 175 / 211 / 135 px.

### SW-09 — Footer vor Podium, Podium ganz unten, Podium hinter Footer ✅ GREEN
| Prüfung | 1440 | 1920 | 1280 | 1024 | 834 | 390 |
|---|---|---|---|---|---|---|
| Podium `z-index` | 0 | 0 | 0 | 0 | 0 | 0 |
| Footer `z-index` | 1 | 1 | 1 | 1 | 1 | 1 |
| Podium `position` / `pointer-events` | relative / none | | | | | |
| `aria-hidden` | true | true | true | true | true | true |
| Podium in `.search-world` | false | false | false | false | false | false |
| `border-radius` `::before` / `::after` | `50% 50% 0 0 / 100% 100% 0 0` | | | | | |
| `restAfterPodium` | 0 | 0 | 0 | 0 | 0 | 0 |

Die Form ist damit **nicht ersetzt**, sondern erhalten: beide Pseudo-Elemente
tragen unverändert den halbrunden elliptischen Radius. Nur die Höhen-, Lage-
und Farbwerte wurden angepasst.

### SW-10 — Intelligence World bleibt kompakt ✅ GREEN
- Columns, Deck und deren Werte sind byte-identisch geblieben (§10 SW-08).
- **Deck-Clipping-Prüfung:** alle 14 sichtbaren Kindelemente (15 im Markup,
  `particles` überlagert die Box vollflächig) geometrisch geprüft.
  `clipped = []` in allen 6 Viewports. Tiefstes **Inhalts**-Element
  `panel--b`: 168/189 = 89 % (1440), 202/227 = 89 % (1920), 153/175 = 87 %
  (1280), 151/175 = 86 % (1024), 197/211 = 93 % (834) — unverändert
  gegenüber vorher. Auf 390 sind alle Deck-Inhalte `display: none`
  (vorbestehender Zustand, unverändert).
- Die vier SW-10-Stellschrauben bleiben innerhalb der dort gesetzten
  Obergrenzen; nur der Fade wurde von `11vh/140` auf `8.5vh/112` verkürzt
  (die SW-10-Invariante war eine Obergrenze, keine Untergrenze).

### SW-11 — ZielinvARIanten
| Ziel | Status | Nachweis |
|---|---|---|
| Podium sichtbar | **GREEN** | sichtbare Kuppel 41–58 px (vorher 39–54), 99–118 sichtbare Zeilen, Kontrast 54 (vorher 15) |
| Podium stärker blau integriert | **GREEN** | Sättigung 6 % → 19 %, blaue Zeilen 0 → 39–59 px, Seitenende `rgb(195,220,238)` |
| Bottom Space kleiner | **GREEN** | Fade −11 bis −27 px je Viewport |
| Gesamthöhe nicht größer | **GREEN** | kleiner in allen 18 Zuständen (−7 bis −23 px) |
| kein weißer Nachlauf | **GREEN** | `istReinweiss` false in allen 18 Zuständen |
| Footer-Inhalt unverändert | **GREEN** | Text, innere Elemente, Computed Style, Höhe, Padding identisch |
| 0 px Overflow | **GREEN** | `overflowX = 0` in allen 18 Zuständen |

---

## 11. BG-STATE-01 Regression ✅ GREEN
Feld-für-Feld-Vergleich vorher/nachher, alle 6 Viewports:

| Merkmal | Ergebnis |
|---|---|
| `background-size` | `cover, cover` — **identisch** |
| `background-position` | `50% 0%, 50% 0%` — **identisch** |
| Background-Opacity | `1` — **identisch** |
| Background-Box-Höhe | 820 / 985 / 729 / 700 / 896 / 539 px — **identisch** |
| `.search-world::before` Farbe | `rgba(0, 0, 0, 0)` — **identisch** |
| `.search-world::before` Höhe | 270 / 324 / 240 / 230.391 / 333.594 / 253.188 px — **identisch** |
| `.search-world` `min-height` | `1044px` / `1252.8px` / `928px` / `890.88px` / `1180px` / `0px` — **identisch** |
| `.search-world` `overflow` | `hidden` — **identisch** |

Einzige Abweichung: die **Höhe der World-Box** selbst, und zwar exakt um die
Fade-Differenz (1919→1896, 2023→1996, 1874→1858, 1869→1857, 2944→2922,
3288→3276). Das ist die gewollte Bottom-Space-Kompression, kein
Background-Effekt. Keine Overlay-Opacity, kein globales Weiß, keine
Gradient-Streckung, keine neue Hintergrundebene.

---

## 12. SW-04 Regression ✅ GREEN
| Viewport | `--sw-progress` gesetzt | p bei 0 % / 50 % Scroll | AI > MATCH > ATS | Podium-Transform |
|---|---|---|---|---|
| 1440 | ja (auf `.search-world`) | 0.3073 / 0.6400 | 15.4 > 9.0 > 5.1 ✅ | `matrix(1,0,0,1,0,0)` |
| 1920 | ja | 0.3082 / 0.6578 | 15.8 > 9.2 > 5.3 ✅ | `matrix(1,0,0,1,0,0)` |
| 1280 | ja | 0.3037 / 0.6275 | 15.1 > 8.8 > 5.0 ✅ | `matrix(1,0,0,1,0,0)` |
| 1024 | ja | 0.3021 / 0.6224 | 14.9 > 8.7 > 5.0 ✅ | `matrix(1,0,0,1,0,0)` |
| 834 | ja | 0.2773 / 0.6270 | 15.0 > 8.8 > 5.0 ✅ | `matrix(1,0,0,1,0,0)` |
| 390 | ja | 0.2331 / 0.6018 | 6.0 > 3.6 > 1.8 ✅ | `matrix(1,0,0,1,0,0)` |

`--sw-progress` liegt unverändert auf `.search-world`, die Differenzierung
AI > MATCH > ATS ist erhalten. Das Podium liegt außerhalb der World und ist
deshalb **statisch** (Identitäts-Transform, keine Scrollbewegung) — wie
bereits in SW-09/SW-10 festgehalten. Es wurde keine neue Bewegung eingeführt.

**Reduced Motion:** `--sw-progress` leer, Podium-Transform `none`, Podium
vorhanden (99 px), World 1479 px, Columns 207 px, Fade 77 px — Deko
vollständig erhalten.

---

## 13. Nicht-Search-Routen ✅ GREEN
`login`, `register`, `impressum`: jeweils **0** Podium, **0** `.search-world`,
**0** Columns, 0 JS-Errors — identisch zu SW-09/SW-10. Nur `/top` (und die
Search-World-Routen) zeigen Podium und World.

---

## 14. Tests / TSC / Build / Browser

- `src/SearchLayout.test.tsx`: **1 Test ergänzt** — „SEARCH-WORLD-11: Podium
  bleibt sichtbares, blau integriertes Element ohne Bottom-Auslauf":
  1. die sichtbare Kuppel (`height` − Überdeckung) muss bei **jeder**
     Viewport-Höhe von 320 bis 1200 px **≥ 40 px** betragen — schließt ein
     Zurückfallen auf eine Randlinie aus;
  2. Überdeckung muss kleiner sein als die Box (die Kuppel darf nie
     vollständig hinter dem Footer verschwinden);
  3. der `::before`-Verlauf muss die blauen Toene
     `rgba(70,150,205,0.3)` und `rgba(133,196,238,0.42)` enthalten — kein
     Zurückfallen auf blasses, faktisch farbloses Glas;
  4. die Bogen-Lichtkante muss ≥ 0.5 Deckkraft haben;
  5. der Fade darf nicht wieder zum Feld wachsen (≤ 9 vh, ≤ 120 px);
  6. SW-09-Baseline bleibt Grundlage: `width: 100%`, `z-index: 0`,
     `pointer-events: none`, `position: relative`, kein `bottom:`, und beide
     Pseudo-Elemente tragen unverändert `50% 50% 0 0 / 100% 100% 0 0`.
- **Anpassung am SW-10-Test:** die dort festgeschriebene Podium-Obergrenze
  wurde von 104 px auf den neuen SW-11-Stand 124 px aktualisiert (SW-11 erlaubt
  die Höhenänderung ausdrücklich). Alle anderen SW-10-Assertions bleiben.
- **729 passed / 5 skipped / 0 failed** (vorher 728).
- `npx tsc -b` **PASS**.
- `npm run build` **PASS** (nur die vorbestehende Chunk-Size-Warnung).
- Browser: **0 JS-Errors** in allen 18 Zuständen (A/B/C × 6 Viewports),
  im Reduced-Motion-Lauf und auf allen vier Nicht-Search-Routen.

---

## 15. Git
Branch `main`, Ausgangs-HEAD `d3c1fe2`. Geänderte Dateien:
`src/styles.css` (8 Deklarationen in 5 Regeln: Podium-Höhe Basis/Tablet/Mobile,
Podium-Überdeckung Basis/Mobile, `::before`-Verlauf, `::after`-Kante/Maske,
Fade-Höhe Basis/Tablet/Mobile), `src/SearchLayout.test.tsx` (1 Test + 1
Anpassung), dieser Report. Die vier vorbestehenden Screenshot-Diffs wurden
nicht angefasst und nicht mit committed.

---

## 16. Working Tree
Nach Commit/Push enthält der Working Tree ausschließlich die vier
vorbestehenden, nicht zu diesem Task gehörenden Screenshot-Diffs:
`D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_09.png`,
`D docs/screenshotsfordev/ChatGPT Image 12. Sept. 2026, 16_52_12.png`,
`?? docs/screenshotsfordev/Animierter KI-Jobstream im Neon-Design.png`,
`?? docs/screenshotsfordev/Screenshot 2026-10-02 at 13-07-10 May's Job Matcher.png`

---

## 17. Offene Fragen
Keine. Der einzige Ermessensspielraum war die Aufteilung der
Überdeckungshöhe zwischen Desktop und Mobile. Sie wurde so gewählt, dass auf
Mobile die sichtbare Kuppel mit 47 px **größer** ist als vorher (42 px) und
nicht kleiner — dafür ist dort eine eigene, kleinere `margin-top`-Deklaration
notwendig geworden, weil der Mobile-Footer mit 208 px deutlich höher ist.

---

## 18. Risiken
Gering. Die Änderung betrifft ausschließlich ein rein dekoratives,
`aria-hidden`-markiertes und `pointer-events: none` gesetztes Element ohne
Interaktionsfunktion sowie die Höhe eines rein atmosphärischen Fade-Layers.
Kein Text, keine Navigation, kein Layout des Inhalts wurde berührt. Abgesichert
durch: 18 Zustände (A/B/C × 6 Viewports) vor **und** nach der Änderung
vermessen, Footer per Text-, Struktur- und Computed-Style-Vergleich als
unverändert bewiesen, Naht Fade→Footer mit Stufe 0, WCAG-Kontrast des
Footertexts geprüft, Deck-Clipping und alle SW-04…SW-10-Invarianten
nachgemessen, BG-STATE-01 Feld-für-Feld verglichen.

---

## 19. Empfohlene nächste Schritte
Keine. **HARD STOP** nach SEARCH-WORLD-11: keine weiteren
SEARCH-WORLD-Änderungen automatisch beginnen.

---

## 20. Resume Point
Abgeschlossen, committed und gepusht. Fortsetzung nur auf ausdrückliche neue
Anweisung.

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; Ausgangs-HEAD: `d3c1fe2`
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 729/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: `src/styles.css` (Podium-Höhe und -Überdeckung in Basis +
  Tablet + Mobile, `::before`-Verlauf, `::after`-Lichtkante und -Maske,
  Fade-Höhe in Basis + Tablet + Mobile), `src/SearchLayout.test.tsx`
  (1 Test, 1 Anpassung der SW-10-Obergrenze), dieser Report
- Risiken: gering (Geometrie und Farbwirkung dekorativer Layer). Überbreite
  0 px, Dokumenthöhe in allen 18 Zuständen kleiner, Deck-Clipping GREEN,
  Podium hinter Footer mit unveränderter Form, Footer per Text/Struktur/
  Computed Style identisch, Naht Stufe 0.
- Nächste Schritte: keine
- Resume-Punkt: abgeschlossen

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung
dokumentiert: **NEIN** — es wurden ausschließlich Höhen-, Positions- und
Farbwerte eines bereits bestehenden, rein dekorativen und
`aria-hidden`-markierten Layers sowie die Höhe eines bestehenden
atmosphärischen Fade-Layers geändert. Keine Änderung an KI-Ausführung,
Modellnutzung, Provider, Datenverarbeitung, Persistenz, Tracking, Auth oder
API. Die Testfixture-Mocks (`/api/models`, `/api/jobs`, `/api/match`) wurden
ausschließlich lokal in einer Mess-Session im Browser-Playwright-Router
verwendet und sind nicht Teil des Codes.
`docs/AI_AUDITLOG.md` bleibt daher unverändert.
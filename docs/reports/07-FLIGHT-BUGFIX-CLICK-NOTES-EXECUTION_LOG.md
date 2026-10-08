# EXECUTION LOG — 07-FLIGHT-BUGFIX-CLICK-NOTES

## Current Status
GREEN — Implementierung + Unit-Tests + TSC + Build + Browser-Verifikation abgeschlossen.

## Audit Date/Time
2026-01-07

## Git
- Branch: `main`
- HEAD vor Änderung: `44797c0`
- Working Tree (dieses Audit): `src/components/JobStream.tsx`, `src/components/JobStream.test.tsx`, `docs/reports/07-…-EXECUTION_LOG.md`
- Nicht von diesem Audit geändert (vorgefunden, unangetastet): `.opencode/agents/*.md`, `AGENTS.md`

## Scope
Fix der an click-erzeugten (dynamic) Notes beobachteten Defekte:
1. **Zu viele Karten**
2. **Back-Jump** zum Ausgangspunkt in unregelmäßigen Abständen
3. **Zwei-Richtungs-Effekt** — sichtbar fast nur vertikale/horizontale Flugrichtung

## Completed Sections
- [x] Root-Cause-Analyse (4 eigentständige Ursachen)
- [x] Implementierung
- [x] Unit-Nachweis inkl. Bildschirm-Verteilung
- [x] `npx tsc -b`
- [x] `npm test -- --run`
- [x] `npm run build`
- [x] Browser-Verifikation (1440 / 834 / 412, echte Klicks)
- [x] `git diff --check`
- [ ] Review
- [ ] Commit / Push

---

## FINDING 1 — Back-Jump: instabiler `onRecycle`-Referenz

**ROOT CAUSE BACK-JUMP**

Der Dynamic-Recycle-Handler wurde im Render-Block als Inline-Lambda erzeugt:

```tsx
onRecycle={isDynamicNote(note) ? (id) => setDynamicNotes(prev => prev.filter(...)) : recycle}
```

Jede Parent-Render erzeugt eine **neue Funktionsreferenz**. `onRecycle` ist
Dependency des `useEffect` in `StreamNoteView`. Neue Referenz → Effekt läuft
erneut → im Cleanup `anim.cancel()`, danach neue WAAPI-Animation → die Note
springt auf den Pfadanfang zurück. Da Renderings unregelmäßig auftreffen
(Match-Puls, Resize, State), passierte das in **unregelmäßigen Abständen** —
exakt das beobachtete Symptom.

**STATE/LIFECYCLE FIX**
- `handleDynamicRecycle` als `useCallback(..., [])` memoisiert; im Render
  referenziert statt erzeugt.
- Dependency in `StreamNoteView` zu `isDynamic ? undefined : size`, damit
  Resize-Renders Dynamic-Notes nicht neu starten (Base-Notes reagieren weiter).
- **`sizeRef` parallel zum `size`-State** (siehe Finding 4).

**Messung (Browser, In-Page-Monitor, Element-Identität statt Index):**
`maxRückwärts = 0 px` über 8–9 Karten je Viewport. Vorher: Sprünge > 160 px.

---

## FINDING 2 — Richtungseffekt (a): Clamp-Verzerrung

**ROOT CAUSE TWO-DIRECTION, Teil 1**

Die ursprüngliche `createDynamicNote` wählte eine der 4 Kanten als Start mit
Fixwerten `-0.1` / `1.1` und clamped die Endpunkte anschließend auf
`[-0.2, 1.2]`. Der Clamp zog Diagonalen auf Rechteck-Ecken zusammen → Endpunkte
landeten massenhaft exakt auf den Grenzwerten → die interpolierte Strecke wurde
achsenaligned. Zusätzlich waren Startkante und Winkel unabhängig, wodurch viele
Bahnen praktisch null Länge hatten.

**MATHEMATICAL FIX (Teil 1):** Ray-Box-Clipping statt Clamp. Winkel wird einmal
über 2π gezogen, ein Strahl durch eine zufällige Lotachse wird gegen den
Play-Bereich `[-0.15, 1.15]²` geclippt → Start/Ende liegen exakt auf dem Rand,
keine Achsenverzerrung durch Clamp.

---

## FINDING 3 — Richtungseffekt (b): Rejection-Sampling-Verzerrung

**ROOT CAUSE TWO-DIRECTION, Teil 2**

Gemessen über 20 000 Pfade (16 × 22,5°-Buckets):

```
vorher: Ratio Max/Min 2.45x   Diagonalen 3.71 %   achsnah 69 %
nachher: Ratio Max/Min 1.13x  Diagonalen ~6.1 %    achsnah 50.4 %
```

Ursache: Der Winkel wurde **gezogen, dann verworfen**, wenn der Pfad die
Safe Zone kreuzte oder `pathLength < 1.0` war. Diagonale Chords durch die Box
fast immer verworfen (sie müssen entweder die zentrale Zone kreuzen oder sind
nach Ausweichen zu kurz), axiale Randbahnen praktisch nie → Achsen-Häufung.

**MATHEMATICAL FIX (Teil 2):** Winkel wird **einmal** gezogen und **nie**
verworfen. Statt den Winkel zu verwerfen, wird der Pfad senkrecht um
`d ∈ [-0.65, 0.65]` verschoben, bis er die Safe Zone umgeht. Damit ist die
Winkelverteilung exakt uniform, weil der einzige Uniformitäts-bruch entfällt.

---

## FINDING 4 — Richtungseffekt (c): Aspekt-Verzerrung + veralteter Closure

**ROOT CAUSE TWO-DIRECTION, Teil 3 — die eigentlich sichtbare Ursache**

Zwei getrennte, aufeinander aufbauende Fehler:

**(c1) Aspekt-Verzerrung.** Der Layer ist z. B. `1440×738` (Aspekt 1,95).
Eine im normalisierte Raum uniforme Winkelmenge wird beim Render durch
`dx * W` gegen `dy * H` verzerrt:

```
normale Richtung : Ratio 1.31x, achsnah 51.2 %
Bildschirmrichtung: Ratio 4.06x, achsnah 56.5 %   ← das Sichtbare
```

**MATHEMATICAL FIX (c1):** Winkel wird im **Bildschirmraum** gezogen und in
normalisierte Koordinaten zurückgerechnet:

```
(dx_norm, dy_norm) ∝ (cos θ / W, sin θ / H)
```

`dims` ist deshalb ein Pflichtparameter — ein Default `{w:1,h:1}` würde die
Verzerrung stillschweigend reintroduzieren.

**(c2) Veralteter Closure-Wert.** Der `useEffect` für USER_PULSE hat
`[count, hardCap]` als Deps, der Auto-Refill `[count, hardCap, staticMotion]` —
**keiner hängt von `size` ab**. Bei erstem Render ist `size = {0,0}`; erst
anschließend misst der Measure-Effekt. Die Handler behalten also den
Erst-Render-Wert `{0,0}`, und mein Fallback griff:

```
Desktop: Fallback 1440×738 == echte Layer 1440×738  → zufällig korrekt ✓
Mobile : Fallback 1440×738 != echte Layer  412×915  → falsch ✗
```

Verzerrungsfaktor beim Rendern: `(412/1440) / (915/738) = 0.286 / 1.240`,
y also **4,34× stärker** als x. Damit ergibt sich das axiale Band (±22,5°):

```
nah vertikal   2 × 121.8°
nah horizontal 2 ×  10.9°
= 265.4° / 360° = 73.7 %   →   gemessen exakt 74 %
```

**STATE/LIFECYCLE FIX (c2):** `sizeRef` wird im Measure-Effekt parallel zum
`size`-State geschrieben; `createDynamicNote` liest ausschließlich
`sizeRef.current`. Damit hängen die erzeugenden Callbacks nie an einem
veralteten Maß.

**Messung (exakte WAAPI-Keyframes, n ≈ 27 je Viewport, ±22,5°):**

| Viewport | vorher | nachher | erwartet |
|---|---|---|---|
| desktop-1440 | 63 % | **54 %** | ~50 % |
| mobile-412 | **74 %** | **41 %** | ~50 % |
| tablet-834 | – | **56 %** | ~50 % |

σ bei n=27 ≈ 9,6 % → 2σ-Bereich 31–69 %; alle Werte darin. 3–4 leere Buckets
sind exakt der Erwartungswert (e⁻¹·⁷ · 16 ≈ 3).

---

## FINDING 5 — zu viele Karten: Side-Effect im State-Updater

Der Auto-Refill rief `scheduleAuto()` **innerhalb** von
`setDynamicNotes((prev) => …)`. Bei React-StrictMode-Doppelausführung
entstanden konkurrierende Timer, die unabhängig voneinander Karten erzeugten.
Zudem prüften beide Handler die Kapazität mit einer lokal neu berechneten
`hardCap`.

**FIX:** Timer-Planung ausschließlich außerhalb des Updaters, `disposed`-Flag
im Cleanup, ein einziger `timeoutId`, `hardCap`/`count` als gemeinsame Basis
plus Effekt, der `dynamicNotes` bei sinkendem `count` trimmt.

**Messung:** 16 schnelle Klicks → `21 / 21` (desktop), `36 / 36` (mobile),
`CAP_OK` je Viewport; `hOverflow = 0`.

---

## FINDING 6 — eigener Messfehler: Safe-Zone-Schutz griff nicht

**WICHTIG — korrigierte Falschaussage in diesem Log (v1):**
„0 Safe-Zone-Kontakte über 40 000 Pfade" war **falsch**. `safeZonePenalty`
zählte Stichproben (`steps = 24`) entlang der Strecke; bei ~1,3 Einheiten
Länge ist der Abstand 0,054, die Safe-Zone-Schneiden sind jedoch fast immer
flachere Ecken-Streifen. Die Stichprobe übersah sie vollständig.

Referenzmessung mit exaktem Liang-Barsky-Clipping, gleicher RNG-Strom,
gleiche Pfade:

```
steps=24  →   0 Treffer   (alle „grün" — falsch)
steps=30  →  65 Treffer
steps=200 → 157 Treffer
exakt     → 183 von 4000 = 4,6 % kreuzten wirklich die Hero-Zone
```

**FIX:** `safeZonePenalty` liefert jetzt exakt den **Längenanteil** der
Strecke innerhalb der Zone (Liang-Barsky), `segmentCrossesSafeZone` ist
davon abgeleitet. Zusätzlich Prioritätsdreh: Runde 2 erlaubt Pfadlänge bis
0.85, beharrt aber auf Safe-Zone-Freiheit — Hero-Kollision ist verboten,
eine ~10 % kürzere Bahn ist nicht sichtbar.

**Messung:** analytisch **0 von 4000** Überlappungen über 4 Viewports
(1440×738, 412×915, 834×912, 1×1), 0 Null-Rückgaben, Ausbeute 4000/4000.

---

## Files Changed
- `src/components/JobStream.tsx`
- `src/components/JobStream.test.tsx`
- `docs/reports/07-FLIGHT-BUGFIX-CLICK-NOTES-EXECUTION_LOG.md` (neu)

## Evidence / Verification

### Unit (`JobStream.test.tsx`, 20 Tests)
- Quadranten: Bildschirmrichtung, alle vier belegt
- **Bildschirm-Verteilung** (Regression Aspekt): Ratio < 1.7x, achsnah < 60 %
- `angle`-Uniformität, 4000 Samples
- Pfadgeometrie, `relLength`-Bounds, Dauer immer in 11–17 s
- Safe Zone: 2000 Pfade, exakt 0 Überlappung
- **Neu:** Sampling-Artefakt-Regression — flacher Ecken-Schnitt muss exakt
  erkannt werden; Kantenberührung zählt nicht; Innenstrecke = Anteil 1

### Commands
| Check | Ergebnis |
|---|---|
| `npx tsc -b` | EXIT 0 |
| `npx vitest run src/components/JobStream.test.tsx` | 20/20 passed |
| `npm test -- --run` | 749 passed, 5 skipped, 63 Dateien |
| `npm run build` | EXIT 0 |
| `git diff --check` | 1 Vorwurf, **vorgefunden** in `.opencode/agents/tester.md` (nicht geändert) |

### Browser (Playwright, echte Klicks)
| Prüfung | desktop-1440 | mobile-412 |
|---|---|---|
| Base / Hard-Cap | 11 / 21 | 26 / 36 |
| nach 16 schnellen Klicks | 21 `CAP_OK` | 36 `CAP_OK` |
| Back-Jump (Monotonie) | **0 px** | **0 px** |
| horizontales Overflow | 0 | 0 |
| JS-Fehler | NONE | NONE |
| achsnah (Keyframes) | 54 % | 41 % |

## Classification
GREEN

## Open Questions / Risks
- Browser-Messungen n ≈ 27 je Viewport; Werte im 2σ-Bereich, aber kein
  Zahlenbeweis mit n ≥ 100. Die engine-seitige Großmessung (4000 je Viewport)
  ist der belastbare Nachweis, die DOM-Messung bestätigt die Kette.
- `git diff --check` meldet einen Vorwurf in `.opencode/agents/tester.md`;
  vorgefunden, nicht Teil dieses Audits, unangetastet gelassen.
- Basis-Notes (11/17/26) + Headroom (+10) entspricht JOBSTREAM-06-Spezifikation.

## Recommended Next Actions
1. Review der drei geänderten Dateien
2. Commit + Push
3. Kein Production Deploy

## Resume Point
Alle Checks GREEN, Temporärskripte entfernt. Nächster Schritt: Commit.

---

# RUNDE 2 — TASK 08: Basis-Noten-Richtung, Auto-Puls, manuelles +10

- **Status:** IN PROGRESS (Messung abgeschlossen, Fix offen)
- **Stand:** 2026-10-07
- **Branch:** main, HEAD `8d0655b`
- **Auslöser (Anwender):** „diese karten die ganze zeit fast nur vertikal oder
  horizontal fliegen … sollten in 360 grad zufällig fliegen", „der pulsar
  sollte von sich aus aufblinken wenn eine karte im automatischen prozess
  anfängt zu fliegen oder man klickt darauf", „ zusätzlich zu dem max im
  automatischen prozess darf das manuelle klicken auf den pulsar +10 karten
  zusätzlich erstellen".
- **Workflow:** docs/AI_AUDITLOG.md, Read-only Audit → gefundene Fehler → Fix.
- **Execution Log:** diese Datei (laufend aktualisiert).

## Audit Scope (Runde 2)
Alle Karten im JobStream (nicht nur dynamische), Pulsar-Sichtbarkeit bei
Auto-Refill, Kapazitätsregeln Auto vs. manuell.

## Completed Audit Sections (Runde 2)
- [x] Vorbefund `8d0655b` identifiziert (drei Dateien, Produktiv-Deploy nein)
- [x] Ursache „nur vertikal/horizontal" empirisch gemessen
- [x] Pulsar-Verhalten im Code geprüft
- [x] Kapazitätslogik geprüft

## Actual Findings (Runde 2)

### FINDING 7 — Basis-Noten fliegen fast nur vertikal/horizontal (ORANGE)
**Korrigiert am 2026-10-07:** Der erste Entwurf dieses Findings enthielt aus
der Hand geschätzte Lane-Koordinaten und Winkel. Ersetzt durch gemessene
Werte (Quelle: `src/__measure__/dirbase.test.ts`, engine-seitig; und
`.srcdir-measure.mjs`, browser-seitig). Nur die gemessenen Zahlen gelten.

**Ursache:** `LANES` ist im normalisierten Raum definiert, die Animation
rechnet aber `startX * size.width` / `startY * size.height` (StreamNoteView).
Die X- und Y-Skalen unterscheiden sich beim echten Layer (z. B. 1440×738,
Aspekt 1.95), der Richtungswinkel wird also verzerrt. Zusätzlich sind die
LANES-Richtungen **im Normraum bereits selbst achsnah** (Lane 0: 8.3°,
Lane 1: 6.6°, Lane 2: 82.4°, Lane 6: −8.7° …) — die Aspektverzerrung ist nur
der Verstärker, nicht die eigentliche Ursache.

**Gemessene Bildschirmwinkel — achsnah = Abstand < 22.5° zum nächsten
Vielfachen von 90° (fairer Erwartungswert = 50 %):**

| Viewport | vorher (Vorlauf `8d0655b`) | nachher (dieser Fix) |
|---|---|---|
| Desktop 1440×738 (n=1661) | **91.4 %** | **49.5 %** |
| Tablet 834×1112 (n=2567) | **97.0 %** | **47.9 %** |
| Mobile 412×915 (n=3926) | **87.5 %** | **49.0 %** |

Messgrundlage: identische Seeds und identische Recycle-Folge für alte und neue
Erzeugung, `src/__measure__/dirbase.test.ts` (Vorlauf-Quelle exakt aus
`git show 8d0655b:src/components/JobStream.tsx`).

**Browser-Gegenprobe vor dem Fix (echte WAAPI-Keyframes, `data-source` getrennt):**

| Viewport | Basis-Noten | Dynamische Noten |
|---|---|---|
| Desktop 1440×738 | 72.7 % (n=22) | 0.0 % (n=10) |
| Tablet 834×1112 | 100.0 % (n=34) | 62.5 % (n=16) |
| Mobile 412×915 | 90.0 % (n=50) | 0.0 % (n=9) |

→ Die dynamischen Noten sind seit `8d0655b` sauber, die **Basis-Noten**
(11/17/26 Stück) sind die achsnahen Karten. Auf Mobile sind das 26 von 36
sichtbaren Karten → der Anwender-Eindruck „fast nur vertikal oder horizontal"
wird vollständig erklärt.

**Konsequenz:** Basis-Noten müssen ebenfalls im Bildschirmraum erzeugt werden
(Ebenfalls-Engine: `createDynamicPath`), inkl. Neuaufbau bei Layer-Maß-Änderung.

### FINDING 8 — Auto-Refill löst keinen Pulsar-Blitz aus (YELLOW)
**Beweis:** `MatchPulse` emittiert nur `USER_PULSE_EVENT` (Klick). Der
Auto-Refill in JobStream (`setTimeout` + `scheduleAuto`) erzeugt Noten,
dispatcht aber kein Event; `MatchPulse` kennt nur `MATCH_PULSE_EVENT`.
→ Bei automatischem Start blitzt die Pulsar-Grafik nicht auf.

### FINDING 9 — Manuelle Klicks sind an dieselben Grenzen gebunden (YELLOW)
**Beweis:** `maxDynamic = hardCap - baseCount` (≈ +10) gilt für Auto-Refill
und `handleManualSpawn` identisch; `trim()` entfernt zusätzlich jede Note
über `hardCap`. Wunsch „manuell +10 zusätzlich" ist damit nicht abbildbar.

## Fixes (Runde 2) — implementiert 2026-10-07

### ROOT CAUSE (FINDING 7) — Basis-Richtung
`LANES`/`recycleNote`-Bänder waren im normalisierten Raum definiert UND dort
bereits achsnah; die `* width / * height`-Projektion verstärkte das je nach
Aspekt. Fix: Basis-Noten nutzen jetzt exakt die Dynamic-Path-Engine
(`createDynamicPath`) — Winkel uniform über 2π im Bildschirmraum,
aspekt-korrekt zurückgerechnet, Safe Zone garantiert frei. `dims` ist Pflicht
bei `buildStreamNotes(seed, dims)` und `recycleNote(prev, rng, dims)` (kein
stillverzerrender Default). Neuaufbau bei Layer-Maß-Änderung (eigener Effekt,
führt `gen` mit → keine ungewollten Key-Resets).

### FIX (FINDING 8) — Auto-Puls
Neues Event `AUTO_PULSE_EVENT = "lp2:auto-pulse"` (MatchPulse.tsx). JobStream
dispatched es REAKTIV (Effekt zählt 'auto'-Noten; bei Zuwachs → dispatch) —
der Timer-Updater bleibt seiteneffektfrei (StrictMode-sicher). MatchPulse
lauscht darauf und ruft `triggerVisualPulse()`. Klickblitz bestand bereits.

### FIX (FINDING 9) — Manuell +10 über Auto-Max
`autoMax = hardCap - count` (=+10, unverändert) bleibt das Auto-Fenster.
Neu `clickMax = autoMax + MANUAL_EXTRA_NOTES` (Export, =10). User-Klicks
dürfen bis zum Klickfenster; Trim-Hard-Cap läuft gegen `clickMax`. Auto zieht
keine manuellen Karten weg.

## Files Changed (Runde 2)
- `src/components/JobStream.tsx` — LANES/Bänder entfernt (`LANE_COUNT`,
  `FALLBACK_PATH`), Engine für Basis+Recycle, Rebuild-effekt, `autoMax`/
  `clickMax`, `MANUAL_EXTRA_NOTES`, reaktiver AUTO_PULSE_EVENT-Dispatch.
- `src/components/MatchPulse.tsx` — `AUTO_PULSE_EVENT` + Listener.
- `src/components/JobStream.test.tsx` — 26 Tests (+6), `dims`-Pflicht an
  alle Basis-Aufrufe, neue Regressionstests (Richtung, Play-Box,
  Determinismus, Kapazität, Auto-Puls).
- `docs/reports/07-FLIGHT-BUGFIX-CLICK-NOTES-EXECUTION_LOG.md` — diese Datei.

## Test Result (Runde 2, 2026-10-07)
- `npx tsc -b` → 0 Fehler
- `npm test -- --run` → **755 passed, 5 skipped** (63 Dateien)
- `npm run build` → EXIT 0 (nur vorbestehende Chunk-Größen-Warnung)
- `git diff --check` → nur vorbestehender Vorwurf `.opencode/agents/tester.md`
  (nicht Teil dieses Audits, unangetastet)

## Visual Result (echter Chrome, native WAAPI-Keyframes, Element-Dedup)
achsnah = ±22.5°, fairer Wert 50 %:

| Viewport (Layer) | Basis vorher→nachher | Dynamisch nachher |
|---|---|---|
| Desktop (1440×605) | 91–97 % → **45.5 %** | 35.0 % (n=20) |
| Tablet (834×912) | → **45.2 %** | 50.0 % (n=20) |
| Mobile (412×915) | → **51.1 %** | 40.0 % (n=20) |

- Auto-Puls E2E: AUTO_PULSE_EVENT bei t≈19.5 s und ≈41.6 s, `is-pulsing=true`
  synchron im Event, 0 JS-Errors.
- Kapazität E2E: 24 schnelle Klicks → 20 User-Noten (= clickMax) auf allen
  Viewports; Auto-Fenster ≤ 10 (Unit-Test).
- Resize 900→400→900: Basis-Counts 17→26→17, achsnah 52.9/50/64.7 (n=17
  Snapshot), 0 JS-Errors.
- `hOverflow`: keine horizontalen Überschreitungen beobachtet.

## Regression (Runde 2)
Keine: Runde-1-Bugfixe (Back-Jump, 360°-Dynamik, Kapazität +10-Auto-Fenster,
JOBSTREAM-05-Baseline) bleiben bestehen — alle Alttests grün. Dynamische
Noten unverändert in Pfad-/Lifecycle-Logik; nur Basis-Erzeugung/Recycle
umgestellt. Pulsar-Verhalten beim Klick unverändert.

## Classification (Runde 2) — final
- FINDING 7 Basis-Richtung: **GREEN** (fixiert, gemessen engine+e2e)
- FINDING 8 Auto-Puls: **GREEN** (fixiert, Unit+E2E)
- FINDING 9 Klickfenster: **GREEN** (fixiert, Unit+E2E)

## Git status (Runde 2)
- HEAD vor Fix: `8d0655b`. Geändert: die vier oben genannten Dateien.
- Angefasst nicht: `.opencode/agents/*.md`, `AGENTS.md` (Vorbefunde).

## Recommended Next Actions (Runde 2)
1. Review der vier geänderten Dateien
2. Commit + Push (nach Freigabe)
3. Kein Production Deploy

## Resume Point (Runde 2)
Alle Checks GREEN, temporäre Skripte (.srcdir-measure.mjs,
.autopulse-verify.mjs, src/__measure__/) entfernt. Offen: Commit-Freigabe.

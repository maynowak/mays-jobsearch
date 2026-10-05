# SEARCH-WORLD-02 — Architektonische Verpackung (Top-Light / Intelligence-Deck / Boden)

## Status
DONE (rein visuelle Verpackung; keine Animation, keine Logik-/API-Änderung)

## 1. Ausgangszustand (SEARCH-WORLD-01)
- `HERO` → Search-World mit Hintergrundbild + Intelligence-Deko (AI/JOBS/INTELLIGENCE
  über die volle Section-Höhe gestreut) → Fade → Footer.
- Drei Bereiche vorhanden, aber ohne klare architektonische Staffelung: kein
  verbindendes Lichtelement am Hero-Übergang, die Intelligenz-Elemente hingen von der
  Gesamthöhe ab, und der Abschluss zum Footer war ein reiner Farbverlauf ohne
  Bodenform.

## 2. Neue Section-Struktur (`src/App.tsx`)
```
HERO (unverändert)
  ↓
.search-world
  ├── __background   z-index 0   Atrium-Bild (cover, center top)
  │     ::before     z-index 1   Overlays Hero-Hell → Cyan → Blau → ruhig
  ├── __top-light    z-index 2   SEARCH-WORLD-02: Portalbogen + Lichtkranz
  ├── __content      z-index 10  bestehende Search-/Notification-UI
  ├── __intelligence z-index 3   SEARCH-WORLD-02: Lower Intelligence Deck
  ├── __floor        z-index 4   SEARCH-WORLD-02: halbrunde Bodenplattform
  └── __fade         z-index 5   weicher Auslauf zum Footer
  ↓
FOOTER (unverändert, normaler Dokumentfluss)
```

## 3. Top-Light-Portal (Hero → Search World)
- `.search-world__top-light` direkt an der oberen Section-Grenze, Höhe
  `clamp(96px, 14vh, 172px)`, `aria-hidden`, `pointer-events: none`.
- `::before` = Portalbogen: `width: min(1280px, 90vw)`, flacher Ellipsenbogen
  (`border-radius: 50% 50% 0 0 / 100% 100% 0 0`), 2-px-Cyan-Lichtkante,
  Weiß-/Cyan-Verlauf im Bogeninneren, weicher `box-shadow`-Schein.
- `::after` = Lichtkranz: elliptischer Radial-Verlauf
  (`min(1560px, 96vw) × clamp(150px, 22vh, 260px)`) als weiche Übergangsfläche.
- Farbweg: Hero hell/warm → Weiß/Cyan im Bogen → Cyan/Blau der Welt. Kein harter
  horizontaler Rand, keine Lampe, kein Sockel, keine UI-Komponente.

## 4. Lower Intelligence Deck
- Eigenständiger unterer Raum: `.search-world__intelligence` jetzt
  `top: 54%; bottom: 0` (Desktop) statt `inset: 0`. Dadurch sitzt die Komposition
  unabhängig von der Gesamthöhe und wächst nicht in den UI-Bereich.
- Bestehende Elemente (AI-/JOBS-Chip, Connector, INTELLIGENCE-Label, 3 Glas-Panels,
  Lichtlinien, Lichtpunkte) innerhalb des Decks neu positioniert.
- Neu: vier Micro-Labels `MATCH`, `ATS`, `PROFILE`, `SKILLS` (Opacity 0.22, nur
  Konzept-Wörter), vierte Glasfläche `--panel--d` für mehr Tiefenstaffelung und
  `.search-world__particles` (sehr dezente statische Radial-Punkte).
- **Rein dekorativ:** Container `aria-hidden`, `pointer-events: none`, keine Daten,
  keine Scores, keine klickbaren Controls, keine API-Anbindung.
- Positionierung gegen die Suchkarte geprüft: alle sechs Labels liegen im freien
  Bereich (Messung: keine Überlappung mit `.search-card`).

## 5. Halbrunder Boden
- `.search-world__floor`: `left/right: -2%`, `bottom: clamp(64px, 11vh, 148px)`,
  Höhe `clamp(86px, 13vh, 158px)`, Breite damit über die Section hinaus
  (gemessen 1498 px bei 1440 px Viewport) — große Podestform, kein UI-Element.
- `::before` = Glasfläche: Halbkreis nach oben
  (`border-radius: 50% 50% 0 0 / 100% 100% 0 0`), Weiß→Cyan/Blau-Verlauf,
  weicher Schatten + feine Oberkante — keine harte Kontur, keine sichtbare Box.
- `::after` = Lichtkante entlang des Bogens (`border-top` + Glow), per Maske auf die
  oberen 24 % begrenzt (dezente Kante statt harter Linie).

## 6. Übergang zum Footer
- Reihenfolge gemessen: Section-Bottom → Boden → Fade → Footer.
- Boden liegt innerhalb der Section, Fade darüber (z 5) blendet von transparent
  über `#f4f8fc` nach `#f8fafc` aus → **kein weißes Loch**; der Auslauf ist
  kontrolliert (gemessen 99 px Abstand Boden→Footer im Leerzustand und mit
  Ergebnisliste).
- Hinweis: der Auslauf bleibt hell-blau, damit der bestehende Footer-Text
  (`--muted`) lesbar bleibt. Ein dunkler Auslauf würde eine Footer-Kontraständerung
  erfordern — laut Scope nicht zulässig.

## 7. Responsive (gemessen, Chromium)
| Viewport | Section | Portal | Boden | Deck-Elemente | Überbreite |
|---|---|---|---|---|---|
| Desktop 1440×900 | 1206 px | 126 px | 117 px | 4 Panels, 4 Micro-Labels, Partikel | 0 px |
| Desktop + Ergebnisse | 1378 px | 126 px | 117 px (oben verankert) | wie Desktop | 0 px |
| Tablet 834×1112 | 1482 px | 133 px | 122 px | 2 Panels, 2 Labels, keine Partikel/Linien | 0 px |
| Mobile 390×844 | 1539 px | 76 px (1,5 px Kante) | 76 px | **alle Deko-Elemente ausgeblendet** | 0 px |

## 8. Visuelle Hierarchie
Search UI (opake Karten, `z-index: 10`) → Atrium-Bühne → Portalbogen → Intelligence-
Atmosphäre → Boden → Footer. Karten bleiben opak und dominant (gemessen: keine
transparente Kartenhintergründe), Suchfelder unverändert.

## 9. Bewusst noch NICHT animiert
Parallax, Scroll-driven transforms, bewegliche Lichtlinien, Partikelanimation,
Pulsieren, Floating Panels — alle später. Verifiziert per Browser-Messung: auf
`.search-world`, `__background`, `__top-light`, `__intelligence`, `__floor`,
`__fade` **keine** `animation-name` und **keine** Transition (die einzige Transition
im Section-Bereich ist die vorbestehende `.cv-mode-btn`-Umschaltung, unverändert).
Kein Canvas, kein WebGL, keine neue Dependency, kein Video.

## 10. Nicht verändert (Scope-Schutz)
Hero-Bild, Hero-Texte, Navbar, Search-Felder, Search-Funktion/-Parameter, Search-API,
CV, ATS, Notification-Funktion, Login, Registrierung, Cognito, RIS, Platform API,
Offers, Entitlements, Footer-Funktionalität, Screenshots und Referenzassets.

## 11. Tests / Build
- `src/SearchLayout.test.tsx` (3 Tests) erweitert: Layer-Vollständigkeit inkl.
  `__top-light` und `__floor`, `aria-hidden` für alle Deko-Layer, Boden vor Footer,
  Deko außerhalb des Content-Layers, kein Streifen/keine alte Stage,
  Auth-/Landing-Route ohne Search World.
- `npx tsc -b` PASS; `npm test` **714 passed / 5 skipped / 0 failed**;
  `npm run build` PASS.
- Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): z-index 0/1/2/3/4/5/10 wie spezifiziert; Section beginnt exakt am
  Hero-Unterkante; Hero enthält weiterhin nur das Originalbild; 0 JS-Errors;
  Screenshots Desktop / mit Ergebnissen / Tablet / Mobile geprüft.

## 12. Git
- Commit folgt; nur zugehörige Dateien: `src/App.tsx`, `src/styles.css`,
  `src/SearchLayout.test.tsx`, `docs/AI_TEAM.md`,
  `docs/AI_TOOLS_AND_LEARNING_RECORD.md`, dieser Report.
- Screenshots/Referenzassets unverändert; vorbestehende
  `docs/screenshotsfordev/`-Diffs unangetastet.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)
- Status: DONE
- Zeitpunkt: 2026-10-05; Branch: main; HEAD: `f6f954c` (Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 714/0 failed, tsc PASS, Build PASS
- Agenten-Eintrag: Space Bunny in `docs/AI_TEAM.md` (AI Collaborators) +
  Eintrag 2026-10-05 in `docs/AI_TOOLS_AND_LEARNING_RECORD.md`
- Risiken: gering (reine Darstellung; Opacity/Höhen sind Geschmackssache und per
  CSS justierbar)
- Nächste Schritte: Animationen als separater Task (bewusst offen)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)
Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — rein visuelles CSS/Markup. Keine AI-Anfrage, keine Datenverarbeitung, keine
Persistenz, keine API-/Datenfluss-Änderung. Deko-Elemente sind `aria-hidden`,
nicht klickbar und zeigen keinerlei echten Daten. Keine AI-Audit-Ergänzung erzeugt.
# JM-MARKETING-02B — Landing Page Visual Polish & Conversion Review

**Status:** `VISUAL POLISH IMPLEMENTED — TESTED — READY FOR PREVIEW REVIEW`
**Datum:** 2026-11-13 (Europe/Berlin)
**Branch:** `feature/jm-marketing-02-product-positioning`
**Basis:** `origin/main` @ `b3b8525`
**Commits:** `01458a3`, `7ba790c`, `d7f1803` (+ Docs-Commit)
**Getesteter Produkt-Commit:** `7ba790c`

Kein Merge nach `main`, kein Production-Deployment, keine Branch-Löschung,
keine RIS-/AWS-/Cognito-/Terraform-Änderung, keine Auth-/Consent-/Payment-
Änderung, keine Matching-Algorithmus-Änderung, keine neuen Dependencies.

---

## 1. Git und Ausgangslage

| Prüfung | Ergebnis |
|---|---|
| Branch | `feature/jm-marketing-02-product-positioning` |
| Vorheriger HEAD | `d112ba9` |
| `origin/main` | `b3b8525` (unverändert) |
| Neue Commits | `01458a3` (Visual Polish), `7ba790c` (Tests/Evidence), `d7f1803` (Preview-E2E) |
| Untracked Fremddateien | 4, unverändert |

---

## 2. Hero-Lesbarkeit

Die futuristische Stadt, die blauen Lichtlinien, Glass-Navigation, Job-Stream
und MatchPulse bleiben unverändert.

Verbessert wurde ausschließlich die Lesbarkeit:

- lokaler radialer Lesbarkeitshof hinter dem Hero-Text (kein großflächiges
  Abdunkeln des Bildes),
- stärkere Textschatten für Kicker, Headline und Subheadline,
- Subheadline auf `clamp(19px, 1.5vw, 20px)` mit `line-height: 1.5` und
  `max-width: 600px`,
- `text-wrap: balance` für die Headline und `pretty` für Fließtexte,
- der Kontakthinweis liegt auf einer halbtransparenten dunklen Fläche statt
  direkt auf hellen Bildstreifen.

---

## 3. Primärer CTA — Hover, Focus, Active

Button: **„Jetzt passende Jobs finden“** → `/search`

Gemessene Werte auf der Preview (`getComputedStyle`, Chromium):

| Zustand | Background | Transform | Box-Shadow |
|---|---|---|---|
| Basis | `rgb(255, 255, 255)` | `none` | `rgba(8,30,60,0.3) 0 2px 16px` |
| Hover | `rgb(236, 254, 255)` | `matrix(1.02, 0, 0, 1.02, 0, -2)` | `rgba(34,211,238,0.42) 0 10px 30px` + dunkler Schatten |
| Mouseout | wieder Basis | `none` | wieder Basis |
| Active | `rgb(242, 254, 255)` | `matrix(0.992…, 0, 0, 0.992…, 0, 0)` | reduzierter Schatten |
| Focus | Basis | – | `outline: solid 3px rgb(103,232,249)` |

- Übergang: `0.2s ease` für Transform, Background, Border, Shadow und Color.
- Bewegung: 2 px nach oben, maximal 1,02 Skalierung.
- Kein Layoutsprung (nur `transform`).
- Mouseout kehrt vollständig zum Ausgangszustand zurück.
- Klick navigiert weiterhin direkt nach `/search` ohne Zwischenansicht oder
  Registrierungspflicht.

## 4. Sekundärer CTA — Hover, Focus, Active

Button: **„So funktioniert's“** → `#lp2-how`

| Zustand | Background | Border | Transform | Box-Shadow |
|---|---|---|---|---|
| Basis | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.7)` | `none` | `none` |
| Hover | `rgba(34,211,238,0.18)` | `rgba(165,243,252,0.92)` | `translateY(-2px)` | `rgba(34,211,238,0.24) 0 8px 24px` |
| Mouseout | wieder Basis | wieder Basis | `none` | wieder `none` |

Der sekundäre CTA bleibt bewusst zurückhaltender als der primäre (keine
Skalierung, transluzenter Hintergrund, dünnerer Glow). Beide sind nicht
identisch.

## 5. Interaktionshierarchie und Zustände

- Primär: weiße Fläche, kräftiger Schatten, 1,02-Skalierung, starker
  Cyan-Glow.
- Sekundär: transparente Glasfläche, Cyan-Tint, 2-px-Lift, dezenter Glow.
- `:focus-visible` mit 3-px-Cyan-Ring auf beiden CTAs und der Navigation.
- `:active` mit reduzierter Skalierung und Schatten.
- `[aria-disabled="true"]` ist für künftige Zustände vorbereitet
  (Opacity, kein Pointer, keine Transformation); aktuell nicht verwendet.
- Hover-Regeln gelten nur unter `(hover: hover) and (pointer: fine)`, damit
  Touch-Geräte keinen hängenden Hover-Zustand bekommen.

## 6. Reduced Motion und Touch

- `prefers-reduced-motion: reduce` entfernt Transform/Skalierung bei Hover und
  Active vollständig; Farb-/Schatten-/Kontrastwechsel bleiben erhalten.
- Der Reduced-Motion-Block steht nach den Hover-Regeln, damit die
  Überschreibung zuverlässig greift.
- Touch-Kontext (`hasTouch`, `isMobile`): `(hover: hover)` und
  `(pointer: fine)` sind `false`; ein aufgezwungener Hover erzeugt keine
  Transformation.

## 7. Karten und Lesbarkeit

Betroffen: „So funktioniert's“, „Mehr als eine Jobsuche“, „Gut zu wissen“.

- Fließtexte von `0.95rem`/`0.92rem` auf `1rem`/`0.98rem` vergrößert.
- Kontrastfarbe von `--muted` auf `#4b5563` erhöht.
- `line-height: 1.6`, `text-wrap: pretty`.
- Einheitliche Innenabstände (`1.25rem 1.2rem`) und Überschriftengrößen
  (`1.05rem`, `line-height: 1.3`).
- Karten und Schritte nutzen `height: 100%` im Grid für gleichmäßige Höhen.
- Sehr dezenter Hover nur auf Karten/Schritten: Border- und Schattenwechsel,
  keine Bewegung, kein Pointer-Cursor.

## 8. Abschließender Conversion-CTA

Neu oberhalb des Footers:

- **Headline:** „Bereit für deinen nächsten Karriereschritt?“
- **Beschreibung:** „Entdecke passende Stellen und starte deine persönliche
  Jobsuche.“
- **Button:** „Jetzt Jobs finden“ → `/search`
- EN: „Ready for your next career move?“, „Discover matching jobs and start
  your personal job search.“, „Find jobs now“.

Gestaltung: kompaktes Cyan-/Mint-Panel, kein zweiter Hero, keine neue
Hintergrundgrafik. Der Button nutzt Petrol als Grundfarbe und hat einen
eigenen Hover-/Focus-/Active-Zustand. Auf ≤ 600 px wird er volle Breite.

## 9. Responsive

Geprüft in DE/EN bei **320, 390, 768, 1024 und 1440 px**:

- kein horizontaler Overflow,
- Hero-CTAs und Hinweis im ersten Viewport,
- abschließender CTA im Dokumentfluss vor dem Footer,
- keine abgeschnittenen Buttons,
- Grid 4/2/1 Spalten für Schritte/Vorteile, 1 Spalte für Transparenz auf
  kleinen Viewports,
- Footer lesbar und erreichbar.

## 10. Accessibility und Keyboard

- Tab-Reihenfolge: Brand → Sprachumschaltung → Suche → Anmelden →
  MatchPulse → primärer CTA → sekundärer CTA → Karten/Footer.
- Enter auf dem fokussierten primären CTA öffnet `/search`.
- Fokusringe sind auf Navigation und CTAs sichtbar (3 px Cyan).
- Sekundärer CTA scrollt per Klick/Enter zu `#lp2-how` (`scroll-margin-top:
  90px`).
- Reduced Motion: Opening-Layer aus, Hintergrund-/Pulse-Animationen aus,
  keine CTA-Transformation.
- Kein automatischer axe/WCAG-Audit (keine Dependency); Kontrast über dem
  Hero-Bild bleibt visuell/manuell geprüft. Die neuen Fließtexte auf weißem
  Grund verwenden `#4b5563` und erreichen damit deutlich mehr Kontrast als
  zuvor.

## 11. SEO-Regression

Unverändert gegenüber JM-MARKETING-02:

- `index.html`-Title, Description, Canonical, Open Graph, Twitter Cards,
- `app.html`, `robots.txt`, `sitemap.xml`, `vercel.json`,
- Private-Routen-Noindex und Vercel-Rewrites.

Es wurden in 02B ausschließlich Landing-CSS/TSX, Tests und Evidence geändert.
Die Marketingpositionierung und die SEO-Beschreibung bleiben konsistent.

## 12. Tests, Build und Browser-E2E

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | **PASS** (1,49 s) |
| `npx vitest run --maxWorkers=2` | **1871 PASS / 5 SKIPPED** (178 Dateien PASS) |
| `git diff --check` | **PASS** |
| Fokussierte Landing-Tests | **18/18 PASS** |
| Browser-E2E lokal (`node tests/e2e/landing-visual-polish.mjs`) | **PASS** |
| Browser-E2E gegen Preview (`BASE_URL=…`) | **PASS** |

Der E2E-Test prüft computed styles vor/nach Hover, Mouseout, Active, Focus,
Klicknavigation, Reduced Motion, Touch-Medienabfrage und den abschließenden
CTA. Screenshots:

- `docs/reports/assets/JM-MARKETING-02B/de-1440-primary-hover.png`
- `docs/reports/assets/JM-MARKETING-02B/de-1440-secondary-hover.png`
- `docs/reports/assets/JM-MARKETING-02B/de-390-final-cta.png`

Der bekannte Standard-Timeout-Flake in
`src/ManualSearchProfiles.integration.test.tsx` unter voller Parallelität
bleibt dokumentiert; `--maxWorkers=2` und isoliert PASS.

## 13. Preview

| Feld | Wert |
|---|---|
| Deployment-ID | `dpl_9nXP9udgRHgYza8L8LK5SwuNxUGH` |
| URL | https://mays-job-matcher-i0246a3l3-maymilly.vercel.app |
| Environment | `preview`, `READY` |
| Commit | `7ba790c` |
| Build Identity | `Version 2.2.0 · preview · feature/jm-marketing-02-product-positioning · 7ba790c` |

Der Browser-E2E lief erfolgreich gegen diese Preview. Production bleibt
unverändert auf `b3b8525`.

## 14. Risiken / Findings

| ID | Schwere | Punkt |
|---|---|---|
| F1 | MINOR | Kein automatisierter axe/WCAG-Audit; Kontrast über Bild visuell/manuell |
| F2 | MINOR | Hover-Tests nutzen synthetische Maus-Events; kein Test auf exotischen Touch-Browsern |
| F3 | MINOR | Bekannter Standard-Test-Flake unter Vollparallelität (nicht durch 02B verursacht) |
| F4 | INFO | Docs-Commit nach dem getesteten Produkt-Commit; Preview-Build Identity bleibt `7ba790c` |

Keine BLOCKER, keine MAJOR-Findings.

## 15. Release-Empfehlung

**A — IMPLEMENTED & VERIFIED — READY FOR PREVIEW REVIEW**

- Beide Hero-CTAs reagieren sichtbar und kehren sauber zurück.
- Primärer und sekundärer CTA sind klar unterscheidbar.
- Hero, Karten und abschließender CTA sind lesbarer und konsistenter.
- Responsive, Keyboard, Reduced Motion und Touch sind geprüft.
- SEO Foundation und Positionierung bleiben unverändert.
- Kein Merge, kein Production-Deployment.

Nächster Schritt: `JM-MARKETING-02C — LANDING PAGE PREVIEW ACCEPTANCE &
PRODUCTION RELEASE` nach visueller Abnahme.

# JM-MARKETING-02 — Product Positioning & Landing Page

**Status:** `IMPLEMENTED & VERIFIED — READY FOR PREVIEW REVIEW`
**Datum:** 2026-11-13 (Europe/Berlin)
**Branch:** `feature/jm-marketing-02-product-positioning`
**Basis:** `origin/main` @ `b3b8525`
**Commits:** `11ca542`, `341f5c4` (+ Docs-Commit)

Kein Merge nach `main`, kein Production-Deployment, keine Branch-Löschung,
keine RIS-/AWS-/Cognito-/Terraform-Änderung, keine Auth-/Consent-/Payment-
Änderung, keine neuen Dependencies, keine Tracking-Dienste.

---

## 1. Ausgangslage und Audit

Der Branch wurde direkt von `origin/main` (`b3b8525`) erstellt. Die vier
bereits vorhandenen untracked Fremddateien blieben unverändert.

Analysiert wurden:

- `src/components/LandingPage2.tsx`
- `src/landingpage2.css`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- `src/rootRoute.ts`
- `index.html` / `app.html`
- Such-/Profil-/Bewerbungslogik für die Wahrheitsprüfung der Aussagen

### Befunde im Ausgangsstand

- Die Hero-Headline („Dein nächster Karriereschritt mit KI“) beschrieb die
  Produktkategorie nicht; „Job Matching“ und die individuelle Suche waren
  nicht sofort erkennbar.
- Die erste Funktionskarte behauptete pauschal „Arbeitnow, Arbeitsagentur,
  Adzuna, JobsPipe, Theirstack und ATS-Boards“. JobsPipe/Theirstack sind für
  Gast-Suchen gesperrt und nur bei entsprechender Konfiguration aktiv; die
  Aussage war damit zu breit.
- Es gab keine Erklärung des Ablaufs und keine transparente Einordnung von
  Konto, Consent, KI-Übermittlung und sitzungsbasierten Bewerbungen.
- Nur drei Karten; Bewerbungsorganisation und individuelle Suchprofile fehlten
  als eigene Nutzenversprechen.
- Der primäre CTA („Jobs finden →“) war sichtbar, aber nicht als
  positionierter Haupt-CTA formuliert.
- Positive Befunde: kein horizontaler Überlauf, CTA im ersten Viewport,
  reduced-motion-Regeln, Glass-Navigation und Markenbild funktionierten.

---

## 2. Endgültige Positionierung

**Kernbotschaft:** „Finde Jobs, die wirklich zu dir passen.“

May's Job Matcher wird als individuelle Jobsuche mit KI-Unterstützung
positioniert — nicht als klassische Jobbörse. Die Sprache bleibt für alle
Berufsgruppen verständlich; IT-/Tech-Fachkräfte, erfahrene Fachkräfte und
Wiedereinsteiger werden nicht ausgeschlossen.

### Hero (DE)

- **Headline:** „Finde Jobs, / die wirklich zu dir passen.“
- **Subheadline:** „Entdecke Stellen aus mehreren Quellen, definiere eigene
  Suchprofile und vergleiche Anforderungen mit deinen Qualifikationen – auf
  Wunsch mit KI-Unterstützung.“
- **Primärer CTA:** „Jetzt passende Jobs finden“ → `/search`
- **Sekundärer CTA:** „So funktioniert's“ → `#lp2-how`
- **Hinweis:** „Ohne Anmeldung starten. Dauerhafte Suchprofile brauchen ein
  Konto und eine Einwilligung.“

### Hero (EN)

- **Headline:** „Find jobs / that really fit you.“
- **Subheadline:** „Discover jobs from multiple sources, define your own search
  profiles and compare requirements with your skills – with optional AI support.“
- **Primärer CTA:** „Find matching jobs now“ → `/search`
- **Sekundärer CTA:** „How it works“ → `#lp2-how`
- **Hinweis:** „Start without an account. Permanently saved profiles require an
  account and consent.“

---

## 3. Wahrheits- und Verfügbarkeitsprüfung

| Aussage | Tatsächlicher Stand | Formulierung |
|---|---|---|
| Mehrere Job-Quellen | Arbeitnow, Arbeitsagentur, Adzuna und öffentliche ATS-Quellen sind je nach Konfiguration/Verfügbarkeit aktiv; JobsPipe/Theirstack sind für Gäste gesperrt | „Stellen aus den **verfügbaren** Job-Quellen“; keine Aufzählung aller Anbieter |
| Individuelle Suchprofile | Manuelle/CV-Profile sind ohne Konto sitzungsbasiert; dauerhafte Speicherung benötigt Konto und separate Einwilligung | „Ohne Konto für die Sitzung, mit Konto dauerhaft speicherbar“ + Consent-Hinweis |
| KI-Matching | Bewertung erfolgt auf Wunsch; liefert Score, Begründung und Vorbereitungsfrage | „Auf Wunsch … mit Score, Begründung und Vorbereitungsfrage“ |
| Bewerbungsorganisation | Standardmäßig sitzungsbasiert; dauerhafte Speicherung nur mit Freigabe | „standardmäßig in der aktuellen Sitzung“ + Transparenzhinweis |
| Lebenslauf | PDF wird lokal gelesen; extrahierter Text kann für die Profilerstellung an einen KI-Dienst gehen | „PDF wird lokal im Browser gelesen … kann … übermittelt werden“ |
| Anmeldung | Suche/KI-Bewertung ohne Konto nutzbar; Konto nur für dauerhafte Profile | „Ohne Anmeldung starten“ |

Nicht verwendet: Garantien auf passende Jobs/Einstellung, „alle Jobbörsen“,
unbegrenzte kostenlose KI-Nutzung, vollständige Anonymität, dauerhafte
Speicherung aller Lebensläufe.

---

## 4. Landingpage-Änderungen

- Hero auf die neue Kernbotschaft umgestellt; „mit KI“ als alleiniger
  Headline-Fokus entfernt und in die Subheadline integriert.
- Primärer CTA direkt auf `/search`, sekundärer CTA auf den neuen
  Erklärungsabschnitt `#lp2-how`.
- Neuer Abschnitt **„So funktioniert's“** mit vier Schritten:
  1. Suchprofil festlegen
  2. Stellen entdecken
  3. Passung vergleichen
  4. Bewerbung organisieren
- Neuer Abschnitt **„Mehr als eine Jobsuche“** mit vier Vorteilskarten:
  Stellensuche, Individuelle Suchprofile, KI-Matching,
  Bewerbungsorganisation.
- Neuer Transparenzabschnitt **„Gut zu wissen“** zu Konto/Consent,
  CV-Verarbeitung und sitzungsbasierten Bewerbungen.
- Bestehende Markenidentität, Hero-Bild, Glass-Navigation, Job-Stream,
  Match-Pulse und Footer bleiben erhalten.
- MatchPulse erhielt eine übersetzbare `aria-label`-Prop (DE/EN).

### SEO-Anpassung

Die Meta-Description (HTML, OG, Twitter) wurde an die neue Headline angepasst:

```text
Finde Jobs, die wirklich zu dir passen – mit individuellen Suchprofilen,
KI-gestütztem Job Matching und Lebenslaufanalyse. Organisiere deine Jobsuche
mit May's Job Matcher.
```

Title, Canonical, OG-/Twitter-Struktur, `robots.txt`, `sitemap.xml`,
`index.html`/`app.html`, Vercel-Rewrites und Private-Routen-Noindex blieben
unverändert. Die SEO-Metadaten sind mit der Landing-Botschaft konsistent.

---

## 5. UX und Conversion

- Primäre Handlung ist im ersten Viewport sichtbar und führt ohne
  Zwischenschritt zu `/search`.
- Registrierung wird nicht als zwingend dargestellt; der Hinweis trennt
  Suche ohne Konto von dauerhaften Profilen mit Konto/Consent.
- Informationshierarchie: Positionierung → Ablauf → Vorteile → Transparenz.
- Keine neuen Fachbegriffe ohne Erklärung; „Match-Score“, „Suchprofil“ und
  „Consent“ werden im Kontext erläutert.
- Keine zusätzlichen Ablenkungen oder neuen UI-Bibliotheken.

---

## 6. Mobile und Responsive

Getestet mit Playwright/Chromium in DE und EN:

| Viewport | Horizontaler Überlauf | CTA im ersten Viewport | Hinweis sichtbar |
|---|---|---|---|
| 320 px | nein | ja | ja |
| 390 px | nein | ja | ja |
| 768 px | nein | ja | ja |
| 1024 px | nein | ja | ja |
| 1440 px | nein | ja | ja |

Grid-Verhalten:

- ≥ 1001 px: 4 Spalten für Schritte und Vorteile, 3 Spalten für Transparenz.
- 601–1000 px: 2 Spalten für Schritte/Vorteile, 1 Spalte für Transparenz.
- ≤ 600 px: 1 Spalte; Abschnittsüberschriften linksbündig.

---

## 7. Barrierefreiheit

- Genau eine `h1`; Abschnitte mit `h2`, Karten/Schritte mit `h3`.
- Abschnitte über `aria-labelledby` benannt; Ablauf als geordnete Liste.
- Primäre/sekundäre CTAs und Navigation mit sichtbarem
  `:focus-visible`-Ring (3 px Cyan).
- Touch-Ziele: CTAs ≥ 46 px, Burger 44 px, Sprachbuttons ≥ 44 px.
- `prefers-reduced-motion`: Opening-Layer ausgeblendet, Hintergrund- und
  Pulse-Animationen deaktiviert; JobStream respektiert reduced motion bereits.
- Lesbarkeitshof hinter dem Hero-Text und Textschatten verbessern den
  Kontrast auf dem hellen Bild; der Hinweis liegt auf einer halbtransparenten
  dunklen Fläche.
- Sprachumschaltung DE/EN aktualisiert Headline, CTAs, Abschnitte, Karten und
  MatchPulse-Label.

**Grenze:** Es wurde kein automatisierter WCAG-Audit (z. B. axe) ausgeführt,
da keine entsprechende Dependency vorhanden ist. Die Kontrastprüfung über dem
Hero-Bild ist visuell/manuell, nicht rechnerisch für jeden Bildpunkt.

---

## 8. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Landing-/SEO-Tests | **86/86 PASS** |
| Vollsuite `npx vitest run --maxWorkers=2` | **1869 PASS / 5 SKIPPED** (178 Dateien PASS, 3 skipped) |
| `npm run build` | **PASS** (1,24 s) |
| `git diff --check` | **PASS** |

Der bekannte Standard-Timeout-Flake in
`src/ManualSearchProfiles.integration.test.tsx` unter voller Parallelität
bleibt dokumentiert; mit `--maxWorkers=2` und isoliert PASS.

### Browserprüfung (lokal, Production-Build)

- 10 Kombinationen (DE/EN × 320/390/768/1024/1440): 0 Console-Errors,
  0 Page-Errors, 0 fehlgeschlagene Requests, kein horizontaler Überlauf.
- Primärer CTA: Navigation nach `/search`, Suchoberfläche sichtbar.
- Sekundärer CTA: Scroll zu `#lp2-how` (`scroll-margin-top: 90px`).
- Tastatur: Fokusring auf Navigation und CTA sichtbar.
- Reduced Motion: Opening ausgeblendet, Hintergrund-/Pulse-Animationen aus.

---

## 9. Risiken und offene Punkte

| ID | Schwere | Punkt |
|---|---|---|
| F1 | MINOR | Kein automatisierter WCAG-Audit; Kontrast über Bild nur visuell/manuell geprüft |
| F2 | MINOR | Bekannter Standard-Test-Flake unter Vollparallelität (nicht durch diese Änderung verursacht) |
| F3 | MINOR | Externe Social-Validatoren für die geänderte Description nicht ausgeführt |
| F4 | INFO | Rechtsseiten bleiben gemäß 01A–01C vorläufig `noindex` |

Keine BLOCKER, keine MAJOR-Findings.

---

## 10. Release-Empfehlung

**A — IMPLEMENTED & VERIFIED — READY FOR PREVIEW REVIEW**

- Positionierung, Hero, CTAs, Ablauf, Vorteile und Transparenz sind umgesetzt.
- Aussagen sind an den tatsächlichen Funktionsumfang gebunden.
- Responsive, Accessibility-Grundlagen, SEO und Routing sind lokal geprüft.
- Kein Merge, kein Production-Deployment, keine Preview-Abnahme behauptet.
- Nächster Schritt: `JM-MARKETING-02B — LANDING PAGE PREVIEW & CONVERSION REVIEW`.

# JOBMATCHER-AUTH-HOLOGRAPHIC-CONSOLE-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-12
Branch: main

## Scope
Login-/Registrierungskarten als elegante schwebende 3D-Hologramm-Konsolen.
Designreferenz: The Neural Gateway. Bestehendes Hintergrundbild bleibt —
keine neue Hintergrundgrafik erzeugt.

## Maßnahmen (Implementer)
- `src/components/AuthCard.tsx` (NEU): Shell-Konsole mit
  - Maus-Tilt max. ±3° (perspective rotateX/rotateY via CSS-Variablen --rx/--ry)
  - Lichtreflex folgt Mausposition (--mx/--my)
  - Ref-basiert, keine zusaetzlichen Re-Renders pro Mousemove
  - `matchMedia("(hover:hover) and (pointer:fine)")` → kein Tilt auf Touch
  - Mouseleave → Rueckkehr auf 0deg
- `LoginForm.tsx` / `RegisterForm.tsx`: rendern Inhalt in <AuthCard>,
  Auth-Links mit dezenten Inline-SVG-Pfeilen; Texte/Ziele unveraendert.
- `src/styles.css`:
  - `.auth-card`: Milchglas rgba(255,255,255,0.86) + blur(16px),
    eisblaue Kontur rgba(125,211,252,0.45), tuerkis leuchtende Umrandung
    (Ring + Glow 26px), mehrschichtige weiche Schatten,
    inset Highlight; 3D-Transform aus --rx/--ry, `overflow:hidden` fuer Reflex.
  - `.auth-card-outer`: sehr langsames Schweben (9s, translateY -6px) nur bei
    `(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)`;
    weicher Lichtschein unter der Karte (::after radial + blur).
  - `.auth-card .auth-submit`: kraeftiger Tuerkisverlauf
    (#2dd4bf→#0d9488→#0f766e), weisser Text mit Text-Shadow,
    inneres Highlight (inset), Glow bei Hover, klare Fokusmarkierung
    (`outline:3px solid var(--accent)`).
  - Auth-Links: Icon-Inline, einheitliche Abstaende, Fokus-Outline.
  - Footer nur auf Auth-Seiten: `.auth-main ~ .footer` Glas-Flaeche
    (rgba(255,255,255,.72) + blur(10px), eisblaue Top-Kante) → ausreichender
    Kontrast, keine Lichtbahnen-Ueberlagerung. Search-Footer dadurch
    unveraendert.
  - `prefers-reduced-motion`: keine Schwebeanimation, keine Transition.

## Explorer-Befund (verifiziert vor Fix)
- Auth-Routen rendern zentral in `App.tsx` via `main.auth-main` +
  `LoginForm`/`RegisterForm`; globale Tokens aus `src/styles.css :root`
  (--accent #22d3ee, --brand #0d9488, --brand-dark #0f766e).
- Navbar ist eigenstaendig (z-index 40); Footer hat z-index 1.
- Neural-Gateway-Layers (Bild/Bahnen/Glow) liegen bei z-index 0 unter Karte.

## Sicherheit (Security)
- Cognito/OIDC/PKCE vollstaendig unverändert: `auth.signinRedirect()` und
  `auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } })` bleiben.
- Keine lokalen Passwortfelder, keine Session/Token-Logik, keine
  neuen Abhängigkeiten, keine VITE_-Secrets.

## Validierung (Tester)
- `npx vitest run` AuthCard+AuthRoutes+LoginForm → 5+9? ✅
- `npm test` → 762 passed, 3 skipped ✅
- `npm run build` → erfolgreich ✅
- Kein Layout-Shift (transform nur auf Karte/Wrapper),
  kein Scrollbar (gateway overflow:hidden im vorherigen Gate).

## Reviewer-Ergebnis
- Minimale isolierte Aenderung: neue `AuthCard`-Komponente + CSS-Ersetzung
  im Auth-Abschnitt. Searchpage, Navbar, Impressum/Datenschutz unangetastet.
- A11Y: Tastatur-Fokus erhalten (Buttons/links), Kontraste: weiss auf
  #0d9488 ~3.7:1 (AA grosser Text), Karte fast-opak → Lesbarkeit hoch.

## Bewertung
GREEN

## Files changed
- src/components/AuthCard.tsx (neu)
- src/components/AuthCard.test.tsx (neu)
- src/components/LoginForm.tsx (AuthCard + Icons)
- src/components/RegisterForm.tsx (AuthCard + Icons)
- src/styles.css (Hologramm-Konsole + Footer-Glass scoped)
- docs/reports/JOBMATCHER-AUTH-HOLOGRAPHIC-CONSOLE-01-EXECUTION_LOG.md

## Offene Hinweise
- Manuelle Sichtpruefung Desktop/Tablet/Mobile + Zoom 125/150% empfohlen
  (kein Browser-Driver in der Pipeline).

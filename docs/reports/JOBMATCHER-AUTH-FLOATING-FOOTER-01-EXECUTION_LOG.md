# JOBMATCHER-AUTH-FLOATING-FOOTER-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-12
Branch: main

## Scope
Von full-width Glass-Leiste zu kompaktem schwebendem „Floating Glass Dock"
auf /anmelden und /registrieren. Designreferenz: The Neural Gateway.

## Explorer-Befund (vor Fix, verifiziert)
- `Footer.tsx` (unveraendert): Legal-Links (Impressum, Datenschutz,
  Datenschutzprinzipien), Jobquellen, KI-Hinweis, Versionsinfos.
- `.footer` Basis: `position:relative; z-index:1; padding:24px 20px 40px`.
- Zuvor nur flache Glas-Leiste `.auth-main ~ .footer` (full width).

## Massnahmen (Implementer)
- `src/styles.css` `.auth-main ~ .footer`:
  - `width: min(950px, calc(100% - 40px)); margin: 0 auto 46px;`
  - `border-radius: 20px`, `background: rgba(255,255,255,.66)`,
    `backdrop-filter: blur(12px)`, `border: 1px solid rgba(125,211,252,.4)`,
    mehrschichtiger weicher Schatten (Ring + 10px + 26px),
    kompakte Innenabstaende (`14px 24px 16px`, p `margin: 4px 0`).
  - Mobile (`<=640px`): `width: calc(100% - 32px)`, angeschraenktes Padding,
    `margin-bottom: 28px` — Hintergrund bleibt rundum sichtbar.
- Kein JS/3D/Animation fuer Footer; Navbar und AuthCard unveraendert.
- `src/AuthRoutes.test.tsx`: Gateway-Scope Test + Footer-Dock Scope
  (`main.auth-main ~ footer.footer`) + Legal-Links erreichbar.

## Reviewer-Ergebnis
- Selektor `.auth-main ~ .footer` wirkt aussschliesslich auf Auth-Seiten
  (Search: Hero/search-world/floor ohne auth-main → kein Impact).
- Gateway bleibt links/rechts/unten sichtbar (cap 950px, margin-bottom 46px).
- Kontrast: weiss bei 0.66 Opazitaet + blur → Text `--text` lesbar.
- Keine horizontalen Scrollbars (max-width via calc/cap, keine fixen Breiten).

## Security
Cognito/OIDC/PKCE/RIS/Backend unverändert. Keine Auth-Logik-Aenderung.

## Validierung (Tester)
- `npx vitest run src/AuthRoutes.test.tsx` → 6 passed ✅
- `npm test` → 763 passed, 3 skipped ✅
- `npm run build` → erfolgreich ✅

## Bewertung
GREEN

## Files changed
- src/styles.css
- src/AuthRoutes.test.tsx
- docs/reports/JOBMATCHER-AUTH-FLOATING-FOOTER-01-EXECUTION_LOG.md

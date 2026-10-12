# JOBMATCHER-AUTH-NAVBAR-OVERLAP-FIX-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-12
Branch: main

## Scope
Auf /anmelden und /registrieren wird der obere Bereich der Auth-Karte
von der schwebenden Navbar verdeckt. Fix: Auth-Karten vollständig
sichtbar unterhalb der Navbar positionieren.

## Befund (verifiziert)
- `Navbar` ist `position: sticky; top: 0` und auf Auth-Routen im Glass-Mode
  (`navbar-glass`: `padding-top:12px` + `margin-bottom:-12px`).
- Auth-Seiten rendern in `<main className="container legal-main">`.
- `.legal-main` verwendet `padding: var(--space-xl) var(--space-md)`.
  Die Tokens `--space-xl` und `--space-md` sind im Designsystem NICHT definiert
  (definiert sind nur `--space-1` bis `--space-8`), somit ist die
  Padding-Deklaration invalid und fällt auf 0 zurück. Dadurch beginnt die
  Auth-Karte direkt hinter der Navbar (inkl. -12px Margin der Glass-Bar).

## Maßnahmen
- `src/App.tsx`: Auth-Main bekommt zusätzlich Klasse `auth-main`
  (lokale Lösung, keine Änderung an Searchpage/Navbar/Footer).
- `src/styles.css`: `.auth-main` mit festem `padding-top`:
  Desktop 112px, ≤768px 88px, ≤480px 76px. Zielabstand erfüllt
  (Navbar ~68px hoch → effektiver Abstand Desktop ~44px, mobil ~8–20px).

## Cognito/OIDC/PKCE
Unverändert. Auth-Vertrag unangetastet.

## Validierung
- `npm test` → 758 passed, 3 skipped ✅
- `npm run build` → erfolgreich ✅

## Bewertung
GREEN

## Files changed
- src/App.tsx
- src/styles.css

## Risiken / Folgeaktionen
- Visuelle Prüfung (Desktop/Tablet/Mobile, Zoom 125%/150%) ohne Browser
  nicht möglich; manuelle Sichtprüfung empfohlen.
- Hinweis: `--space-xl`/`--space-md`/`--space-lg` sind global undefiniert.
  Betrifft nur Legal-Seiten (Padding fällt auf 0). Separater Cleanup-Ticket-
  Kandidat, absichtlich nicht Teil dieses lokalen Fixes.

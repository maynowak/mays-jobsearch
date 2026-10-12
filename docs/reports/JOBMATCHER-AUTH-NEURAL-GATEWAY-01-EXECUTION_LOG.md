# JOBMATCHER-AUTH-NEURAL-GATEWAY-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-12
Branch: main

## Scope
Futuristischer, animierter Hintergrund "The Neural Gateway" für
/anmelden und /registrieren. Drei getrennte Ebenen: statisches Bild,
animierte SVG-Lichtleiter/Lichtimpulse, bestehende Auth-Karte + Navbar.

## Bilddatei (verifiziert)
- Gate gefordert: `public/images/auth-neural-gateway.png`
- Original vom Projektinhaber: `src/assets/images/Futuristische_Datenautobahn_im_Morgenlicht.png`
  (PNG, 1672x941, vom User im Gate als Quelle referenziert)
- Maßnahme: Datei nach `public/images/auth-neural-gateway.png` kopiert
  (identischer Inhalt, keine Fremdgrafik eingesetzt).

## Maßnahmen
- `src/App.tsx`: Auth-Routen rendern zusätzlich `div.auth-gateway`
  (aria-hidden, pointer-events none) mit:
  - `.auth-gateway__image` (Layer 1, `/images/auth-neural-gateway.png`)
  - SVG `.auth-gateway__conduits` (5 Bahnen, viewBox skalierend)
  - 5 `.light-dot` Impulse via CSS `offset-path`
  - `.auth-gateway__glow` Lichtschein hinter der Karte
- `src/styles.css`: volle Animation (GPU-freundlich, keine Bibliothek):
  - `conduit-pulse` (Opazität-Pulsieren)
  - `light-travel` (offset-distance 0→100%, Fade in/out)
  - `gateway-breath` (Glow)
  - Hover/Fokus auf `.auth-submit` beschleunigt Impulse via
    `.auth-main:has(.auth-submit:is(:hover,:focus-visible))`
  - `prefers-reduced-motion`: Impulse/Breathing deaktiviert
  - Tablet ≤1024px: 3 Bahnen, Mobile ≤640px: nur Bottom-Center-Bahn
- Fix nebenbei: `.auth-main` Padding komplett fix gesetzt, da
  `--space-xl/--space-md` undefiniert sind (Padding fiel auf 0).
- `src/AuthRoutes.test.tsx`: 2 Tests für Gateway-Layer (Auth vorhanden,
  /search ohne Gateway — kein Search-Regression).

## Layout-Hierarchie / Ursache vorherige Themen
- Footer hat `position:relative; z-index:1` → bleibt vor Gateway.
- Navbar z-index 40 → bleibt oben.
- `.auth-page` erhält `position:relative; z-index:1` → Karte über Gateway.
- Gateway `position:fixed; inset:0; z-index:0; overflow:hidden` → keine
  Scrollbars, keine Event-Erfassung.

## Cognito/OIDC/PKCE
Unverändert. Kein Auth-Vertrag, keine Session/Token-Änderung.

## Validierung
- `npx vitest run src/AuthRoutes.test.tsx` → 5 passed ✅
- `npm test` → 758 passed, 3 skipped ✅
- `npm run build` → erfolgreich ✅
- Keine Anpassungen an /search, kein doppeltes Footer/Navbar.

## Bewertung
GREEN

## Files changed
- public/images/auth-neural-gateway.png (neu, Kopie der Owner-Datei)
- src/App.tsx (Gateway-Markup auf Auth-Routen)
- src/styles.css (Neural-Gateway-CSS + auth-main Padding-Fix)
- src/AuthRoutes.test.tsx (Tests)
- docs/reports/JOBMATCHER-AUTH-NEURAL-GATEWAY-01-EXECUTION_LOG.md (diese Datei)

## Risiken / Folgeaktionen
- Manuelle visuelle Sichtprüfung Desktop/Tablet/Mobile + Zoom 125/150%
  empfohlen (in der Pipeline nicht automatisierbar ohne Browser-Driver).
- PNG ist 2.3 MB; bei Bedarf später auf WebP optimieren.

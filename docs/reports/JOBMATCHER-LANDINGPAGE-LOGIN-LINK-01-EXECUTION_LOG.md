# JOBMATCHER-LANDINGPAGE-LOGIN-LINK-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-13
Branch: main

## Mission
Der Login-Link auf der Landingpage (/) war nicht klickbar und führte nirgendwohin.

## Root Cause (im Code verifiziert)
`src/components/LandingPage2.tsx` rendert den Login-Eintrag als
**Button ohne Funktion**:

```tsx
{/* Login noch ohne Funktion (Prototype) */}
<button type="button" className="lp2-login" aria-disabled="true">Login</button>
```

Kein `onClick`, kein `href`, `aria-disabled="true"` — der Button war bewusst
als Prototyp markiert. CSS dazu: `cursor: default` ("vorerst ohne Funktion").

Warum kein `useAuth()`: `src/main.tsx` rendert die LandingPage2 **ausserhalb**
des `AuthProvider` (nur die Job-Matcher-App liegt darin). Ein OIDC-Aufruf wäre
dort nicht verfügbar — daher ist ein normaler Link die korrekte Lösung, genau
wie der nicht angemeldete Login-Link der Navbar (`<a href="/anmelden">`).

## Fix
- `src/components/LandingPage2.tsx`: Button → `<a className="lp2-login" href="/anmelden">Login</a>`
- `src/landingpage2.css`: `.lp2-login` auf Link-Semantik angepasst
  (`display: inline-flex`, `text-decoration: none`, `cursor: pointer`,
  Hover + sichtbarer `:focus-visible`-Ring); bestehendes Oval-Design bleibt.

Keine Aenderung an: AuthProvider, Cognito/OIDC/PKCE, Navbar, Landingpage-Layout,
Job-Lobby, Hintergrundgrafik, API, RIS, AWS/Terraform, vercel.json
(`/anmelden`-Rewrite existiert bereits).

## Browser-Verifikation (VERIFIED, Chromium, Produktions-Build)
- Landing `/`: `.lp2-login` ist ein `<a>` mit `href="/anmelden"`, Text „Login"
- Klick → URL `http://localhost:4173/anmelden`
- Auth-Karte rendert (Überschrift „Anmelden", Neural-Gateway-Hintergrund,
  Hologramm-Konsole, Floating Glass Dock)
- Kein Scroll-Lock: `body/html overflow = ""`
- Screenshot nach dem Klick erstellt und geprüft

## Tests / Build
- `npm test` → **791 passed**, 5 skipped (71 Dateien) ✅
- `npm run build` → erfolgreisch ✅
- Neuer Regressionstest in `src/components/LandingPage2.test.tsx`:
  „LP-LOGIN-01: Login ist ein klickbarer Link auf /anmelden" — prüft
  `role="link"` + `href="/anmelden"` und dass kein
  `button[aria-disabled="true"].lp2-login` mehr existiert.

## Offene Punkte
- Kein Deployment durchgeführt (nicht angefordert); Live-Domain wurde nicht
  geprueft, nur der lokale Produktions-Build.

## Files changed
- src/components/LandingPage2.tsx (Button → Link)
- src/landingpage2.css (Link-Styling inkl. Fokusring)
- src/components/LandingPage2.test.tsx (1 Regressionstest)
- docs/reports/JOBMATCHER-LANDINGPAGE-LOGIN-LINK-01-EXECUTION_LOG.md

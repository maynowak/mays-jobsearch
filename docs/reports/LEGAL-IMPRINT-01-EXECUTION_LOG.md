# LEGAL-IMPRINT-01 — EXECUTION LOG (Impressum + Footer + Kontakt)

## Current status
FINALIZED — alle Validierungen gruen. Commit + Push abgeschlossen.

## Audit date/time
2026-09-28 (nach ATS-UI-IMPROVEMENT-01; Start-HEAD f152594, gepusht)

## Git state (Start)
- Branch: main, HEAD f152594, synchron mit origin/main, working tree clean

## Task / Purpose (User-Request)
Impressum-Seite (/impressum) mit Footer-Navigation (Impressum, Datenschutz)
erstellen. E-Mail-Adresse ueber Vercel Environment Variable (VITE_CONTACT_EMAIL),
nicht als Klartext im Git. Betreiberanschrift offen (OPEN ITEM LEGAL-ADDRESS-01).
Keine Domain/Infrastruktur-Aenderungen. Nur technische Vorbereitung.

## Plan
1. src/config/legal.ts — zentrale Legal-Config mit Env-Zugriff
2. src/components/Imprint.tsx — Impressum-Seite
3. App.tsx — Route /impressum hinzufuegen
4. Footer.tsx — Links zu /impressum und /datenschutz
5. .env.local — VITE_CONTACT_EMAIL (nicht committed)
6. .gitignore — .env* ausschliessen
7. Tests (Erreichbarkeit, Footer-Links, Env-Config, keine Klartext-E-Mail)
8. Browser-Verifikation (Desktop/Tablet/Mobile)
9. AI_AUDITLOG.md pruefen
10. Execution Report finalisieren + Commit + Push

## Completed sections
- [x] src/config/legal.ts
- [x] src/components/Imprint.tsx
- [x] App.tsx Route
- [x] Footer.tsx Erweiterung
- [x] .env.local + .gitignore
- [x] Tests (Imprint, Footer, Legal Config)
- [x] Browser-Verifikation (Desktop/Tablet/Mobile)
- [x] AI_AUDITLOG.md Pruefung
- [x] Validierung + Audit-Eintrag

## Änderungen (Summary)

### src/config/legal.ts (neu)
- Zentrale Legal-Config mit `legalConfig` Object
- `contactEmail` via `import.meta.env.VITE_CONTACT_EMAIL`
- `isDev` Flag fuer Development-Zustand
- `getContactEmailDisplay()` Helper fuer UI (Placeholder bei fehlender Env)

### src/components/Imprint.tsx (neu)
- Route: `/impressum`
- Struktur: Anbieter (Name, Anschrift) + Kontakt (E-Mail)
- Anschrift als Entwicklungs-Platzhalter (italic/muted): "Die Betreiberanschrift wird vor dem produktiven rechtlichen Abschluss dieser Seite ergaenzt."
- E-Mail als `mailto:`-Link aus Env-Config
- Entwicklungs-Hinweis unten: "Hinweis: Dieses Impressum befindet sich in der Entwicklung. Die Betreiberanschrift ist noch nicht finalisiert."
- Responsive Design (Container max-width 720px, mobile stacking)

### src/App.tsx
- Import `Imprint` component
- Route-Detection: `/impressum` -> "impressum", `/top` -> "matcher", sonst "landing"
- Conditional Rendering: Imprint-Seite ODER Haupt-App (Hero + Search + Results)
- `cvProcessingUI` nur einmal gerendert (Bugfix: war doppelt)
- Navbar bekommt `route` Prop fuer korrekte Link-Darstellung

### src/components/Footer.tsx
- Neue Navigations-Leiste oben im Footer: Impressum · Datenschutz
- Links: `/impressum` und `/datenschutz` (Platzhalter)
- Bestehende Quellen-Links (Arbeitnow, Arbeitsagentur) bleiben erhalten
- i18n Keys: `footer.imprint`, `footer.privacy`, `footer.legalAriaLabel`

### src/i18n.tsx
- DE/EN Keys fuer Impressum: `legal.imprintTitle`, `legal.providerHeading`, `legal.providerName`, `legal.providerNameDev`, `legal.providerAddress`, `legal.addressDev`, `legal.contactHeading`, `legal.contactEmail`, `legal.devNotice`
- DE/EN Keys fuer Footer: `footer.imprint`, `footer.privacy`, `footer.legalAriaLabel`

### src/styles.css
- `.legal-main`, `.legal-page`, `.legal-container`, `.legal-header`, `.legal-section`, `.legal-dl`, `.legal-placeholder`, `.legal-dev-notice`
- `.footer-links` fuer Legal-Links im Footer
- Mobile Breakpoints (680px) fuer Legal-Seiten

### src/components/Imprint.test.tsx (neu, 6 Tests)
- Impressum-Titel, Provider-Sektion, Kontakt-Sektion
- E-Mail aus Env-Config als Link
- Entwicklungs-Hinweis zur fehlenden Anschrift
- Platzhalter-Kennzeichnung (italic/muted)
- EN-Sprache Labels

### src/components/Footer.test.tsx (neu, 4 Tests)
- Impressum-Link (`/impressum`)
- Datenschutz-Link (`/datenschutz`)
- aria-label "Rechtliche Links"
- EN-Sprache Labels

### .env.local (nicht committed)
- `VITE_CONTACT_EMAIL=maysjobsearchinfos@gmail.com`

### .gitignore
- Bereits vorhanden: `.env`, `.env.local`, `.env*`

## Open Items
- **LEGAL-ADDRESS-01** (OPEN): Betreiberanschrift noch nicht final festgelegt.
  - Im Report dokumentiert, Impressum zeigt Entwicklungs-Platzhalter.
  - Rechtliche Vollstaendigkeit erst nach Eintragung der echten Anschrift.

## Checks (final)
- npx vitest run: 45 Files / 516 Tests — PASS
- npx tsc -b — PASS
- npm run build — PASS (Exit 0)
- git diff --check — CLEAN

## Consent-/Privacy-/Contract-Bezug
- Keine Aenderung an Consent-Flow, Privacy-Boundary, AI-Model-Auswahl.
- E-Mail wird oeffentlich im Impressum angezeigt (kein Secret).
- `VITE_CONTACT_EMAIL` ist KEIN Secret (oeffentlich im Impressum sichtbar).
- Keine Klartext-E-Mail im Git-Source (nur Env-Variable referenziert).

## Classification
GREEN — Impressum technisch vorbereitet, Footer erweitert, Env-Config sauber, Tests gruen.

## Resume point
Abgeschlossen; Commit + Push erfolgt.
# JOBMATCHER-FOOTER-MENU-AUTH-LINK-AUDIT-01 — EXECUTION LOG

Status: YELLOW
Datum: 2026-10-10
Branch: main
HEAD: 022cdd0

## Scope
Prüfung Footer Impressum/Datenschutz, Cognito Auth Link Erreichbarkeit, Menü-Stil Konsistenz mit Jobsearch Page.

## Befunde

### Footer
- Footer.tsx rendert Links /impressum und /datenschutz
- /impressum: route mapping vorhanden in App.tsx, Komponente Imprint.tsx existiert → funktioniert
- /datenschutz: kein Route Mapping in App.tsx, keine Komponente, kein Vercel Rewrite → Link führt ins Leere

### Cognito Auth Link
- Kein direkter Link zu Cognito Domain im Frontend
- Auth Flow via react-oidc-context signinRedirect mit oidcConfig
- /auth/callback wird über isAuthCallback Early Return mit AuthCallback gerendert, Navbar nicht vorhanden → akzeptabel

### Menü Stil
- Navbar.tsx isGlass = route === "matcher"
- Jobsearch Page = route "matcher" → navbar-glass aktiv
- /anmelden → route "login", /registrieren → route "register" → isGlass false
- Ergebnis: Menü auf Auth Seiten unterscheidet sich visuell von Jobsearch Page
- Ursache: TOP-MENU-02 bewusst auf matcher beschränkt

## Risiken
- Toter Datenschutz Link
- UX Inkonsistenz Menü

## Empfehlung
- Route für /datenschutz ergänzen und Komponente bereitstellen
- Entscheidung dokumentieren ob Glass Mode auf Auth Seiten erweitert werden soll
- Notiz im Navbar Modul hinterlassen

## Git
Keine Änderungen vorgenommen, Audit nur Lesend.

## Nächster Schritt
Freigabe für Datenschutz-Route und Menü-Stil Entscheidung.

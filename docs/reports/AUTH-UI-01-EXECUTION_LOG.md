# AUTH-UI-01 — Login- und Registrierungsmaske als reine Frontend-GUI (Execution Log)

## Status
DONE (reine GUI; kein Backend, keine Session, keine Secrets — PRODUCT/PLATFORM CONTRACT unangetastet)

## 1. IST-Bestand vor Änderung (aus REGISTRATION-UI-01, Commit `437f690`)
- `RegisterForm.tsx`: Konto-Maske mit allen Pflichtfeldern, Validierung, Placeholder,
  Links `/anmelden` + `/top`. `LoginForm.tsx`: minimale Login-Maske (E-Mail, Passwort,
  Placeholder, Links `/registrieren` + `/top`). Routen `/registrieren`, `/anmelden`
  in `App.tsx` + `vercel.json`-Rewrites; Navbar-Login → `/anmelden`.
- Lücken zu AUTH-UI-01: kein „Passwort vergessen?", kein Trennbereich, Link-Wording
  „Noch kein Konto? Jetzt erstellen" statt „… Registrieren", keine Routen-Tests
  auf App-Ebene.

## 2. Umgesetzte Login-GUI (Delta)
- „Passwort vergessen?"-Button (`LoginForm.tsx`): toggelt UI-only Hinweis
  („… noch nicht verbunden …", `role="status"`) — kein Reset-Flow, kein Request.
- Trennbereich `.auth-divider` zwischen Formular und Registrierungs-Link.
- Wortlaut: „Noch kein Konto? Registrieren" (de; en unverändert sinngemäß).
- i18n-Keys `auth.forgotPassword`, `auth.forgotHint` (de + en); CSS `.auth-forgot`,
  `.auth-hint`, `.auth-divider` (Token-basiert, responsiv abgedeckt).

## 3. Umgesetzte Registrierungs-GUI
Unverändert aus REGISTRATION-UI-01 (alle AUTH-UI-01-Punkte bereits erfüllt:
Überschrift, neutrale Erklärung, E-Mail, Passwort ×2, beide Checkboxen, Submit,
beide Links, Validierung, Placeholder „… mit dem Authentifizierungssystem verbunden").

## 4. Navigation (UI-Flow, verifiziert)
`/top` (Gast) → Navbar-Login → `/anmelden` → (Anmelden-Placeholder | „Passwort
vergessen?"-Hinweis | „Noch kein Konto? Registrieren" → `/registrieren` →
„Bereits registriert? Anmelden" → `/anmelden`); beide → `/top` (Gastmodus).
Keine echte Authentifizierung an irgendeiner Stelle.

## 5. Validierung
Login: E-Mail Pflicht + Format, Passwort Pflicht, Feldfehler (`role="alert"`).
Registrierung: + Wiederholung/Match, Passwort ≥ 8, beide Checkboxen Pflicht.
Submit bei Fehlern blockiert; gültig → Placeholder-State. Kein Request-Pfad im Code
(kein `fetch` in beiden Komponenten).

## 6. Bewusst nicht implementiert (HARD STOP eingehalten)
Cognito, API-Requests, JWT (keine Dummies), User-Erstellung, UserProfile-Persistenz,
DynamoDB, Session/Token, Entitlements, Offers/Produktlogik, Provisioning,
JobSearch-Backend-Änderungen, Credentials/Secrets (Secret-Audit: keine Funde).

## 7. Tests
- Neu: `src/AuthRoutes.test.tsx` (3 Tests): `/anmelden` rendert Login inkl.
  Forgot-Button + alle Links/Hrefs; `/registrieren` rendert Registrierung inkl.
  aller Links/Hrefs; `/top` rendert Jobsuche ohne Auth-Zwang (Gast intakt).
- Erweitert: `LoginForm.test.tsx` (+2: Forgot-Hinweis UI-only ohne `fetch`-Call;
  Wording/Divider implizit via Rendering).
- Stand: neu/geändert 16/16 grün; Vollsuite **711 passed, 5 skipped, 0 failed**;
  `npx tsc -b` PASS; `npm run build` PASS (nur vorbestehende Chunk-Warnung).
- Live-Browser (Chromium/Playwright, lokales `vite dev`, danach gestoppt, `/tmp`
  sauber): Forgot-Button → Hinweis, Divider vorhanden, Links korrekt, beide Routen
  rendern, 0 JS-Errors.

## 8. Build / Git-Status / Commit
- Build: PASS (s. §7). Commit folgt, nur zugehörige Dateien:
  `src/components/LoginForm.tsx`, `LoginForm.test.tsx`,
  `src/AuthRoutes.test.tsx`, `src/i18n.tsx`, `src/styles.css`,
  dieser Report. (`RegisterForm*`, `App.tsx`, `Navbar.tsx`, `vercel.json`
  bereits in `437f690`.)
- Screenshots-Diffs (`docs/screenshotsfordev/`, vorbestehend) NICHT angefasst.

## Audit-Nachweis (AI_AUDITLOG-pflichtig)
- Status: DONE (UI-only; Gast-Flow + Suite verifiziert ungebrochen)
- Zeitpunkt: 2026-10-03; Branch: main
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: ausgeführt — 16/16, Suite 711/0 failed, tsc PASS, Build PASS
- Geänderte Dateien: nur obige (kein `api/`, keine Secrets, kein Backend)
- Risiken: minimal (zusätzlicher UI-Hinweis + Divider + Wording; kein Verhalten sonst)
- Nächste Schritte: keine (Auth-Verdrahtung = separater Schritt, nicht begonnen)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)
Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reine Auth-GUI ohne AI-/Datenfluss-Änderung (kein Request, keine Persistenz).
Keine AI-Audit-Ergänzung erzeugt.

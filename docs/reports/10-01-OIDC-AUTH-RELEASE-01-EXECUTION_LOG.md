# JOBMATCHER-OIDC-AUTH-RELEASE-01 - Execution Log

Datum: 2026-10-23
Branch: main
HEAD: fb88729
Autor: OpenCode

## 1. Preconditions
- `git log -1` → `fb88729 JOBMATCHER-OIDC-LOGIN-PARAMETER-FIX-01: separate login/logout OIDC params`
- Arbeitsbaum enthält 9 vorbestehende, untracked Dateien (unverändert gelassen); keine uncommitted Änderungen an getrackten Dateien.

## 2. Deployment
- Befehl: `vercel --prod --scope maymilly --yes`
- Deployment ID: `dpl_GfCXj8oe8jevyuGM7Fzbe3nYuwfj`
- Deployment URL: `https://mays-job-matcher-dy6a0ij5z-maymilly.vercel.app`
- Production Alias: `https://www.mays-job-matcher.app`
- Status: READY

## 3. Ausgeliefertes Bundle
- Production `index.html` referenziert `assets/index-BhWwxOIS.js` (neuer Hash vs. vorherigem Release `index-CVwSO0hm.js`).
- Bundle enthält Logout-Parameter (`logout_uri` im Signout-Pfad) — Login-Konfiguration ohne globale Logout-Extras.

## 4. Browser-E2E (Production, Playwright/Chromium)

### 4.1 Login
| Check | Ergebnis |
|---|---|
| `/anmelden` → Login-Button → Cognito | PASS |
| Cognito `/login` HTTP-Status | PASS — 200 |
| `client_id` genau einmal | PASS — count=1 |
| kein `logout_uri` im Login-Request | PASS — Params: client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method |
| `redirect_uri` = `/auth/callback` | PASS |
| `response_type=code` | PASS |
| `scope=openid email profile` | PASS |
| PKCE `S256` | PASS |
| Cognito zeigt E-Mail-/Passwort-Feld | PASS |

### 4.2 Logout (Session-Flow)
Hinweis: Für den UI-Flow wurde eine **synthetische, unsignierte** Session im Browser-Kontext injiziert (keine echten Credentials, keine echten Tokens; Werte `synthetic@example.invalid`).

| Check | Ergebnis |
|---|---|
| Navbar zeigt „Logout" bei aktiver Session | PASS |
| Navbar zeigt Profil-Link | PASS |
| Logout-Request an Cognito `/logout` | PASS |
| `client_id` genau einmal im Logout | PASS — count=1 |
| `logout_uri` vorhanden | PASS — `https://www.mays-job-matcher.app` |
| kein `post_logout_redirect_uri` | PASS — Params: id_token_hint, client_id, logout_uri |
| Cognito `/logout` Antwort | PASS — 302 |
| Rückkehr auf Startseite | PASS — `https://www.mays-job-matcher.app/` |
| Lokale Session bereinigt | PASS — `sessionStorage`-User entfernt |
| Navbar auf `/search` nach Logout | PASS — „Login" |
| Startseite (LandingPage2) zeigt Login-Einstieg | PASS — `a.lp2-login` = „Login" (Landing hat bewusst keine App-Navbar) |
| Erneuter Login | PASS — Cognito `/login` 200, client_id=1, kein logout_uri, PKCE S256, Passwortfeld vorhanden |

### 4.3 Profil-Zugriff ohne Session — **FAIL (vorbestehender Defekt)**
- `/profil` liefert **nicht** die Profilseite, sondern die alte Landing-Hero („Finde Jobs, die wirklich zu dir passen."). Keine Profil-/User-Daten sichtbar (kein Datenleck).
- Auch **mit** synthetischer Session rendert `/profil` diese Landing-Hero; Profil-Daten werden nicht angezeigt.
- Ursache (Code-Beleg): `src/App.tsx:81-90` mappt `/profil` auf die Fallback-Route `"landing"`; der Early-Return `if (route === "landing" && !isSearching)` (Zeile ~1301) greift **vor** dem `if (isProfile)`-Zweig (Zeile ~2425).
- Historie: `isProfile` wurde in `dc117c9` (2026-10-09) eingeführt; der Landing-Early-Return existiert seit `4391910` → **vorbestehender Defekt**, nicht durch dieses Release verursacht.
- Konsequenz: Der Navbar-Link „Profil" führt ins Leere (Landing-Hero) — die Profilansicht ist funktional nicht erreichbar.

## 5. Bewertung
- Deployment, Login-Parameter und Logout-Flow: **GREEN** (HTTP- und Browser-Evidence).
- Akzeptanzkriterium „Profilzugriff prüfen": **RED** wegen vorbestehendem Routing-Defekt in `App.tsx`.
- Gemäß Auftrag („Bei Fehler STOP und Evidence dokumentieren") wurde **kein** weiterer Code-Fix und **kein** weiteres Deployment durchgeführt.
- Keine AWS-Änderungen.

## 6. Empfohlener minimaler Fix (Freigabe erforderlich)
- `route`-Mapping in `src/App.tsx`: `if (path === "/profil") return "profil";` (bzw. Profil-Route vor dem Landing-Fallback) **oder** den `isProfile`-Zweig vor den Landing-Early-Return ziehen.
- Regressionstest: `/profil` rendert Profilseite (nicht Landing-Hero), anonym → „nicht angemeldet".

## 7. Sicherheit
- Keine Tokens oder Cookies in diesem Report gespeichert.
- Synthetische Session-Werte sind Platzhalter (`synthetic@example.invalid`), keine echten Credentials.

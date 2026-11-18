# JM-PROFILE-UX-02 — PROFILE COMMAND CENTER PREVIEW ACCEPTANCE

**Status:** `C — AUTHENTICATED PREVIEW VERIFICATION BLOCKED`  
**Feature-Branch:** `feature/jm-profile-ux-01-command-center`  
**Code-Commit:** `2843811`  
**Feature-HEAD:** `113fea0`  
**No Main merge, no Production deployment, no design/auth/consent/RIS change.**

## 1. Git & Preview Preflight

```text
Branch:                  feature/jm-profile-ux-01-command-center
HEAD:                    113fea0
origin/feature/...:       113fea0
origin/main:             92ca1fc
Code commit 2843811:     enthalten
Working tree:            clean
git diff --check:        PASS
```

Gefundene Preview für denselben Feature-Branch:

```text
URL:          https://mays-job-matcher-nzln1n0ny-maymilly.vercel.app
Deployment:   dpl_FBHhFVC6caZHh4hwWtSGyuEaPgZo
Target:       preview
Status:       READY
Commit:       113fea088a4d475000ae403a037555865d1e3aa4
Branch:       feature/jm-profile-ux-01-command-center
```

Produkt-Preview für den Code-Commit:

```text
https://mays-job-matcher-a56083uq9-maymilly.vercel.app
Commit: 28438111a8bb7b5ee320ed37f603e358a8c0d948
```

Es wurde **kein neues Preview-Deployment** erzeugt.

## 2. Preview Identity & Rendering

Footer der echten Preview:

```text
Version 2.2.0 · preview · feature/jm-profile-ux-01-command-center · 113fea0
```

Damit stimmen Preview-Commit und Build Identity überein.

```text
Hintergrund-Asset: HTTP 200, image/webp, 96.016 Bytes
HTML:              HTTP 200
Profilroute:       HTTP 200
Shell-Klasse:      layout-profile-command
Console Errors:    0
Horizontal Overflow: 0 (1440, 390)
```

Die unauthentifizierte `/profil`-Preview zeigt den neuen Command-Center-Shell,
Hintergrund und Guest-/Bewerbungsansicht. Das ist **kein Nachweis** für die
sechs angemeldeten Profilansichten.

Screenshots:

```text
docs/evidence/jm-profile-ux-02/preview-unauth-1440.png
docs/evidence/jm-profile-ux-02/preview-unauth-390.png
```

## 3. Authentifizierungsblocker

Der Preview-Login führt zu:

```text
Host:          auth.mays-job-matcher.app
redirect_uri:  https://www.mays-job-matcher.app/auth/callback
client_id:     5hb3f6dj5ialg77jf4blur9g6g
```

Der Preview-Host erhält damit keinen Auth-Callback. Eine Preview-Anmeldung
würde nach Production zurückführen. Es wurden keine produktiven Tokens oder
Session-Daten kopiert und kein Auth-Bypass verwendet. Eine autorisierte
synthetische Preview-Identität ist nicht verfügbar.

**Daher nicht verifizierbar auf der echten Preview:**

- sechs angemeldete Profilansichten
- Profil-Dashboard-Karten
- CV-/Bewerbungs-/Suchprofil-Daten
- Logout und Rückkehr zwischen Bereichen
- authentifizierte Hover-/Focus-Zustände der Dashboard-Sidebar

Ein Login-Screen allein wird nicht als Preview-Abnahme gewertet.

## 4. Lokale Vorprüfung (nicht Preview)

Die UX-01-Lokalprüfung bleibt gültig, wird aber **nicht** als Preview-E2E
ausgegeben:

- 30 synthetische Demo-Ansichten, sechs Tabs, DE/EN, 320–1440 px
- 0 Overflow, 0 Console Errors, 0 Header-Überlappung
- 16 Screenshots unter `docs/evidence/jm-profile-ux-01/`
- `profile-ux-final` und `profile-storage-consent` lokal PASS

## 5. QA

```text
npm run build:                   PASS
npx vitest run --maxWorkers=2:   1956 PASS / 11 skipped
git diff --check:                PASS
Preview HTTP/Asset-Smoke:        PASS für unauthentifizierten Shell
Authentifizierter Preview-E2E:   BLOCKED (Auth-Callback)
```

## 6. Security / Privacy

- Keine Tokens, Cookies oder produktiven Auth-Daten in Screenshots/Reports.
- Keine echten Bewerberdaten.
- Keine Änderungen an Auth, Consent, CV-Logik, RIS, AWS, Cognito oder
  Terraform.
- Keine zusätzliche Preview- oder Production-Aktion.

## 7. Empfehlung

**Keine vollständige Preview-Abnahme behaupten.**

Nächster notwendiger Schritt ist eine separat freigegebene
Preview-Authentifizierungsmöglichkeit, z. B. eine temporäre, eng begrenzte
Preview-Callback-Konfiguration für eine autorisierte synthetische Identität.
Danach können die sechs Bereiche und die interaktiven Zustände auf der echten
Preview geprüft werden.

Bis dahin gilt:

```text
C — AUTHENTICATED PREVIEW VERIFICATION BLOCKED
```

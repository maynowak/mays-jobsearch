# JM-RIS-CONSENT-UX-02

**Status:** `B — PRODUCTION SMOKE VERIFIED / AUTH E2E BLOCKED`  
**No AWS/Terraform/RIS configuration change.**

## 1. Integration

| Punkt | Ergebnis |
|---|---|
| Repository | `maynowak/mays-jobsearch` |
| PR | #31 |
| Base | `b7424222742bd6b2aaf4dc3475d7abe93c9b1eca` |
| Feature-Head | `bdc75e3a18de3de337a965c9e616b4767b693c1c` |
| Merge-SHA | `68aca2a1e6007974343ff6515675c4122d6f9420` |
| Merge-Art | regulärer Merge, kein Force-/History-Rewrite |
| Tree-Vergleich | Feature-Tree == Main-Tree |

Änderungsumfang ausschließlich:

- Consent-UX (`StorageConsentLive`)
- CV-404-/Persistent-CV-UX
- I18n/Tests
- Auditlog und Report

Keine RIS-, AWS-, Terraform-, Cognito-, CloudFront- oder DNS-Änderung.

## 2. Automatisches Production-Deployment

Commit `68aca2a1e6007974343ff6515675c4122d6f9420`:

| Projekt | Deployment-ID | Status |
|---|---|---|
| `mays-job-matcher` | `dpl_GS5AYuF8iifCq7jJZsGMxSLwVDap` | READY |
| `mays-jobsearch` | `dpl_GMUkQDsS9dyWqFJ6edEDTsXk3kzN` | READY |

Beide Domains:

```text
https://www.mays-job-matcher.app
https://mays-jobsearch.vercel.app
```

liefern Build `68aca2a` im Bundle. Kein manuelles Deployment.

## 3. Production-Smoke

Öffentliche Routen auf beiden Domains:

```text
/                   200
/profil             200
/profil?tab=settings 200
/profil?tab=cv      200
/datenschutz        200
/impressum          200
```

Bundle-Prüfung:

- enthält `Wird gespeichert`
- enthält `Einwilligungen in den Einstellungen öffnen`
- enthält `nicht mehr vorhanden`
- enthält die sichtbare Success-Meldung
- Build-SHA `68aca2a`

Browser-Smoke (Chromium, 1280×900, ohne Login):

- keine Page-Errors
- keine Console-Errors
- alle geprüften Routen HTTP 200
- unauthentifizierte Profilseite zeigt Login-Zustand

API-Smoke:

```text
GET https://www.mays-job-matcher.app/api/ris/consents -> 401 unauthenticated
GET https://mays-jobsearch.vercel.app/api/ris/consents  -> 503 consent_disabled
```

Keine 5xx-Antwort auf der matcher-Domain; kein unerwarteter API-Fehler.

## 4. Authentifizierter Live-E2E

**BLOCKED — AUTH E2E REQUIRED.**

Es ist keine gültige autorisierte Limited-Beta-Testidentität bzw. kein gültiger
Test-Token in dieser Umgebung verfügbar. Nicht ausgeführt wurden:

- ApplicationV1-Consent Grant/Reload
- sichtbare Success-Meldung im angemeldeten Konto
- Widerruf und erneute ausdrückliche Einwilligung
- CV-Speicherfreigabe
- PDF-404 mit synthetischen, angemeldeten Testdaten

Es wurden keine echten Bewerbungsunterlagen gelöscht oder verändert und keine
Tokens/Consent-Historien protokolliert.

## 5. Tests / Build

Aus dem PR-Stand:

```text
Fokussiert Consent/CV:       29 PASS
RIS Consent API:             40 PASS
Serielle Gesamtsuite:        1949 PASS / 11 skipped
npm run build:               PASS
```

Der Production-Build von Vercel war ebenfalls READY.

## 6. Bekannte Einschränkungen

- Authentifizierte UX- und Consent-E2E bleibt offen.
- Der CV-404-Fix ist lokal mit 404-Mocks und Listen-Refresh verifiziert; eine
  reale stale-CV-Metadatenzeile konnte ohne Testidentität nicht live
  reproduziert werden.
- Die Production-Smoke prüft öffentliche Routen und Bundle-Inhalte, nicht den
  angemeldeten Consent-Status.

## 7. Git

Feature-Branch retained:

```text
feature/jm-ris-consent-ux-01
```

Docs-Branch:

```text
docs/jm-ris-consent-ux-02
```

Kein weiterer Main-Merge, kein Deployment und keine RIS-/AWS-Änderung.

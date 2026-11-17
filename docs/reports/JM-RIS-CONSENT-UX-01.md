# JM-RIS-CONSENT-UX-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL / AUTHENTICATED LIVE E2E BLOCKED`  
**No Main merge, no Production deployment, no RIS/AWS/Terraform mutation.**

## 1. Ausgangslage

Basis: `origin/main` `b7424222742bd6b2aaf4dc3475d7abe93c9b1eca`.
Gelesen: `AGENTS.md`, `docs/AI_AUDITLOG.md` und der bestehende
Consent-/CV-Datenfluss.

Der RIS-DEV-Consent-Fix ist bereits ausgerollt; die RIS-Notice
`application-storage/1.0` ist `APPROVED`. Eine autorisierte
Limited-Beta-Testidentität ist in dieser Umgebung jedoch weiterhin nicht
verfügbar. Daher wurden keine echten personenbezogenen Daten, Tokens oder
Consent-Historien verwendet oder protokolliert.

## 2. Reproduktion und Befunde

### Application-Consent

Der bestehende Pfad ist:

```text
StorageConsentLive
  -> grantRisConsent(token, specialCategoriesConsent)
  -> POST /api/ris/consents
  -> Jobsearch BFF
  -> RIS /v1/partner/me/consents
```

Bestätigt im Code und in Tests:

- `specialCategoriesConsent=true` wird tatsächlich im POST-Body übertragen.
- Der BFF akzeptiert den Grant nur mit ausdrücklicher Art.-9-Bestätigung.
- Ohne API-Erfolg wird keine Erfolgsmeldung erzeugt.
- Die RIS-Antwort bleibt der Server-Status; es gibt keine clientseitige
  Gate-Umgehung.

Gefundene UX-Defekte:

1. Während des POST gab es keinen sichtbaren Ladezustand am Button.
2. Nach erfolgreichem POST gab es nur den Statuswechsel, aber keine explizite
   Bestätigung.
3. Nach einem Reload wurde bei bereits erteilter Einwilligung die Checkbox
   lokal als „nicht bestätigt“ dargestellt, obwohl der Server `GRANTED` und
   `specialCategoriesConsent=true` lieferte.
4. Fehler wurden häufig als „Einwilligungsdienst nicht verfügbar“ angezeigt,
   auch wenn der BFF einen konkreten Grund wie eine noch nicht aktive Notice
   oder eine fehlende Berechtigung lieferte.

### CV „Der Lebenslauf wurde nicht gefunden.“

Die Meldung stammt aus dem persistenten PDF-Pfad
`usePersistentCvStorage`/`downloadCvFile`:

```text
GET /api/ris/cvs?id=<cvId>&action=document
```

Ein Listeneintrag kann als Metadatenzeile sichtbar bleiben, während die
zugehörige PDF-Ressource in RIS nicht mehr vorhanden ist. Der 404 wurde
bisher als statischer Text angezeigt; die Liste wurde nicht abgeglichen.

Das ist **nicht** der CV-Builder-Entwurf: der Builder ist ein separater
strukturierter Sitzungsdatensatz. Es wurden keine Daten gelöscht oder
migriert.

## 3. Implementierte UX-Verbesserungen

### `StorageConsentLive`

- Expliziter Ladezustand:
  - „Wird gespeichert …“
  - „Wird widerrufen …“
  - „Verlauf wird geladen …“
- Sichtbare Erfolgsbestätigung nach bestätigtem POST:
  - Grant: „Die Einwilligung zur dauerhaften Speicherung wurde gespeichert.
    Status: erteilt.“
  - Widerruf: „Die Einwilligung wurde widerrufen …“
- Keine Erfolgsmeldung bei fehlgeschlagener API-Antwort.
- Konkrete Fehlertexte für:
  - fehlende Art.-9-Bestätigung
  - deaktivierten Consent-Dienst
  - unvollständige Server-Konfiguration
  - nicht erreichbaren Notice-Katalog
  - abgelaufene Anmeldung
  - nicht freigegebenes Konto
  - nicht erreichbaren Dienst
- Bereits erteilte Art.-9-Einwilligung wird nach Reload als checked +
  disabled angezeigt.
- Widerruf setzt die Checkbox weiterhin für eine neue ausdrückliche
  Einwilligung zurück.
- Der Server-Status wird aus der POST-Antwort übernommen; ein zusätzlicher
  GET kann einen bestätigten Grant nicht in einen falschen Fehler verwandeln.

### CV-/Profilbereich

- Bei fehlender CV-Speicherfreigabe erscheinen:
  - der Hinweis, dass ApplicationV1- und CV-Consent getrennt sind,
  - ein direkter Link `/profil?tab=settings`,
  - Ladezustände beim Erteilen/Widerrufen.
- Ein 404 beim persistenten PDF-Download wird als konkreter, nicht
  destruktiver Fehler erklärt:
  „Der gespeicherte Lebenslauf ist in RIS nicht mehr vorhanden. Die Liste wird
  aktualisiert; bitte den Lebenslauf erneut auswählen.“
- Der Hook aktualisiert nach einem 404 die Liste, löscht oder migriert aber
  keine Daten.
- Der bestehende AI-Consent-/CV-Workflow bleibt unverändert; Storage-Consent
  wird nicht als AI-Consent behandelt.

## 4. Tests

Fokussiert:

```text
src/components/StorageConsentLive.test.tsx
src/lib/usePersistentCvStorage.test.tsx
src/components/PersistentCvList.test.tsx
src/components/PersistentCvList.consentUx.test.tsx

29 PASS
```

API-Vertrag:

```text
npx vitest run tests/api/ris-consents.test.mjs
40 PASS
```

Build:

```text
npm run build
PASS
```

Serielle Gesamtsuite:

```text
npx vitest run --no-file-parallelism
1949 PASS / 11 skipped
```

Abgedeckte Fälle:

- fehlende Art.-9-Einwilligung
- erfolgreicher Grant mit `specialCategoriesConsent=true`
- Ladezustand und Erfolg erst nach API-Erfolg
- fehlgeschlagener Grant / RIS-Fehler
- Status nach Reload
- Widerruf
- erneute ausdrückliche Einwilligung
- getrennte ApplicationV1-/CV-Consent-Hinweise
- Link von CV zu den Einstellungen
- CV-404 mit Listenabgleich ohne Löschung

## 5. Offene RIS-/Live-Abhängigkeiten

- Eine autorisierte Limited-Beta-Testidentität ist weiterhin nicht verfügbar.
- Der authentifizierte Live-E2E (Grant/Reload/Withdraw/Regrant) ist daher
  **nicht** ausgeführt.
- Der unauthentifizierte BFF-Smoke bleibt `401`, nicht `503`; das ist kein
  Beweis für einen erfolgreichen Grant.
- Keine Production-Wiederherstellung behauptet.

## 6. Git / PR

Feature-Branch: `feature/jm-ris-consent-ux-01`

Kein Main-Merge, kein Production-Deployment, keine RIS-/AWS-/Terraform-
Änderung.

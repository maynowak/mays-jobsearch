# JM-RIS-INTEGRATION-GAP-CLOSURE-01

## Status

**BFF + REMOTE ADAPTER IMPLEMENTED — MOCK-TESTS PASS — LIVE E2E BLOCKED**

- Branch: `feature/jm-ris-integration-gap-closure-01`
- Base: `origin/main` @ `fec135c`
- Keine AWS-/Terraform-/Cognito-Änderung
- Kein Deployment, kein Push, kein Merge
- Lokale Session-Bewerbungsverwaltung bleibt unverändert verfügbar

## 1. Tatsächlich verifizierte RIS-Routen

Aus dem RIS-Phase-27-E2E (echter Gateway-/JWT-/Partner-Test):

| Methode | RIS-Pfad | Status |
|---|---|---|
| GET | `/v1/partner/me/applications/metrics` | live 200 |
| POST | `/v1/partner/me/applications` | live 201 |
| GET | `/v1/partner/me/applications` | live 200 |
| GET | `/v1/partner/me/applications/{id}` | live 200 |
| PATCH | `/v1/partner/me/applications/{id}` | live 200 |
| GET | `/v1/partner/me/applications/{id}/export` | live 200 |
| DELETE | `/v1/partner/me/applications/{id}` | live 204 |

Nicht als live verifiziert übernommen:

- `POST .../{id}/status`
- `POST .../{id}/history`
- `POST .../{id}/cover-letter-versions`
- Privacy-Inspect/Export
- CV-/Profil-/Suchprofil-Routen

## 2. Feld- und Vertragsmatrix

| Jobsearch (`contractTypes` / UI) | RIS ApplicationV1 | Behandlung |
|---|---|---|
| `localId` | `applicationId` | Remote-Adapter setzt `localId = applicationId`; `applicationId` wird nie aus Browserdaten gesetzt |
| `ownerId` | nicht im Response exponiert | Adapter nutzt `""`; nie als Client-Input gesendet |
| `job.companyName` | `job.company` | Mapping |
| `job.location: string[]` | `job.location: string` | Join/Split |
| `job.source: string[]` | `job.source: string` | erstes Element |
| `job.originalUrl` | `job.url` | Mapping; fehlende URL → `jobOrigin: manual` |
| Status lowercase (`draft`, `submitted`, …) | Status uppercase + `stage` | `stage` bevorzugt, sonst Mapping |
| `documents.coverLetterDraft` | `documents.coverLetterDraft` | direkt |
| `documents.coverLetterVersions` | `documents.coverLetterVersions` | direkt, aber Version-Route nicht live verifiziert |
| `documents.cvReference` | `documents.cvReference` | direkt; RIS prüft CV-Ownership separat |
| `salary` inkl. Dezimalwerten | `salary` als JSON-Zahl/Decimal | direkt; RIS validiert Decimal |
| `followUp` | `followUp` | direkt |
| `statusHistory` | im List/Get nicht exponiert | Adapter liefert `[]`; keine erfundene Historie |
| `history` | im List/Get nicht exponiert | Adapter liefert `[]`; History-Route offen |
| `version` | `version` | direkt; Patch/Delete mit `expectedVersion` |
| Export | `{application, exportedAt}` | Mapping zu `ApplicationExportV1`, `localDraft: false` |
| Delete | 204 ohne Receipt | Adapter liefert `{deleted, localId, idempotent:false}` |

## 3. BFF

Datei: `api/ris/[...path].mjs`

- Browser → BFF → RIS API Gateway.
- `Authorization` wird unverändert weitergereicht.
- `X-Api-Credential` wird **nur serverseitig** aus `RIS_API_KEY` gesetzt.
- Erlaubte Routen: Applications list/create/get/patch/delete/export/metrics.
- Status/History/Cover-Letter-Versionen liefern bewusst **501 `unsupported`**.
- Timeout (`RIS_PARTNER_TIMEOUT_MS`), 204, Fehler-Mapping (401/403/404/409/422/429/503/504) und `Cache-Control: no-store`.
- Kein Secret/Token in Antworten oder Logs.

Benötigte Server-Env:

```text
RIS_API_BASE_URL=https://<ris-api>
RIS_API_KEY=ris_...
RIS_PARTNER_TIMEOUT_MS=15000
```

## 4. Frontend-Adapter

Dateien:

- `src/lib/applications/ris/risMapping.ts`
- `src/lib/applications/ris/risClient.ts`
- `src/lib/applications/ris/risRepository.ts`
- `src/lib/applications/ris/risMode.ts`

Unterstützt:

- List inkl. Cursor/Limit/Status
- Detail
- Create inkl. Idempotency-Key
- Update mit `expectedVersion`
- Export
- Delete mit `expectedVersion`
- Metrics über den Persistence-Port
- `findByJob` über paginierte List-Suche
- `invalidate()` bei Session-/Identitätswechsel

Explizit nicht unterstützt (Fehler `unsupported`):

- Statusübergänge
- Feedback/Interview/Notiz-History
- Anschreiben-Versionen
- Cover-Letter-Adoption

## 5. UI-Anbindung

- Remote-Modus ist opt-in über `VITE_RIS_APPLICATIONS_REMOTE=true`.
- Zusätzlich ist eine explizite Subjekt-Allowlist `VITE_RIS_REMOTE_TEST_SUBS` erforderlich.
- Nur für synthetische Testbenutzer; normale Nutzer bleiben im Session-Modus.
- `ApplicationsSection` zeigt im Remote-Modus einen Konto-/Testhinweis und weist auf nicht unterstützte Status-/History-/Versionsaktionen hin.
- Lokale Entwürfe werden **nicht** automatisch migriert.
- Bei Remote-Fehler bleibt der lokale Session-Modus unverändert verfügbar; es wird kein Erfolg vorgetäuscht.

## 6. Testnachweise

| Prüfung | Ergebnis |
|---|---|
| TypeScript + Vite Build | PASS |
| Adapter-Tests (Mapping, Create, Update, List, Export, Delete, Fehler, Unsupported) | 11 passed |
| BFF-Tests mit Mock-RIS (Node `--test`) | 7 passed |
| Anwendungs-/UI-bezogene Vitest-Suite | 200 passed |
| CV-PDF-Tests separat | 9 passed |
| API-Syntax `node --check api/ris/[...path].mjs` | PASS |

Vollsuite-Hinweis: Im parallelen Gesamtlauf traten zwei CV-PDF-Timeouts auf; dieselben Tests bestehen separat. Das ist ein bestehender Umgebungs-/Parallelitätsflake, nicht Teil dieser Änderung.

## 7. Live-E2E-Status

**BLOCKED** aus zwei Gründen:

1. **Cognito-Vertrag:** Die lokale Jobsearch-OIDC-Konfiguration zeigt auf
   `eu-central-1_ZURSMpD2O` / Client `5hb3f6dj5ialg77jf4blur9g6g`. Der live
   verifizierte RIS-DEV2-Authorizer erwartet
   `eu-central-1_K3dkdSipZ` / Audience `21j28p71vogg0m41tcue0ib3l4`.
   Ob das Vercel-Deployment die Jobsearch-Env auf den RIS-Pool überschreibt,
   ist ohne Vercel-Zugriff **nicht verifiziert**. Ein Token aus dem falschen
   Pool wird von RIS mit 401 abgelehnt.
2. **Kein Jobsearch-Partner-Credential/BFF-Deployment:** `RIS_API_KEY` und
   `RIS_API_BASE_URL` sind lokal nicht gesetzt. Die RIS-Testcredentials aus
   Phase 27 wurden widerrufen. Ein Live-Test benötigt einen eigenen
   Jobsearch-Partner/APIProfile/Credential sowie ein Preview-Deployment — beides
   ist ohne separate Freigabe nicht zulässig.

Daher wurden Anmeldung, echter Gateway-Aufruf, Logout/Login und
Benutzerwechsel nicht live ausgeführt. Sie sind als nächstes Integrationsgate
dokumentiert.

## 8. Datenschutz / Consent

- Remote-Modus darf nicht für normale/produktive Nutzer aktiviert werden, bis
  RIS-Privacy-/Consent-Gates und die Jobsearch-BFF-Abnahme vorliegen.
- Partner-Key bleibt serverseitig; der Browser sieht nur den BFF.
- Keine automatische Migration lokaler Entwürfe.
- Keine echten Bewerberdaten in DEV2.
- Lösch-/Export-Semantik von RIS bleibt serverseitig; Jobsearch zeigt keinen
  lokalen Lösch-Erfolg als Servererfolg.

## 9. Offene Arbeitspakete

1. Ziel-Cognito-Issuer/-Client zwischen Jobsearch-Deployment und RIS DEV2
   verbindlich abgleichen (ohne unautorisierte Cognito-Änderung).
2. Eigenen synthetischen Jobsearch-Partner + APIProfile + Credential über den
   RIS-Trust-Anchor provisionieren.
3. BFF in einem Preview-Deployment mit `RIS_API_BASE_URL`/`RIS_API_KEY`
   konfigurieren.
4. Live-E2E: Login, Create, Reload/List, Update, Export, Delete,
   Logout/Login/Benutzerwechsel, Fremdzugriff.
5. Danach Status-/History-/Cover-Letter-Versionen nur nach separater
   RIS-Verifikation ergänzen.
6. Mehrseitige Pagination und Cursor-Verhalten live prüfen.

## 10. Grenzen

- Keine `ris-dev`-Änderung.
- Keine AWS-/Terraform-/Cognito-/CloudFront-/DNS-/ACM-Änderung.
- Kein Push/Merge/Produktionsdeployment.
- Keine Secrets in Git, Reports oder Logs.

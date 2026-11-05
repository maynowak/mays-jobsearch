# JM-RIS-INTEGRATION-01E — Session Handoff / Kontospeicherung (lokal)

**Art:** Session-Migration / Consent-Gate / lokaler Mock
**Datum:** 2026-11-05
**Ziel:** `ris-dev` (nicht live) · **Modus:** LOCAL MOCK ONLY
**Status:** **SESSION MIGRATION LOCAL VERIFIED · STORAGE GATE FAIL-CLOSED · RIS-DEV LIVE BLOCKED**

---

## 1. Baseline

| Element | Stand |
|---|---|
| Jobsearch | `main` `a3c9a04` + Migrationsstand |
| Remote-Adapter | 01C |
| UI-Integration | 01D |
| BFF | 01B |
| Session-Repository | unverändert |
| Testbasis | **1481 passed / 5 skipped** |

---

## 2. Implementierte Schnittstellen

- `ApplicationMigrationPortV1` (vorhanden) wird durch
  `createApplicationMigration` implementiert.
- Erweiterungen am bestehenden Vertrag (additiv):
  - `ApplicationMigrationSelectionV1.confirmed`
  - `ApplicationMigrationItemStatus`
  - `ApplicationMigrationPreviewItemV1`
  - `ApplicationMigrationPreviewV1.items`
  - `ApplicationMigrationResultV1.statuses`
  - `CreateApplicationDraftInputV1.followUp`
- UI: `ApplicationMigrationDialog` + Button „Im Konto speichern“ in
  `ApplicationsSection`, nur wenn ein Migrations-Port explizit übergeben wird.
- Keine neue Bewerbungsverwaltung; keine Änderung der Session-Semantik.

---

## 3. Benutzerablauf

```text
Session-Bewerbung
  → „Im Konto speichern“
  → Vorschau (Kompatibilität, Duplikate, Gründe)
  → Auswahl + ausdrückliche Bestätigung
  → commit (nur mit confirmed:true)
  → Remote-Create (Mock)
  → Server-ID prüfen (get)
  → Ergebnis pro Bewerbung
```

- Keine automatische Migration beim Login.
- Kein Auto-Transfer beim Öffnen der Seite.
- Lokale Bewerbungen bleiben nach Erfolg **erhalten**.
- Die UI zeigt Erfolg erst nach bestätigter Server-Antwort.

---

## 4. Consent-Gate (fail-closed)

- `consentSource` muss `"simulated"` sein; `"server"` wird ohne echten
  Consent-Dienst mit `storage_consent_required` abgelehnt.
- `storageConsent()` muss `true` liefern; sonst kein Write.
- Eine lokale Checkbox ist **keine** serverseitige Freigabe; der UI-Dialog
  bestätigt nur die konkrete Übertragung.
- Keine künstlichen Consent-Receipts.
- Der echte Server-Consent bleibt offen (01F/Produkt).

---

## 5. Kompatibilitätsprüfung (kein stiller Datenverlust)

Eine Bewerbung wird als **INCOMPATIBLE** markiert, wenn:

| Grund | Ursache |
|---|---|
| `location_not_single` | mehrere Standorte |
| `source_not_single` | mehrere Quellen |
| `manual_job_unsupported` | manuelle Stelle / `source:"manual"` |
| `builder_cv_unsupported` | Builder-CV-Referenz |
| `status_history_not_transferable` | mehr als der initiale Statuseintrag |
| `history_not_transferable` | Feedback/Interview/Notiz vorhanden |
| `notes_too_long` | > 10.000 Zeichen |
| `missing_original_url` | Quell-Job ohne URL |

Inkompatible Bewerbungen werden **nicht** übertragen; die lokale Bewerbung
bleibt unverändert und der Grund wird angezeigt.

---

## 6. Duplikate und Idempotenz

- Vor dem Transfer wird die Remote-Liste (max. 5 Seiten) nach derselben
  `job.jobId` durchsucht; Treffer werden als **CONFLICT** angezeigt.
- Keine automatische Zusammenführung.
- Idempotenzschlüssel: `<migrationKey>:<localId>`, stabil über Wiederholungen.
- Nach Timeout/unklarem Ausgang wird **kein** neuer Create mit neuem Schlüssel
  ausgelöst; zuerst wird per Remote-Liste abgeglichen.
- Bereits übertragene Bewerbungen werden nicht erneut erstellt.
- Eine bestätigte `applicationId` wird der lokalen ID im Migrationskontext
  zugeordnet.

---

## 7. Status und Teilübertragungen

Unterstützte Zustände: `READY`, `INCOMPATIBLE`, `CONFLICT`, `TRANSFERRED`,
`CONFIRMATION_PENDING`, `FAILED` (plus Vertragswerte).

- Jede Bewerbung erhält ein eigenes Ergebnis.
- Ein Fehler löscht keine lokale Bewerbung.
- Teilübertragungen sind sichtbar (`succeeded`/`failed`/`statuses`).
- `CONFIRMATION_PENDING` wird nie als Erfolg angezeigt.

---

## 8. Isolation

- Verifizierte Cognito-Identität; kein E-Mail-Fallback.
- Keine Browser-`ownerId` als Autorität.
- Session-Generation + `invalidate()` verwerfen verspätete Antworten.
- Logout/Benutzerwechsel → `session_ended`; keine Übernahme zwischen Benutzern.
- Migrationszustand (localId → applicationId) ist instanzgebunden und wird
  nicht über Identitätsgrenzen wiederverwendet.

---

## 9. UI

- Neuer Dialog `ApplicationMigrationDialog`:
  - Vorschau, Status, Gründe, Duplikate,
  - Auswahl kompatibler Bewerbungen,
  - Pflicht-Checkbox,
  - Ergebnisanzeige.
- Button nur sichtbar, wenn ein Migrations-Port übergeben wird.
- App übergibt den Port nur bei:
  `VITE_RIS_APPLICATION_MIGRATION_MOCK=true` **und** verifizierter Anmeldung
  mit Access-Token. Default: **false**.
- Keine produktive Aktivierung; keine Server-Consent-Erfassung.

---

## 10. Tests

| Prüfung | Ergebnis |
|---|---|
| Migrations-Contract-Tests | **16 / 16 PASS** |
| Dialog-Tests | **2 / 2 PASS** |
| Remote-Adapter (01C) | **21 / 21 PASS** |
| BFF (01B) | **14 / 14 PASS** |
| UI-Bridge (01D) | **12 / 12 PASS** |
| Gesamtsuite | **1481 passed / 5 skipped** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

Abgedeckt: keine Auto-Migration, explizite Bestätigung, Erfolg,
Reload/Remote-Reconcile, RIS-ID, Duplikat, idempotenter Retry, Timeout,
Teilübertragung, nicht unterstützte Felder, Builder-CV, History, Logout,
Benutzerwechsel, Consent-Gate, Session unverändert.

---

## 11. Offene Voraussetzungen

1. Echter serverseitiger Storage-Consent inkl. Textversion/Widerruf.
2. History-/Cover-Letter-Transfer (BFF liefert keine vollständige App).
3. `statusHistory` im RIS-Detail.
4. RIS-DEV-Partnerbindung, Credential, Tenant, Surface.
5. Datenschutz-/Rechtsfreigabe.
6. Produktentscheidung zu manuellen Stellen und Builder-CVs.

```text
JM-RIS-INTEGRATION-01E

MODE:                    LOCAL MOCK ONLY
SESSION MIGRATION:       VERIFIED
EXPLICIT CONFIRMATION:   VERIFIED
NO-LOSS GUARANTEE:       PARTIAL (inkompatible Datensätze blockiert)
IDEMPOTENCY:             PASS
DUPLICATE HANDLING:      PASS
USER ISOLATION:          PASS
STORAGE CONSENT GATE:    FAIL-CLOSED
RIS-DEV LIVE:            NOT AUTHORIZED
PRODUCTION STORAGE:      DISABLED
AWS/TERRAFORM:           UNCHANGED
COGNITO/CLOUDFRONT:      UNCHANGED
GITHUB PUSH:             NOT AUTHORIZED
```

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine echten RIS-DEV-Requests, kein Push, kein Deployment. Phase 01F
nicht begonnen.

---

## 12. Evidence

- `src/lib/applications/applicationMigration.ts`
- `src/lib/applications/applicationMigration.test.ts`
- `src/components/ApplicationMigrationDialog.tsx`
- `src/components/ApplicationMigrationDialog.test.tsx`
- `src/components/ApplicationsSection.tsx`
- `src/App.tsx`
- `src/lib/applications/repositoryTypes.ts`
- `src/lib/applications/contractTypes.ts`
- `src/i18n.tsx`
- `.env.example`

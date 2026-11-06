# JM-RIS-INTEGRATION-01D — Application Management UI ↔ RIS Remote Repository

**Art:** UI-Repository-Integration / lokaler Remote-Preview / Regression
**Datum:** 2026-11-05
**Ziel:** `ris-dev` (nicht live) · **Modus:** SESSION / REMOTE_PREVIEW (Mock)
**Status:** **UI REPOSITORY INTEGRATION: LOCAL VERIFIED · RIS-DEV LIVE BLOCKED**

---

## 1. Baseline

| Element | Stand |
|---|---|
| Jobsearch | `main` `68ae5de` + UI-Integrationsstand |
| Remote-Adapter | `src/lib/applications/risRemoteRepository.ts` (01C) |
| BFF | `api/ris/applications.mjs` (01B) |
| Session-Repository | unverändert |
| Testbasis | **1463 passed / 5 skipped** |

---

## 2. Verwendete Schnittstellen

- **UI:** `ApplicationsSection` erwartet weiterhin `ApplicationRepository`
  (`SessionApplicationV1`, `localId`).
- **Remote:** `ApplicationPersistencePort` (`ApplicationV1`, `applicationId`).
- **Brücke:** `src/lib/applications/remoteSessionRepository.ts` implementiert
  `ApplicationRepository` auf Basis des Remote-Ports.
- Keine zweite UI, keine neue Bewerbungsverwaltung, keine Änderung der
  Session-Semantik.

### Modusauswahl

| Bedingung | Modus |
|---|---|
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` ≠ `true` | **SESSION** |
| Flag `true`, aber Gast/kein Access-Token | **SESSION** |
| Flag `true` + verifizierte Anmeldung + Access-Token | **REMOTE_PREVIEW** |
| Logout/Identitätswechsel | Repository wird invalidiert und neu aufgebaut |

Remote ist **niemals** automatisch aktiv; der Server-Flag
`RIS_APPLICATION_STORAGE_ENABLED` bleibt separat und standardmäßig `false`.

---

## 3. Unterstützte Operationen

| UI-Funktion | Remote-Verhalten |
|---|---|
| Liste | Remote-Liste, Cursor bleibt erhalten |
| Detail | Remote-Get |
| Anlegen | RIS-`applicationId` wird `localId` der UI |
| Bearbeiten | `expectedVersion` wird durchgereicht |
| Status | bestätigter Stage-Vertrag |
| Export | `localDraft: false`, RIS-Application |
| Löschen | erst nach RIS-Bestätigung |
| Kennzahlen | Remote-Metrics (sofern genutzt) |

---

## 4. Bewusst nicht unterstützt

Im Remote-Modus verweigern folgende Operationen mit `not_supported`:

- `addHistory` (Feedback/Interview/Notiz)
- `addCoverLetterVersion`
- `adoptCoverLetter`

Die UI zeigt dafür einen verständlichen Hinweis
(`applications.error.not_supported`) und täuscht **keine** Speicherung vor.
Die Session-Funktionen bleiben unverändert verfügbar.

---

## 5. UI-Zustände

| Zustand | Umsetzung |
|---|---|
| `LOCAL_ONLY` | Session-Hinweis bleibt |
| `LOADING` | bestehender Ladezustand |
| `SAVING` | bestehender `busy`-Zustand |
| `SAVED` | erst nach bestätigter Repository-Antwort |
| `VERSION_CONFLICT` | 409 zeigt Konflikt **und** lädt die Liste neu |
| `UNAVAILABLE` | `unavailable`-Meldung, kein Erfolg |
| `SESSION_EXPIRED` | `session_ended`-Meldung, verspätete Antworten verworfen |
| `ERROR` | bestehende Fehleranzeige |

Zusätzlich:

- Remote-Hinweis ersetzt im Remote-Modus die Aussage „nur in dieser Sitzung“.
- Löschdialog unterscheidet „Sitzungsentwurf“ und „gespeicherte Bewerbung“.
- Kein automatischer Transfer bestehender Bewerbungen.
- Keine automatische Kontospeicherung beim Login.
- Keine aktive Speicher-Consent-Erfassung (bleibt 01E).

---

## 6. Identität und Isolation

- Access-Token wird pro Request aus der bestehenden Cognito-Session geholt.
- `ownerId` stammt aus dem verifizierten `sub`, nicht aus dem Browser-Body.
- `invalidate()` bricht laufende Requests ab.
- Die globale Session-Generation wird bei Logout/Identitätswechsel erhöht;
  alte Repositories und verspätete Antworten werden verworfen.
- Keine Vermischung von Session- und Remote-Daten: die UI erhält pro Modus
  genau ein Repository; `localId` wird nur UI-intern auf `applicationId`
  abgebildet und nie als Server-ID gesendet.

---

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| Bridge-Contract-Tests | **12 / 12 PASS** |
| UI-Remote/Session-Tests | **2 / 2 PASS** |
| Remote-Adapter (01C) | **21 / 21 PASS** |
| BFF (01B) | **14 / 14 PASS** |
| Gesamtsuite | **1463 passed / 5 skipped** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

Abgedeckt: Session-Modus, Gastverhalten, Remote-List/Detail, Create/Update,
Versionskonflikt, Delete, Metrics, Remote-Ausfall, Logout während Request,
Benutzerwechsel, deaktivierte Remote-Funktionen, keine stille
Session-/Remote-Vermischung, Remote-/Session-Hinweis.

---

## 8. Offene Voraussetzungen für 01E

1. History-/Cover-Letter-Vertrag (Response liefert keine vollständige
   `ApplicationV1`).
2. `statusHistory`/`history` im RIS-Detail.
3. Explizites „Im Konto speichern“ (Preview, Duplikaterkennung, Bestätigung,
   Idempotenz, Cleanup).
4. Speicher-Consent/Textversion serverseitig.
5. RIS-DEV-Partnerbindung, Credential, Tenant, Surface.
6. Datenschutz-/Rechtsfreigabe.

```text
JM-RIS-INTEGRATION-01D

UI REPOSITORY INTEGRATION:  LOCAL VERIFIED
SESSION MODE:               PRESERVED
REMOTE MOCK MODE:           VERIFIED
AUTH ISOLATION:             PASS
VERSION CONFLICT UI:        PASS
UNSUPPORTED OPERATIONS:     EXPLICITLY HANDLED
APPLICATION MIGRATION:      NOT STARTED
RIS-DEV LIVE:               NOT AUTHORIZED
PRODUCTION STORAGE:         DISABLED
GITHUB PUSH:                NOT AUTHORIZED
```

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine echten RIS-DEV-Anfragen, kein Push, kein Deployment. Phase 01E
nicht begonnen.

---

## 9. Evidence

- `src/lib/applications/remoteSessionRepository.ts`
- `src/lib/applications/remoteSessionRepository.test.ts`
- `src/components/ApplicationsSection.tsx`
- `src/components/ApplicationsSection.remote.test.tsx`
- `src/App.tsx`
- `src/lib/applications/repositoryTypes.ts`
- `src/lib/applications/sessionApplications.ts`
- `src/i18n.tsx`
- `docs/reports/JM-RIS-INTEGRATION-01C-REMOTE-ADAPTER.md`

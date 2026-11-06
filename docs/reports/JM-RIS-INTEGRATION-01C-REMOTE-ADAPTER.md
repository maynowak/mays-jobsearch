# JM-RIS-INTEGRATION-01C — Remote Application Repository (lokal)

**Art:** Remote-Adapter / Session-Kompatibilität / Contract-Tests
**Datum:** 2026-11-05
**Ziel:** `ris-dev` (nur vorbereitet) · **Test:** lokaler Mock-BFF
**Status:** **REMOTE ADAPTER LOCAL VERIFIED · RIS-DEV LIVE BLOCKED**

---

## 1. Baseline

| Element | Stand |
|---|---|
| Jobsearch | `main` `67af66a` + Adapter-Arbeitsstand |
| BFF | `api/ris/applications.mjs` + `api/_lib/ris/*` (01B) |
| Session-Repository | unverändert |
| Testbasis | 1449 passed / 5 skipped |
| RIS-DEV | unverändert, `PARTNER_SURFACE_ENABLED=false` |

---

## 2. Verwendetes Repository-Interface

- `ApplicationPersistencePort` und `ApplicationV1` aus
  `src/lib/applications/repositoryTypes.ts` / `contractTypes.ts`.
- Keine Neudefinition von `ApplicationV1`.
- `ApplicationListOptions` wurde **additiv** um optionales `status` erweitert
  (der BFF unterstützt Statusfilter; keine Breaking Change).
- Das bestehende `SessionApplicationRepository` bleibt unverändert und ist
  weiterhin der Standard.

---

## 3. Implementierte Methoden

| Methode | Status | BFF-Route |
|---|---|---|
| `list` | implementiert | `GET /api/ris/applications` |
| `get` | implementiert | `GET ?id=` |
| `create` | implementiert | `POST` + `Idempotency-Key` |
| `update` | implementiert | `PATCH ?id=` + `expectedVersion` |
| `transitionStatus` | implementiert | `POST ?id=&action=status` |
| `export` | implementiert | `GET ?id=&action=export` |
| `delete` | implementiert | `DELETE ?id=` + `expectedVersion` |
| `metrics` | implementiert (konkret, nicht Teil des Ports) | `GET ?action=metrics` |

**Nicht implementiert (bewusst):**

- `addFeedback`, `addInterview`, `addNote`, `addCoverLetterVersion`.
  Der BFF liefert `{history}` bzw. `{version}`, aber **nicht** die vollständige
  `ApplicationV1`. Ein erfundenes vollständiges Objekt wäre falsch. Diese
  Methoden verweigern mit `unavailable` bis zur Vertragsklärung (01D).

---

## 4. Mapping und Vertragslücken

Der Adapter delegiert das RIS-Mapping an den BFF (01B). Er validiert die
Antwortform (`schemaVersion`, `applicationId`, `ownerId`, `job`, `status`,
`version`) und ergänzt fehlende Timeline-Arrays nur als **leere Arrays**, wenn
RIS sie nicht liefert.

| Thema | Verhalten |
|---|---|
| `location[]` / `source[]` | BFF lehnt 0 oder >1 Wert mit **422** ab; Adapter mappt auf `validation_error` |
| Builder-CV | BFF lehnt mit **422** ab; Adapter mappt auf `validation_error` |
| `profileRef` | wird nicht gesendet; kein stilles Entfernen im Adapter |
| `notes` | Adapter prüft **10.000 Zeichen** vor dem Request |
| `expectedVersion` | Adapter prüft Integer ≥ 1 vor dem Request |
| Gehalt | unverändert durchgereicht; keine Rundung im Adapter |
| Delete | BFF bestätigt `{deleted:true}`; Adapter erzeugt lokales Receipt mit `deletedAt` |
| History/StatusHistory | RIS-Detail liefert sie nicht; Adapter behauptet keine Vollständigkeit |
| Export | Adapter liefert `ApplicationExportV1` (`schemaVersion`, `exportedAt`, `application`) |

---

## 5. Identität und Datentrennung

- Access-Token wird **pro Request** über `getAccessToken()` geholt; nie gespeichert.
- `ownerId` kommt aus `getOwnerId()` (verifizierte Session), nicht aus dem Body.
- `invalidate()` bricht laufende Requests ab und markiert die Instanz ungültig.
- Zusätzlich prüft jede Operation die globale
  `currentApplicationSessionGeneration()`; nach `beginNewApplicationSession()`
  (Logout/Identitätswechsel) schlägt sie mit `session_ended` fehl.
- Verspätete Antworten werden nach dem `await` erneut geprüft und verworfen.
- Keine Benutzer-/Tenant-Werte aus dem Browser; das Partner-Credential bleibt
  ausschließlich im BFF.

---

## 6. Version, Konflikt, Idempotenz

- `applicationId` wird ausschließlich vom Server übernommen.
- `localId` wird nie als RIS-ID verwendet.
- `expectedVersion` wird bei Update/Delete/Status mitgesendet.
- HTTP 409 `version_conflict` → `version_conflict`; keine automatische
  Überschreibung, kein Re-Read mit Auto-Merge.
- `Idempotency-Key` bleibt für Wiederholungen stabil, wenn der Aufrufer ihn
  übergibt; ohne Key wird ein neuer erzeugt.
- **Kein automatischer Retry** nach Timeout/Netzwerkfehler; ein zweiter Create
  erfolgt nur durch einen neuen Aufruf mit demselben Key.

---

## 7. Fehlerabbildung

| BFF | Adapter-Code |
|---|---|
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 `version_conflict` | `version_conflict` |
| 409 `idempotency_conflict` | `idempotency_conflict` |
| 409 sonst | `conflict` |
| 400/422 | `validation_error` |
| 429/502/503/Netzwerk | `unavailable` |
| Logout/Identitätswechsel | `session_ended` |
| Caller-Abbruch | `aborted` |

Fehlgeschlagene Speicherung wird nie als Erfolg zurückgegeben.

---

## 8. Feature-Flag

- Fabrik: `createRisApplicationRepository({ enabled, ... })`.
- `enabled=false` → jede Operation `unavailable`; kein Netzwerkzugriff.
- UI-Flag: `VITE_RIS_APPLICATION_STORAGE_ENABLED` (Default **false**).
- Kein automatischer Remote-Zugriff beim Login, kein stilles Umschalten des
  Session-Repositories, kein automatischer Transfer.
- UI-Anbindung erfolgt erst in 01D.

---

## 9. Tests

| Prüfung | Ergebnis |
|---|---|
| Adapter-Contract-Tests | **21 / 21 PASS** |
| BFF-Tests | **14 / 14 PASS** |
| Gesamtsuite | **1449 passed / 5 skipped** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

Abgedeckt: Create mit Server-ID, List/Detail, Update mit Version,
Versionskonflikt, Export, Delete, Metrics, Pagination/Cursor,
nicht unterstützte Felder, Builder-CV, fehlende Profilreferenz, fehlender/
ungültiger Token, Logout während Request, Benutzerwechsel, RIS-Ausfall,
idempotente Create-Wiederholung, keine Secrets in Antworten, Default-off.

**Hinweis:** Ein früherer Volllauf zeigte 1 nicht reproduzierbaren Fehler
(bekannte Flake-Klasse); der unmittelbare Folgelauf war grün. Keine Tests
deaktiviert, keine Timeouts erhöht.

---

## 10. Session-Kompatibilität

- `src/lib/applications/sessionRepository.ts` wurde **nicht** verändert.
- Die bestehende Session-Verwaltung bleibt Standard und vollständig getestet.
- Der Remote-Adapter ist eine zusätzliche Implementierung desselben Ports und
  wird nicht automatisch instanziiert.

---

## 11. Noch blockiert

1. `addFeedback`/`addInterview`/`addNote`/`addCoverLetterVersion` — BFF liefert
   keine vollständige `ApplicationV1`; Vertragsklärung nötig.
2. `statusHistory`/`history` im Detail — RIS liefert sie nicht.
3. `ris-dev` Live-Betrieb — Partnerregistrierung, Credential, Tenant, Surface.
4. Metrics live — nur gegen Mock getestet.
5. Datenschutz-/Rechtsfreigabe für dauerhafte Speicherung.

```text
JM-RIS-INTEGRATION-01C

REMOTE ADAPTER:          LOCAL VERIFIED
APPLICATIONV1 CONTRACT:  PARTIAL
AUTH SESSION ISOLATION:  PASS
VERSION CONFLICT:        PASS
IDEMPOTENCY:             PASS
SESSION REPOSITORY:      PRESERVED
RIS-DEV LIVE:            NOT AUTHORIZED
PRODUCTION STORAGE:      DISABLED
AWS/TERRAFORM:           UNCHANGED
COGNITO/CLOUDFRONT:      UNCHANGED
GITHUB PUSH:             NOT AUTHORIZED
```

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine realen RIS-DEV-Requests, kein Push, kein Deployment. Phase 01D
nicht begonnen.

---

## 12. Evidence

- `src/lib/applications/risRemoteRepository.ts`
- `src/lib/applications/risRemoteRepository.test.ts`
- `src/lib/applications/repositoryTypes.ts`
- `api/ris/applications.mjs`
- `api/_lib/ris/client.mjs`
- `tests/api/ris-applications.test.mjs`
- `docs/reports/JM-RIS-INTEGRATION-01A-CONTRACT.md`
- `docs/reports/JM-RIS-INTEGRATION-01B-TESTUSER-AND-BFF.md`

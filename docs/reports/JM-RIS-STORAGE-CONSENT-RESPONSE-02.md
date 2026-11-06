# JM-RIS-STORAGE-CONSENT-RESPONSE-02

- Datum: 2026-11-06
- Status: **WAITING_FOR_PROVIDER_RESPONSE**
- Auftragstyp: External API Contract Verification
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `main`
- Keine RIS-Implementierung, keine RIS-Interna, keine produktive Speicherung

## 1. Git-Baseline

| Item | Wert |
|---|---|
| HEAD | `4b07466` |
| `origin/main` | `7a3d2ea` |
| Divergenz | **3 ahead / 0 behind** |
| Erwarteter Stand | `4b07466` — **VERIFIED** |
| Untracked | 4 bekannte Dokumente unverändert |

Bewertung: Der erwartete lokale Stand ist vorhanden. Die drei lokalen Commits (`53cbcd4`, `dcbc973`, `4b07466`) sind nicht gepusht.

## 2. Status der offiziellen RIS-Antwort

**RIS PROVIDER RESPONSE: NOT RECEIVED**

Im Repository liegt keine Antwort vor, die eindeutig zuordenbar ist zu:

- RIS-Anbieter,
- API-Version,
- Zielumgebung,
- veröffentlichter Vertragsversion,
- unterstützten Operationen,
- Authentifizierungsanforderungen,
- Berechtigungen,
- Fehler- und Antwortschemata.

`docs/contracts/JM-RIS-STORAGE-CONSENT-CONTRACT-01.md` ist die **ausgehende Anfrage**, keine Antwort. Es wurde kein externer Partnerkanal kontaktiert und keine RIS-Implementierung untersucht.

**Status: `WAITING_FOR_PROVIDER_RESPONSE`.**

## 3. Support-Matrix

Ohne externe Vertragsevidenz ist keine Funktion `SUPPORTED`. Alle Werte bleiben `UNKNOWN`.

| Funktion | RIS-Status | API-Nachweis | Jobsearch-Stand |
|---|---|---|---|
| Einwilligung abrufen | **UNKNOWN** | Offen | Vorbereitet |
| Einwilligung erteilen | **UNKNOWN** | Offen | Vorbereitet |
| Einwilligung aktualisieren | **UNKNOWN** | Offen | Vorbereitet |
| Einwilligung widerrufen | **UNKNOWN** | Offen | Vorbereitet |
| Einwilligung versionieren | **UNKNOWN** | Offen | Datenmodell vorhanden |
| Auditnachweis | **UNKNOWN** | Offen | Datenmodell vorhanden |
| Datenexport | **UNKNOWN** | Offen | Teilweise vorhanden (ApplicationV1-Export, kein Consent-Export) |
| Löschanforderung | **UNKNOWN** | Offen | Vorbereitet (ApplicationV1-DELETE) |
| Löschbestätigung | **UNKNOWN** | Offen | Nicht verifiziert |
| Aufbewahrungsregeln | **UNKNOWN** | Offen | Freigabe erforderlich |

Zulässige Statuswerte: `SUPPORTED`, `PARTIAL`, `NOT_SUPPORTED`, `UNKNOWN`. Eine Funktion wird nur mit ausreichender externer Vertragsevidenz als `SUPPORTED` bewertet.

## 4. Verfügbare API-Endpunkte und Schemas

### 4.1 Consent

**Keine** veröffentlichten oder verifizierten Consent-Endpunkte. Es gibt keinen Nachweis für:

- `GET` Consent-Status,
- `PUT`/`POST` Consent-Erteilung,
- `POST` Widerruf,
- Consent-Audit,
- Consent-Export,
- serverseitige Persistierungsbestätigung.

### 4.2 ApplicationV1 — lokal vorhanden, extern nicht verifiziert

Die Jobsearch-BFF-Routen unter `/api/ris/applications` sind lokal implementiert:

| Methode | Route | Lokale Semantik |
|---|---|---|
| `GET` | `/api/ris/applications` | Liste |
| `GET` | `/api/ris/applications?id=...` | Detail |
| `GET` | `/api/ris/applications?id=...&action=export` | Export |
| `GET` | `/api/ris/applications?action=metrics` | Metriken |
| `POST` | `/api/ris/applications` | Create |
| `POST` | `/api/ris/applications?id=...&action=status` | Statuswechsel |
| `POST` | `/api/ris/applications?id=...&action=history` | Verlauf |
| `POST` | `/api/ris/applications?id=...&action=cover-letter` | Anschreibenversion |
| `PATCH` | `/api/ris/applications?id=...` | Update |
| `DELETE` | `/api/ris/applications?id=...` | Löschung |

Diese Routen sind **Jobsearch-BFF**, nicht der veröffentlichte RIS-Partnervertrag. Der Upstream-Pfad ist im Code als `/v1/partner/me/applications` konfiguriert; seine offizielle Bestätigung, Version und Zielumgebung fehlen.

### 4.3 Evidenzklassifikation

| Aussage | Klasse |
|---|---|
| Consent-Handoff und Anfrage sind dokumentiert | `DOCUMENTED` |
| Lokale BFF-/Adapter-/Consent-Modelle und Tests existieren | `VERIFIED` |
| Server-seitiger Consent-Gate für ApplicationV1-Writes | `PROPOSED` |
| Offizielle RIS-Consent-Endpunkte/Schemas | `BLOCKED` |
| Bestehende Nutzer-Einwilligung abrufbar | `BLOCKED` |
| Produktive Speicherung | `BLOCKED` |

## 5. Dokumentationslücken

Offen und für eine Aktivierung erforderlich:

1. Offizielle RIS-Partner-API-Basisadresse (HTTPS).
2. Akzeptierter Cognito-Issuer und Client.
3. Partner-Credential-Authentifizierung und Berechtigung des bestehenden Partners `mays-jobsearch`.
4. API-Version, Zielumgebung und veröffentlichte Vertragsversion.
5. Consent-Read-Endpoint inklusive Schema und Fehlercodes.
6. Consent-Write-Endpoint inklusive Idempotency und Persistierungsbestätigung.
7. Consent-Withdraw-Endpoint.
8. Versionierung von Consent-Text und Privacy Notice.
9. Serverseitiger Entscheidungs-/Widerrufszeitstempel.
10. Auditnachweis und Append-only-Semantik.
11. Export-, Lösch- und Löschbestätigungsoperationen.
12. Aufbewahrungs- und Erasure-Regeln.
13. Tenant-/Ownership-Kontext, falls RIS ihn benötigt.
14. Fehler- und Antwortschemata für alle Operationen.

## 6. Vorhandene Jobsearch-Komponenten

| Komponente | Befund | Evidenz |
|---|---|---|
| `src/lib/storageConsent.ts` | Versioniertes Datenmodell; Zwecke `cv_storage`, `application_storage`, `search_profile_storage`; Status `not_requested`, `granted`, `declined`, `withdrawn`, `reconsent_required`; Owner nur aus `iss + sub`; Audit-Event-Modell; `STORAGE_CONSENT_BACKEND_AVAILABLE = false` | `VERIFIED` |
| `src/components/StorageConsentSection.tsx` | Vorbereitungs-UI; keine Checkbox, keine aktive Erteilung; Aktionen deaktiviert; Zwecke getrennt; KI-Consent separat | `VERIFIED` |
| `src/lib/applications/applicationMigration.ts` | Explizite Bestätigung; `consentSource: "simulated" | "server"`; `server` schlägt fail-closed fehl; produktiver Server-Consent fehlt | `VERIFIED` |
| `src/App.tsx` | Remote-Modus nur bei `VITE_RIS_APPLICATION_STORAGE_ENABLED` + Auth; Migration-Mock mit `storageConsent: async () => true` und `consentSource: "simulated"` | `VERIFIED` — **kein produktiver Nachweis** |
| `src/lib/applications/risRemoteRepository.ts` | Remote-Adapter für Liste, Detail, Create, Update, Status, Export, Delete; History-/Cover-Letter-Methoden teils `not_supported`; **kein Consent-Check** | `VERIFIED` |
| `src/lib/applications/remoteSessionRepository.ts` | Brücke UI → Remote-Port; Create/Update/Status/Export/Delete; **kein Consent-Check** | `VERIFIED` |
| `api/ris/applications.mjs` | BFF mit JWT-Verifikation, Issuer/Client-Prüfung, Allowlist, Upstream-Aufrufen; **kein Consent-Check für Writes** | `VERIFIED` |
| `api/_lib/ris/config.mjs` | Flags default OFF; Credential-Aliase; keine Consent-Konfiguration | `VERIFIED` |
| `api/_lib/ris/client.mjs` | Ein Request pro Aufruf; `X-Api-Credential`; Mutations werden nicht automatisch retried | `VERIFIED` |

**Kritischer Befund:** Das bestehende Migrations-Consent-Gate ist simuliert und schützt nur den Migrations-Commit. Die normalen ApplicationV1-Schreibpfade (Create, Update, Status, History, Cover-Letter) sind im BFF **nicht** durch einen serverseitigen Consent-Gate geschützt. Das ist vor einer produktiven Freischaltung unzureichend.

## 7. Erforderliche minimale Integrationsänderungen

Keine Umsetzung in diesem Auftrag; nur Plan. Voraussetzung ist eine offizielle RIS-Antwort.

1. **Bestehende BFF-Architektur erweitern, keine zweite Consent-Architektur.**
   - Consent-Operationen im vorhandenen `api/ris/`-Bereich ergänzen.
   - Wegen des Hobby-Limits von 12 Functions keine neue Function ohne vorherige Konsolidierung; vorhandene `api/ris/applications.mjs` erweitern oder Function-Zahl separat reduzieren.

2. **Server-seitigen Consent-Client ergänzen.**
   - Read, Write und Withdraw gegen die offiziell bestätigten RIS-Endpunkte.
   - Authentifizierung mit dem bestehenden verifizierten JWT und dem serverseitigen Partner-Credential.
   - Keine Client-Owner-ID, keine E-Mail, keine clientseitigen Zeitstempel.

3. **Zentralen Gate `assertApplicationStorageConsent` implementieren.**
   - Vor jedem neuen dauerhaften Write: `POST` Create, `PATCH` Update, `POST` Status, `POST` History, `POST` Cover-Letter, Migrations-Create.
   - Nur `purpose = application_storage` und `status = granted` zulassen.
   - Consent-Text- und Privacy-Notice-Version müssen mit den freigegebenen Versionen übereinstimmen.
   - `not_requested`, `declined`, `withdrawn`, `reconsent_required`, fehlende oder nicht prüfbare Antwort → keine Speicherung, kein Upstream-Write.
   - Fehlerantwort z. B. `403 storage_consent_required` oder `503 consent_unavailable`.

4. **Bestehende gültige Einwilligung respektieren.**
   - Vor dem Write den aktuellen Status lesen.
   - Bei gültiger, aktueller Einwilligung keine erneute Anforderung.
   - Bei Versionswechsel `reconsent_required` auslösen.

5. **Export, Widerruf und Löschung weiterhin ermöglichen.**
   - Export und Delete dürfen nicht durch einen fehlenden Consent blockiert werden, wenn sie zur Datensubjekt-Rechtsausübung erforderlich sind.
   - Widerruf stoppt neue optionale Verarbeitung; Löschung bleibt ein separater, bestätigter Vorgang.

6. **UI unverändert weiterverwenden.**
   - `StorageConsentSection.tsx` bleibt die einzige Oberfläche.
   - Keine neue Consent-UI, keine pauschale Zustimmung.
   - Die drei Zwecke bleiben getrennt; KI-Consent bleibt separat.
   - Buttons bleiben deaktiviert, bis der Server-Consent bestätigt ist.

7. **Migration-Mock klar trennen.**
   - `consentSource: "simulated"` bleibt ausschließlich Test/Mock.
   - Produktion verwendet `consentSource: "server"` mit echtem BFF-Consent.
   - Eine simulierte Einwilligung darf niemals als produktiver Nachweis dienen.

8. **Tests.**
   - Consent-Read/Write/Withdraw mit Mock-RIS.
   - Fail-closed bei fehlendem, widerrufenem, abgelehntem, veraltetem oder nicht verfügbarem Consent.
   - Kein Upstream-Write bei fehlendem Consent.
   - Read/Export/Delete bleiben möglich.
   - Identität ausschließlich aus verifiziertem `iss + sub`.
   - Zweck-Isolation und Versionskonflikte.
   - Function-Zahl bleibt bei 12.

9. **Flags und Env.**
   - Remote-Flags bleiben OFF.
   - Keine Vercel-Env-Änderung in diesem Auftrag.
   - `RIS_API_BASE_URL`, Issuer, Client, Allowlist und Credential-Berechtigung sind vor Aktivierung zu bestätigen.

## 8. Datenschutz- und Consent-Blocker

| Blocker | Status |
|---|---|
| Offizielle RIS-Antwort | **BLOCKED** |
| Consent-Read-Endpoint | **BLOCKED** |
| Consent-Write inkl. Persistierungsbestätigung | **BLOCKED** |
| Consent-Withdraw | **BLOCKED** |
| Consent-Audit | **BLOCKED** |
| Export/Löschung/Retention | **BLOCKED** |
| Bestehende Nutzer-Einwilligung abrufbar | **BLOCKED** |
| Server-seitiger Gate für alle ApplicationV1-Writes | **PROPOSED / nicht implementiert** |
| Migrations-Consent | **simuliert, nicht produktiv** |
| Preview-Secret-Isolation | **BLOCKED** (separater Blocker) |
| Testbenutzer/Allowlist | **BLOCKED** (separater Blocker) |
| Produktive Speicherung | **DISABLED** |

Zusätzlich gilt: Eine fehlgeschlagene oder nicht verfügbare Consent-Prüfung darf keine dauerhafte Speicherung auslösen. Ein fehlender Datensatz ist keine Einwilligung. KI-Consent ist keine Storage-Consent.

## 9. Abnahmekriterien

Eine Aktivierung ist erst möglich, wenn alle Punkte erfüllt sind:

1. Offizielle, zuordenbare RIS-Antwort mit API-Version, Zielumgebung und Vertragsversion.
2. Veröffentlichter Consent-Read-Endpoint; Jobsearch kann bestehende Einwilligungen abrufen.
3. Veröffentlichter Consent-Write-Endpoint mit serverseitiger Persistierungsbestätigung.
4. Veröffentlichter Withdraw-Endpoint.
5. Versionierung von Consent-Text und Privacy Notice; `reconsent_required` ist abbildbar.
6. Auditnachweis mit serverseitigem Zeitstempel.
7. Export-, Lösch- und Löschbestätigungsoperationen.
8. Aufbewahrungsregeln und Erasure-Verfahren freigegeben.
9. Server-seitiger Gate vor allen neuen dauerhaften Writes; fail-closed.
10. Bestehende gültige Einwilligung wird nicht unnötig erneut abgefragt.
11. Tests für alle Gate-/Fehlerpfade bestehen.
12. Remote-Flags bleiben bis zur separaten E2E-Freigabe OFF.
13. Keine echten Bewerberdaten und keine Live-Writes im Test.

## 10. Empfehlung für die nächste Phase

**Nächste Aktion: `WAITING_FOR_PROVIDER_RESPONSE`.**

1. Die Anfrage `JM-RIS-STORAGE-CONSENT-CONTRACT-01` über den freigegebenen Partnerkanal erneut zur Beantwortung bereitstellen.
2. Um Antwort im Format aus Abschnitt 4 der Anfrage bitten (Funktion, Status, Endpoint, Contract-Referenz, Schema, Einschränkungen).
3. Keine Consent-Endpunkte erfinden und keine RIS-Implementierung untersuchen.
4. Produktive Speicherung und Remote-Flags bleiben deaktiviert.
5. Nach Eingang der Antwort: Support-Matrix aktualisieren, offizielle Schemas in den Handoff übernehmen und einen separaten Implementierungsauftrag für den serverseitigen Consent-Gate freigeben.
6. Die Preview-Secret-Isolation und Testbenutzer-/Allowlist-Blocker bleiben eigenständige Voraussetzungen für einen späteren E2E.

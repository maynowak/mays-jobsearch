# JM-APPLICATION-MANAGEMENT-01

**Art:** Bewerbungsverwaltung / Datenmodell / RIS-Integrationsvertrag V1
**Status:** SPECIFIED / VERIFIED (Contract, Domainregeln, Fixtures) — keine UI, keine Persistenz, kein RIS/AWS/Cognito
**Datum:** 2026-11-02
**Baseline:** `main` @ `fb155cc`, `origin/main` synchron
**Handoff:** APP-02

## 1. Bestandsaufnahme

Analysiert wurden:

- `LetterModal`, Anschreiben-Generierung/-Revision und die bestehenden Draft-/Versionszustände
- CV-Verwaltung (`CvDocument`, `cvProfileStore`, `CvDocumentList`)
- Suchprofile und Session-Adapter (`src/lib/profiles/*`)
- Authentifizierungsgrenze (`deriveAuthProfileKey`, `iss + sub`)
- bestehende RIS-/Profilverträge unter `docs/contracts/`
- vorhandene TypeScript-Modelle und JSON-Schemas

**Nicht verändert:** Anschreiben-, BA-, ATS- und Suchfunktionen. Keine UI und
keine produktive Speicherung.

## 2. Datenmodell V1

Der vollständige Vertrag liegt in:

- `docs/contracts/JOBMATCHER-APPLICATION-MANAGEMENT-V1.md`
- `src/lib/applications/contractTypes.ts`
- `src/lib/applications/applicationValidation.ts`
- `src/lib/applications/applicationDomain.ts`

### ApplicationV1

Enthält:

- `schemaVersion: 1`
- server-generierte `applicationId`
- server-abgeleitete `ownerId` (verifizierte Identität, nicht E-Mail)
- `job` mit stabiler `jobId`, Titel, Arbeitgeber, Ort, Quelle und Original-URL
- `documents` mit Anschreiben-Entwurf, Versionen, optionaler CV-Referenz und Dokumentenstatus
- Erstellungs-/Änderungszeitpunkt, optionales Bewerbungsdatum und Bewerbungsweg
- Ansprechpartner/Kontaktinformationen
- persönliche Notizen
- Gehaltsvorstellung und optionales Angebot (Betrag, Währung, Zeitraum)
- Status, StatusHistory und History
- `version` für optimistische Konkurrenzkontrolle

### Dokumente und Versionen

- Anschreiben-Versionen sind über `jobId` eindeutig an die Bewerbung und die
  zugehörige Stelle gebunden.
- Die CV-Referenz enthält nur `cvId`/optionale `documentId` und Label; keine
  PDF-Datei, keinen Hash und keine Kopie.
- `coverLetterDraft` ist der aktuelle Entwurf; Versionen werden nicht
  automatisch erzeugt.

## 3. Statusmodell

```text
draft -> submitted
submitted -> feedback | interview | rejected | withdrawn
feedback -> interview | offer | rejected | withdrawn
interview -> offer | rejected | withdrawn
offer -> withdrawn
rejected / withdrawn -> terminal
```

Fachliche Regeln:

- Eine Bewerbung startet immer als `draft`.
- `draft -> submitted` ist nur mit `confirmed: true` über eine ausdrückliche
  Aktion möglich.
- Generieren/Verbessern eines Anschreibens markiert keine Bewerbung als
  versendet.
- StatusHistory beginnt mit `from: null -> draft` und enthält jeden Wechsel.
- Feedback, Interviewtermine und Notizen liegen im `history`-Verlauf.

## 4. API-fähiger Vertrag

Vorgesehene, **nicht implementierte** Endpunkte:

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/api/applications` | Draft anlegen |
| `GET` | `/api/applications` | eigene Bewerbungen lesen |
| `GET` | `/api/applications/{id}` | eine eigene Bewerbung lesen |
| `PATCH` | `/api/applications/{id}` | Draft aktualisieren |
| `POST` | `/api/applications/{id}/status` | ausdrücklicher Statuswechsel |
| `POST` | `/api/applications/{id}/history` | Feedback/Interview/Notiz |
| `POST` | `/api/applications/{id}/cover-letter-versions` | Version anhängen |
| `GET` | `/api/applications/{id}/export` | Export |
| `DELETE` | `/api/applications/{id}` | Löschung |

`expectedVersion` ist Pflicht bei Mutationen; ein Konflikt liefert
`version_conflict` (API: `409`). `applicationId`, `ownerId`, Zeitstempel,
`status` und `version` sind server-owned und nicht im Create-Input erlaubt.

## 5. Session, Identität und RIS

- APP-01 hat **keine** Persistenz und **keine** Session-Repository-Implementierung.
- Eine Browser-Sitzung und ein späteres Benutzerkonto bleiben getrennt.
- `ownerId` muss später aus dem bereits vorgesehenen verifizierten
  Authentifizierungsvertrag (`iss + sub`) abgeleitet werden.
- E-Mail-Adressen, Nicknames oder ungeprüfte Browserangaben sind keine
  Eigentümeridentität.
- Keine automatische Übernahme fremder Sitzungsdaten.
- Keine neue RIS-Schnittstelle wird vorausgesetzt. Die RIS-Anbindung bleibt ein
  separater, zu verifizierender Backend-Vertrag.
- Keine CV-Dateien werden in Bewerbungseinträge kopiert.

## 6. Datenschutz

- Keine automatische Kontospeicherung.
- Keine Speicherung allein durch KI-Generierung.
- Keine neue Backend-Persistenz in APP-01.
- Keine Bewerbungsinhalte in technischen Logs.
- Explizite Export- und Löschverträge.
- Lösch-/Aufbewahrungsfristen und die spätere Kontoeinwilligung bleiben offen.
- Die bestehenden Datenschutzgrenzen und BA-/Apify-/ATS-Flows bleiben unverändert.

## 7. Tests und Fixtures

### Domain-Tests

`src/lib/applications/applicationDomain.test.ts` — **12 passed**

Abgedeckt:

- neuer Draft
- ausdrückliche Submit-Bestätigung
- Statuswechsel feedback → interview → offer
- rejected/withdrawn
- Feedback-, Interview- und Notizverlauf
- Anschreiben-Versionen und Job-Bindung
- CV-Referenz und Gehaltsangaben
- ungültige Daten
- Versionskonflikt
- fremde Eigentümeridentität
- Export und Lösch-Quittung
- keine automatische Statusänderung durch Dokumente/History

### Fixtures und JSON Schema

- Schema: `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`
- Fixtures: `docs/contracts/fixtures/application-v1/` — 14 Dateien
- Python-`jsonschema`-Prüfung mit Draft 2020-12 und `FormatChecker`:
  - 13 gültige Ressourcen-/Input-/Export-/Receipt-Fixtures: PASS
  - `application.invalid-unknown-field.json`: korrekt abgelehnt

### Gesamtsuite

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run` | **1155 passed, 5 skipped** (107 Dateien) |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |

## 8. Offene Entscheidungen / APP-02

1. RIS-Ownership, Tenant-Mapping und Route (`iss + sub`) verifizieren.
2. API-Auth/Session-Verfahren festlegen; keine neue Client-Identität.
3. Löschsemantik: Hard Delete vs. Tombstone, Retention und Audit.
4. Exportformat, Download-Autorisierung und Aufbewahrung.
5. Ob jede Anschreiben-Generierung automatisch eine Version erzeugt oder nur
   eine ausdrückliche Benutzeraktion.
6. Kapazität/Pagination pro Benutzer.
7. Umgang mit verschwundenen Quellen/Jobs.
8. Backend-Idempotenz, Conditional Writes, Migration und Ownership-Tests.
9. Rechtliche/Privacy-Freigabe für kontobasierte Bewerbungsdaten.

## 9. Grenzen

- Keine vollständige Bewerbungsoberfläche.
- Keine neue Datenbank.
- Keine RIS-/AWS-/Cognito-Änderung.
- Kein Deployment.
- Keine echten BA-/Apify-/Provider-Aufrufe.

## 10. Git

- Implementierung/Dokumentation: Commit nach diesem Bericht.
- Kein Deployment.

# JM-APPLICATION-LETTER-REVISION-01 — Consolidated Readiness

**Status:** 01A–01E lokal konsolidiert und verifiziert; NICHT gemerged, NICHT gepusht, NICHT deployed
**Basis:** 01D `01836f7`; 01E-Korrekturen `1463525`; lokaler `main` `4364eab`
**Branch:** `feature/jm-application-letter-revision-01e`

## 1. Umfang

| Schritt | Inhalt | Status | Commits |
|---|---|---|---|
| 01A | Versionsauswahl und vollständiger Vergleich | VERIFIED LOCAL | `4d9e8e7`, `54f7fc2`, `0fa6941` |
| 01B | Consent-gesteuerte KI-Verbesserung als temporäre Vorschau | VERIFIED LOCAL | `b394e37`, `579b5b9`, `e0f513e` |
| 01C | Wort-Diff und manuelle Vorschlagsbearbeitung | VERIFIED LOCAL | `efc4634`, `e29a7c9` |
| 01D | Speicherung als neue Version und kontrollierte Entwurfsübernahme | VERIFIED LOCAL | `a0d106f`, `01836f7` |
| 01E | Konsolidierung, Regression, Datenschutz, Release Readiness | VERIFIED LOCAL | `1463525`, dieser Commit |

## 2. Architektur

```text
ApplicationsSection (Dokumente-Tab)
  └─ ApplicationLetterComparison
       ├─ Vergleich: current draft | CoverLetterVersionV1[]
       ├─ KI-Verbesserung: POST /api/cover-letter, operation=revise
       ├─ Diff: src/lib/textDiff.ts
       ├─ Speicherung: ApplicationRepository.addCoverLetterVersion
       └─ Übernahme: ApplicationRepository.update
```

- Eine bestehende Repository-/Session-Grenze; keine zweite Datenhaltung.
- Keine neue API, kein neuer Provider, keine neue Browser-Persistenz.
- KI-Vorschlag und Bearbeitung bleiben React-State, bis der Nutzer ausdrücklich
  speichert.
- Save/Adopt laufen über `expectedVersion`, `AbortSignal`, Session-Generation,
  Parent-Operationsschutz und Doppelaktionsschutz.

## 3. Datenmodelle

- `CoverLetterVersionV1`: `versionId`, `jobId`, `createdAt`, `content`,
  `source`, optional `language`/`model`.
- `ApplicationDocumentsV1`: Draft, Versionen, optionale CV-Referenz,
  `documentStatus`.
- `ApplicationV1`/`SessionApplicationV1`: unveränderliche Historie,
  Anschreibenversionen, Status/History, `version`.
- Keine Schemaerweiterung und keine neuen Enum-Werte in 01A–01E.
- `source` bleibt `generated | revised | manual`; KI plus manuelle
  Nachbearbeitung wird als `revised` gespeichert.

## 4. KI-Vertrag und Provider

- Wiederverwendet wird ausschließlich `POST /api/cover-letter` mit
  `operation: "revise"`.
- Gesendet werden Stellenreferenz, leerer manueller Kandidatenkontext,
  anonymisierte Ausgangsfassung, anonymisierter Verbesserungswunsch, Sprache,
  Stil, Länge und Modell.
- Nicht gesendet werden Kontaktdaten, Notizen, Gehalt, CV-Datei/CV-Text,
  `cvReference` oder erfundene Kandidatenangaben.
- Der vorhandene Provider-/Modell-Fallback bleibt aktiv.
- Der Transparenztext nennt nun auch mögliche konfigurierte
  Fallback-Anbieter und stellt klar, dass der Vorschlag nicht automatisch
  gespeichert wird.
- Es wurden keine echten Provider-Anfragen ausgeführt; alle Tests mocken die
  API.

## 5. Datenschutz

- Consent ist standardmäßig deaktiviert; ohne Consent kein Request.
- Consent wird bei Quellen-/Modellwechsel zurückgesetzt.
- `anonymizeText()` maskiert E-Mail, Telefon, Adresse, URLs, Datumsangaben,
  bekannte Namen und seit 01E auch typische Signaturnamen.
- `draft_anonymized:true` wird erst nach der lokalen Transformation gesetzt.
- Keine neue Persistenz in localStorage/sessionStorage/IndexedDB.
- Keine RIS-/AWS-/Cognito-Integration.
- Keine Anschreibeninhalte in Browser-/Anwendungslogs.
- Offen: Server prüft nur das Client-Flag, keine serverseitige PII-Redaktion;
  der Cover-Letter-Endpunkt ist unauthentifiziert und ohne eigenes
  Missbrauchsquota; Provider-Fehlerlogs können Fragmente enthalten.

## 6. Versionierung und Idempotenz

- Historische Versionen werden ausschließlich angehängt, nie ersetzt.
- Alte IDs, Inhalte und Zeitstempel bleiben unverändert.
- Speicherung erzeugt eine neue Version erst nach ausdrücklicher Aktion.
- Entwurfsübernahme ersetzt nur `coverLetterDraft` und `documentStatus`;
  Bewerbungsstatus und History bleiben unverändert.
- `expectedVersion` verhindert stille Parallelschreibungen.
- Doppelklicks werden durch Refs und deaktivierte Buttons geblockt.
- **Keine Exactly-once-Garantie:** Eine verlorene Erfolgsantwort kann bei einem
  Retry eine neue Version erzeugen; die alte `expectedVersion` führt dann
  sichtbar zu einem Konflikt. Es wird keine stärkere Garantie behauptet.

## 7. Session- und Async-Schutz

- `requestSeqRef`, `inFlightRef`, `appIdRef` schützen die KI-Anfrage.
- `actionSeqRef` schützt Save/Adopt gegen verspätete Antworten nach
  Bewerbungswechsel/Unmount.
- Parent-Save/Adopt laufen durch denselben `runningRef`/`AbortController`-Pfad
  wie andere Repository-Aktionen.
- Unsaved AI proposal blockiert Tab-/Bewerbungswechsel mit verständlichem
  Hinweis; Speichern/Verwerfen gibt den Wechsel frei.
- `invalidate()`/Session-Generation bleiben unverändert; bei Session-Ende hat
  die Datenentfernung Vorrang.
- Offen: Der KI-Request selbst hat noch kein `AbortSignal`; die Antwort wird
  nach Unmount/Logout verworfen, die Übertragung aber nicht abgebrochen.

## 8. Regression

Tatsächlich ausgeführt:

- Gesamtsuite: **1254 passed, 5 skipped**
- Feature-Unit/Integration: **69 passed**
- API-Cover-Letter: **23 passed**
- TypeScript/Build: **PASS**
- `node --check` API: **PASS**
- `git diff --check`: **PASS**
- Applications-E2E 1440/390: **PASS**, responsive 1024/768/320 **PASS**
- Cover-Letter-E2E 1440/390: **PASS**
- Mobile-Nav-E2E 390/430/768/1024/1440: **PASS**
- Guest-CV-E2E 1440/390: **PASS**
- JSON Schema/Fixtures: 15 gültig, negatives Fixture abgelehnt
- Keine Console-Errors; keine echten KI-/Provider-/Apify-/RIS-/AWS-Aufrufe

Der frühere Volllast-Flake in `ManualSearchProfiles.integration.test.tsx` trat im
finalen Gesamtlauf nicht auf.

## 9. Screenshots

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/`

Synthetische Daten; keine echten Bewerberdaten. Für 01E waren keine neuen
Screenshots erforderlich.

## 10. Git

- Branch: `feature/jm-application-letter-revision-01e`
- 01E-Korrekturen: `1463525`
- Dokumentation: dieser Commit
- `main`: `4364eab`
- Kein Push, Merge, Rebase, Stash, Reset, Clean oder Deployment

## 11. Statusgrenzen

**IMPLEMENTED:** 01A–01D.

**VERIFIED LOCAL:** 01A–01E inklusive Unit-, API-, Schema-, Build- und
Browser-Regressionen.

**SPECIFIED:** RIS-/Persistenz-/Auth-Grenzen aus APP-03 und den
Application-Verträgen.

**OPEN:** Live-Provider-Verifikation, serverseitige Anonymisierung,
Output-Faktenprüfung, AI-Abbruchsignal, Provider-Log-Hygiene.

**BLOCKED:** Produktionsfreigabe ohne Auth-/Gastmodus-Live-Matrix,
Retention-/Datenschutzfreigabe, dauerhafte RIS-Persistenz, Missbrauchsschutz
für `/api/cover-letter` und Deployment-Freigabe.

**NOT DEPLOYED:** Kein Push, Merge oder Deployment.

## 12. Release-Entscheidung

### LOCAL INTEGRATION

**READY**

Die Serie ist für eine kontrollierte Integration in den lokalen `main`
vorbereitet. Die Integration selbst ist nicht erfolgt.

### PRODUCTION

**BLOCKED**

Ein Session-only-/Demo-Umfang ist lokal verifiziert. Die produktive
Dauerfunktion ist ohne die oben genannten Live-, Datenschutz-, Persistenz-,
Auth- und Missbrauchsschutz-Gates nicht freigegeben.

# JM-APPLICATION-MANAGEMENT-03

**Art:** Bewerbungsverwaltung / Repository-Readiness / Session-Adapter
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein RIS-Backend, kein Deployment
**Datum:** 2026-11-02
**Baseline:** `main` @ `e1f0347d4595ea40cc2772b09fd2c65003d1ac61`
**Grenzen:** Keine RIS-/AWS-/Cognito-Änderung, keine neue Datenbank, keine produktiven API-/KI-/Apify-Aufrufe, kein Deployment.

## 1. Executive Summary

APP-03 bereitet die Bewerbungsverwaltung auf eine spätere RIS-Persistenz
vor, ohne eine RIS-Kommunikation zu implementieren. Die vorhandene
Session-only-Funktionalität aus APP-02 bleibt vollständig erhalten und ist
jetzt über eine Repository-Grenze angebunden.

Die UI kennt keine konkrete Speicherimplementierung mehr. Der aktuelle
Standard ist `createSessionApplicationRepository()` mit reinem In-Memory-State.
Die spätere RIS-API, serverseitige Identität, Persistenz und Datenlebenszyklen
bleiben ausdrücklich RIS-Aufgabe.

## 2. Tatsächlicher Ausgangsstand

- Basis-HEAD: `e1f0347` (`docs: document application management dashboard`).
- APP-01-Vertrag, Domainregeln, Validierung, JSON Schema und Fixtures vorhanden.
- APP-02-Dashboard, Session-Bewerbungen, Anschreiben-Übernahme, Statusverlauf,
  Export und bestätigtes Löschen vorhanden.
- Bestehende Profil-/CV-/ATS-/BA-Funktionen und Authentifizierungsgrenze
  `iss + sub` waren bereits vorhanden und wurden nicht ersetzt.
- Keine RIS-Route, kein RIS-Repository und keine RIS-Credentials im Browser.

## 3. Neue und veränderte Komponenten

| Datei | Änderung |
|---|---|
| `src/lib/applications/repositoryTypes.ts` | Persistenzneutraler Repository-Vertrag, typisierte Fehler, Pagination, `AbortSignal`, Idempotenz- und Konfliktfelder |
| `src/lib/applications/sessionRepository.ts` | Session-Adapter über den vorhandenen Domainfunktionen |
| `src/lib/applications/sessionRepository.test.ts` | CRUD-, Status-, Versions-, CV-/Anschreiben-, Export-, Lösch-, Idempotenz-, Abort- und Isolations-Tests |
| `src/components/ApplicationsSection.tsx` | Datenzugriff ausschließlich über `ApplicationRepository`; Lade-/Fehler-/Busy-Zustand; Schutz gegen späte Operationen |
| `src/components/ApplicationsSection.test.tsx` | Repository-Harness und Test für verspätete Operationen nach Session-Wechsel |
| `src/App.tsx` | Repository-Instanz, Auth-Reset, Übernahme über Repository, Session-Key |
| `src/i18n.tsx` | Lade- und Repository-Fehlertexte (DE/EN) |
| `docs/contracts/MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md` | RIS-Anforderungs- und Integrationsvertrag |
| `docs/reports/JM-APPLICATION-MANAGEMENT-03.md` | Dieser Bericht |

## 4. Repository-Vertrag

`ApplicationRepository` beschreibt die fachlichen Operationen:

- `list` mit Statusfilter, `limit`, Cursor und `AbortSignal`
- `get`
- `findByJob` für die vorhandene Duplikatprüfung bei der Anschreiben-Übernahme
- `create` mit optionalem Idempotency-Key
- `update` mit `expectedVersion`
- `transitionStatus` mit APP-01-Regeln und `signal`
- `addHistory` für Feedback, Interview und Notiz
- `addCoverLetterVersion` mit Job-Bindung
- `export` als lokaler Entwurf
- `delete` mit `expectedVersion` und idempotentem Ergebnis

Typisierte Fehler:

```text
validation_error
not_found
version_conflict
invalid_transition
confirmation_required
aborted
unavailable
owner_mismatch
idempotency_conflict
```

Der Vertrag verwendet bewusst die vorhandenen `SessionApplicationV1`- und
APP-01-Datentypen. Die RIS-Variante mit `ApplicationV1`, serverseitigen IDs und
`ownerId` ist im RIS-Handoff spezifiziert und **nicht** als vorhandene API
behauptet. `localId` bleibt ausschließlich eine lokale UI-/Session-ID und wird
nie als `applicationId` ausgegeben oder übertragen.

## 5. Session-Adapter

`createSessionApplicationRepository()`:

- speichert ausschließlich in einer lokalen In-Memory-Liste,
- arbeitet auf den vorhandenen Funktionen aus `sessionApplications.ts`,
- erzeugt lokale IDs und lokale Versionen,
- unterstützt Pagination und Statusfilter,
- liefert bei abgebrochenen Operationen `aborted`,
- verhindert doppelte Entwürfe für dieselbe Stelle,
- liefert bei wiederholtem Idempotency-Key den aktuellen Stand,
- löscht idempotent und nur bei passender Version,
- kapselt die Daten per Klon, damit UI und Repository nicht denselben
  veränderlichen Objektbaum teilen,
- führt keine Backend-, KI- oder Apify-Aufrufe aus.

Es gibt weiterhin **keine** Speicherung in `localStorage`, `sessionStorage`,
IndexedDB, Redis oder einem Backend.

## 6. UI-Anbindung

`ApplicationsSection` erhält jetzt `repository` statt einer Anwendungsliste und
eines Setter-Callbacks. Die vorhandene Oberfläche bleibt erhalten.

- Initiales Laden über `repository.list({ signal })`.
- Statuswechsel, Feedback, Interview, Notiz, Anschreiben-Version, Export und
  Löschen laufen ausschließlich über Repository-Operationen.
- `busy` verhindert doppelt ausgelöste Aktionen.
- Laufende Operationen werden bei Repository-/Session-Wechsel abgebrochen und
  dürfen keinen späten UI- oder `onChanged`-Zustand mehr schreiben.
- Ein Repository-Fehler wird als verständlicher DE/EN-Text angezeigt; es gibt
  keinen stillen Datenverlust.
- Die Session-only-Warnung und der Reload-Leerzustand bleiben bestehen.

Die Repository-Instanz liegt in `App.tsx`. Bei Logout/Benutzerwechsel wird sie
zusammen mit den Sitzungsbewerbungen ersetzt. Der Dashboard-Bereich wird über
den verifizierten Auth-Profilschlüssel neu aufgebaut.

## 7. Authentifizierungs- und CV-Grenzen

- Die bestehende Authentifizierungsgrenze `iss + sub` wird wiederverwendet.
- Kein E-Mail-Fallback für Eigentümeridentitäten.
- Kein clientseitig erzeugter `ownerId`.
- Die CV-Referenz übernimmt nur `cvId`/`documentId`/Label, keine PDF-Datei,
  keinen Hash und keinen Dateiinhalt.
- Eine spätere serverseitige Prüfung der CV-Eigentümerschaft bleibt RIS-Aufgabe.
- `LetterModal` übergibt weiterhin nur die explizite Benutzeraktion; kein
  Auto-Submit und keine automatische Versionierung.

## 8. Migrationsvertrag (zukünftig)

Der Übergang von Session zu RIS ist nur als Vertrag vorbereitet:

```text
SessionApplicationV1
  → ausdrückliche Benutzerentscheidung
  → Vorschau der zu übernehmenden Daten
  → späterer RIS-Adapter
  → serverbestätigte ApplicationV1
```

Regeln:

- Keine automatische Migration.
- Keine RIS-Route wird vorausgesetzt.
- `localId` wird niemals ohne Serverbestätigung zu `applicationId`.
- Duplikate werden über Stelle/Eigentümer/aktive Bewerbung erkannt.
- Teilübernahmen und Fehler werden pro Eintrag gemeldet.
- Lokale Daten bleiben bei Fehlern erhalten.
- Lokale Daten werden erst nach serverbestätigter Übernahme als migriert
  markiert oder ersetzt.
- Keine KI-/Apify-Aufrufe während der Übernahme.

Es gibt bewusst **keinen** „Im Konto speichern“-Button, solange die
Backend-Anbindung fehlt.

## 9. RIS-Handoff

`docs/contracts/MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md` beschreibt:

- benötigte Application-Ressourcen und vorgeschlagene CRUD-/Statusrouten,
- serverseitige Identität aus `iss + sub` und Ownership-Prüfung,
- servergenerierte `applicationId`, Zeitstempel und Version,
- Conditional Writes und `409 version_conflict`,
- Anschreiben-Versionen mit `jobId`-Bindung,
- CV-Referenzen ohne Dateikopie,
- Export- und Löschverträge,
- Fehler- und Pagination-Verträge,
- Datenschutz-/Retention-Anforderungen,
- offene Architekturentscheidungen und ausdrücklich unverifizierte
  Backend-Fähigkeiten.

Die APP-01-Endpunkte bleiben Vorschläge. Der Handoff ist kein Auftrag zur
RIS-Implementierung.

## 10. Tests

| Prüfung | Ergebnis |
|---|---|
| Session-Repository | **9 passed** |
| ApplicationsSection | **9 passed** |
| Session-Applikationen (Bestand) | **5 passed** |
| LetterModal (Bestand) | **45 passed** |
| DashboardV2 (Bestand) | **10 passed** |
| Gesamtsuite | **1183 passed, 5 skipped** |
| TypeScript (`tsc --noEmit`) | PASS |
| Build (`npm run build`) | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Reload-Leerzustand | PASS |

Abgedeckt:

- Repository CRUD, Liste, Get, Job-Suche
- Statusübergänge inkl. ausdrücklicher Submit-Bestätigung
- Versionskontrolle und veraltete Schreibvorgänge
- Anschreiben-Version mit Stellenzuordnung
- CV-Referenz ohne Dokumentkopie
- Doppelklick-/Idempotenzschutz
- Session-Isolation
- verspätete Operation nach Repository-/Session-Wechsel
- Export als lokaler Entwurf
- bestätigtes Löschen
- Fehleranzeige ohne stillen Zustandsverlust
- bestehende Profil-/CV-/ATS-/BA-/Anschreiben-Regressionen
- Desktop/Mobil

## 11. Git-Commits

| Schritt | Commit | Inhalt |
|---|---|---|
| APP-03A | `ea57e9c` | Repository-Vertrag |
| APP-03B | `0d9ef8d` | Session-Adapter und Tests |
| APP-03C | `89e877c` | UI-Integration und Auth-/Session-Schutz |
| APP-03D | `c12d7a4`, `ec7abfa` | RIS-Handoff und Formatierungsnormalisierung |
| APP-03E | dieser Commit | Security-/Regression-Gate und Dokumentation |

## 12. Statusabgrenzung

**IMPLEMENTED**

- Repository-Vertrag
- Session-Adapter
- UI-Anbindung über Repository
- Session-Isolation und Schutz vor späten Operationen
- lokaler Export und bestätigtes Löschen

**VERIFIED**

- TypeScript, Build, Gesamtsuite
- Desktop-/Mobil-E2E
- Reload-Leerzustand
- keine Console-Errors
- `git diff --check`

**SPECIFIED**

- RIS-Persistenz-API
- serverseitige `ApplicationV1`-Ressource
- Session-to-RIS-Übergabe
- Fehler-/Pagination-/Retention-Verträge
- CV-Eigentümerschaftsprüfung

**OPEN**

- RIS-Backend implementieren und verifizieren
- echte serverseitige IDs, Ownership und Conditional Writes
- Live-Auth-Matrix (Login, Logout, Benutzerwechsel)
- Datenschutz-/Retention-Freigabe
- RIS-Handoff-Referenzdokumente waren in diesem Workspace nicht vorhanden und
  bleiben hier unverifiziert

**NOT DEPLOYED**

- Kein Deployment.
- Keine produktiven RIS-/API-/KI-/Apify-Aufrufe.

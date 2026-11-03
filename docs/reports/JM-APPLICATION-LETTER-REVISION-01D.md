# JM-APPLICATION-LETTER-REVISION-01D

**Art:** Anschreiben / kontrollierte Versionsübernahme / Entwurfsübernahme
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-revision-01d`
**Ausgangsstand:** 01C `e29a7c9`
**Grenzen:** Keine neue Persistenz, keine neue API, keine RIS-/AWS-/Cognito-/KI-Anfrage, kein Merge/Deployment.

## 1. Versionsspeicherung

Neue Aktion im KI-Vorschaubereich:

**„Als neue Version speichern“**

Ablauf:

1. bearbeiteter Vorschlag wird geprüft (nicht leer, max. 50.000 Zeichen),
2. bestehende Bewerbung und Session werden verwendet,
3. neue `versionId` wird lokal erzeugt,
4. Speicherung ausschließlich über `ApplicationRepository.addCoverLetterVersion`,
5. `expectedVersion` schützt vor parallelen Änderungen,
6. Erfolg wird erst nach dem Repository-Ergebnis angezeigt,
7. die neue Version erscheint unmittelbar in der Vergleichsauswahl.

Eigenschaften der neuen Version:

- `source: "revised"` (auch nach manueller Nachbearbeitung des KI-Texts)
- `content` = aktuell bearbeiteter Vorschlag
- `createdAt` = Zeitpunkt der Speicherung
- `jobId` der Bewerbung
- `language` der aktuellen UI-Sprache
- `model` nur, wenn das tatsächlich erfolgreiche Modell aus dem Fallback-Trace
  zuverlässig bekannt ist; sonst leer

Keine Schemaerweiterung, keine neuen Enum-Werte.

## 2. Unveränderlichkeit

Historische Versionen werden nicht ersetzt:

- alte `versionId`s bleiben unverändert,
- alte Inhalte/Zeitstempel bleiben unverändert,
- neue Version erhält eine eigene ID,
- Vergleich und Bearbeitung des KI-Vorschlags mutieren keine Historie,
- die Quelle einer neuen KI-Überarbeitung bleibt als alte Version erhalten.

## 3. Entwurfsübernahme

Für eine gespeicherte Vergleichsversion:

**„Als aktuellen Entwurf übernehmen“**

- Aktion ist nur für gespeicherte Versionen verfügbar.
- Bestätigung ist verpflichtend.
- Hinweis, falls der aktuelle Entwurf noch nicht als Version gespeichert ist.
- Bestätigung ersetzt ausschließlich `coverLetterDraft`/`documentStatus`.
- Keine neue Version und keine Statusänderung.
- Keine automatische Übernahme, kein stilles Überschreiben.
- Abbruch verändert nichts.

## 4. Konflikte und Doppelklick

- `expectedVersion` wird bei Speicherung und Entwurfsübernahme verwendet.
- `savingRef`/`adoptingRef` und deaktivierte Buttons verhindern Doppelklick.
- `version_conflict` zeigt eine verständliche Meldung; Vorschlag bleibt erhalten.
- Ein Response-Verlust ist nicht als Exactly-once garantiert. Wenn ein Retry
  nach einer tatsächlich erfolgreichen, aber verlorenen Antwort erfolgt,
  verhindert die alte `expectedVersion` eine zweite unkontrollierte Anlage und
  führt zu einem Konflikt. Die UI behauptet keine Exactly-once-Garantie.
- Session-/Bewerbungswechsel entwerten den Vorschlag und die lokalen
  Aktionszustände.

## 5. UI/Responsive

- Speichern- und Verwerfen-Aktionen beim bearbeitbaren KI-Vorschlag.
- Erfolgsmeldung „Version N gespeichert.“
- Neue Version direkt in den Selektoren.
- Adopt-Aktion im Vergleichspanel mit Bestätigung.
- Desktop: zwei Vergleichsspalten; mobil untereinander.
- 1440/1024/768/390/320 ohne horizontalen Overflow.
- Keine neuen Repository-Anfragen für Vergleiche/Anzeige.

## 6. Datenschutz

- Keine neue Übertragung an KI-Anbieter beim Speichern oder Übernehmen.
- Keine automatische KI-Anfrage.
- Keine localStorage-/sessionStorage-/IndexedDB-Persistenz.
- Keine RIS-/AWS-Integration.
- Keine Anschreibeninhalte in Logs.
- Session-Speicherung ist nicht als dauerhafte Archivierung dargestellt.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationLetterImprovement | **12 passed** |
| ApplicationLetterComparison | **6 passed** |
| TextDiff | **4 passed** |
| ApplicationsSection | **31 passed** |
| Gesamtsuite (`npm test -- --run`) | **1245 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| AI-/Comparison responsive 1024 / 768 / 320 | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/Provider-/Backend-Aufrufe | keine |

Abgedeckt:

- KI-Vorschlag und manuell bearbeiteter Vorschlag
- neue Version über Repository-Callback
- Original-/frühere Versionen unverändert
- neues Modell/Version-Metadaten
- neue Version in Auswahl und Vergleich
- Entwurfsübernahme inkl. Bestätigung/Abbruch
- Konflikt und Doppelklick
- Originaltext bleibt bei Fehlern erhalten
- Versionsanzahl unverändert ohne Speichern
- keine Statusänderung
- Session-/Bewerbungswechsel

## 8. Screenshots

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/desktop-1440-saved.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/desktop-1440-adopt-confirm.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/desktop-1440-adopted.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/mobile-390-saved.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/mobile-390-adopt-confirm.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01D/mobile-390-adopted.png`

Synthetische Daten; keine echten Bewerberdaten.

## 9. Git

- Implementierung: `a0d106f`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-letter-revision-01d`
- `main` bleibt `4364eab`
- Kein Push, Merge oder Deployment

## 10. Offene Punkte

- Exactly-once bei verlorener Antwort ist nicht garantiert; `expectedVersion`
  verhindert eine zweite unkontrollierte Version, erzeugt aber ggf. einen
  sichtbaren Konflikt.
- Keine dauerhafte Archivierung über Browser-Sitzungen.
- 01E nicht vorweggenommen.

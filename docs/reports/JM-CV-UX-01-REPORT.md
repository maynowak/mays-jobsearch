# JM-CV-UX-01 — CV Builder: Speicherfehler analysieren und beheben

**Status:** `COMPLETE — LOCAL/UNIT VERIFIED — LIVE RIS E2E NOT EXECUTED`
**Datum:** 2026-11-15
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-ux-01-save-blocker`
**Basis:** `origin/main` @ `464783b`
**Implementierungs-Commit:** `2edd04e`

Kein Main-Merge, kein Production-Deployment, keine RIS-/AWS-/Terraform-/Cognito-
Änderung, keine Änderung an Auth-, Consent- oder Kapazitätslogik.

---

## 1. Tatsächliche Ursache

Der beobachtete Speicherblocker war **kein RIS-Backend-Fehler**, sondern ein
Validierungsfehler im CV-Builder:

1. `validateCvBuilderDraft()` erzeugt mindestens einen Feldfehler.
2. `errorCount > 0` deaktiviert den RIS-Speicherbutton und den PDF-Export.
3. Die UI zeigte nur „Feldvalidierung: 1 Feldfehler“ bzw. „Bitte prüfe die
   markierten Felder“, aber **nicht**, welcher Abschnitt/welches Feld betroffen
   war.
4. Dadurch war der deaktivierte Button nicht handlungsfähig; der eigentliche
   Upload wurde nie erreicht.

Die RIS-/Upload-Kette war nicht die Ursache und wurde nicht verändert.

---

## 2. Behobenes Verhalten

### Betroffene Abschnitte sichtbar

Die Validierungszusammenfassung nennt jetzt die betroffenen Abschnitte, z. B.:

> Betroffene Abschnitte: Persönliche Angaben

Bei mehreren Abschnitten werden sie eindeutig zusammengefasst.

### „Zum ersten Fehler“

Neuer Button in der Validierungszusammenfassung:

- öffnet den betroffenen `<details>`-Abschnitt,
- scrollt ihn in den sichtbaren Bereich,
- fokussiert das tatsächlich fehlerhafte Feld,
- wechselt auf Mobile ggf. von „Vorschau“ zurück zu „Bearbeiten“,
- funktioniert im Modal und in der Vollansicht.

Feldzuordnung:

| Fehlerpfad | Ziel |
|---|---|
| `personal.*`, `profile.*` | jeweiliges Textfeld |
| `experience.N.*`, `education.N.*`, `projects.N.*`, `certificates.N.*` | jeweiliges Eingabefeld |
| `skills.*` | gemeinsames Skills-Textfeld |
| `languages.N.language` | Sprachfeld |
| `languages.N.level` | Sprachlevel-Select |
| `links.N.*` | Link-Felder im Abschnitt „Sprachen und Links“ |
| Abschnitts-Limitfehler | Abschnitts-Summary |

### Deaktivierte Speicheraktionen erklärt

- Sichtbarer Hinweis: „PDF-Export und RIS-Speicherung sind erst nach Korrektur
  der markierten Felder möglich.“
- Der deaktivierte RIS-Button trägt zusätzlich den Title „Dauerhaftes Speichern
  ist erst möglich, wenn die markierten Felder korrigiert sind.“
- Auth-, Consent-, Kapazitäts- und Identitätsprüfungen bleiben unverändert.

### Erfolg und Fehler

- Erfolgsmeldung erscheint weiterhin nur nach `onSavePdfToRis(...) === true`,
  also nach bestätigter Speicherung.
- Fehlgeschlagener Upload erzeugt weiterhin keine Erfolgsmeldung.
- Validierungsfehler blockieren weiterhin Upload und Export; es wurde keine
  Validierung umgangen.
- Bestehende technische Meldungen für Auth, Consent, Kapazität und
  PDF-Validierung bleiben erhalten.

### PDF-Download

Der bestehende Download bleibt unverändert und unabhängig vom RIS-Speichern.

---

## 3. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/CvBuilderEditor.tsx` | Abschnitts-/Feldfokus, „Zum ersten Fehler“, Erklärungshinweise, stabile Skills-/Level-IDs |
| `src/components/CvBuilderEditorRisStorage.test.tsx` | Neue Regressionstests für Blocker, Fokus, Korrektur, Modal/Vollansicht, Skills |
| `src/i18n.tsx` | DE/EN-Texte für Abschnitte, Button und Blockhinweise |
| `src/styles.css` | Gestaltung der Validierungszusammenfassung und des Blockhinweises |
| `docs/reports/JM-CV-UX-01-REPORT.md` | Dieser Bericht |
| `docs/AI_AUDITLOG.md` | Audit-Eintrag |

Keine Änderungen an `api/**`, RIS, AWS, Terraform, Cognito, Auth, Consent oder
Matching.

---

## 4. Tests

### Fokussiert

```text
npx vitest run --maxWorkers=2 \
  src/components/CvBuilderEditor.test.tsx \
  src/components/CvBuilderEditorPdf.test.tsx \
  src/components/CvBuilderEditorRisStorage.test.tsx \
  src/components/CvBuilderWorkspacePage.test.tsx \
  src/lib/useCvBuilderPdfRisStorage.test.tsx \
  src/lib/usePersistentCvStorage.test.tsx \
  src/lib/cvBuilder
Test Files  14 passed (14)
     Tests  151 passed (151)
```

Abgedeckt:

1. Fehlerhafter CV blockiert Upload.
2. „Zum ersten Fehler“ fokussiert das fehlerhafte Feld.
3. Korrektur gibt die Speicherung frei.
4. PDF-Erzeugung + Upload-Callback werden aufgerufen.
5. Erfolgreicher Upload zeigt die Erfolgsmeldung.
6. Fehlgeschlagener Upload zeigt keine falsche Erfolgsmeldung.
7. Fehlende Anmeldung/Einwilligung bleibt gesperrt.
8. Mehrfachklicks erzeugen keine parallelen Speicheraktionen.
9. Modal und Vollansicht funktionieren.
10. PDF-Download bleibt unverändert.
11. Mobile Wechsel von Vorschau zu Bearbeiten funktioniert.
12. Duplicate-Skill-Fehler fokussiert das gemeinsame Skills-Feld.

### Vollsuite

```text
npx vitest run --maxWorkers=2
Test Files  179 passed | 4 skipped (183)
     Tests  1895 passed | 11 skipped (1906)
```

### Build / Diff

```text
npm run build
✓ built in 740ms

git diff --check
# Exit 0, keine Fehler
```

### Live-RIS

**Nicht ausgeführt.** Es lag keine ausdrückliche Live-Test-Freigabe mit
synthetischen Daten und genehmigter RIS-/Preview-Umgebung vor. Die Tests sind
Komponenten-/Hook-Tests mit gemocktem PDF-/Upload-Pfad; sie werden nicht als
RIS-Live-E2E ausgegeben.

---

## 5. Verbleibende Einschränkungen

1. **Live-RIS-/S3-E2E nicht verifiziert** — benötigt separate Testfreigabe,
   synthetische Daten und Pilotidentität.
2. **Technischer Upload-Fehler** bleibt als sichere generische Meldung
   („Das PDF konnte nicht in RIS gespeichert werden.“); spezifische
   Auth-/Consent-/Kapazitätsmeldungen bleiben erhalten.
3. **Visuelle Production-Abnahme** des neuen Validierungsblocks steht aus
   (kein Deployment in diesem Auftrag).
4. Keine Änderung an RIS, daher keine Backend-Regression erwartet, aber auch
   nicht live gegengeprüft.

---

## 6. Git

| Feld | Wert |
|---|---|
| Branch | `feature/jm-cv-ux-01-save-blocker` |
| Implementierungs-Commit | `2edd04e` |
| Remote-Branch | `origin/feature/jm-cv-ux-01-save-blocker` |
| Push | bestätigt (Remote = `2edd04e`) |
| Main-Merge | nein |
| Production-Deployment | nein |

Der Report-/Audit-Commit folgt auf demselben Branch.

---

## 7. Ergebnis

**COMPLETE — im autorisierten lokalen Testumfang.**

Nach Korrektur des ungültigen Feldes ist der bestehende Speicherweg wieder
freigegeben; der Benutzer wird vorher zum konkreten Abschnitt und Feld geführt.
Der eigentliche RIS-Upload bleibt unverändert und ist nicht live getestet.

# CV-BUILDER-IMPORT-01B-R1 — REAL-CV QUALITY FIX

**Status:** `CV-BUILDER-IMPORT-01B-R1 — IMPLEMENTED / VERIFIED LOCAL`
**Basis:** `origin/main` `baac910`
**Branch:** `feature/cv-builder-import-01b-r1`
**Code-Commit:** `8141e1b`

## 1. Gefundene Ursachen

- `PROFESSIONAL EXPERIENCE (CONTINUED)` wurde nicht als Fortsetzungsüberschrift
  erkannt und konnte als Positionszeile in die Erfahrungsauswertung gelangen.
- Wiederholte Kopf-/Fußzeilen wurden nur teilweise gefiltert.
- Erfahrungsblöcke ohne belastbare Arbeitgeber-/Positionsangabe wurden als
  unvollständige Einträge erzeugt, statt der manuellen Zuordnung angeboten.
- Namen durften zu leicht wie eine Berufsbezeichnung aussehen.
- Die Vorschau erlaubte eine pauschale Übernahme aller nicht zugeordneten
  Zeilen in das Kurzprofil. Das war zu grob.
- Projekt-/Skill-Zeilen aus mehrzeiligen PDFs konnten noch falsch zusammen-
  laufen; einzelne Technologie-Fragmente enthielten Satzreste.

## 2. Implementierte Korrekturen

### Kopf-/Fußzeilen und Fortsetzungsüberschriften

- `PROFESSIONAL EXPERIENCE (CONTINUED)` und analoge
  `(FORTSETZUNG)`-Überschriften werden als Abschnittswechsel behandelt.
- Seitenzahlen und wiederholte `PROFESSIONAL CV/PROFILE <n>`-Zeilen werden
  entfernt.
- Fortsetzungsüberschriften werden nie zu Positionen oder Arbeitgebern.

### Namen und Rollen

- Namenskandidaten werden abgelehnt, wenn sie wie eine Berufsbezeichnung,
  ein Unternehmen oder eine Abschnittsüberschrift aussehen.
- Die Rollenauswahl bleibt kontextgebunden; es werden keine Rollen erfunden.

### Berufserfahrung

- Ein Eintrag wird nur erzeugt, wenn Position und Arbeitgeber plausibel sind.
- Unvollständige Datums-/Positionsblöcke werden als nicht zugeordnet angeboten,
  nicht als leere Erfahrungszeile.
- Selbstständigkeit/Freelance wird aus dem Originaltext als Arbeitgeberkontext
  übernommen, nicht erfunden.
- Lab-/Trainings-/Weiterbildungsblöcke bleiben von Berufserfahrung getrennt.

### Skills und Projekte

- Skill-Kandidaten mit internen Satzzeichen, Satzfragmenten, Jahreszahlen,
  URLs oder unplausibler Länge werden aussortiert.
- Kategorien wie `Architecture:`, `Cloud & DevOps:` oder `Software & Data:`
  werden nicht als Skills geführt.
- Technologieangaben in Projekten werden mit derselben Plausibilitätsprüfung
  bereinigt.
- Projektbeschreibungen, Technologiezeilen und Link-only-Zeilen bleiben getrennt.

### Ausbildung

- `Education & Certifications` wird als Bildungsabschnitt erkannt.
- Einzelzeilen mit Abschluss und Hochschule werden in Abschluss und Einrichtung
  getrennt, soweit der Text das hergibt.
- Fehlende Zeiträume bleiben leer und werden als Prüfhinweis markiert.
- Seitenfußzeilen und Professional-Development-Blöcke werden nicht als
  Ausbildung erfunden.

### Manuelle Zuordnung nicht erkannter Zeilen

- Die pauschale Option „alle nicht zugeordneten Zeilen ins Kurzprofil“ wurde
  entfernt.
- Jede nicht zugeordnete Zeile kann einzeln einem bestehenden Builder-Bereich
  zugeordnet werden:
  - Kurzprofil
  - Fähigkeiten
  - Projekte
  - Zertifikate
  - Links
  - oder **Nicht übernehmen**
- Die Zuordnung erfolgt erst nach expliziter Auswahl und Bestätigung.
- Keine Schemaänderung am Builder.

### Kompakte Vorschau

- Status und Anzahl pro Abschnitt bleiben sichtbar.
- Details sind einklappbar.
- Nicht zugeordnete Zeilen sind einzeln gelistet und pro Zeile zuordenbar.
- Lange Skill-Listen und Rohtextblöcke werden nicht ungefragt ins Kurzprofil
  übernommen.

## 3. Vorher-/Nachher am realen Referenzlauf

Lokaler Referenzlauf mit den bereitgestellten synthetischen/realen Text-
extraktionen; keine PDF-Inhalte oder personenbezogenen Daten werden im
Repository gespeichert.

| Signal | Vor R1 | Nach R1 |
|---|---:|---:|
| `PROFESSIONAL EXPERIENCE (CONTINUED)` als Position | möglich | **ausgeschlossen** |
| Erfahrungseinträge mit leerem Arbeitgeber/Position | mehrere | **0 erzeugt; manuell zuordenbar** |
| Satzfragmente in Skills | vorhanden | **gefiltert** |
| Pauschale Kurzprofil-Übernahme | ja | **entfernt** |
| Nicht zugeordnete Zeilen | nur Liste | **einzeln zuordenbar** |

Der einspaltige ATS-Referenzlauf erkennt weiterhin Projekte, Technologien,
Sprachen und Links. Die zweispaltige Extraktion bleibt eine bekannte Grenze:
Die vorhandene Lesereihenfolge vermischt Spalten; der Parser erfindet daraus
keine vollständigen Lebensläufe, sondern bietet unklare Blöcke zur manuellen
Zuordnung an.

## 4. Tests

| Prüfung | Ergebnis |
|---|---|
| Serielle Gesamtsuite | **1715 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Parser-/Preview-/Manual-Assignment-Tests | **PASS** |
| Import-E2E lokal + gemockter RIS-CV | **PASS** |
| Breiten | 320 / 390 / 430 / 768 / 1024 / 1440 px |
| Prefill, Bearbeitung, PDF-Export | **PASS** |
| AI-/Modellaufrufe | **0** |
| RIS-Schreiboperationen | **0** |

Zusätzlich geprüft:

- Fortsetzungsüberschrift wird nicht zur Position
- unvollständige Erfahrungsblöcke bleiben manuell
- Namenskandidaten werden nicht mit Rollen verwechselt
- manuelle Einzelzuordnung in Builder-Bereiche
- keine pauschale Kurzprofil-Übernahme
- bestehende Section-Auswahl und PDF-Export

## 5. Screenshots

`docs/reports/assets/CV-BUILDER-IMPORT-01B-R1/`

- `source-{320,390,430,768,1024,1440}.png`
- `preview-{320,390,430,768,1024,1440}.png`
- `editor-{320,390,430,768,1024,1440}.png`
- `results.json`

## 6. Commits

- `8141e1b` — R1 Parser-/Vorschau-Korrekturen
- Dokumentations-Commit (HEAD) — Bericht und Auditlog

## 7. Verbleibende Einschränkungen

- Kein OCR und keine KI; gescannte PDFs bleiben ausgeschlossen.
- Zweispaltige PDFs bleiben durch die vorhandene Extraktionsreihenfolge begrenzt.
- Manuelle Zuordnung ist auf bestehende textuelle Builder-Bereiche begrenzt;
  komplexe Erfahrungs-/Ausbildungsstrukturen müssen im Editor ergänzt werden.
- Kein authentifizierter Live-RIS-E2E.
- Kein Push, Merge oder Production-Deployment im Rahmen von R1.
- Keine RIS-/AWS-/Cognito-/Terraform-/Consent-Änderung.

## 8. Empfehlung

**GO für Review und kontrollierten Merge.**
**NO-GO für Production-Deployment ohne gesonderte Freigabe.**

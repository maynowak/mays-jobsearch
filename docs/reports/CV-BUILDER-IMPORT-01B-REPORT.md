# CV-BUILDER-IMPORT-01B — PARSER QUALITY & IMPORT UX

**Status:** `CV-BUILDER-IMPORT-01B — IMPLEMENTED / VERIFIED LOCAL`
**Basis:** `origin/main` `325693a`
**Branch:** `feature/cv-builder-import-01b`
**Code-Commit:** `c2e8efe`

## 1. Gefundene Ursachen

- Abschnittserkennung nutzte ausschließlich exakte Aliaslisten. Überschriften wie
  **Selected Current Projects**, **Work History**, **Education and Qualifications**,
  **Further Education**, **Technical Skills**, **Core Competencies** oder
  **Cloud & DevOps** wurden dadurch nicht als neuer Abschnitt erkannt.
- Ohne Abschnittswechsel liefen Projektzeilen weiter in die Skill-Liste.
- Skill-Zeilen wurden zu breit aufgeteilt; Satzfragmente, Jahreszahlen und
  Projektbeschreibungen landeten als Skills.
- Jeder Datumsblock wurde als Berufserfahrung interpretiert, auch
  Trainings-/Lab-/Weiterbildungsblöcke.
- Projektblöcke wurden über Leerzeilen getrennt; mehrzeilige Projektinformationen
  zerfielen dadurch in mehrere Projekte.
- Links wurden nur im Links-Abschnitt erkannt, nicht innerhalb von Projekten;
  pro Zeile wurde nur der erste Link übernommen.
- Die Vorschau zeigte alle Details gleichzeitig und war bei langen CVs zu lang.

## 2. Implementierte Verbesserungen

### Abschnittserkennung

- Musterbasierte Erkennung zusätzlich zu Aliasen, u. a.:
  - Selected Current Projects / Selected Projects
  - Project Experience
  - Professional Experience / Work History
  - Education and Qualifications / Education & Certifications
  - Further Education / Continuing Education
  - Technical Skills / Core Competencies
  - Cloud & DevOps
- Ein erkannter Abschnitt beendet den vorherigen zuverlässig.
- Linke Spalte einer zweispaltigen Extraktion kann als Überschrift dienen, wenn
  die Lesereihenfolge dies hergibt.
- Wiederholte Kopf-/Fußzeilen und reine Seitenzahlen werden entfernt.

### Skills

- Kategorien wie `Architecture:`, `Cloud & DevOps:`, `Software & Data:` oder
  `AI Engineering:` werden nur als Kategorie behandelt, nicht als Skill.
- Satzfragmente, Verantwortlichkeitsbeschreibungen, Jahreszahlen, URLs und
  E-Mail-Adressen werden aussortiert.
- Mehrzeilige Skill-Listen werden zusammengeführt, ohne Technologiebegriffe zu
  zerlegen.
- Mehrteilige Technologien wie `Java EE/J2EE`, `REST APIs` und `Spring Boot`
  bleiben vollständig.
- Unklare Kandidaten werden nicht gelöscht, sondern in der Vorschau separat
  angeboten.
- Keine willkürliche Obergrenze.

### Erfahrung / Ausbildung / Weiterbildung

- Datumsbereiche allein reichen nicht mehr für „Berufserfahrung“.
- Trainings-, Lab-, Kurs-, Seminar- und Weiterbildungsblöcke werden als unsicher
  behandelt und nicht ungeprüft als Arbeitgeber übernommen.
- Datumszeilen mit `|` werden in Position und Arbeitgeber aufgeteilt.
- Einzeljahre werden als unvollständig markiert, nicht auf einen Monat ergänzt.
- Ausbildungsblöcke ohne vollständigen Zeitraum werden mit leerem Zeitraum und
  Prüfhinweis übernommen, nicht erfunden.
- „Education & Certifications“ wird als Bildungsabschnitt erkannt.
- „Further Education“ / „Continuing Education“ wird separat als Zertifikats-/
  Weiterbildungsabschnitt geführt.

### Projekte, Mehrzeiligkeit und Links

- Projektabschnitte werden an datierten Projektstarts zusammengehalten.
- Mehrzeilige Beschreibungen bleiben eine Einheit.
- Technologiezeilen werden als Technologien übernommen und von Beschreibungen
  getrennt.
- Link-only-Zeilen werden nicht als Projektbeschreibung dupliziert.
- GitHub-/LinkedIn-/Portfolio-Links werden auch innerhalb von Projekten erkannt.
- Alle Links einer Zeile werden berücksichtigt, dedupliziert und normalisiert.

### Importvorschau

- Kompakte Abschnittsübersicht mit:
  - Status **erkannt** oder **Prüfung empfohlen**
  - Anzahl der Angaben/Einträge/Kandidaten
  - aufklappbarer Detailansicht
  - Übernahme-Checkbox pro Abschnitt
- Lange Skill-Listen, Details und nicht zuordenbare Zeilen sind standardmäßig
  eingeklappt.
- Warnhinweise und „Nicht erkannt“-Bereiche bleiben sichtbar.
- Übernahme erfolgt weiterhin nur nach ausdrücklicher Bestätigung.

## 3. Vorher-/Nachher-Vergleich

Gleiches synthetisches Referenzdokument, Parser 01A vs. 01B:

| Metrik | 01A | 01B |
|---|---:|---:|
| Skills | 13 | **6** |
| Projekte | 0 | **1** |
| Berufserfahrung | 3 | **1** |
| Zertifikate/Weiterbildung | 0 | **1** |
| Links | 0 | **2** |

Die 01A-Skill-Liste enthielt u. a.:

- `Selected Current Projects`
- `RIS Integration`
- eine Projektbeschreibung
- `2022`
- eine URL

01B enthält nur die tatsächlichen Technologien:
`Java EE/J2EE`, `Spring Boot`, `REST APIs`, `PostgreSQL`, `AWS Lambda`,
`Terraform`.

Zusätzlich wurden im 01A-Lauf `AI/Automation Lab` und eine Ausbildungszeile als
Berufserfahrung geführt. 01B führt nur die tatsächliche Acme-Station als
Erfahrung; der Lab-/Weiterbildungsblock bleibt separat prüfbar.

Es werden keine Erfolgsquoten behauptet. Der Qualitätsgewinn liegt in weniger
falschen Zuordnungen, nicht in maximaler Trefferzahl.

## 4. Parser-Grenzen

- Scanned PDFs ohne Text bleiben nicht unterstützt (kein OCR).
- Stark verschachtelte Mehrspaltigkeit kann durch die vorhandene
  `extractPdfText()`-Reihenfolge weiterhin eingeschränkt sein; nur zuverlässig
  lesbare Überschriften werden genutzt.
- Projektgruppierung basiert auf datierten Projektstarts oder Leerzeilen.
- Unsichere Blöcke werden bewusst nicht automatisch einem Bereich zugeordnet.
- Keine KI, keine neuen Abhängigkeiten, keine RIS-/AWS-Änderung.

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Parser-/Import-/Builder-Tests | **PASS** |
| Serielle Gesamtsuite | **1711 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Import-E2E lokal + gemockter RIS-CV | **PASS** |
| Breiten | 320 / 390 / 430 / 768 / 1024 / 1440 px |
| Prefill, Bearbeitung, PDF-Export | **PASS** |
| Keine AI-/Modellaufrufe | **PASS** |
| Keine RIS-Schreiboperationen | **PASS** |

Zusätzliche Parser-Tests prüfen:

- Projektüberschrift beendet Skill-Abschnitt
- Projektbeschreibungen werden nicht zu Skills
- Technologien bleiben vollständig
- Lab/Weiterbildung wird nicht unbegründet Berufserfahrung
- unvollständige Ausbildungszeiträume werden nicht erfunden
- mehrzeilige Projekte bleiben zusammen
- Links innerhalb von Projekten
- unklare Inhalte bleiben verfügbar
- Abschnittsauswahl und kompakte Vorschau

## 6. Screenshots

`docs/reports/assets/CV-BUILDER-IMPORT-01B/`

- `source-{320,390,430,768,1024,1440}.png`
- `preview-{320,390,430,768,1024,1440}.png`
- `editor-{320,390,430,768,1024,1440}.png`
- `results.json`

## 7. Commits

- `c2e8efe` — Parser-Qualität, Skill-Filter, Projekt-/Erfahrungslogik und kompakte Vorschau
- Dokumentations-Commit (HEAD) — Bericht und Auditlog

## 8. Verbleibende Einschränkungen

- Kein authentifizierter Live-RIS-E2E mit echtem Testkonto.
- Kein OCR, keine KI.
- Kein Push, Merge oder Production-Deployment im Rahmen dieses Auftrags.
- Keine RIS-/AWS-/Cognito-/Terraform-/Consent-Änderung.
- Keine echten personenbezogenen Lebensläufe als Repository-Fixtures.

## 9. Empfehlung

**GO für Review und kontrollierten Merge.**
**NO-GO für Production-Deployment**, bis Merge-/Deployment-Freigabe und ein
Live-Browser-Lauf gegen den deployten Build erfolgen.

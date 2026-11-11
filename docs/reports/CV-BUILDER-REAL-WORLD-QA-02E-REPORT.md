# CV-BUILDER-REAL-WORLD-QA-02E — REAL PDF IMPORT QUALITY & EDITOR UX

**Status:** `CV-BUILDER-REAL-WORLD-QA-02E — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`
**Branch:** `feature/cv-builder-real-world-qa-02e`
**Base:** `origin/main` @ `78c0a7b`
**Zielstatus:** `CV-BUILDER-REAL-WORLD-QA-02E — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Evidence und Reproduktion | **COMPLETE** | `69dd4a6` |
| B | Persönliche Angaben und Kurzprofil | **COMPLETE** | `ba7d628` |
| C | Berufserfahrung aufteilen | **COMPLETE** | `08a6b87` |
| D | Ausbildung/Weiterbildung | **COMPLETE** | `08a6b87` |
| E | Skills-Erkennung | **COMPLETE** | `69dd4a6`, `08a6b87` |
| F | Zertifikatsstatus | **COMPLETE** | `ba7d628` |
| G | Projekte und Technologien | **COMPLETE** | `08a6b87` |
| H | Sprachen, Links, Inhaltsqualität | **COMPLETE** | `08a6b87` |
| I | Editor-Layout/Scrollen | **COMPLETE** | `a7a32aa` |
| J | Importqualität sichtbar | **COMPLETE** | `08a6b87` |
| K | End-to-End-Verifikation | **COMPLETE** | `08a6b87` + Abschluss-Doku |

## STEP A — Reproduktion

Synthetische 3-Seiten-Fixture mit den gemeldeten Überschriften:

- `ARCHITECTURE & CLOUD`
- `SOFTWARE ARCHITECTURE`
- `TECHNICAL SKILLS`
- `TECHNOLOGIES`
- Zertifizierungszielen, Weiterbildung, 3 Projekten und Timeline

Reproduzierte UX-/Mapping-Probleme:

- Architektur-/Cloud-/Technologies-Überschriften wurden als `unknown` oder
  falsch erkannt; Skill-Zeilen wurden über Abschnittsgrenzen zusammengezogen
  (`Kubernetes Event-driven Architecture`, `PostgreSQL Docker`).
- Name und Standort blieben im persönlichen Block unerkannt.
- Zertifizierungsziele mit Status `in preparation`/`planned` konnten je nach
  Abschnitt als Zertifikat erscheinen.
- Eine Weiterbildungszeile ohne Datum wurde an die vorherige Berufsstation
  angehängt.
- Der Desktop-Editor und die Vorschau teilten sich das Modal-Scrollen.

Private Referenzdaten bleiben außerhalb des Repositories; die Fixture ist
synthetisch.

## STEP B — Abschnittserkennung und Skills

- `architecture`, `software architecture`, `architecture & cloud`, `cloud`,
  `technologies` und `technical skills` werden als Skills klassifiziert.
- Projekt-/Architektur-Komposita mit `Projekt`/`Project` bleiben Projekte.
- Skills werden pro Dokumentabschnitt getrennt; kein Zusammenziehen von
  Wörtern über Abschnittsgrenzen.
- Projektbeschreibungen werden nicht als Skills übernommen.
- Die bestehende explizite Skill-Auswahl bleibt erhalten.

Tests: 24 Parser-Tests und 14 Strukturtests PASS, Build PASS.

## STEP C — Zertifikatsstatus

`CERTIFICATION_GOAL_RE` erkennt jetzt unter anderem `in preparation`,
`preparing for`, `planned`, `in progress`, `pursuing`, `geplant`,
`in Vorbereitung`, `angestrebt` und `noch nicht erworben`. Solche Zeilen
werden nicht zu `draft.certificates`, sondern mit `certification-goal` zur
manuellen Prüfung angeboten. Echte Zertifikate mit Issuer/Datum bleiben
erhalten. Tests: DE/EN-Ziele und ein echtes Zertifikat.

## STEP D — Persönliche Angaben

- Kontaktzeilen werden nicht mehr als vermeintliche Fortsetzung in den Namen
  gemerged.
- Ein kurzer Standort im persönlichen Block wird kontextabhängig erkannt, ohne
  Titel/Firmen zu erfinden.
- Name, E-Mail, Telefon, Standort, Profil-Headline und Kurzprofil werden aus
  dem persönlichen/professionellen Kontext getrennt.

## STEP E — Timeline/Weiterbildung

- Undatierte Training-/Lab-Zeilen starten einen eigenen Trainingsblock statt
  an die vorherige Berufsstation angehängt zu werden.
- Trainingszeilen und ihre Folgezeilen bleiben mit Quelle/Seite erhalten.
- Keine erfundenen Arbeitgeber oder Zeiträume.

## STEP F — Prüfliste

- Timeline-Gründe werden an alle Zeilen eines Trainingsblocks weitergegeben.
- Training schlägt nicht mehr fälschlich `certification-goal` oder
  `incomplete-experience` für die Folgezeile vor.
- Quellseite, Abschnitt und Reihenfolge bleiben erhalten.
- Keine stillen Löschungen.

Tests: 28 Parser- und 15 Strukturtests PASS; Build PASS.

## STEP G — Desktop-Scroll und Editor-UX

- Desktop (>900 px): Modal bleibt stehen; Editor und Live-Vorschau sind
  getrennte Scroll-Container mit `overscroll-behavior: contain`.
- Kopf, Navigation und Aktionen bleiben erreichbar; Abschnittslinks scrollen
  den Editor, nicht das ganze Modal.
- Mobile/Tablet (≤900 px): einspaltige Ansicht; das Modal scrollt als Ganzes,
  damit der Workspace auf 320 px nicht kollabiert.
- Kein horizontales Overflow.

Browser-E2E: 320/390/430/768/1024/1440 px PASS; bei 1024/1440 unabhängig
Editor-/Preview-Scroll und Modal-/Window-Scroll `0`; Screenshots unter
`docs/reports/assets/CV-BUILDER-REAL-WORLD-QA-02E/`.

## Second Pass — C/D/E/G/H/J

Die Feldzuordnung wurde nach der ersten 02E-Runde an den Praxisbeispielen
nachgeschärft:

- **C Erfahrung:** `roleLike` und `classifyExperiencePair` unterscheiden
  DevOps/Web Services/E-Commerce von Unternehmensnamen; Tests prüfen
  `BaFin/Web Services`, `Contenido/E-Commerce`, `DevOps/Unternehmen GmbH`
  als konkrete Feldwerte.
- **D Ausbildung:** Einrichtung, Fachrichtung, Abschluss und Zeitraum werden
  getrennt. `Computer Science` + `Bachelor of Science` + Hochschule ergibt
  Hochschule als Institution, `Computer Science – Bachelor ...` als Degree,
  ohne die Hochschule in die Beschreibung zu verschieben.
- **E Skills:** Solution Architecture, Enterprise Integration, Distributed
  Systems und Architektur-/Cloud-/Technologies-Überschriften werden als
  Kandidaten erkannt; Abschnittstrennung bleibt erhalten.
- **G Projekte:** Datierte Namen werden bereinigt, der Zeitraum bleibt als
  `Zeitraum: …` in der Beschreibung; Technologien werden nur aus explicit
  tech evidence/„mit …“ extrahiert und dedupliziert.
- **H Links:** GitHub-/LinkedIn-/Portfolio-Labels enthalten Repository-/
  Profilpfade statt identischer Generik; URLs bleiben editierbar.
- **J Importqualität:** Editor zeigt Feldvalidierung und Importprüfung
  getrennt (`Feldvalidierung: Keine Feldfehler` · `Importprüfung: …`), ohne
  einen künstlichen Qualitätswert.

## STEP K — Praxistest und Regression

### Qualitätsmatrix

Die gemeldeten Praxiswerte (0 Skills, 83 ungeprüfte Angaben) stammen aus dem
realen Nutzerfall. Die reproduzierbare synthetische 3-Seiten-Fixture zeigt die
technische Ursache und den korrigierten Zustand:

| Messpunkt | Synthetisch vorher | Synthetisch nachher |
|---|---:|---:|
| Architektur-/Cloud-/Technologies-Abschnitte | 2 unknown, Technologies verloren | 4 als Skills erkannt |
| Skills | 6, mit abschnittsübergreifenden Zusammenziehungen | 14, getrennt und dedupliziert |
| Persönliche Angaben | Name/Standort fehlten | Name, E-Mail, Telefon, Standort vollständig |
| Profil | Headline/Summary vorhanden | unverändert korrekt |
| Zertifikate | Ziel-/Statuszeilen konnten als Zertifikat erscheinen | nur erworbenes Zertifikat; Ziele separat |
| Ausbildung | 1 | 1 |
| Projekte | 3 | 3 |
| Berufsstationen | 2, Training an letzte Station gehängt | 2, Training separat |
| Ungeprüfte Angaben | 4 | 4, mit korrigierten Gründen/Quellen |
| Quellseiten | teils falsch/fehlend | 2/2/3-Seitenzuordnung geprüft |
| Desktop-Scroll | Editor/Preview gekoppelt | unabhängig; Modal/Windowe scrollen nicht |
| Mobile | einspaltig | einspaltig, Modal scrollt, kein Overflow |

Die Zahl der Prüfkandidaten wurde nicht künstlich reduziert; die Verbesserung
kommt aus Abschnitts-, Personal- und Timeline-Erkennung.

### Verifikation

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Parser-/Struktur-/Dialogtests | **61 PASS** |
| Serielle Gesamtsuite | **1767 PASS / 5 skipped** |
| Production-Build | **PASS** |
| 02E-Praxisfixture 320–1440 px | **PASS** |
| Import-01A / 02B / 02C / 02D | **PASS** |
| Workflow-02A | **PASS** |
| PDF-Export mit echtem Download | **PASS** |
| PDF-Export-Fix-01 | **PASS** |
| `git diff --check` / Secret-Scan | **PASS** |
| Overflow / API-/RIS-Writes / Console | **0 / 0 / 0** |

Screenshots/PDFs: `docs/reports/assets/CV-BUILDER-REAL-WORLD-QA-02E/`.

### Commit-Historie

- `69dd4a6` — A/E: Architektur-/Cloud-/Technologies-Skills, Abschnittstrennung
- `ba7d628` — B/F: Zertifikatsziele, Personal, Training, Review-Gründe
- `a7a32aa` — I: unabhängiges Desktop-Scrolling und 02E-E2E
- `08a6b87` — C/D/E/G/H/J: Erfahrungs-, Bildungs-, Projekt-, Link- und
  Importqualitäts-Fixes
- Abschluss-Dokumentations-Commit (HEAD)

**Gepusht:** `origin/feature/cv-builder-real-world-qa-02e`

### Restprobleme

- Kein Merge und kein Production-Deployment.
- Keine echten CV-Daten im Repository; die reale Referenz bleibt privat.
- Parser bleibt regelbasiert; keine KI/OCR.
- Exotische Zwei-Spalten-/Layout-PDFs bleiben durch PDF.js-Lesereihenfolge
  begrenzt.
- Keine RIS-/AWS-/Cognito-/Terraform-/Consent-Änderung.

**GO für Review und kontrollierten Merge.**
**NO-GO für Production-Deployment ohne gesonderte Freigabe.**

## FINAL REVIEW 01 — Datenschutz-Hygiene

Neue 02E-Fixtures und Screenshots verwenden jetzt die eindeutig fiktive
Identität **Nora Beispiel** (`nora.beispiel@example.invalid`) statt eines
realitätsnahen Personennamens. Bestehende, unabhängige Anonymisierungstests
mit explizitem Namensbezug wurden nicht verändert. Screenshots wurden mit der
fiktiven Identität neu erzeugt; kein privates PDF und keine realen
Kontaktdaten im Repository.

Fokussiert: 46 PASS; 02E-E2E 320–1440 PASS.

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-real-world-qa-02e`. Kein Rebase, kein Force-Push,
kein Merge nach `main`.

## Grenzen

Kein Merge, kein Production-Deployment, keine RIS-/AWS-/Cognito-/Terraform-
Änderung, keine echten CV-Daten, keine KI-/OCR-Abhängigkeit.

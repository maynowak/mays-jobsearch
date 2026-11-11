# CV-BUILDER-REAL-WORLD-QA-02E — REAL PDF IMPORT QUALITY & EDITOR UX

**Status:** `CV-BUILDER-REAL-WORLD-QA-02E — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`
**Branch:** `feature/cv-builder-real-world-qa-02e`
**Base:** `origin/main` @ `78c0a7b`
**Zielstatus:** `CV-BUILDER-REAL-WORLD-QA-02E — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Evidence und Reproduktion | **COMPLETE** | `pending` |
| B | Abschnittserkennung und Skills | **COMPLETE** | `pending` |
| C | Zertifikatsstatus | **COMPLETE** | `pending` |
| D | Persönliche Angaben und Kurzprofil | **COMPLETE** | `pending` |
| E | Timeline und Weiterbildungen | **COMPLETE** | `pending` |
| F | Prüfliste | **COMPLETE** | `pending` |
| G | Desktop-Scroll und Editor-UX | **COMPLETE** | `pending` |
| H | Praxistest und Regression | **COMPLETE** | `pending` |

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

## STEP H — Praxistest und Regression

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
| Serielle Gesamtsuite | **1762 PASS / 5 skipped** |
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

- `69dd4a6` — A/B: Architektur-/Cloud-/Technologies-Skills, Abschnittstrennung
- `ba7d628` — C–F: Zertifikatsziele, Personal, Training, Review-Gründe
- `a7a32aa` — G: unabhängiges Desktop-Scrolling und 02E-E2E
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

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-real-world-qa-02e`. Kein Rebase, kein Force-Push,
kein Merge nach `main`.

## Grenzen

Kein Merge, kein Production-Deployment, keine RIS-/AWS-/Cognito-/Terraform-
Änderung, keine echten CV-Daten, keine KI-/OCR-Abhängigkeit.

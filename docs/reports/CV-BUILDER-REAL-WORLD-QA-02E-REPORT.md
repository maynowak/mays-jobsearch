# CV-BUILDER-REAL-WORLD-QA-02E — REAL PDF IMPORT QUALITY & EDITOR UX

**Status:** `IN PROGRESS — STEPS A–B COMPLETE`
**Branch:** `feature/cv-builder-real-world-qa-02e`
**Base:** `origin/main` @ `78c0a7b`
**Zielstatus:** `CV-BUILDER-REAL-WORLD-QA-02E — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Evidence und Reproduktion | **COMPLETE** | `pending` |
| B | Abschnittserkennung und Skills | **COMPLETE** | `pending` |
| C | Zertifikatsstatus | OFFEN | — |
| D | Persönliche Angaben und Kurzprofil | OFFEN | — |
| E | Timeline und Weiterbildungen | OFFEN | — |
| F | Prüfliste | OFFEN | — |
| G | Desktop-Scroll und Editor-UX | OFFEN | — |
| H | Praxistest und Regression | OFFEN | — |

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

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-real-world-qa-02e`. Kein Rebase, kein Force-Push,
kein Merge nach `main`.

## Grenzen

Kein Merge, kein Production-Deployment, keine RIS-/AWS-/Cognito-/Terraform-
Änderung, keine echten CV-Daten, keine KI-/OCR-Abhängigkeit.

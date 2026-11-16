# JM-ATS-DESCRIPTION-HANDOFF-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO MAIN MERGE / NO PRODUCTION DEPLOY`

**Date:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-ats-description-handoff-01`
**Baseline:** `origin/main` `fbe58e1cb885a365ff82cef0f8a5357a96f8a8c7`

## 1. Ziel

Ein Klick auf „Mit ATS bewerten“ soll die vollständige Stellenbeschreibung
verwenden. Ist nur eine Kurzbeschreibung vorhanden, wird der bestehende
Job-Details-Pfad genutzt. Wenn keine ausreichende Beschreibung beschafft werden
kann, bietet der ATS-Dialog eine manuelle Eingabe an.

## 2. Bestehende Datenflüsse

- „Mehr anzeigen“ nutzt bereits `fetchJobDetails([slug])` und speichert das
  Ergebnis in `RemainingCard.detailJob`.
- `displayJob` kombiniert den Original-Job mit den nachgeladenen
  Arbeitsagentur-Details, ohne den Original-Job zu überschreiben.
- „Mit ATS bewerten“ übergab bisher direkt `displayJob` an App/`AtsOverlay`.
- `AtsOverlay` sendet `description`/`descriptionPlain` an
  `/api/ats-analysis`; die bestehende ATS-Logik blieb unverändert.
- PR #21 (Übersetzung) ist nicht Teil dieses Branches; die Übersetzungsfunktion
  wurde nicht verändert.

## 3. Beschreibungsqualität

Es wird nicht allein die Textlänge geprüft. Die vorhandene
`evaluateDescription()`-Logik aus `src/lib/jobDescriptionReview.ts` liefert
`sufficient`/`limited`/`missing` anhand von:

- Aufgaben-/Anforderungssignalen
- Platzhalter-/Wiederholungs-/Marketing-Erkennung
- Mindestinhalt/Struktur

Die gemeinsame Prüfung liegt in `src/lib/atsJobHandoff.ts`
(`hasSufficientJobDescription`).

## 4. Automatisches Nachladen

In `RemainingCard` und `MatchCard`:

1. Ausreichende Beschreibung → direkt an ATS.
2. Kurze Beschreibung einer Arbeitsagentur-Anzeige → vorhandener
   `fetchJobDetails`-Pfad.
3. Erfolgreich nachgeladen → `AtsOverlay` erhält den vollständigen
   Originaltext mit `descriptionOrigin="reloaded"`.
4. Fehlgeschlagen/nicht verfügbar → ATS-Dialog erhält den Original-Job und
   bietet die manuelle Eingabe an.
5. Doppelte parallele Anfragen werden in `RemainingCard` über eine
   gemeinsame Promise-Referenz und in `MatchCard` über einen synchronen
   Loading-Ref verhindert.
6. Bereits geladene `detailJob`-Daten werden wiederverwendet.

Es wurde **keine neue API** und keine zweite Fetch-Architektur eingeführt.
Der bestehende `/api/job-details`-Pfad bleibt unverändert.

## 5. Manueller Fallback im ATS-Dialog

`AtsOverlay` bietet bei `descriptionSufficient === false`:

- „Stellenbeschreibung manuell einfügen“
- mehrzeiliges Textfeld (maximal 20.000 Zeichen)
- „Mit dieser Beschreibung bewerten“
- „Abbrechen“
- Validierung für leeren/zu langen Text
- Hinweis: Der Text wird nur für diese ATS-Bewertung verwendet und nicht
  gespeichert.

Der manuell eingegebene Text wird ausschließlich in einem lokalen
`jobForAnalysis`-Clone an `/api/ats-analysis` übergeben. `job.description`,
`job.descriptionPlain`, die Original-URL und alle übrigen Jobdaten bleiben
unverändert.

## 6. Bewertungszustände und Herkunft

Intern unterscheidbar:

- `original` — vollständige Originalbeschreibung war vorhanden
- `reloaded` — Originalbeschreibung wurde nachgeladen
- `manual` — manuell eingefügter Text

Bei unvollständiger Beschreibung zeigt der Dialog keine irreführende
vollständige Bewertung, sondern „Beschreibung unvollständig“ und den manuellen
Einstieg. `analysisStatus` und `basis` der bestehenden ATS-API bleiben
unverändert in Verwendung.

## 7. ATS-/Übersetzungs-Isolation

- ATS erhält bei normalem Pfad das vollständige Original.
- Manuell eingefügter Text ist ein separater Analyse-Clone.
- Es wird keine deutsche Übersetzung als ATS-Eingabe verwendet.
- Es gibt keine zusätzliche Übersetzungsanfrage beim ATS-Klick.
- `api/_lib/ats.mjs` und `api/ats-analysis.mjs` wurden nicht verändert.
- Keine Änderung an Übersetzungsprovider, CV-Parser, CV-Persistenz,
  Suchprofil-Persistenz, RIS, AWS oder Cognito.

## 8. Tests

### Fokussiert

```text
npx vitest run src/components/AtsOverlay.test.tsx src/components/RemainingCard.test.tsx src/components/MatchCard.test.tsx
```

Ergebnis: **40 PASS**

Abgedeckt:

- vollständige Beschreibung → kein Nachladen
- kurze Arbeitsagentur-Beschreibung → Nachladen
- nachgeladene Beschreibung → ATS-Übergabe
- fehlgeschlagenes Nachladen → manuelle Eingabe
- manuelle Beschreibung → ATS erhält eingefügten Text
- Original-Job bleibt unverändert
- keine doppelten parallelen Nachladeanfragen
- unvollständige Beschreibung → keine irreführende Bewertung
- ATS-Original bleibt von Übersetzung/Anzeige getrennt
- bestehende HTML-/Detail-/Sicherheitstests

### Build

```text
npm run build
```

Ergebnis: **PASS**

### Gesamtsuite

```text
npx vitest run --no-file-parallelism
```

Ergebnis: **1901 PASS / 11 skipped / 4 skipped files**

## 9. Git-Commits

- `27bae97` — `feat(ats): load full job description before evaluation`
- `9ebe784` — `feat(ats): add manual description fallback`
- `f4060a7` — `feat(ats): reuse description handoff in match cards`
- `0155872` — `refactor(ats): share description readiness check`
- Dokumentations-Commit folgt separat.

Feature-Branch gepusht. Kein Merge, kein Production-Deployment.

## 10. Bekannte Einschränkungen

- Automatisches Nachladen ist nur für Quellen verfügbar, für die der
  bestehende Job-Details-Pfad Daten liefert (aktuell Arbeitsagentur).
  Andere Quellen öffnen den ATS-Dialog mit manueller Eingabe.
- Die Qualitätsprüfung ist eine bestehende Heuristik und ersetzt keine
  inhaltliche Prüfung der Anzeige.
- Es werden keine zusätzlichen Datenquellen oder Provider eingeführt.
- Keine Änderung an der fachlichen ATS-Scoring-Logik.

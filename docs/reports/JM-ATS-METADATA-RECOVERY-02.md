# JM-ATS-METADATA-RECOVERY-02

**Status:** `IMPLEMENTED / VERIFIED LOCAL / SERIAL FULL GREEN — PARALLEL TEST FLAKE OUTSIDE ATS — NO MERGE/DEPLOY`

**Date:** 2026-11-16  
**Repository:** `maynowak/mays-jobsearch`  
**Branch:** `feature/jm-ats-metadata-recovery-02`  
**Baseline:** `origin/main` `464783b936647b281df63d6dd8c18b15ad732aa3`  
**Predecessors:** `JM-ATS-GIT-RECOVERY-01`, `JM-ATS-MATCHING-QUALITY-01`

## 1. Ziel

Die ATS-Analyse soll fachliche Stellenanforderungen von Rollenbezeichnungen,
Arbeitsmodellen, Sprachcodes, Beschäftigungsdaten und Platzhaltern trennen. Die
vollständige Beschreibungsextraktion aus `JM-ATS-MATCHING-QUALITY-01` bleibt
erhalten. Keine neue ATS-Architektur, kein Rollback, keine RIS-/AWS-Änderung.

## 2. Historische Ursache

`4fb852b` (2026-10-14, Single-Parent-Commit, kein Merge) entfernte aus
`METADATA_PATTERNS`:

```diff
- /\b(software|engineer|developer|architect)\b/i
+ /\bsoftware\b/i
```

Dadurch wurden `architect`, `engineer` und `developer` wieder als
Titel-Requirements extrahiert. `c186619` hatte diese Rollen noch gefiltert.
`464783b` (PR #19) hat diese Änderung nicht verursacht und nicht rückgängig
gemacht.

## 3. Wiederverwendete Logik

- `c186619`: `METADATA_PATTERNS` und `isTechnicalSkill()` für Titel-/Tag-Rollen.
- `e9d47d2`: technische Allowlist, Vollbeschreibung, `calculateRoleMatch`,
  `analysisStatus`.
- `src/lib/jobMeta.ts`: `CONTRACT_TYPE_NO_DATA` / `KEINE_ANGABE`-Semantik.
- `api/_lib/filter.mjs`: bestehende Tokenisierung.

Kein Cherry-Pick, kein pauschaler Revert, keine CV-Parser-Änderung.

## 4. Änderungen

### `api/_lib/ats.mjs`

- Titel-Tokens erzeugen keine Requirements mehr; sie bleiben über
  `metadata.titleTokens` und `roleMatch` verfügbar.
- `architect`, `engineer`, `developer`, `software`, `solutions` und weitere
  Rollen werden als Metadaten behandelt.
- `remote`, `(remote)`, `onsite`, `hybrid`, `homeoffice` werden nicht als
  Requirements geführt.
- Sprachcodes `de`/`en` werden nicht als technische Skills geführt.
- `full_time`, `part_time`, `Vollzeit`, `Teilzeit`, Vertragsarten werden nicht
  als Requirements geführt.
- `KEINE_ANGABE`, `NONE`, `NO_INDICATION`, `NICHT_ANGEGEBEN`, `Unknown`, `N/A`
  werden verworfen.
- Tags mit generischen Abteilungs-/Platzhalterwerten werden gefiltert.
- Fachliche Begriffe wie `DevOps`, `Cloud`, `Terraform`,
  `Software Architecture`, `Cloud Architecture` bleiben erhalten.
- Neue `extractJobMetadata()`-Funktion für Sprache, Arbeitsmodell,
  Beschäftigung und Vertragsart.
- `EXPERIENCE_PATTERN` wird pro Aufruf als frische globale Regex verwendet;
  `extractAgeRequirements()` verwendet ebenfalls `matchAll` statt einer
  nicht-fortschreitenden `while/exec`-Schleife.

### `api/ats-analysis.mjs`

- `source` wird im Requirement-Response erhalten.
- `metadata` wird optional im Response ergänzt.
- Bestehende Response-Felder und der Endpunkt bleiben unverändert.
- Kein neues Scoring für Metadaten; bestehende `workmodeMatch`- und
  `employmentMatch`-Semantik bleibt erhalten.

### `src/components/AtsOverlay.tsx`

- `renderRequirements()` ist die einzige vollständige Requirement-Liste.
- Aktionen für nicht belegte technische Anforderungen stehen direkt in der
  zentralen Liste.
- `renderGaps()` ist nur noch eine Zusammenfassung mit Count, keine zweite
  Keyword-Liste.
- `renderTips()` enthält Counts statt erneut alle Keywords.
- Neue Sektion „Stellenkontext“ zeigt Arbeitsmodell, Sprache, Beschäftigung
  und Vertragsart separat.
- Bestehende ATS-Bewertung, Rollenabgleich, Accessibility und Modal-Struktur
  bleiben erhalten.

## 5. Vorher/Nachher

Synthetischer Acceptance-Job:

```text
Titel: Solutions Architect (Remote)
Tags: DevOps, (remote), Cloud, Unknown, N/A
Beschreibung: We need DevOps, Cloud, Terraform and Software Architecture.
Sprache: de
Arbeitsmodell: onsite
Beschäftigung: full_time
Vertragsart: KEINE_ANGABE
```

### Vorher

Requirements enthielten unter anderem:

```text
solutions, architect, (remote), DevOps, Cloud, de, onsite, full_time, KEINE_ANGABE
```

### Nachher

```json
{
  "metadata": {
    "titleTokens": ["solutions", "architect", "(remote)"],
    "language": "de",
    "workMode": "onsite",
    "jobTypes": ["full_time"],
    "contractType": null,
    "contractTypeNoData": true
  },
  "requirements": [
    {"text": "DevOps", "source": "tags"},
    {"text": "Cloud", "source": "tags"},
    {"text": "Terraform", "source": "description"},
    {"text": "Software Architecture", "source": "description"}
  ],
  "analysisStatus": "complete",
  "roleMatch": 100,
  "requirementCount": 4
}
```

Damit sind `architect`/`solutions` Rolleninformation, `remote`/`onsite`
Arbeitsmodell, `de` Sprachmetadatum und `KEINE_ANGABE` ein verworfener
Platzhalter.

## 6. Tests

### Fokussiert

```text
npx vitest run tests/api/ats-extraction.test.js tests/api/ats-analysis.test.js src/components/AtsOverlay.test.tsx
```

Ergebnis: **3 Test Files, 88 Tests PASS**.

Abgedeckt:

- Rollenfilter für `architect`, `engineer`, `developer`
- Workmode-, Sprach- und Beschäftigungsausschluss
- Platzhalter `KEINE_ANGABE`, `Unknown`, `N/A`
- Erhalt von `DevOps`, `Cloud`, `Terraform`, `Software Architecture`
- `source` im API-Response
- `metadata` separat und keine Metadaten in Requirements
- keine dreifache Requirement-Darstellung
- `5+ years experience`, `3 years experience`, mehrere Angaben, keine Angabe
- Education-Regex terminiert

### Build

```text
npm run build
```

Ergebnis: **PASS**.

### Gesamtsuite

```text
npx vitest run --no-file-parallelism
```

Ergebnis: **1896 PASS, 11 skipped, 4 skipped files**.

Hinweis: `npx vitest run` (parallele Dateiausführung) zeigte zwei Flakes in
`CvBuilderEditorRisStorage.test.tsx` und `ManualSearchProfiles.integration.test.tsx`.
Beide Dateien enthalten keine ATS-Änderungen; beide liefen isoliert PASS
(12/12 und 8/8). Die serielle Gesamtsuite ist grün. Die parallele Flake-Stabilität
ist ein separates Test-Isolationsthema und wird nicht als ATS-Erfolg gewertet.

## 7. Git-Commits

- `711a823` — `fix(ats): separate job metadata from requirements`
- `ceefa6f` — `fix(ats): expose requirement source and job metadata`
- `3d66f62` — `fix(ats): consolidate requirement view and show job metadata`
- `d6b2669` — `fix(ats): terminate experience and education regex scans`

Dokumentations-Commit folgt separat.

## 8. Bekannte Einschränkungen

- `titleRequirementCount` zählt weiterhin alle Titel-Tokens inkl.
  `(remote)`; er dient nur der Transparenz und geht nicht in den Score ein.
- Die technische Allowlist bleibt konservativ. Nicht gelistete Technologien
  werden weiterhin nicht geraten.
- Ein vollständiger externer Stellenanzeigen-Fixture ist nicht eingecheckt.
- Die parallele Gesamttestsuite hat die oben genannten, ATS-fremden Flakes.
- Kein Merge, kein Production-Deployment, keine RIS-/AWS-/Cognito-Änderung.

## 9. Sicherheits-/Privacy-Abgrenzung

Keine neue Datenquelle, kein neuer Modellaufruf, keine neue Persistenz. Die
Änderung ist deterministisch und arbeitet auf den bereits übertragenen
Jobdaten. Keine RIS-, AWS-, Cognito-, CV-Parser-, CV-Persistenz- oder
Suchprofil-Persistenzänderung.

# JM-JOB-TRANSLATION-ATS-INTEGRATION-01

**Status:** `A — MERGED / PRODUCTION E2E VERIFIED`

**Date:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Final `origin/main`:** `17ffec8fd09231d67fd2567a8c0b8782659f8191`

## 1. Merge-Ergebnis

| PR | Zweck | Merge-SHA |
|---|---|---|
| #21 | Deutsche Lesefassung für englische Stellenanzeigen | `8456910a9ae64f51ec4a33ea1e9e82068f82bfff` |
| #23 | ATS Description Handoff | `ad3aff4a56d25b7a8231f0e791937a10281e09ee` |
| #24 | Integration-Fix: Übersetzung erst nach sichtbarer AA-Beschreibung | `17ffec8fd09231d67fd2567a8c0b8782659f8191` |

PR #24 war erforderlich, weil die Production-E2E zeigte, dass bei einer kurzen
Arbeitsagentur-Anzeige der Übersetzungsschalter sichtbar war, bevor die
Beschreibung selbst dargestellt wurde. Die Korrektur bindet den Schalter an
`detailJob`:

```ts
const canTranslate =
  (!isAA || Boolean(detailJob)) &&
  descriptionLang === "en" &&
  (descriptionPlain.trim() || description.trim()).length > 0;
```

## 2. Konfliktauflösung

PR #23 wurde nach PR #21 mit aktuellem `origin/main` zusammengeführt.

Konflikte:

- `src/components/RemainingCard.tsx`
  - Imports zusammengeführt: `useEffect`, `useRef`, `useState`,
    `translateJobDescription`, `hasSufficientJobDescription`.
  - State kombiniert: Übersetzungszustand + ATS-Loading/Detail-Promise.
  - Übersetzung bleibt reiner Anzeigezustand; ATS-Handoff nutzt `displayJob`
    bzw. nachgeladene Details.
- `src/components/RemainingCard.test.tsx`
  - Beide Testsätze erhalten: Translation-Cache/Original/Fehler und
    Auto-Reload/Manual-Fallback/ATS-Original.
- `docs/AI_AUDITLOG.md`
  - Beide Einträge (Translation und ATS Handoff) vollständig erhalten.

Automatisch zusammengeführt:

- `src/i18n.tsx`
- `src/styles.css`
- `api/job-details.mjs`
- `src/api.ts`
- `tests/api/job-translation.test.js`
- `docs/reports/JM-JOB-TRANSLATION-01.md`

Keine Datei wurde blind durch eine Seite ersetzt. Keine Änderung an
`api/_lib/ats.mjs` oder `api/ats-analysis.mjs`.

## 3. Test- und Build-Nachweise

### Nach der Integration

```text
npx vitest run src/components/RemainingCard.test.tsx \
  src/components/MatchCard.test.tsx \
  src/components/AtsOverlay.test.tsx \
  tests/api/job-translation.test.js \
  tests/api/ats-extraction.test.js
# 114 PASS

npm run build
# PASS

npx vitest run --no-file-parallelism
# 1913 PASS / 11 skipped
```

### Nach dem Integration-Fix (#24)

```text
npx vitest run src/components/RemainingCard.test.tsx
# 20 PASS

npm run build
# PASS

npx vitest run --no-file-parallelism
# 1914 PASS / 11 skipped
```

## 4. Production-Deployment

Beide Domains liefern Build `17ffec8`:

- https://www.mays-job-matcher.app
- https://mays-jobsearch.vercel.app

Live-Bundle enthält:

- „Deutsch lesen“
- „Stellenbeschreibung manuell einfügen“
- „Vollständige Stellenbeschreibung wird geladen …“

Vercel Production Status für Merge `17ffec8`: **SUCCESS**. Kein manuelles
Production-Deployment.

## 5. Production-E2E

Ausschließlich synthetische Daten; keine echten Bewerberdaten.

### 5.1 Übersetzung

Synthetische englische Anzeige:

```text
English role with AWS and TypeScript for a platform team.
```

Aktion: „Deutsch lesen“ → „Original anzeigen“.

Ergebnis:

- echter Provider-Aufruf über `/api/job-details`
- HTTP 200
- deutsche Fassung sichtbar
- „Original anzeigen“ stellt den Originaltext sofort wieder her
- technische Begriffe AWS/TypeScript blieben erhalten
- erneuter Wechsel verwendete den lokalen Cache
- genau **1** Übersetzungsaufruf im erfolgreichen E2E-Lauf
- keine Console Errors

Ein früherer isolierter Provider-Aufruf antwortete einmalig mit 502
`model_unavailable`; der nächste Versuch war erfolgreich. Die UI zeigt in
diesem Fall den Originaltext und eine verständliche Fehlermeldung.

### 5.2 ATS-Handoff

Synthetische Arbeitsagentur-Anzeige mit Kurzbeschreibung:

- „Mit ATS bewerten“
- vorhandener `/api/job-details`-Pfad lud die vollständige Originalbeschreibung
- ATS-Dialog zeigte **„Beschreibungsquelle: Nachgeladenes Original“**
- Bewertung: **40/100**, Anforderungsabdeckung 40 %
- Requirements enthielten AWS, Terraform, Kubernetes, TypeScript und
  `3+ years`
- Metadatenfilter blieben aktiv (`onsite`, `en`, `full_time` separat)
- kein manueller Fallback nötig
- keine ATS-Originaltext-Regression
- keine Console Errors

### 5.3 Manueller Fallback

Synthetische Anzeige ohne ausreichende Beschreibung:

- ATS-Dialog zeigte „Beschreibung unvollständig“
- „Stellenbeschreibung manuell einfügen“ war verfügbar
- synthetischer Text wurde eingefügt und mit ATS bewertet
- Dialog zeigte **„Beschreibungsquelle: Manuelle Eingabe“**
- keine ursprünglichen Jobdaten wurden überschrieben
- keine Console Errors

### 5.4 Gemeinsamer Ablauf

```text
Englische Anzeige → Deutsch lesen → Original anzeigen → Mit ATS bewerten
```

Ergebnis:

- Übersetzung funktioniert
- Original kehrt zurück
- ATS erhält die vollständige Originalbeschreibung
- Übersetzung wird nicht als ATS-Eingabe verwendet
- keine doppelten Lade-/Übersetzungsanfragen im erfolgreichen Ablauf
- ATS-Metadatenfilterung bleibt intakt

Screenshots:

- `integration-02-01-original.png`
- `integration-02-02-translated.png`
- `integration-02-03-ats.png`
- `integration-02-04-manual-prompt.png`
- `integration-02-05-manual-result.png`

(lokal unter `/tmp/opencode/`, keine personenbezogenen Daten)

## 6. Offene Einschränkungen

- Der Free-Model-Provider kann temporär `model_unavailable` liefern. Die UI
  bewahrt dann den Originaltext und zeigt eine Fehlermeldung; ein erneuter
  Versuch kann erfolgreich sein.
- Automatisches Nachladen bleibt auf Quellen beschränkt, für die der
  bestehende Job-Details-Pfad Daten liefert (aktuell Arbeitsagentur).
- Die Beschreibungsqualität verwendet die bestehende Heuristik
  `evaluateDescription()`; sie ersetzt keine redaktionelle Prüfung.
- Keine Änderung an RIS, AWS, Cognito, CV-Parser, CV-Persistenz,
  Suchprofil-Persistenz oder fachlicher ATS-Scoring-Logik.

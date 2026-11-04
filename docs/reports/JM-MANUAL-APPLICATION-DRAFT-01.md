# JM-MANUAL-APPLICATION-DRAFT-01

**Art:** Manuelle Bewerbungsentwürfe / Wiedereinstieg in LetterModal / Session-Versionierung
**Status:** **IMPLEMENTED LOCAL**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-manual-application-draft-01`
**Baseline:** lokaler `main` `99e4105`; `origin/main` `4364eab`

> Kein Push, Merge oder Deployment. Keine RIS-, AWS- oder Cognito-Änderung.
> Keine dauerhafte Speicherung, keine neue KI-Pipeline.

## 1. Git-Baseline

- Ausgangspunkt: lokaler `main` `99e4105`.
- `origin/main`: `4364eab`.
- Neuer Branch: `feature/jm-manual-application-draft-01`.
- Working Tree vor Beginn: clean.
- Bestehende Worktrees geprüft; keine fremden Änderungen überschrieben.
- `docs/AI_AUDITLOG.md` gelesen.

## 2. Entwurfsmodell

Ein Entwurf wird ausschließlich im bestehenden Session-Repository angelegt:

```ts
repository.create({
  job: manualReference,
  coverLetter: "",
});
```

Eigenschaften:

- `SessionApplicationV1` im bestehenden In-Memory-Repository,
- `documents.coverLetterDraft = ""`,
- `documents.coverLetterVersions = []`,
- `documents.documentStatus = "missing"`,
- keine Anschreibenversion,
- keine KI-Anfrage,
- keine dauerhafte Speicherung.

Die stabile `manual:<opaque-id>`-Referenz bleibt erhalten.

## 3. UI

### Neues Formular

`NewApplicationForm` hat jetzt zwei Aktionen:

- **„Anschreiben generieren“** — bestehender Direct-Cover-Letter-Ablauf,
- **„Als Entwurf anlegen“** — nur für authentifizierte Benutzer.

Die Entwurfsaktion:

- validiert dieselbe manuelle Stelle wie die Generierung,
- nutzt dieselbe `buildManualJob`-Logik,
- speichert die Session-Beschreibung,
- erzeugt keine Version,
- startet keine KI-Anfrage.

Gäste sehen die Entwurfsaktion nicht.

### Bewerbungsverwaltung

In den Bewerbungsdetails (Dokumenten-Tab) gibt es für manuelle Bewerbungen:

**„Anschreiben erstellen“**

Ablauf:

1. Session-Eintrag `manual:<id>` in `manualJobSession` suchen.
2. Wenn vorhanden: bestehendes `LetterModal` mit genau dieser Beschreibung öffnen.
3. Wenn nicht vorhanden: `ManualJobDescriptionPrompt` anzeigen.
4. Benutzer gibt die Beschreibung erneut ein.
5. Prompt validiert und speichert die Beschreibung in `manualJobSession`.
6. Erst danach wird das bestehende `LetterModal` geöffnet.

Es wird keine Beschreibung erfunden und keine KI-Anfrage beim Öffnen gestartet.

## 4. Wiedereinstieg und Beschreibungskontext

- Die Beschreibung bleibt session-lokal.
- `manualJobSession` ist der einzige Zwischenspeicher.
- Nach Session-Reset/Identitätswechsel wird er geleert.
- Bei fehlendem Kontext erscheint eine verständliche erneute Eingabe.
- Keine `localStorage`-/IndexedDB-/Backend-Speicherung.
- Nach Reload können Session-Bewerbung und Beschreibung verloren gehen; das
  ist eine bekannte Einschränkung, keine vorgetäuschte Persistenz.

## 5. Versionierung

| Aktion | Ergebnis |
|---|---|
| Entwurf anlegen | keine Version |
| Entwurf erneut öffnen | keine neue Version |
| Anschreiben erstellen | bestehende Bewerbung wird geöffnet |
| Erste Adoption | Version 1 |
| Weitere Adoption | neue Version, Historie bleibt |
| Doppelklick | keine doppelte Mutation |

Die Adoption nutzt weiterhin `findByJob`, `expectedVersion` und
`adoptCoverLetter`.

## 6. Duplikatschutz

- `handleSaveManualDraft` prüft `findByJob`.
- Existiert die Job-ID, wird der vorhandene Entwurf ausgewählt; es wird kein
  zweiter Entwurf erstellt.
- `repository.create` bleibt die zweite Sicherung gegen Duplikate.
- Adoption aktualisiert die bestehende Bewerbung.
- Versionskonflikte werden kontrolliert gemeldet.
- Gäste können keinen Entwurf anlegen.

## 7. Session- und Datenschutzgrenzen

- Keine RIS-Endpunkte.
- Keine neue Datenbank.
- Keine dauerhafte Speicherung.
- Keine automatische Gastdatenmigration.
- Keine KI-Anfrage beim Entwurf.
- Keine Änderung an Consent-/Privacy-Vorbereitung.
- Bestehende Session-Invalidierung bleibt aktiv.

## 8. Tests

### Gesamtsuite

```text
npm test -- --run --maxWorkers=2
```

- **1384 passed**
- **5 skipped**
- **132 Testdateien passed, 3 skipped**

### Gezielte Tests

- `NewApplicationForm`
- `ApplicationsSection.manual`
- `sessionApplications.adoption`

Gezielter Lauf: **26 passed** (3 Dateien).

Abgedeckt:

- Entwurf ohne Anschreiben,
- keine Version beim Entwurf,
- Entwurf mit/ohne URL,
- vorhandener Entwurf ohne Duplikat,
- Wiedereinstieg mit Session-Beschreibung,
- fehlender Kontext → erneute Eingabe,
- erste Version nach späterer Adoption,
- Gast ohne Entwurfsaktion,
- Session-Invalidierung.

### Build / Syntax

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- `node --check tests/e2e/manual-application-draft.mjs` — PASS
- `git diff --check` — PASS

### E2E

Neu:

```text
npm run test:e2e:manual-application-draft
```

- Auth: 1440, 1024, 768, 430, 390, 320
- Gast: 1024, 768, 430, 390, 320
- Entwurf anlegen, Liste/Details, Dokumenten-Tab,
  „Anschreiben erstellen“, LetterModal, Generieren, Adoption, Version 1,
  keine zweite Bewerbung.
- Keine KI-Anfrage beim Entwurf oder Öffnen.
- Keine horizontalen Überläufe; Entwurfs-/Aktionsbuttons ≥ 44 px.

Bestehende E2E:

- Direct Cover Letter — PASS
- Applications — PASS
- Cover Letter — PASS
- CV Builder — PASS
- Search Results — PASS
- Profile/Storage Consent — PASS

Keine echten Provider-, KI-, AWS-, RIS- oder Apify-Aufrufe.

Screenshots:
`docs/reports/assets/JM-MANUAL-APPLICATION-DRAFT-01/` — 11 Dateien.

## 9. Commits

| Commit | Inhalt |
|---|---|
| `4070be2` | Entwurfsaktion, Wiedereinstieg, Description-Prompt, i18n, Styles |
| `3d6faae` | Unit-/Repository-/E2E-Tests und Test-Skript |
| Dokumentationscommit | Report, Auditlog, Screenshots |

## 10. Offene Findings

1. Entwurf und Beschreibung bleiben sessionbezogen; Reload kann beides
   verlieren.
2. Exactly-once über mehrere Tabs/Clients ist nicht garantiert.
3. Kein sicherer Wiedereinstieg nach Reload ohne dauerhafte Beschreibung.
4. RIS-Unterstützung für `jobOrigin: "manual"` und optionale URL bleibt offen.
5. Keine Live-Provider-/RIS-/AWS-Verifikation.
6. Gastbereich der ApplicationsSection bleibt eine bestehende
   Produktentscheidung.

## 11. Abschlussentscheidung

**MANUAL APPLICATION DRAFT: READY für Main-Review.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Kein automatischer Merge, kein Push, kein Deployment, keine
dauerhafte Speicherung, keine RIS-/AWS-/Cognito-Änderungen.**

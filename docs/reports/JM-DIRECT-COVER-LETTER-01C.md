# JM-DIRECT-COVER-LETTER-01C

**Art:** Manuelle Bewerbungsübernahme / Versionierung / Refresh / Navigation
**Status:** **IMPLEMENTED LOCAL — PHASE C COMPLETE**; Adoption für authentifizierte manuelle Stellen freigegeben
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-direct-cover-letter-01c`
**Basis:** Phase B `f4a8e84`; lokaler `main` `7a4a64e`; `origin/main` `4364eab`

> Keine neue KI-Engine, keine zweite Bewerbungsverwaltung, keine RIS-/AWS-/
> Cognito-Änderung, keine dauerhafte Speicherung. Die bestehende
> `/api/cover-letter`-Pipeline, `LetterModal` und Session-Repository werden
> verwendet.

## 1. Git-Baseline

- Ausgangspunkt: `feature/jm-direct-cover-letter-01b`, HEAD `f4a8e84`.
- Neuer Branch: `feature/jm-direct-cover-letter-01c` von `f4a8e84`.
- `main`: `7a4a64e`; `origin/main`: `4364eab`.
- Arbeitsbaum vor Phase C: clean.
- `docs/AI_AUDITLOG.md` gelesen; bestehende Audit- und Sessiongrenzen
  berücksichtigt.

## 2. Adoptionspfad

`src/App.tsx` verwendet weiterhin `handleAdoptLetterAsApplication`.

Ablauf:

1. Aktuellen Repository-Zustand über
   `applicationRepository.findByJob(payload.job.slug)` lesen.
2. Keine Bewerbung gefunden:
   - Session-Bewerbung mit `create` anlegen,
   - erste `CoverLetterVersionV1` im selben Create-Vorgang mitschreiben,
   - `coverLetterDraft` und `documentStatus` setzen.
3. Bewerbung gefunden:
   - `adoptCoverLetter` mit `expectedVersion` aufrufen,
   - neue Version anhängen,
   - aktuellen Entwurf aktualisieren,
   - vorhandene Versionen unverändert erhalten.
4. Nach bestätigter Mutation:
   - `lastAdoptedApplicationIdRef` setzen,
   - App-State aktualisieren,
   - `applicationRefreshToken` erhöhen,
   - Erfolgsstatus setzen.

Es wird keine zweite Bewerbung als Ausweichlösung erzeugt.

## 3. Versionssemantik

`CoverLetterVersionV1` wird aus dem bestehenden Vertrag verwendet:

| Letter-Status | Version Source |
|---|---|
| frisch generiert | `generated` |
| überarbeitet | `revised` |
| manuell bearbeitet | `manual` |

Zusätzlich werden `language` (`de`/`en`) und das aktive `model` gespeichert.
`jobId` ist die stabile manuelle Stellen-ID.

Neue Bewerbung:

- `coverLetterVersions` startet mit genau einer Version.
- Der aktuelle Entwurf entspricht dem übernommenen Text.

Bestehende Bewerbung:

- neue Version wird angehängt,
- bestehende Versionen bleiben erhalten,
- keine historische Version wird überschrieben.

Keine Version entsteht durch:

- Einfügen der Stellenbeschreibung,
- Öffnen des Modals,
- Modellauswahl,
- Generieren,
- Bearbeiten,
- Vorschau.

Erst die ausdrückliche Adoption mutiert das Repository.

## 4. Duplikat- und Konfliktschutz

- `adoptingRef` verhindert Doppelklicks während der Adoption.
- Der Adoptionsbutton ist nach erfolgreicher Adoption deaktiviert.
- Neue Bewerbung nutzt `idempotencyKey: adopt:<jobId>`.
- Bestehende Bewerbung nutzt `expectedVersion`.
- Bei `idempotency_conflict` wird der aktuelle Repository-Zustand erneut
  gelesen und die vorhandene Bewerbung aktualisiert.
- Bei `version_conflict` erscheint eine kontrollierte Fehlermeldung; es wird
  keine zweite Bewerbung erzeugt.
- Session-Ende/Identitätswechsel invalidiert das Repository und verhindert
  verspätete Mutationen.

**Einschränkung:** Vollständige Exactly-once-Semantik über mehrere Tabs oder
gleichzeitige unabhängige Clients ist mit dem In-Memory-Session-Repository
nicht garantiert. Innerhalb der bestehenden Sitzung sind Doppelklick,
`expectedVersion` und Idempotency-Key geschützt.

## 5. Refresh und Navigation

- `ApplicationsSection` erhält `refreshToken`.
- Nach bestätigter Adoption erhöht App den Token; die Liste wird ohne
  Seitenneuladung neu über `repository.list()` geladen.
- `navigationTarget` erlaubt die gezielte Auswahl der neuen/aktualisierten
  Bewerbung und des Tabs.
- `navigationTarget` wird genau einmal angewendet; spätere Repository-
  Aktualisierungen setzen den Tab nicht erneut zurück.
- `LetterModal` bietet nach Adoption:
  - „Meine Bewerbungen öffnen“ → Übersicht,
  - „Dokumente öffnen“ → Dokumenten-Tab.
- Die neue Version ist im bestehenden `ApplicationLetterComparison` sichtbar.

## 6. Session- und Datenschutzsicherheit

- Adoption nur für authentifizierte Benutzer; Gäste behalten Generieren,
  Bearbeiten, Kopieren und Download.
- Keine automatische Gastdatenmigration.
- `manualJobSession` bleibt rein speicherintern und wird bei Identitätswechsel
  geleert.
- Die manuelle Beschreibung wird nicht in `ApplicationV1` gespeichert.
- Keine RIS-/AWS-/Cognito-/Backend-Persistenz.
- Keine neue KI-Engine, keine externe URL-Abfrage.
- Bestehende Anonymisierung, Consent- und Fehlergrenzen bleiben erhalten.
- Die Erfolgsmeldung erscheint erst nach bestätigter Repository-Mutation.

## 7. Gastverhalten

- Gäste können die manuelle Stellenanzeige einfügen und ein Anschreiben
  generieren.
- Die Adoptionsaktion ist für Gäste nicht verfügbar; der bestehende
  Anmelde-Handoff bleibt sichtbar.
- Es gibt keine automatische Anmeldung und keine Übernahme von Gastdaten.

## 8. Optionaler Bewerbungsentwurf (STEP I)

Der bestehende Vertrag und das Session-Repository könnten eine leere
Bewerbung ohne Anschreiben anlegen. In Phase C wird diese Teilfunktion
**nicht** als eigener UI-Ablauf freigeschaltet, weil nach dem Schließen des
Formulars kein sicherer Wiedereinstieg in den Anschreiben-Assistenten für
genau diese manuelle Stelle existiert. Ein solcher Einstieg würde eine
zusätzliche UI-/Navigationsentscheidung benötigen.

Der Befund wird als separates Arbeitspaket dokumentiert; es wurde keine
komplexe neue Entwurfsverwaltung eingeführt.

## 9. Tests

### Vollständige Suite

```text
npm test -- --run --maxWorkers=2
```

Ergebnis:

- **1376 passed**
- **5 skipped**
- **132 Testdateien passed, 3 skipped**

### Neue/angepasste Tests

- `src/lib/applications/sessionApplications.adoption.test.ts`
- `src/components/ApplicationsSection.manual.test.tsx`
- `src/components/LetterModal.test.tsx`
- `tests/e2e/direct-cover-letter.mjs`
- `tests/e2e/applications-dashboard.mjs`

Gezielter Phase-C-Lauf: **112 passed** (5 Dateien).

Abgedeckt:

- neue Bewerbung mit erster Version,
- bestehende Bewerbung mit zusätzlicher Version,
- Erhalt älterer Versionen,
- doppelte Version-ID,
- fremde `jobId`,
- veraltete `expectedVersion`,
- `findByJob`-Lookup,
- Refresh und Dokumenten-Tab,
- manuelle Adoption ohne URL,
- Versionsmetadaten,
- Gast ohne Adoptionsaktion,
- Doppelklick-/Session-Schutz.

### Build / Syntax

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- `node --check tests/e2e/direct-cover-letter.mjs` — PASS
- `git diff --check` — PASS

### E2E

- Direct-Cover-Letter: 1440 Auth (Adoption + Dokumente) sowie
  1024/768/430/390/320 Gast — PASS.
- Applications — PASS (Versionszählung an die neue erste Version angepasst).
- Cover Letter — PASS.
- CV Builder — PASS.
- Search Results — PASS.
- Mobile Navigation — PASS.
- Keine Console-Errors; keine echten Provider-/KI-/AWS-/RIS-/Apify-Aufrufe.

Screenshots:
`docs/reports/assets/JM-DIRECT-COVER-LETTER-01C/` — 13 Dateien.

Hinweis: Die bestehenden E2E-Skripte schreiben in historische
Screenshot-Verzeichnisse. Die dadurch entstandenen fremden Bildänderungen
wurden vor dem Commit zurückgesetzt; nur Phase-C-Evidenz bleibt erhalten.

## 10. Commits

| Commit | Inhalt |
|---|---|
| `a658523` | Adoption, Versionierung, `findByJob`, Refresh, Navigation, Session-Schutz |
| `53da795` | Unit-/Repository-/E2E-Tests und angepasste Versionszählung |
| Dokumentationscommit | Report, Auditlog, Phase-C-Screenshots |

## 11. Offene Findings

1. Exactly-once über mehrere Tabs/Clients ist mit dem In-Memory-Repository
   nicht garantiert; dokumentierte Einschränkung.
2. Manuelle Stellenbeschreibung bleibt session-lokal und geht nach Reload
   verloren; die Oberfläche täuscht keine vollständige Beschreibung vor.
3. Der Verbesserungspfad aus der Bewerbungsverwaltung hat weiterhin keinen
   gespeicherten Stellenbeschreibungskontext.
4. „Als Entwurf anlegen“ bleibt als separates Arbeitspaket offen.
5. RIS-Backend muss `jobOrigin: "manual"` und optionale `originalUrl`
   akzeptieren; keine Serverpersistenz in Phase C.
6. Gastbereich der ApplicationsSection bleibt eine bewusste Phase-B/C-
   Produktentscheidung.
7. Keine Live-Provider-/RIS-/AWS-Verifikation.

## 12. Abschlussentscheidung

**DIRECT-COVER-LETTER-01C: READY für Phase D.**

Die manuelle Adoption für authentifizierte Benutzer ist lokal implementiert,
versioniert, getestet und ohne Seitenneuladung sichtbar. Gäste bleiben von der
Adoption ausgeschlossen.

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Keine automatische Main-Integration, keine dauerhafte
Speicherung, keine RIS-/AWS-/Cognito-Änderungen, kein Merge oder Deployment.**

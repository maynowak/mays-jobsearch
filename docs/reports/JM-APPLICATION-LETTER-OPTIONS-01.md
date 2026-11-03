# JM-APPLICATION-LETTER-OPTIONS-01

**Art:** Anschreiben-Werkstatt / Sprache / Schreibstil / Länge / Bewerbungsverwaltung
**Status:** READY für lokale Main-Integration — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-options-01`
**Baseline:** lokaler `main` `09a6971`; `origin/main` `4364eab`

## 1. Git-Ausgangspunkt

- lokaler `main`: `09a6971`
- `origin/main`: `4364eab`
- neuer Branch: `feature/jm-application-letter-options-01`
- Arbeitsbaum vor Beginn: clean
- Branch aus dem verifizierten lokalen `main`, nicht aus dem älteren Remote-Stand

## 2. API-Vertragsprüfung

Verwendet wird ausschließlich die bestehende Architektur:

```typescript
interface CoverLetterGenerationOptions {
  language: "German" | "English";
  style: "professional" | "warm" | "concise" | "formal";
  length: "short" | "one_page" | "detailed";
  target_roles: string[];
  model?: string | null;
}
```

Der neue Stilwert `formal` wurde kontrolliert ergänzt in:

- `src/lib/coverLetterRequest.ts`
- `api/cover-letter.mjs` (`ALLOWED_STYLES`)
- Prompt-Erzeugung (`STYLE_GUIDANCE` / `LENGTH_GUIDANCE`)
- `LetterModal`-Stilauswahl
- `ApplicationLetterComparison`-Stilauswahl
- DE/EN-Texte
- API-Tests

Kein zweiter KI-Endpunkt, keine neue Provider-Integration.

## 3. Sprache

Neue Auswahl in der KI-Verbesserung:

- Deutsch
- Englisch

Eigenschaften:

- unabhängig von der UI-Sprache,
- Standardwert ist die aktuelle UI-Sprache beim Öffnen bzw. beim Bewerbungswechsel,
- eine gespeicherte Ausgangsversion mit `language: "de"` oder `"en"` setzt einen passenden Anfangswert,
- fehlende Metadaten werden nicht erfunden,
- Sprachwechsel löst keinen KI-Aufruf aus,
- Sprachwechsel setzt die Einwilligung zurück und verwirft eine alte Vorschau,
- neue Versionen speichern die ausgewählte Anschreibensprache (`de`/`en`).

## 4. Schreibstil

Anzeige | API-Wert
---|---
Professionell | `professional`
Persönlich & freundlich | `warm`
Kurz & prägnant | `concise`
Klassisch & formell | `formal`

Der Stil `formal` ist backendseitig validiert und im Prompt als sachlicher,
zurückhaltender Stil für öffentlichen Dienst, Behörden, Verwaltung und
konservative Unternehmen beschrieben. Übertriebene Eigenwerbung und künstlich
komplizierte Verwaltungssprache werden ausdrücklich ausgeschlossen.

`professional` bleibt unverändert; `formal` ist kein bloßes UI-Label.

## 5. Länge

- Kurz → `short`
- Eine Seite → `one_page`
- Ausführlich → `detailed`

Die Länge wird ausschließlich als Anfrageoption übergeben. Es gibt keine lokale
Kürzung oder Abschneidung gespeicherter Texte. Der Prompt verbietet ausdrücklich,
fehlende Inhalte oder Qualifikationen zur Füllung der Länge zu erfinden.

## 6. Oberfläche

Die Verbesserungskarte enthält jetzt:

1. Sprache des Anschreibens
2. Art des Anschreibens
3. Gewünschte Länge
4. KI-Modell
5. Verbesserungswunsch
6. Einwilligung
7. „Verbesserung vorschlagen“

Die Optionen liegen in einem responsiven 2-Spalten-Raster; unter 560 px
einspaltig. Selects haben mindestens 44 px Höhe. Der bestehende Dialog- und
Kartenstil bleibt erhalten.

## 7. Consent und Session-Sicherheit

- Einwilligung bleibt vor jedem KI-Aufruf erforderlich.
- Änderungen an Modell, Sprache, Stil, Länge oder Ausgangsversion setzen die
  Einwilligung zurück.
- Eine vorhandene Vorschau wird bei relevanten Kontextänderungen verworfen.
- Der Request-Sequence-Schutz verhindert, dass verspätete Antworten nach einer
  Kontextänderung eine neue Vorschau setzen.
- Bewerbungswechsel und Session-Wechsel invalidieren weiterhin laufende
  Anfragen.
- Doppelklick-/Save-/Adopt-Schutz bleibt erhalten.
- Keine automatische Speicherung, keine neue Persistenz.

## 8. Versionierung

- Historische Versionen bleiben unverändert.
- Eine neue Version entsteht weiterhin erst nach ausdrücklicher Bestätigung.
- Die ausgewählte Anschreibensprache wird in der neuen Version gespeichert.
- Schreibstil und Länge sind reine Anfrageoptionen und werden **nicht** als
  historische Metadaten gespeichert; dafür wurde keine Schemaerweiterung
  vorgenommen.
- Text-Diff, manuelle Bearbeitung und Entwurfsübernahme bleiben unverändert.

## 9. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1328 passed, 5 skipped** |
| Testdateien | 123 passed, 3 skipped |
| API `/api/cover-letter` | **25 passed** |
| ApplicationLetterImprovement | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Applications-E2E 1440/390 | PASS |
| Applications responsive 1024/768/430/320 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Console-Errors | keine |
| Echte Provider-/KI-/AWS-/RIS-/Apify-Aufrufe | keine |

Gezielt geprüft:

- Deutsch → `German`, Englisch → `English`
- deutsche UI + englischer Brief
- englische UI + deutscher Brief
- alle vier Stilwerte
- alle drei Längenwerte
- Optionswechsel ohne automatischen KI-Aufruf
- Einwilligung erforderlich und wird bei Optionswechsel zurückgesetzt
- Request enthält die gewählten Werte
- gespeicherte Version enthält die gewählte Sprache
- alte Version bleibt unverändert
- verspätete Antworten werden nach Kontextwechsel verworfen
- Mobile/Responsive ohne Overflow

## 10. Screenshots

Unter `docs/reports/assets/JM-APPLICATION-LETTER-OPTIONS-01/`:

- `desktop-1440-options.png`
- `mobile-390-options.png`

Die Screenshots zeigen die ausgewählten Werte Englisch, Klassisch & formell,
Kurz und Mock Model sowie die Einwilligung.

## 11. Offene Findings

- Schreibstil und Länge werden nicht historisch versioniert; das bestehende
  Datenmodell speichert nur die Sprache. Keine Schemaerweiterung in diesem
  Schritt.
- Die bestehende Applications-Navbar-Ausnahme aus `JM-NAV-SCROLL-UX-02` bleibt
  unverändert.
- Keine Änderung an RIS, AWS, Auth oder Persistenz.
- **PRODUCTION: weiterhin BLOCKED.**

## 12. Git

- Implementierung: `3e10171` — `feat: add cover letter improvement options`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-application-letter-options-01`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 13. Abschlussentscheidung

**APPLICATION-LETTER-OPTIONS-01: READY für lokale Main-Integration.**

Sprache, Stil inklusive `formal`, Länge, Modell und Verbesserungswunsch werden
explizit an die bestehende Revision übergeben. Consent, Anonymisierung,
Versionierung und Session-Schutz bleiben erhalten.

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP nach diesem Schritt. Keine automatische Main-Integration, kein Push, kein Deployment.**

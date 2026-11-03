# JM-APPLICATION-LETTER-REVISION-01C

**Art:** Anschreiben-Versionierung / Text-Diff / manuelle Vorschlagsbearbeitung
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment, keine Übernahme/Speicherung
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-revision-01c`
**Ausgangsstand:** 01B `e0f513e`
**Grenzen:** Keine neue Persistenz, keine neue API, keine neuen Provider, kein Merge/Deployment.

## 1. Text-Diff

Neu:

- `src/lib/textDiff.ts`
- `src/lib/textDiff.test.ts`

Der Diff arbeitet wortbasiert über die vollständige Ausgangsfassung und den
vollständigen KI-Vorschlag:

- unveränderte Wörter → `equal`
- entfernte Wörter → `removed`
- hinzugefügte Wörter → `added`
- Anzahl beibehalten/hinzugefügt/entfernt
- Anzahl zusammenhängender Änderungsstellen
- Schutz vor übermäßig großen Diff-Matrizen durch vereinfachten Fallback

Die Darstellung verwendet semantische `<del>`-/`<ins>`-Elemente und sichere
React-Textknoten, kein `dangerouslySetInnerHTML`.

## 2. Manuelle Überarbeitung

Der KI-Vorschlag ist im Vorschau-Bereich als editierbares Textfeld vorhanden:

- vollständiger Vorschlagstext
- Auto-Grow über `scrollHeight`
- Änderungen am Vorschlag aktualisieren den Diff unmittelbar
- Originaltext und gespeicherte Versionen bleiben unverändert
- keine automatische Übernahme in `coverLetterDraft`
- keine automatische neue `coverLetterVersions`-Version

## 3. Zustand und Sicherheit

- Der Vorschlag bleibt ausschließlich React-UI-State.
- Keine Repository-Mutation und keine neue Browser-Persistenz.
- `requestSeqRef`/`inFlightRef` aus 01B schützen weiterhin vor verspäteten
  Antworten und Doppelklicks.
- Bewerbungs-/Ausgangsfassungs-/Unmount-Wechsel verwerfen den Vorschlag.
- Der bestehende Consent-, Anonymisierungs- und Provider-Fallback-Pfad bleibt
  unverändert.
- „Erneut verbessern“ startet nur nach ausdrücklicher Aktion eine neue Anfrage.
- „Vorschlag verwerfen“ entfernt nur den temporären Zustand.

## 4. UI

Im Dokumente-Tab, im bestehenden 01B-Bereich:

- Originalfassung vollständig links
- editierbarer KI-Vorschlag rechts
- mobil untereinander
- Zusammenfassung „Änderungen“ mit Zählern
- vollständige Diff-Darstellung unter den beiden Fassungen
- Buttons „Erneut verbessern“ und „Vorschlag verwerfen“

Keine Diff-Hervorhebung als alleinige Information; Zähler und Text bleiben
zugänglich. Sehr lange Texte bleiben vollständig lesbar.

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| TextDiff | **4 passed** |
| ApplicationLetterImprovement | **8 passed** |
| ApplicationLetterComparison | **6 passed** |
| ApplicationsSection | **31 passed** |
| Gesamtsuite (`npm test -- --run`) | **1241 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| AI/Comparison responsive 1024 / 768 / 320 | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/Provider-/Backend-Aufrufe | keine |

Abgedeckt:

- unveränderte/entfernte/hinzugefügte Wörter
- vollständig ersetzter und leerer Text
- Zeilenumbrüche/Sonderzeichen
- Diff-Aktualisierung während manueller Bearbeitung
- No-Changes-Zustand
- Original bleibt unverändert
- Verwerfen
- verspätete Antwort/Bewerbungswechsel
- keine Versionierung/Repository-Mutation

## 6. Screenshots

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/desktop-1440-diff.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/desktop-1440-edited.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/mobile-390-diff.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01C/mobile-390-edited.png`

Synthetische Texte; keine echten Bewerberdaten.

## 7. Git

- Implementierung: `efc4634`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-letter-revision-01c`
- `main` bleibt `4364eab`
- Kein Push, Merge oder Deployment

## 8. Offene Punkte

- 01D Übernahme/Speicherung als neue Version nicht implementiert.
- Keine KI-Diff-Hervorhebung durch einen externen Dienst.
- Live-Provider-Test bleibt separat freizugeben.

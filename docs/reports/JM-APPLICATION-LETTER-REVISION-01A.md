# JM-APPLICATION-LETTER-REVISION-01A

**Art:** Anschreiben-Versionierung / Versionsauswahl / Vergleichsansicht
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment, keine KI-Integration
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-revision-01a`
**Ausgangsstand:** lokaler `main` @ `4364eab` (enthält UX-04A–E, UX-05A/B und Full-Display-Fix)
**Grenzen:** Keine neue Persistenz, keine Provider-/KI-Aufrufe, keine RIS-/AWS-/Cognito-Änderung, kein Deployment.

## 1. Komponente

Neu:

- `src/components/ApplicationLetterComparison.tsx`
- `src/components/ApplicationLetterComparison.test.tsx`

Die Komponente ist rein lesend und wird im bestehenden Tab **Dokumente** unter
den vorhandenen Versionsdetails eingebunden.

## 2. Datenmodell

Verwendet unverändert:

```typescript
interface CoverLetterVersionV1 {
  versionId: OpaqueId;
  jobId: OpaqueId;
  createdAt: ISODateTime;
  content: string;
  source: "generated" | "revised" | "manual";
  language?: "de" | "en";
  model?: string;
}
```

Keine zusätzliche Datenstruktur, kein neues Repository-Feld und keine
Mutation. Vergleichsauswahl ist ausschließlich React-UI-State.

## 3. Vergleichslogik

- Linke Auswahl: **Ausgangsversion**
- Rechte Auswahl: **Vergleichsversion**
- Auswählbar:
  - aktueller Entwurf
  - jede vorhandene gespeicherte Version
- Standard: aktueller Entwurf gegen die neueste gespeicherte Version.
- Bei keiner Version: Hinweis und vollständige Anzeige des aktuellen Entwurfs.
- Bei nur einer Version: Vergleich Entwurf ↔ Version.
- Bei gleicher Auswahl beider Seiten: Hinweis „Beide Seiten zeigen dieselbe Fassung.“
- Bewerbungswechsel/Versionsänderung setzt die Auswahl auf Entwurf und neueste
  Version zurück.
- Keine Version wird erzeugt, gespeichert, übernommen oder verändert.

## 4. Metadaten

Gespeicherte Versionen zeigen:

- Anzeigeindex/Version
- Erstellungsdatum
- Herkunft:
  - KI-generiert (`generated`)
  - Überarbeitet (`revised`)
  - Manuell gespeichert (`manual`)
- Sprache, sofern vorhanden
- Modell, sofern vorhanden
- vollständige `versionId` als tatsächliche Identifikation

Der aktuelle Entwurf ist ausdrücklich **nicht als Version gespeichert** markiert.

## 5. Vollständige Lesbarkeit

- `<pre>` mit `white-space: pre-wrap` und `overflow-wrap: anywhere`.
- Keine feste Höhenbegrenzung und kein verstecktes Clipping.
- Lange Texte, Absätze, Leerzeilen und Sonderzeichen bleiben vollständig
  sichtbar.
- Kein `dangerouslySetInnerHTML`; ausschließlich sichere Textdarstellung.
- Desktop zwei Spalten; ≤900 px untereinander; ≤480 px Metadaten einspaltig.

## 6. Session-Sicherheit

- Vergleich liest ausschließlich die bereits im ausgewählten
  `SessionApplicationV1` vorhandenen Daten.
- Keine Repository-Anfrage, keine Mutation, kein `expectedVersion`-Write.
- Keine Änderung an `AbortSignal`, `invalidate()`, Session-Generation,
  Auth-Wechsel-/Stale-Schutz.
- Keine neue Browser-Persistenz.
- Keine Anschreibeninhalte in Logs/Telemetrie.
- Bei Bewerbungs-/Session-Wechsel werden alte Vergleichstexte nicht
  weiterverwendet.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationLetterComparison | **6 passed** |
| ApplicationsSection | **31 passed** |
| Gesamtsuite (`npm test -- --run`) | **1229 passed, 5 skipped** |
| TypeScript (`npx tsc --noEmit -p tsconfig.app.json`) | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| Vergleichs-responsive 1024 / 768 / 320 | PASS, kein Overflow |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/Provider-/Backend-Aufrufe | keine |

Abgedeckt:

- keine Version / eine Version / mehrere Versionen
- Entwurf gegen Version
- zwei beliebige Versionen
- gleiche Version
- Metadaten und fehlendes Modell
- lange Texte/Sonderzeichen/leerer Entwurf
- Bewerbungswechsel
- keine Repository-Mutation
- bestehende Version-Speichern-, Export- und Tab-Abläufe

## 8. Screenshots

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/desktop-1440-current-vs-version.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/desktop-1440-two-versions.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/desktop-1440-selectors.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/mobile-390-current-vs-version.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/mobile-390-two-versions.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01A/mobile-390-selectors.png`

Synthetische Anschreiben und Daten; keine echten Bewerberdaten.

## 9. Git

- Implementierung: `4d9e8e7`
- Responsive-E2E: `54f7fc2`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-letter-revision-01a`
- `main` bleibt `4364eab`
- Kein Push, Merge oder Deployment

## 10. Offene Punkte

- Keine KI-Verbesserung (01B).
- Keine Änderungs-/Diff-Hervorhebung (01C).
- Keine Versionsübernahme (01D).
- Live-Verifikation nach Deployment.

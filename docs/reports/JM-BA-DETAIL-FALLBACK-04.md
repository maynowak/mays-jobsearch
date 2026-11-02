# JM-BA-DETAIL-FALLBACK-04

**Art:** BA-Detailnachladen / Fehler-Fallback / Originalanzeige-Link
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment, keine echten Apify-Runs
**Datum:** 2026-11-02
**Baseline:** `main` @ `fc84d20`, `origin/main` synchron

## 1. Ausgangsverhalten

„Mehr anzeigen“ bei BA-Jobs:

1. nutzt den bestehenden Detail-Cache,
2. startet bei Cache-Miss den bestehenden gezielten Apify-Detail-Run,
3. rendert bei Erfolg die gemeinsame, formatierte Stellenanzeige.

Bei einem Fehler blieb bisher nur die Fehlermeldung und ein erneuter
„Mehr anzeigen“-Versuch. Ein direkter Weg zur Originalanzeige bei der BA fehlte
an dieser Stelle.

## 2. Änderung

Bei `detailStatus === "error"` zeigt `RemainingCard` jetzt direkt unter der
Fehlermeldung:

**„Originalanzeige bei der Arbeitsagentur öffnen“**

- Verwendet die bereits vorhandene `job.url` des BA-Jobs.
- Die URL wird clientseitig nur akzeptiert, wenn sie ein gültiges `http:`- oder
  `https:`-Ziel ist (`safeExternalUrl`).
- Öffnet in einem neuen Tab (`target="_blank"`, `rel="noopener noreferrer"`).
- Keine automatische Navigation; der Link wird nur durch ausdrückliche
  Benutzeraktion geöffnet.
- Der bestehende Aktionslink „Stellenanzeige ansehen“ bleibt unverändert.
- Keine neue BA-API, keine zusätzliche Abfrage, kein zusätzlicher Apify-Run.

## 3. Zustände

| Zustand | Verhalten |
|---|---|
| Laden | Spinner/Status „Details werden geladen…“ |
| Erfolg | Gemeinsame formatierte BA-Darstellung, kein Fallback-Link |
| Leere Antwort | Fehlermeldung + BA-Fallback-Link |
| Fehler/Exception | Fehlermeldung + BA-Fallback-Link |
| Cache | Bereits geladene Details werden ohne neuen Request wiederverwendet |
| Auf-/Zuklappen nach Erfolg | Kein neuer Detail-Request |
| Ungültige/nicht-http(s)-URL | Kein Fallback-Link |

## 4. Tests

| Prüfung | Ergebnis |
|---|---|
| RemainingCard | **12 passed** |
| safeHtml | **26 passed** |
| Gesamtsuite | **1143 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |

Abgedeckt:

- Fehlerfall zeigt sichtbaren BA-Fallback-Link.
- Link verwendet die vorhandene BA-URL mit `target="_blank"`.
- Bestehender „Stellenanzeige ansehen“-Link bleibt vorhanden.
- Ladezustand wird angezeigt.
- Leere Detailantwort führt zum Fehler-Fallback.
- Erfolgsfall zeigt keinen Fallback-Link.
- Nach erfolgreichem Laden wird beim Zuklappen/Aufklappen kein neuer Request
  ausgelöst.
- Keine echte BA-/Apify-Abfrage.

## 5. Geänderte Dateien

- `src/components/RemainingCard.tsx`
- `src/components/RemainingCard.test.tsx`
- `src/i18n.tsx`
- `src/styles.css`

## 6. Grenzen

- Kein Deployment.
- Keine echten Apify-Runs.
- Keine Änderung an BA-API, Apify, Quotas, Cache, AWS, RIS oder Cognito.
- Bestehende Formatierung, Datenschutzgrenzen und andere Quellen unverändert.

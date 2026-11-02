# JM-BA-DETAIL-FORMAT-01

**Art:** BA-Detailanzeige / „Mehr anzeigen" / Plain-Text-Formatierung
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Baseline:** `main` @ `559cd55`, `origin/main` synchron

## 1. Befund

Bei BA-Jobs wird die Stellenbeschreibung über „Mehr anzeigen" aus
`/api/job-details` nachgeladen. Der BA-Actor liefert in manchen Datensätzen
eine **reine Textbeschreibung** (z. B. mit Leerzeilen und Aufzählungszeichen)
statt HTML.

`renderSanitizedHtml` hat diesen String bisher direkt in ein `div` gesetzt.
Im Browser wurden dadurch:

- Zeilenumbrüche zu normalen Leerzeichen,
- Absätze nicht als Absätze dargestellt,
- Aufzählungen nicht als Liste gerendert.

Die vorhandene HTML-Formatierung für andere Quellen funktionierte weiterhin;
nur der Plain-Text-Fall der BA-Details war betroffen.

Beispielsuche: **AWS Fullstack**.

## 2. Änderung

`src/lib/safeHtml.tsx`:

- Neuer `plainTextToHtml()`-Formatter:
  - Leerzeilen werden zu Absätzen (`<p>`).
  - Einzelne Zeilen innerhalb eines Absatzes werden zu `<br>`.
  - `-`, `*`, `•`, `–` und nummerierte Zeilen werden zu Listen (`<ul><li>`).
  - Text wird HTML-escaped.
- `prepareHtmlForRender()` erkennt, ob bereits HTML-Markup vorliegt:
  - HTML bleibt unverändert und wird weiterhin durch DOMPurify sanitized.
  - Reiner Text wird vor der Sanitization in semantisches HTML umgewandelt.
- Bestehende HTML-Darstellung, Link-/Tag-Whitelist und DOMPurify-Nutzung bleiben erhalten.

`src/components/RemainingCard.tsx` musste nicht geändert werden; der bestehende
`renderSanitizedHtml`-Pfad nutzt jetzt automatisch den Plain-Text-Formatter.

## 3. Tests

Neu/erweitert:

- `src/lib/safeHtml.test.ts`
  - Plain-Text-Absätze und Bullet-Listen,
  - HTML-Escaping.
- `src/components/RemainingCard.test.tsx`
  - BA-Detail mit reinem Text,
  - „Mehr anzeigen" erzeugt `<p>` und `<li>` statt eines unformatierten Strings.

Ergebnis:

| Prüfung | Ergebnis |
|---|---|
| safeHtml-Tests | **25 passed** |
| RemainingCard-Tests | **7 passed** |
| Gesamtsuite | **1137 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |

## 4. Grenzen / Risiken

- Keine echte BA-/Apify-Live-Abfrage und kein kostenpflichtiger Run.
- Die BA-Actor-Antwort kann weiterhin zwischen HTML und Plain-Text variieren;
  beide Pfade sind jetzt abgedeckt.
- Keine Änderung an BA-API, Apify, Quotas, Cache, AWS, RIS, Cognito oder Deployment.
- Die Formatierung ist rein clientseitig; gespeicherte Plain-Text-Caches werden
  dadurch ebenfalls beim Rendern formatiert.

## 5. Git

- Implementierung: Commit nach diesem Bericht.
- Kein Deployment.

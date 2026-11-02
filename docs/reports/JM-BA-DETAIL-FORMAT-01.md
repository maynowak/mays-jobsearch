# JM-BA-DETAIL-FORMAT-01

**Art:** BA-Detailanzeige / „Mehr anzeigen" / Plain-Text- und Markdown-Formatierung
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

- Neuer gemeinsamer `plainTextToHtml()`-Formatter:
  - Leerzeilen werden zu Absätzen (`<p>`).
  - Einzelne Zeilen innerhalb eines Absatzes werden zu `<br>`.
  - `-`, `*`, `•`, `–` und nummerierte Zeilen werden zu Listen (`<ul>`/`<ol>`).
  - Markdown-ähnliche BA-Texte werden unterstützt:
    - `**fett**` → `<strong>`,
    - `[Text](https://…)` → sicherer Link,
    - `# Überschrift` → Überschrift,
    - Inline-Bullets wie `Vergütungspaket- Attraktive …- Zugang …` werden zeilenweise getrennt.
  - Text wird HTML-escaped; Links werden nur für `http`/`https` erzeugt.
- `prepareHtmlForRender()` erkennt, ob bereits HTML-Markup vorliegt:
  - HTML bleibt unverändert und wird weiterhin durch DOMPurify sanitized.
  - Reiner Text wird vor der Sanitization in semantisches HTML umgewandelt.
- Bestehende HTML-Darstellung, Link-/Tag-Whitelist und DOMPurify-Nutzung bleiben erhalten.

`src/components/RemainingCard.tsx` nutzt jetzt nach dem Detail-Laden dieselbe
Darstellung wie normale Suchergebnisse: Die angereicherten BA-Felder werden als
`displayJob` verwendet, und die vorhandene Description-Renderlogik wird für BA
und Nicht-BA gemeinsam genutzt. Der Plain-Text-Formatter bleibt nur der
gemeinsame Fallback im bestehenden `renderSanitizedHtml`-Pfad.

## 2a. Nachtrag — gleicher Darstellungsumfang wie normale Suchergebnisse

Beim Klick auf „Mehr anzeigen“ wird nach erfolgreichem Detail-Laden nun ein
`displayJob` aus dem angereicherten BA-Datensatz gebildet. Dadurch werden
dieselben Kartenfelder wie bei normalen Suchergebnissen verwendet:

- Titel, Arbeitgeber, Ort, Remote-Status
- Tags
- Vertragstyp, Gehalt, Datum
- Beschreibung und Sprach-/Übersetzungsmetadaten
- URL und Aktionen

Die Beschreibung wird über den bestehenden `RemainingCard`-Renderpfad
(`renderSanitizedHtml` / `.html-content`) dargestellt. Nach dem Laden startet
die BA-Karte direkt im vollständigen Zustand; „Weniger anzeigen“ wechselt auf
die vorhandene Preview, ohne einen weiteren Detail-Request auszulösen.
Fehler-/Ladezustand und der ursprüngliche stabile Job bleiben als Fallback
erhalten.

## 3. Tests

Neu/erweitert:

- `src/lib/safeHtml.test.ts`
  - Plain-Text-Absätze und Bullet-Listen,
  - HTML-Escaping.
- `src/components/RemainingCard.test.tsx`
  - BA-Detail mit reinem Text,
  - „Mehr anzeigen" erzeugt `<p>` und `<li>` statt eines unformatierten Strings.
  - BA-Markdown mit `**Fett**`, Markdown-Links und Inline-Bullet-Trennern
    wird als `<strong>`, `<a>` und `<li>` gerendert; `**` erscheint nicht mehr
    als Rohtext.

Ergebnis:

| Prüfung | Ergebnis |
|---|---|
| safeHtml-Tests | **26 passed** |
| RemainingCard-Tests | **9 passed** |
| Gesamtsuite | **1140 passed, 5 skipped** |
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

# JM-JOB-TRANSLATION-01

**Status:** `A — IMPLEMENTED / VERIFIED LOCAL + PREVIEW PROVIDER E2E — NO MAIN MERGE / NO PRODUCTION DEPLOY`

**Date:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-job-translation-01`
**Baseline:** `origin/main` `fbe58e1cb885a365ff82cef0f8a5357a96f8a8c7`
**PR:** #21 (draft)

## 1. Ziel

Englischsprachige Stellenanzeigen können auf ausdrückliche Nutzeraktion auf
Deutsch gelesen werden. Der Originaltext bleibt erhalten und ist jederzeit
wieder aufrufbar. ATS, Matching, Suchprofile und Bewerbungsdaten arbeiten
weiterhin ausschließlich mit dem Original.

## 2. Wiederverwendete Komponenten

- `api/_lib/ai.mjs` / `api/_lib/providers/*`: vorhandener OpenRouter-/EdenAI-
  Provider-Router, Free-Model-Auswahl, Provider-Budget und Fehlercodes.
- `api/_lib/filter.mjs` → `detectLanguage()` und Plain-Text-Bereinigung.
- `api/_lib/ipQuota.mjs`: vorhandener IP-Quota-/Abuse-Schutz.
- `src/lib/safeHtml.tsx` → `renderSanitizedHtml()` für die sichere Darstellung.
- `RemainingCard`-Beschreibungsbereich, „Mehr anzeigen“/„Weniger anzeigen“.
- `Job.language`, `description`, `descriptionPlain`.
- Bestehende i18n-Struktur für DE/EN.

Der historische Commit `2038085c7` bleibt unverändert: Sprachenerkennung und
Browser-Translate-Metadaten. Die neue Funktion ergänzt eine echte, explizite
Übersetzung; sie ersetzt nicht die Browser-Metadaten.

## 3. Provider-Entscheidung

Es wurde **kein neuer externer Dienst** eingebaut. Die Übersetzung nutzt den
vorhandenen Provider-Router über `chat()`.

- Primär: konfigurierter OpenRouter-Provider
- Fallback: vorhandener EdenAI-Provider, soweit konfiguriert
- Keine neuen API-Keys, keine öffentlichen Übersetzungs-Proxys, keine neue
  kostenpflichtige Infrastruktur.
- Kein neuer Vercel-Function-Slot: Der bestehende Endpoint
  `/api/job-details` wurde um `action: "translate"` erweitert.

Lokal fehlen Provider-Keys (`OPENROUTER_API_KEY`/`EDENAI_*` nicht gesetzt).
Die echte Provider-Ausführung wurde deshalb auf dem Vercel-Preview-Deployment
`mays-job-matcher-git-feature-jm-job-translation-01-maymilly.vercel.app`
verifiziert. Kein Production-Deployment wurde ausgelöst.

## 4. Datenfluss

```text
RemainingCard (nur bei language === "en")
  → Klick "Deutsch lesen"
  → POST /api/job-details
     { action:"translate", description: descriptionPlain || description,
       sourceLanguage, targetLanguage:"de", consent:true }
  → bestehender chat()-Provider-Router
  → JSON { translation: "..." }
  → lokaler Anzeigezustand in RemainingCard
  → renderSanitizedHtml(translation, "de")
```

- Nur der öffentliche Stellenanzeigentext und die Quellsprache werden
  übertragen.
- Keine CV-Daten, keine Bewerbungsdaten, keine Suchprofile, keine RIS-Daten.
- Keine serverseitige Speicherung von Original oder Übersetzung.
- Der Originaltext wird bei Fehlern weiterhin angezeigt.

## 5. Sicherheit, Datenschutz und Kosten

- `consent: true` ist für den API-Pfad verpflichtend.
- Die UI startet die Anfrage ausschließlich durch den Klick auf
  „Deutsch lesen“; die Consent-Erklärung steht direkt am Schalter.
- Eingabe ist auf 20.000 Zeichen begrenzt.
- Provider-Ausgabe wird auf 30.000 Zeichen begrenzt und nur als Text
  weitergegeben; HTML wird ausschließlich über die bestehende
  `renderSanitizedHtml()`-Grenze gerendert.
- Vorhandene IP-Quota (`provider = "translation"`) und Provider-Budget-
  /Rate-Limit-Grenzen werden genutzt.
- Keine Erfindung von Anforderungen, keine Bewerbungsberatung im
  Übersetzungstext; der Prompt verbietet Ergänzungen.
- Keine neue Abhängigkeit.

## 6. Original-/Übersetzungs-Trennung

Die Übersetzung liegt ausschließlich im lokalen
`RemainingCard`-Anzeigezustand:

- `job.description` bleibt unverändert.
- `job.descriptionPlain` bleibt unverändert.
- `onAtsEvaluate(displayJob)` erhält das Original.
- `onGenerateLetter` erhält das Original.
- ATS-/Matching-/RIS-Dateien wurden nicht geändert.
- Es gibt keinen Schreibzugriff auf Jobdaten durch die Übersetzung.

## 7. UI

- Englische Anzeige: **Original | Deutsch lesen**
- Standard: Original.
- Erster Klick startet die Übersetzung; Ladezustand wird angezeigt.
- Erfolgreiche Übersetzung: deutsche Lesefassung + Hinweis
  „Automatisch übersetzte Stellenbeschreibung. Maßgeblich ist die
  Originalanzeige.“
- „Original anzeigen“ stellt den Originaltext sofort wieder her.
- Erneutes Umschalten nutzt den lokalen Sitzungszustand; keine erneute
  Anfrage.
- Deutsche Anzeige: kein Schalter, keine Anfrage.
- Unbekannte Sprache: kein Schalter; Original bleibt sichtbar.
- Fehler: Original bleibt sichtbar, verständliche Fehlermeldung.
- Bestehende „Mehr anzeigen“-/„Weniger anzeigen“-Funktion bleibt erhalten.
- Neue CSS-Klassen sind responsive; 40 px Touch-Ziel auf kleinen Viewports;
  Fokusring und `aria-pressed`/`role="status"`/`role="alert"` vorhanden.
- Keine zusätzliche Modal-Ebene.

## 8. Tests

### API

```text
npx vitest run tests/api/job-translation.test.js
```

Ergebnis: **8 PASS**

Abgedeckt:

- Englische Übersetzung
- Keine CV-/Bewerbungsdaten im Provider-Prompt
- Deutsche Beschreibung ohne Provider-Aufruf
- Consent erforderlich
- Größenlimit
- automatische Spracherkennung
- Provider-Timeout/Fehler
- leerer Provider-Output
- nicht unterstützte Zielsprache

### UI

```text
npx vitest run src/components/RemainingCard.test.tsx
```

Ergebnis: **16 PASS**

Abgedeckt:

- Schalter nur bei englischer Sprache
- Original als Standard
- Übersetzung nur nach Klick
- Lade-/Erfolgs-/Fehlerzustand
- Original wiederherstellen
- Sitzungs-Cache beim erneuten Umschalten
- deutscher Originaltext ohne Schalter
- ATS erhält unveränderte Originalbeschreibung
- bestehende HTML-/Sicherheits-/Detailtests

### Build

```text
npm run build
```

Ergebnis: **PASS**

### Gesamtsuite

```text
npx vitest run --no-file-parallelism
```

Ergebnis: **1908 PASS / 11 skipped / 4 skipped files**

## 9. Echte Preview-Verifikation

Preview-Deployment:

`https://mays-job-matcher-git-feature-jm-job-translation-01-maymilly.vercel.app`

Request:

```json
{
  "action": "translate",
  "description": "We are looking for a Software Engineer. You will build reliable systems with AWS, TypeScript and Kubernetes. This role requires clear communication and production experience.",
  "sourceLanguage": "en",
  "targetLanguage": "de",
  "consent": true
}
```

Ergebnis: **HTTP 200**

```json
{
  "translation": "Wir suchen einen Software-Ingenieur. Sie werden zuverlässige Systeme mit AWS, TypeScript und Kubernetes aufbauen. Diese Rolle erfordert klare Kommunikation und Erfahrung in der Produktion.",
  "sourceLanguage": "en",
  "targetLanguage": "de",
  "translated": true
}
```

AWS, TypeScript und Kubernetes blieben erhalten. Die Übersetzung wurde nicht
in Production deployed.

## 10. Git-Commits

- `f6067c3` — `feat(job): add controlled job translation API`
- `553d83d` — `feat(job): add original and German reading toggle`
- Dokumentations-Commit folgt separat.

Feature-Branch gepusht. PR #21 ist Draft; **kein Merge, kein Production-Deployment**.

## 11. Bekannte Einschränkungen

- Übersetzungsqualität hängt vom vorhandenen Free-Model-Provider ab.
- Lokale Provider-Keys fehlen; der echte Provider-Pfad wurde auf Preview
  verifiziert, nicht lokal.
- Es gibt keine automatische Übersetzung; nur explizite Nutzeraktion.
- Keine serverseitige Übersetzungsspeicherung; der Cache ist sitzungsbezogen
  im Komponentenzustand.
- Keine Übersetzung von CV-, Bewerbungs- oder Suchprofildaten.
- Keine Änderung an ATS, Matching, RIS, AWS, Cognito, CV-Parser oder
  Production-Konfiguration.

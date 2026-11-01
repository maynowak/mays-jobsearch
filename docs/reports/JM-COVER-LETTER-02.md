# JM-COVER-LETTER-02

**Art:** Stellenbeschreibungs-Prüfung / Enrichment / deterministische Plausibilität
**Status:** IMPLEMENTIERT / VERIFIZIERT (lokal)
**Deployment:** keines
**Datum:** 2026-11-01

## 1. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `5ab6969` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Verwendete Datenquellen

Die Prüfung nutzt ausschließlich bereits vorhandene Daten:

- `Job.slug`, `title`, `company_name`, `location`, `tags`, `url`, `source`
- `Job.description` / `Job.descriptionPlain`
- bereits geladene Arbeitsagentur-Detaildaten aus `RemainingCard`
- Benutzereingabe im neuen Textfeld

Es gibt:

- keine neue Scraping-Funktion
- keinen automatischen `/api/job-details`-Request
- keinen zusätzlichen `/api/jobs`-Request
- keinen KI-Aufruf für die Beschreibungsprüfung

## 3. Deterministische Vollständigkeitsprüfung

Neu: `src/lib/jobDescriptionReview.ts`

Zustände:

- `sufficient` — ausreichend Aufgaben-/Anforderungssignale, kein Platzhalter,
  keine reine Wiederholung/Werbung
- `limited` — Text vorhanden, aber schwach, kurz, wiederholend oder werblich
- `missing` — keine verwertbare Beschreibung

Kriterien:

- normalisierter Text und Wortanzahl
- Tätigkeits-/Aufgabenverben
- Anforderungs-/Qualifikationssignale
- erkennbare Platzhalter (`TODO`, `Lorem ipsum`, `N/A`, …)
- Wiederholungsanteil
- reine Marketing-/Benefits-Texte ohne Aufgaben/Anforderungen

Keine starre Mindestlänge als alleiniges Kriterium: wenige präzise
Anforderungen können `sufficient` sein.

## 4. Benutzereingabe

Im `LetterModal`:

- optionales mehrzeiliges Textfeld
- Label DE/EN: „Weitere Informationen zur Stellenanzeige einfügen“
- Größenbegrenzung: `20.000` Zeichen
- Normalisierung und Entfernung von HTML-/Script-Inhalten
- Anzeige ausschließlich als Text, kein `dangerouslySetInnerHTML`
- keine automatische Übermittlung an ein Modell
- keine Speicherung in Redis/RIS/localStorage
- Originaldaten werden nicht überschrieben

## 5. Plausibilitätsprüfung

Zustände:

- `plausible`
- `uncertain`
- `mismatch`

Signale:

- Arbeitgeber-Match
- Berufsbezeichnungs-Match
- Ort-Match
- Tag-/Skill-Match
- gemeinsame Begriffe mit der Originalbeschreibung

Widersprüche:

- andere explizit genannte juristische Firma
- andere explizit genannte Rolle/Position

Ein fehlender Arbeitgeber oder eine abweichende Formulierung allein erzeugt
**keinen** Mismatch. Es werden keine KI-Konfidenzwerte erfunden.

## 6. Auswahlregel

| Situation | Ergebnis |
|---|---|
| Keine Ergänzung | Originalbeschreibung |
| Plausible Ergänzung | Ergänzter Text, `origin: enriched` |
| Unklare Ergänzung | Benutzerbestätigung erforderlich; zunächst Original |
| Bestätigte unklare Ergänzung | Ergänzter Text, `origin: user_supplied` |
| Deutlicher Widerspruch | Originalbeschreibung als Fallback |
| Beide Texte unzureichend | `insufficient`, keine ausgewählte Beschreibung |

Der Review-Zustand ist typisiert und sitzungsgebunden. Er wird in CL-02 nur
vorbereitet; die tatsächliche Einbindung in die Anschreiben-Prompt-Architektur
erfolgt in CL-04.

## 7. UI-Verhalten

Der Dialog zeigt:

- vorhandene Stelleninformationen
- Vollständigkeitsstatus der Originalbeschreibung
- Originalbeschreibung als Textvorschau
- optionales Ergänzungsfeld
- Button „Beschreibung prüfen“
- Prüfergebnis mit Signal-Chips
- Warnung bei Mismatch/Uncertain/Insufficient
- Bestätigungsbutton bei unklarer Zuordnung
- ausgewählte Beschreibung inklusive Herkunft:
  - `Original`
  - `Ergänzt`
  - `Vom Benutzer ergänzt`
- Hinweis, dass der ausgewählte Text noch **nicht** an die vorläufige
  Generierung übergeben wird

Die bisherige vorläufige Generierung aus CL-01 bleibt unverändert. Sie nutzt
weiterhin nur die vorhandenen Stellen- und Suchprofildaten.

## 8. Sicherheit und Datenschutz

- Eingabe wird als nicht vertrauenswürdiger Text behandelt.
- HTML/Script werden vor der Prüfung entfernt.
- Anzeige erfolgt als Text, nicht als HTML.
- Keine URL-Abfrage, kein Scraping.
- Keine Anweisungsausführung aus Stellenbeschreibungen.
- Keine Speicherung in Redis/RIS/localStorage.
- Keine neuen Cookies.
- Keine neuen Benutzerkennungen.
- Keine zusätzlichen Modellaufrufe.
- Keine Änderung an Provider-Budgets.
- Keine personenbezogenen Inhalte in Fehlerlogs.

## 9. Tests

| Prüfung | Ergebnis |
|---|---|
| `src/lib/jobDescriptionReview.test.ts` | PASS — 17 Tests |
| `LetterModal.test.tsx` | PASS — 16 Tests |
| MatchCard/RemainingCard/Results | PASS |
| Gesamtsuite | PASS — 1071 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| `/api/jobs` im E2E | 1 (Suche); kein zusätzlicher Request |
| `/api/job-details` im E2E | 0 |
| `/api/cover-letter` beim Review | 0 |
| `/api/cover-letter` nach explizitem Start | 1 |
| Ergänzungstext im Cover-Letter-Request | nicht enthalten |
| Console Errors im E2E | keine |

Hinweis: Bei einem vollständigen parallelen Testlauf traten zwei
intermittierende Timeouts in bestehenden `ManualSearchProfiles`-Tests auf.
Die isolierte Ausführung dieser Tests war PASS; der finale Gesamtlauf war
PASS (1071/5).

### Abgedeckte Pflichtfälle

1. Vollständige Originalbeschreibung → `sufficient`
2. Kurze Originalbeschreibung → `limited`
3. Fehlende Originalbeschreibung → `missing`
4. Passender Ergänzungstext → `plausible`
5. Ergänzung ohne Arbeitgeber → `plausible`
6. Falscher Arbeitgeber → `mismatch`
7. Falsche Stellenbezeichnung → `mismatch`
8. Unklare Zuordnung → `uncertain`
9. Originaltext-Fallback → `original`
10. Beide Texte unzureichend → `insufficient`
11. HTML/Script → entfernt, kein ausführbarer Inhalt
12. Mehrsprachige Beschreibung → `plausible`
13. Stellenwechsel → Review-Input/Ergebnis zurückgesetzt
14. Dialog schließen/neu öffnen → kein alter Review-State
15. Kein KI-Aufruf während der Prüfung
16. Kein zusätzlicher `/api/jobs`-Request
17. Kein automatischer `/api/job-details`-Request
18. Gastbenutzer → E2E ohne Auth
19. Desktop/Mobil → E2E 1440/390
20. CL-01-Regression → bestehende Tests PASS

## 10. UI-Evidenz

`docs/reports/assets/JM-COVER-LETTER-02/`

- `desktop-1440-cards.png`
- `desktop-1440-letter-intro.png`
- `desktop-1440-letter-review.png`
- `desktop-1440-letter-generated.png`
- `mobile-390-cards.png`
- `mobile-390-letter-intro.png`
- `mobile-390-letter-review.png`
- `mobile-390-letter-generated.png`

Der E2E verwendet lokale, gemockte APIs; keine echten Provider.

## 11. Offene Punkte für CL-03/CL-04

1. CV-Auswahl und CV-Upload-Workflow — CL-03.
2. Einbindung der ausgewählten Beschreibung in die Anschreiben-Prompt-Architektur — CL-04.
3. Produktentscheidung, ob eine bestätigte unklare Ergänzung dauerhaft als
   `user_supplied` oder als `enriched` weitergeführt wird.
4. Echter Provider-/Production-Browser-Test steht aus.

## 12. Abgrenzung

Nicht implementiert:

- CV-Auswahl / neuer CV-Upload
- neue Anschreiben-Prompts
- Bewerbungsverwaltung
- RIS-Persistenz
- neue Datenbank
- AWS-/Vercel-Deployment
- neue Authentifizierung

## 13. Git

- Implementierung: `f8e3047`
- Dokumentations-Commit: `a5200b2`
- Remote-Synchronität: nach Push geprüft.
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung, kein Release.

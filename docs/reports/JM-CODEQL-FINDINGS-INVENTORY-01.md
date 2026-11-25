# JM-SECURITY-CODEQL-REMEDIATION-01 — CodeQL Findings Inventory

**Erstellt:** 2026-11-25
**Repository:** `maynowak/mays-jobsearch`
**Basis:** `origin/main` `aa57500` (Merge PR #67)
**Baseline-Analyse:** CodeQL Run [45645491629](https://github.com/maynowak/mays-jobsearch/actions/runs/45645491629) · `main` · Commit `df1fe01` · Sprache `javascript-typescript` · Query-Suite `security-and-quality`
**Abfrage:** `GET /repos/maynowak/mays-jobsearch/code-scanning/alerts?state=open` (paginiert, 100/Seite)

## 1. Ergebnis der Bestandsaufnahme

| Kennzahl | Wert |
| --- | --- |
| Offene Alerts (Baseline) | **86** |
| Geschlossene Alerts (Baseline) | 23 (19 × `js/unused-local-variable`, 4 × `js/useless-regexp-character-escape`) |
| High (security severity) | 17 |
| Medium | 7 |
| Error (CodeQL severity) | 1 |
| Warning ohne Security-Level | 3 |
| Note (Quality) | 58 |
| Produktivcode (`src/`, `api/`, `scripts/`) | 51 |
| Test-/E2E-Code (`tests/`) | 35 |

Es wurden alle Seiten der API-Antwort ausgewertet; die Zahlen decken sich mit dem GitHub-Snapshot vom 25.11.2026 (86 offen / 23 geschlossen).

## 2. Regeln und Gruppen

| Regel | Anzahl | Severity | Bereich | Triage | Ursache | Empfohlene/umgesetzte Korrektur |
| --- | --- | --- | --- | --- | --- | --- |
| `js/bad-tag-filter` | 3 | high | Produktiv (`api/job-details.mjs`, `api/cover-letter.mjs`, `src/lib/jobDescriptionReview.ts`) | B | Reguläre Ausdrücke entfernten `<script>`/`<style>`-Blöcke unvollständig (z. B. `</script >`). Die Ausgabe wird nur als Text verwendet, nicht als HTML gerendert; Risiko ist Prompt-/Textextraktion, nicht XSS. | Regex-Filter durch zustandslosen Tag-Scanner ersetzt (`api/_lib/htmlText.mjs`). |
| `js/xss-through-dom` | 2 | high | Produktiv (`src/lib/safeHtml.tsx`, `src/lib/jobDescriptionReview.ts`) | B | DOM-Text wurde über `innerHTML` (detached `textarea`) bzw. `DOMParser` als HTML interpretiert. Kein ausführbarer Sink nachgeschaltet (DOMPurify bzw. nur `textContent`), dennoch unnötiger HTML-Parse-Pfad. | Entity-Decoder ohne DOM; HTML→Text ohne `DOMParser`. DOMPurify bleibt für echtes Rich-HTML zuständig. |
| `js/identity-replacement` | 6 | medium | Produktiv (`src/lib/jobMeta.ts`) | B | Sechs `.replace()`-Aufrufe ersetzten Zeichen durch sich selbst; Entity-Decoding war faktisch defekt (`&nbsp;`, `&#x24;`, `&#x2F;` blieben stehen). Kein XSS, da React-Textkontext. | Gemeinsamer Entity-Decoder für benannte/dezimale/hexadezimale Entities. |
| `js/insecure-randomness` | 1 | high | Produktiv (`src/lib/profiles/sessionRepositories.ts`, Ursprung `src/lib/manualSearchProfiles.ts`) | B | `Math.random()` erzeugte Session-Profil-IDs (kein Auth-Token, aber stabile Referenz). Vorhersagbarkeit/Kollisionen unnötig. | `crypto.getRandomValues` (`src/lib/secureRandomId.ts`), ID-Format unverändert. |
| `js/insecure-temporary-file` | 1 | high | Test/E2E (`tests/e2e/live-production-browser.mjs`) | C | Evidenzdatei in einem vorhersagbaren Pfad unter `/tmp` geschrieben (Symlink-Risiko auf Entwicklerrechnern). | `mkdtemp` (0700) und Results-Datei mit Modus 0600. |
| `js/incomplete-url-substring-sanitization` | 9 | high | Test (`tests/api/*`, `tests/integration/*`) | C | Fetch-Mocks prüften `url.includes("host")`; Suffix-/Userinfo-Tricks hätten den Mock falsch bedienen können. Kein Produktivpfad, aber falsche Testaussage möglich. | Hostname aus `new URL()` exakt vergleichen (`tests/helpers/url.mjs`). |
| `js/stack-trace-exposure` | 1 | medium | Test (`tests/integration/ip-quota-parallel.test.mjs`) | C | Mock-REST-Server gab `error.message` an den Client zurück. | Generischer Fehlercode ohne interne Details. |
| `js/regex/missing-regexp-anchor` | 1 | high | Test (`tests/api/ris-boundary.test.mjs`) | C | Unverankertes Regex auf Dateiinhalt; die Aussage „kein hartkodierter execute-api-Endpunkt“ war unscharf. | Assertion auf `https?://execute-api…` verankert. |
| `js/call-to-non-callable` | 1 | error | Produktiv (`api/cv-improvement.mjs`) | A | Handler importierte `computeImprovementDelta`, das im Modul nicht existierte (nur `compareAtsResults`); der Reanalyze-Pfad lief ins Leere. | Funktion exportiert, Reanalyze-Validierung auf eigene Felder umgestellt, Regressionstest. |
| `js/duplicate-property` | 1 | warning | Test (`tests/api/theirstack-source.test.mjs`) | Q | `cacheEval` doppelt im Mock-Objekt. | Duplikat entfernt. |
| `js/useless-assignment-to-local` | 2 | warning | Produktiv (`src/components/ApplicationsSection.tsx`, `scripts/purge-cv-profile-cache.mjs`) | Q | Initialwerte wurden immer überschrieben. | Deklaration ohne toten Initialwert. |
| `js/unused-local-variable` | 58 | note | 25 Dateien in `api/`, `src/`, `tests/`, `scripts/` | Q | Tote Importe, Variablen, Helper und ein durch den fehlenden Export „unbenutzter“ Delta-Helper. | Entfernt bzw. korrekt verdrahtet. |

### Triage-Legende

- **A — Confirmed Vulnerability/Defect:** reproduzierbarer Fehler mit Sicherheits- oder Laufzeitwirkung.
- **B — Security Hardening:** unsichere Implementierung ohne bestätigten Angriffspfad aus dem Internet; Korrektur reduziert Angriffsfläche.
- **C — Test-only:** Befund ausschließlich in Test-/E2E-Code; keine Produktivroute, aber Testaussage oder lokale Ausführung betroffen.
- **D — False Positive:** nachweislich nicht zutreffend (im Baseline-Set nicht vergeben).
- **E — Superseded / Already Fixed:** durch neuere Änderungen bereits erledigt (keine Dismissals vorgenommen).
- **Q — Quality-only:** Erweiterung, weil die Suite `security-and-quality` Note-/Warning-Findings ohne Sicherheitsbezug meldet. Diese Befunde sind sachlich korrekt, aber keine Schwachstellen; sie wurden dort behoben, wo es ohne Verhaltensänderung möglich war.

## 3. Bewertung der High-Severity-Findings

### 3.1 `js/bad-tag-filter` (#92, #93, #107)

- **Datenfluss:** Stellenanzeigen (`description`, BA-Detailtexte) → Regex-Entfernung von `<script>/<style>` → Text für KI-Prompt bzw. Review-Heuristik.
- **Ausnutzbarkeit:** Kein HTML-Rendering dieser Ausgabe. Ein umgangener Filter fügt dem Prompt Text hinzu (Prompt-Injection-Oberfläche, Datenmüll), erzeugt aber kein ausführbares Markup im Browser. Einstufung **B**, nicht A.
- **Korrektur:** `api/_lib/htmlText.mjs` entfernt Raw-Text-Elemente (`script`, `style`, `noscript`, `template`, `iframe`, `object`, `svg`, `math`, …) inklusive Inhalt über einen Tag-Scanner, der auch `</script >`, `</SCRIPT\n>` und `</script data-x>` erkennt. Keine Regex-Filterung mehr.

### 3.2 `js/xss-through-dom` (#10, #91)

- **#10 `safeHtml.tsx`:** `decoder.innerHTML = html` auf einem detached `textarea` führte zu HTML-Parsing; der Wert wurde anschließend durch DOMPurify gerendert. Kein ungeprüfter Sink, aber der Parse-Schritt war unnötig.
- **#91 `jobDescriptionReview.ts`:** `DOMParser.parseFromString(value, "text/html")`; gelesen wurde nur `textContent`. Kein Render-Sink.
- **Korrektur:** Beide Pfade nutzen jetzt den DOM-freien Decoder/Scanner. `dangerouslySetInnerHTML` bleibt ausschließlich hinter DOMPurify mit Tag-/Attribut-Allowlist.

### 3.3 `js/insecure-randomness` (#85)

- Der Alert zeigt auf `sessionRepositories.ts:124`, die Zufallsquelle lag aber in `manualSearchProfiles.ts` (`defaultCreateId`). Die ID wird als `sessionId` eines Session-Profils verwendet – kein Authentifizierungs- oder Autorisierungswert.
- **Korrektur:** CSPRNG-Suffix, Format `manual-<timestamp>-<7 Zeichen>` unverändert; ebenso für CV-Profil-Einträge (`entry-…`). Regressionstest schützt die Format- und CSPRNG-Erwartung.

### 3.4 `js/incomplete-url-substring-sanitization` (#7–#9, #60, #67, #73, #86, #87, #96)

- Alle neun Befunde liegen in Fetch-Mocks von Tests. Sie prüfen, ob eine Anfrage an Arbeitnow/Nominatim/Greenhouse geht. `includes("host")` akzeptiert auch `host.attacker.test`, `evil.test/?next=host` oder `host@evil.test`.
- **Korrektur:** `isHostname()` parst die URL und vergleicht `hostname` exakt; Regressionstest deckt Suffix-, Userinfo- und Query-Tricks ab.

### 3.5 `js/insecure-temporary-file` (#99) und `js/regex/missing-regexp-anchor` (#97)

- Beide test-only. Evidenzverzeichnis jetzt `mkdtemp` mit privaten Rechten; RIS-Boundary-Assertion mit Schema-Anker.

## 4. Vorgehen und Grenzen

- Keine CodeQL-Regel deaktiviert, keine Datei ausgeschlossen, keine Alerts dismissed.
- Keine Änderung an RIS, AWS, Terraform, Cognito, Consent-Verträgen, Produktionsdaten oder CI-Berechtigungen. `.github/workflows/codeql.yml` blieb unverändert (`security-and-quality`, `build-mode: none`).
- Der Handler `api/cv-improvement.mjs` wird vom Frontend über `/api/v1/cv-improvement…` angesprochen; für diesen Pfad existiert in `vercel.json` **keine** Rewrite-Regel (nur `/api/analysis/v1/*` und `/api/ris/*`). Die Client-Funktionen sind damit im Production-Build nicht erreichbar. Eine Routing-Änderung wäre eine Produkt-/Architekturentscheidung und wurde **nicht** vorgenommen; sie ist als Folgearbeit dokumentiert.

## 5. Vollständiges Inventar (86 Alerts)

Pfad und Zeile beziehen sich auf den Baseline-Commit `df1fe01`.

| Alert | Regel | Severity | Pfad:Zeile (Baseline) | Triage | Status |
| --- | --- | --- | --- | --- | --- |
| 92 | `js/bad-tag-filter` | high | `src/lib/jobDescriptionReview.ts:101` | B | Behoben |
| 93 | `js/bad-tag-filter` | high | `api/cover-letter.mjs:43` | B | Behoben |
| 107 | `js/bad-tag-filter` | high | `api/job-details.mjs:29` | B | Behoben |
| 48 | `js/call-to-non-callable` | note | `api/cv-improvement.mjs:237` | A | Behoben |
| 88 | `js/duplicate-property` | note | `tests/api/theirstack-source.test.mjs:17` | Q | Behoben |
| 1 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:71` | B | Behoben |
| 2 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:72` | B | Behoben |
| 3 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:73` | B | Behoben |
| 4 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:74` | B | Behoben |
| 5 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:75` | B | Behoben |
| 6 | `js/identity-replacement` | medium | `src/lib/jobMeta.ts:76` | B | Behoben |
| 7 | `js/incomplete-url-substring-sanitization` | high | `tests/api/apify-actor.test.mjs:60` | C | Behoben |
| 8 | `js/incomplete-url-substring-sanitization` | high | `tests/api/apify-actor.test.mjs:80` | C | Behoben |
| 9 | `js/incomplete-url-substring-sanitization` | high | `tests/api/sources-registry.test.mjs:74` | C | Behoben |
| 60 | `js/incomplete-url-substring-sanitization` | high | `tests/integration/cv-to-jobs-e2e.test.mjs:90` | C | Behoben |
| 67 | `js/incomplete-url-substring-sanitization` | high | `tests/integration/20-skills-regression.test.mjs:87` | C | Behoben |
| 73 | `js/incomplete-url-substring-sanitization` | high | `tests/api/greenhouse-source.test.mjs:57` | C | Behoben |
| 86 | `js/incomplete-url-substring-sanitization` | high | `tests/api/apify-actor.test.mjs:302` | C | Behoben |
| 87 | `js/incomplete-url-substring-sanitization` | high | `tests/api/apify-actor.test.mjs:315` | C | Behoben |
| 96 | `js/incomplete-url-substring-sanitization` | high | `tests/api/sources-registry.test.mjs:71` | C | Behoben |
| 85 | `js/insecure-randomness` | high | `src/lib/profiles/sessionRepositories.ts:124` | B | Behoben |
| 99 | `js/insecure-temporary-file` | high | `tests/e2e/live-production-browser.mjs:161` | C | Behoben |
| 97 | `js/regex/missing-regexp-anchor` | high | `tests/api/ris-boundary.test.mjs:39` | C | Behoben |
| 89 | `js/stack-trace-exposure` | medium | `tests/integration/ip-quota-parallel.test.mjs:98` | C | Behoben |
| 11 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:1` | Q | Behoben |
| 12 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:474` | Q | Behoben |
| 13 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:823` | Q | Behoben |
| 14 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:825` | Q | Behoben |
| 15 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:971` | Q | Behoben |
| 16 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:532` | Q | Behoben |
| 17 | `js/unused-local-variable` | note | `api/_lib/sources/apify/actors.mjs:2` | Q | Behoben |
| 18 | `js/unused-local-variable` | note | `api/_lib/sources/arbeitnow.mjs:1` | Q | Behoben |
| 19 | `js/unused-local-variable` | note | `api/ats-analysis.mjs:2` | Q | Behoben |
| 20 | `js/unused-local-variable` | note | `api/ats-analysis.mjs:3` | Q | Behoben |
| 21 | `js/unused-local-variable` | note | `tests/api/filter.test.js:3` | Q | Behoben |
| 22 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:2` | Q | Behoben |
| 23 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:59` | Q | Behoben |
| 25 | `js/unused-local-variable` | note | `tests/api/cv-improvement-api.test.mjs:161` | Q | Behoben |
| 26 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:176` | Q | Behoben |
| 27 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:190` | Q | Behoben |
| 28 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:264` | Q | Behoben |
| 29 | `js/unused-local-variable` | note | `api/cv-improvement.mjs:228` | Q | Behoben |
| 30 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:173` | Q | Behoben |
| 33 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:177` | Q | Behoben |
| 34 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:178` | Q | Behoben |
| 49 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:179` | Q | Behoben |
| 50 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:180` | Q | Behoben |
| 51 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:181` | Q | Behoben |
| 52 | `js/unused-local-variable` | note | `src/lib/cv-improvement.js:182` | Q | Behoben |
| 54 | `js/unused-local-variable` | note | `api/_lib/searchStrategy.mjs:87` | Q | Behoben |
| 57 | `js/unused-local-variable` | note | `tests/api/search-strategy.test.mjs:2` | Q | Behoben |
| 58 | `js/unused-local-variable` | note | `tests/api/search-strategy.test.mjs:3` | Q | Behoben |
| 59 | `js/unused-local-variable` | note | `tests/api/search-strategy.test.mjs:381` | Q | Behoben |
| 61 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:2` | Q | Behoben |
| 62 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:47` | Q | Behoben |
| 63 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:52` | Q | Behoben |
| 64 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:117` | Q | Behoben |
| 65 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:182` | Q | Behoben |
| 66 | `js/unused-local-variable` | note | `tests/integration/cv-to-jobs-e2e.test.mjs:262` | Q | Behoben |
| 68 | `js/unused-local-variable` | note | `tests/integration/20-skills-regression.test.mjs:46` | Q | Behoben |
| 69 | `js/unused-local-variable` | note | `tests/integration/20-skills-regression.test.mjs:49` | Q | Behoben |
| 70 | `js/unused-local-variable` | note | `tests/integration/20-skills-regression.test.mjs:114` | Q | Behoben |
| 71 | `js/unused-local-variable` | note | `tests/integration/20-skills-regression.test.mjs:220` | Q | Behoben |
| 72 | `js/unused-local-variable` | note | `api/_lib/searchStrategy.mjs:216` | Q | Behoben |
| 74 | `js/unused-local-variable` | note | `api/_lib/searchStrategy.mjs:1` | Q | Behoben |
| 75 | `js/unused-local-variable` | note | `api/_lib/sources/index.mjs:12` | Q | Behoben |
| 76 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/ashby.mjs:31` | Q | Behoben |
| 77 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/lever.mjs:32` | Q | Behoben |
| 78 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/recruitee.mjs:23` | Q | Behoben |
| 79 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/recruitee.mjs:24` | Q | Behoben |
| 80 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/recruitee.mjs:27` | Q | Behoben |
| 81 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/workable.mjs:29` | Q | Behoben |
| 82 | `js/unused-local-variable` | note | `api/_lib/sources/public-ats/adapters/personio.mjs:137` | Q | Behoben |
| 83 | `js/unused-local-variable` | note | `tests/api/filter.test.js:3` | Q | Behoben |
| 84 | `js/unused-local-variable` | note | `tests/api/sources-live.test.mjs:75` | Q | Behoben |
| 94 | `js/unused-local-variable` | note | `tests/e2e/mobile-nav.mjs:100` | Q | Behoben |
| 98 | `js/unused-local-variable` | note | `tests/api/ris-routing.test.mjs:74` | Q | Behoben |
| 100 | `js/unused-local-variable` | note | `tests/e2e/live-production-browser.mjs:23` | Q | Behoben |
| 105 | `js/unused-local-variable` | note | `tests/e2e/cv-builder-import-ux-02d.mjs:157` | Q | Behoben |
| 106 | `js/unused-local-variable` | note | `api/_lib/ats.mjs:986` | Q | Behoben |
| 113 | `js/unused-local-variable` | note | `api/ats-analysis.mjs:2` | Q | Behoben |
| 114 | `js/unused-local-variable` | note | `tests/e2e/application-draft-save-recovery-01.mjs:15` | Q | Behoben |
| 90 | `js/useless-assignment-to-local` | note | `scripts/purge-cv-profile-cache.mjs:229` | Q | Behoben |
| 95 | `js/useless-assignment-to-local` | note | `src/components/ApplicationsSection.tsx:590` | Q | Behoben |
| 10 | `js/xss-through-dom` | high | `src/lib/safeHtml.tsx:7` | B | Behoben |
| 91 | `js/xss-through-dom` | high | `src/lib/jobDescriptionReview.ts:94` | B | Behoben |

## 6. Verbleibende Findings nach der Korrektur

- Alle 86 Baseline-Alerts wurden adressiert. GitHub schließt Alerts erst nach einer Analyse des Branches/`main` mit der korrigierten Quelle; die Verifikation erfolgt über den CodeQL-Lauf auf `security/jm-codeql-remediation-01` (siehe Remediation-Report).
- Keine Dismissals, keine False-Positive-Markierungen beantragt.
- Beobachtung außerhalb des CodeQL-Sets: `api/cv-improvement.mjs` setzt `Access-Control-Allow-Origin: *`. Das ist keine CodeQL-Schwachstelle, aber eine Härtungsfrage (CORS auf einem KI-Endpunkt). Nicht geändert, da Vertragsänderung.

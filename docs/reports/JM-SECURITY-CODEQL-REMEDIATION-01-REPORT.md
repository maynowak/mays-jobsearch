# JM-SECURITY-CODEQL-REMEDIATION-01 — Security Remediation Report

**Status:** READY FOR SECURITY REVIEW (vorbehaltlich der im Abschnitt 11 dokumentierten Gates)
**Erstellt:** 2026-11-25
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `security/jm-codeql-remediation-01`
**Basis:** `origin/main` `aa57500` (Merge PR #67)
**Inventar:** [`docs/reports/JM-CODEQL-FINDINGS-INVENTORY-01.md`](./JM-CODEQL-FINDINGS-INVENTORY-01.md)

## 1. Basis und Branch-HEAD

| | SHA | Datum |
| --- | --- | --- |
| `origin/main` Basis | `aa57500` | 2026-11-25 17:59 |
| Baseline-Analyse | `df1fe01` (Run 45645491629, `main`) | 2026-11-25 15:28 |
| SEC-01 HTML/XSS | `5c729b6` | — |
| SEC-02 URL-Validierung | `4078ff0` | — |
| SEC-03 Randomness/Fehlerausgabe | `0dd97d6` | — |
| SEC-04 Temp-Datei/Runtime | `cc10d2b` | — |
| SEC-05 Restbefunde | `c91e097` | — |
| Nachkorrektur Regex-Anker | `348a54c` | — |
| Review-Nachbesserungen + `filter.mjs`-Migration | `e843ed8` | — |
| Test-Hygiene (echte Entity-Fixtures, case-insensitive Boundary) | `4e6d292` | — |
| Scanner-Kanten, Entity-Tabelle, Match-Impact-Validierung | `8ba0c43` | — |
| Feature-HEAD vor Doku | `8ba0c43` | — |

Kein Merge nach `main`, kein Deployment, kein Force-Push, keine Branch-Löschung.

## 2. Anzahl aller untersuchten Findings

**86 offene Alerts** (alle Seiten der Code-Scanning-API), 23 geschlossene Alerts als Kontext. Vollständige Liste mit Alert-Nummer, Regel, Severity, Pfad/Zeile, Triage und Status: siehe Inventar.

## 3. Findings nach Severity

| Severity | Anzahl | Regeln |
| --- | --- | --- |
| High (security severity) | 17 | `js/bad-tag-filter` 3, `js/incomplete-url-substring-sanitization` 9, `js/xss-through-dom` 2, `js/insecure-randomness` 1, `js/insecure-temporary-file` 1, `js/regex/missing-regexp-anchor` 1 |
| Medium | 7 | `js/identity-replacement` 6, `js/stack-trace-exposure` 1 |
| Error (CodeQL severity) | 1 | `js/call-to-non-callable` 1 |
| Warning ohne Security-Level | 3 | `js/useless-assignment-to-local` 2, `js/duplicate-property` 1 |
| Note | 58 | `js/unused-local-variable` 58 |

Produktivcode: 51 Alerts, Testcode: 35 Alerts.

## 4. Bestätigte Sicherheitslücken / Defekte

- **A — `js/call-to-non-callable` (#48, `api/cv-improvement.mjs`):** Der Handler importierte `computeImprovementDelta`, das im importierten Modul nicht existierte (dort nur `compareAtsResults`). Der Reanalyze-Zweig rief damit `undefined` auf. Zusätzlich verlangte die generische Validierung ein `profile`-Feld, obwohl der Zweig `originalProfile`/`improvedProfile` nutzt. Beides behoben, Regressionstest ergänzt.
- **Verfügbarkeit (während der Umsetzung entdeckt und behoben):** Die erste Fassung von `findRawTextEnd` lowercaste den gesamten Eingabetext pro Kandidat (O(n²) bei adversarialen `</scriptx`-Payloads) und konnte bei unauthentifizierten Endpunkten Zeit bis zum Timeout binden. Der finale Scanner prüft case-insensitiv ohne Kopie (linear); Regressionstest vorhanden.
- **Keine bestätigte, aus dem Internet ausnutzbare XSS-/SSRF-/Auth-Lücke** im Baseline-Set. Die High-Findings in Produktivcode wurden als **B (Security Hardening)** eingestuft: unvollständige HTML-Textfilterung, unnötige DOM-HTML-Parse-Pfade, vorhersagbare Session-IDs. Sie wurden dennoch vollständig korrigiert.

## 5. Behobene Findings

Alle 86 Baseline-Alerts wurden im Quellcode adressiert:

- **HTML/XSS (#10, #91, #92, #93, #107):** Neuer gemeinsamer, DOM-freier Tag-Scanner und Entity-Decoder (`api/_lib/htmlText.mjs` + `.d.mts`, typisiert für das Frontend). `api/job-details.mjs`, `api/cover-letter.mjs`, `src/lib/jobDescriptionReview.ts`, `src/lib/safeHtml.tsx`, `src/lib/jobMeta.ts` nutzen ihn. Kein `innerHTML`, kein `DOMParser` mehr für Text-Extraktion; `dangerouslySetInnerHTML` bleibt ausschließlich hinter DOMPurify.
- **URL-Validierung (#7, #8, #9, #60, #67, #73, #86, #87, #96):** `tests/helpers/url.mjs` mit `URL`-Parsing und exaktem Hostname-Vergleich; alle Fetch-Mocks umgestellt. Zusätzlicher Regressionstest deckt Suffix-, Userinfo- und Query-Tricks ab.
- **Randomness (#85):** `src/lib/secureRandomId.ts` (CSPRNG), verwendet in `manualSearchProfiles.ts` und `cvProfileStore.ts`; ID-Format unverändert.
- **Stack Trace (#89):** Mock-REST-Server liefert generischen Fehlercode.
- **Temp-Datei (#99):** `mkdtemp` mit 0700, Results-Datei 0600; ungenutzte Pfad-Helfer entfernt.
- **Runtime (#48):** Export + eigene Validierung des Reanalyze-Zweigs; der gleichartige `match-impact`-Zweig validiert jetzt ebenfalls seine eigenen Felder (`8ba0c43`).
- **Qualität (#1–#6, #88, #90, #95, #96–#114):** Identitäts-Ersetzungen durch echten Decoder ersetzt, Duplikat entfernt, tote Initialwerte, 58 unbenutzte Importe/Variablen/Helper entfernt. Der zuvor „unbenutzte“ Delta-Helper ist jetzt korrekt exportiert und getestet.

## 6. Verbleibende Findings

- **Quellcode:** keine offenen Baseline-Findings.
- **GitHub-Alerts:** werden durch die Branch-Analyse bewertet (Abschnitt 10). `main` behält seine Alerts bis zur Integration einer geprüften Korrektur.
- **Außerhalb des CodeQL-Sets:** `api/cv-improvement.mjs` setzt `Access-Control-Allow-Origin: *`; keine Änderung (API-Vertrag, keine CodeQL-Regel). Die Client-Routen `/api/v1/cv-improvement…` haben keine `vercel.json`-Rewrite-Regel und sind im Production-Build nicht erreichbar; kein Routing-Umbau (Produktentscheidung).

## 7. Nachgewiesene False Positives

Keine Alerts wurden als False Positive dismissed oder markiert. Zwei Befunde wurden fachlich als **nicht ausnutzbar, aber unnötig** bewertet und trotzdem gehärtet:

- #10 `safeHtml.tsx`: `textarea.innerHTML` auf einem detached Element führt keinen Code aus; der dekodierte Wert lief anschließend durch DOMPurify.
- #91 `jobDescriptionReview.ts`: `DOMParser`-Ergebnis wurde nur als `textContent` gelesen; kein Render-Sink.

## 8. Geänderte Komponenten

52 Dateien, +992/−279 Zeilen (ohne diese Doku). Schwerpunkte:

- **Neu:** `api/_lib/htmlText.mjs` (+ `.d.mts`), `src/lib/secureRandomId.ts`, `tests/helpers/url.mjs`, drei neue Testdateien (`tests/api/html-text.test.mjs`, `tests/api/url-host-validation.test.mjs`, `src/lib/secureRandomId.test.ts`).
- **API:** `api/job-details.mjs`, `api/cover-letter.mjs`, `api/cv-improvement.mjs`, `api/ats-analysis.mjs`, `api/_lib/ats.mjs`, `api/_lib/searchStrategy.mjs`, Quellen-Adapter/Imports.
- **Frontend:** `src/lib/jobDescriptionReview.ts`, `src/lib/safeHtml.tsx`, `src/lib/jobMeta.ts`, `src/lib/manualSearchProfiles.ts`, `src/lib/cvProfileStore.ts`, `src/lib/cv-improvement.js`, `src/components/ApplicationsSection.tsx`.
- **Tests/E2E/Scripts:** Quellen-Mocks, Boundary-Test, IP-Quota-Mock, E2E-Cleanups, `scripts/purge-cv-profile-cache.mjs`.

Keine Änderung an RIS, AWS, Terraform, Cognito, Consent-Verträgen, Produktionsdaten, Persistenzformaten oder CI-Berechtigungen. `.github/workflows/codeql.yml` unverändert.

## 9. Neue Regressionstests

| Datei | Absicherung |
| --- | --- |
| `tests/api/html-text.test.mjs` | Script-/Style-/Raw-Text-Entfernung inkl. `</script >`, `</SCRIPT\n>`, `</script data-x>`, XHTML `<script/>`, unclosed `<script>`, Kommentare, Quotes in Attributen, Vergleichstext (`2 < 3`), lineare Verarbeitung eines adversarialen `</scriptx`-Payloads, Unicode-Offsetfall, Entity-Decoding (benannt/dezimal/hex, mehrfach kodiert, Legacy ohne Semikolon, URL-Schutz, ungültige Codepoints). |
| `tests/api/job-translation.test.js` | Translation-Prompt enthält keine Script-/Event-Handler-Payloads; sichtbarer Text bleibt erhalten. |
| `tests/api/cover-letter.test.mjs` | Anschreiben-Prompt enthält keine HTML-/Script-Payloads. |
| `tests/api/url-host-validation.test.mjs` | Exakter Hostname; Ablehnung von Suffix-, Userinfo-, Query- und ungültigen URLs. |
| `src/lib/safeHtml.test.ts` | Entity-kodierte, echt doppelt und dreifach kodierte HTML-Payloads; Event-Handler/Script werden vor dem Rendern entfernt; unclosed Script bleibt draußen. |
| `src/lib/jobDescriptionReview.test.ts` | Alle End-Tag-Varianten, Raw-Text-Container, Entity-Decoding, Vergleichstext. |
| `src/lib/secureRandomId.test.ts` | CSPRNG-Format, Eindeutigkeit, kein `Math.random` in den Session-ID-Generatoren. |
| `tests/api/cv-improvement-api.test.mjs` | Reanalyze liefert Delta mit `scoreDelta`/`requirementDeltas`; ungültiger Job → 400. |
| `tests/api/filter.test.js` | `stripHtml` entfernt Script-Bodies und Event-Handler, decodiert einfache und doppelt kodierte Markup-Beispiele in der dokumentierten Reihenfolge (`&lt;p&gt;`/`&amp;lt;p&amp;gt;`), testet `htmlToPlainText` direkt und erhält Vergleichstext (`Salary < 50000`). |
| `tests/api/cv-improvement-match-impact.test.mjs` | Match-Impact liefert Delta ohne `profile`-Feld; ungültiger Payload → 400; keine echten KI-Aufrufe (gemockt). |

Die Tests prüfen das ursprüngliche Risiko (Payload/URL/Format), nicht nur die neue Implementierung.

## 10. CodeQL-Vorher-/Nachher-Vergleich

| Lauf | Ref | Commit | Ergebnis |
| --- | --- | --- | --- |
| 45645491629 (Baseline) | `main` | `df1fe01` | **86 offene Alerts** |
| 45665338849 (Zwischenlauf) | `security/jm-codeql-remediation-01` | `c91e097` | 1 offener Alert (`js/regex/missing-regexp-anchor`) |
| 45666252232 (Zwischenlauf) | `security/jm-codeql-remediation-01` | `348a54c` | 0 offene Alerts |
| 45670378147 / 45671589470 (Zwischenläufe) | `security/jm-codeql-remediation-01` | `e843ed8`, `4e6d292` | Analyse erfolgreich |
| **45672927313** (final) | `security/jm-codeql-remediation-01` | `8ba0c43` | **0 offene Alerts** |

Branch-Abfrage: `GET /code-scanning/alerts?state=open&ref=refs/heads/security/jm-codeql-remediation-01` → `[]`.

- **Behoben:** 86 (alle Baseline-Findings im Branch nicht mehr vorhanden).
- **Verbleibend (Branch):** 0.
- **Neu:** 0.
- **Noch nicht neu analysiert:** keine; die Branch-Analyse lief vollständig und erfolgreich (`CodeQL Analysis (javascript-typescript, none): success`).
- **`main`:** Die 86 Baseline-Alerts bleiben dort offen, bis eine geprüfte Korrektur integriert und `main` erneut analysiert wurde. Es wurden **keine** Alerts dismissed oder manuell geschlossen.

- Keine Regel deaktiviert, keine Datei ausgeschlossen, kein Query-Filter geändert (`queries: +security-and-quality` bleibt).
- Keine Dismissals.

## 11. Build- und Testergebnisse

| Gate | Ergebnis |
| --- | --- |
| TypeScript (`tsc -b`) | **PASS** |
| Production-Build (`npm run build`) | **PASS** |
| API-Syntax (`node --check api/**/*.mjs`) | **PASS** |
| Fokussierte Security-/Regressionstests | **182 PASS** in 12 Dateien (html-text, job-translation, cover-letter, cv-improvement-api, cv-improvement-match-impact, ris-boundary, url-host-validation, filter, secureRandomId, safeHtml, jobMeta, jobDescriptionReview) |
| Serielle Vollsuite (`npx vitest run --no-file-parallelism`, HEAD `8ba0c43`) | **2153 PASS / 5 skipped** · 203 Dateien PASS / 3 Dateien skipped (206) · 234 s |
| `git diff --check` | **PASS** |
| Secret-Scan über den Gesamtdiff | **PASS** (keine Treffer) |
| CodeQL (Run 45672927313, HEAD `8ba0c43`) | **PASS** — 0 offene Alerts auf dem Branch |

Übersprungene Dateien sind die opt-in Live-Suiten (`tests/api/sources-live.test.mjs`, `apify-live.test.mjs`, `theirstack-live.test.mjs`; kostenpflichtig/Credits) sowie einzelne bereits vorhandene Skip-Fälle. Es gibt keine fehlgeschlagenen Tests; die Altlast `cv-builder-workflow-02a` trat in diesem Lauf nicht als Fehler auf.

## 12. Bekannte Einschränkungen

- **Reichweite:** Die Client-Funktionen für `/api/v1/cv-improvement…` sind ohne Rewrite nicht erreichbar; der Handler wurde dennoch korrigiert. Eine Routing-/Vertragsklärung ist eine separate Produktentscheidung.
- **#85:** Die Alert-Position (`sessionRepositories.ts:124`) war gegenüber der tatsächlichen Zufallsquelle (`manualSearchProfiles.ts`) verschoben; die Ursache wurde an der Quelle behoben.
- **Test-only Findings:** URL-, Temp-Datei- und Stack-Trace-Findings lagen ausschließlich in Tests; sie beeinflussen die Produktionssicherheit nicht, wurden aber bereinigt, damit die Tests belastbare Aussagen liefern.
- **Keine neuen Abhängigkeiten:** HTML-Text-Extraktion und ID-Erzeugung nutzen Browser-/Node-Standard-APIs; keine neue npm-Abhängigkeit.
- **Altlast:** `cv-builder-workflow-02a` (alter Buttontext) bleibt unverändert und ist keine Regression dieses Pakets.
- **CORS:** `Access-Control-Allow-Origin: *` auf `api/cv-improvement.mjs` bleibt als Härtungsfrage offen (Vertragsänderung).
- **Legacy-Entities:** Benannte References ohne Semikolon werden nur im Textkontext und nicht vor Wortzeichen/`=` dekodiert (z. B. bleibt `?a=1&copy=2` unverändert). Das entspricht dem Schutz von URLs, weicht aber bewusst von der vollständigen HTML5-Attribut-Semantik ab. Die Entity-Tabelle deckt die in Stellenanzeigen üblichen typografischen, mathematischen und griechischen Referenzen ab, ist aber keine vollständige HTML5-Liste (bewusster Verzicht auf eine ~2.000-Einträge-Tabelle).
- **`filter.mjs`-Migration:** Der bisherige Regex-Tagfilter ist ersetzt; ATS-/Keyword-Texte erhalten dadurch keinen Script-/Style-Inhalt mehr. Bestehende Filter-Tests, die Script-Inhalt als „Text“ erwarteten, wurden auf das sichere Verhalten aktualisiert (dokumentiert in §9).

## 13. Commit-SHAs

```
5c729b6 fix(security): replace regex HTML filtering with text scanner
4078ff0 test(security): validate mocked hosts via parsed URL hostname
0dd97d6 fix(security): CSPRNG session ids and no raw errors in test server
cc10d2b fix(security): private evidence dir, defined delta helper, no dead assignments
c91e097 chore(security): remove dead code reported by CodeQL
348a54c test(security): assert RIS endpoint absence without host regex
e843ed8 fix(security): harden text scanner and migrate legacy stripHtml
4e6d292 test(security): use real encoded fixtures and case-insensitive boundary check
8ba0c43 fix(security): linear scanner edges and match-impact validation
```

## 14. Offene Folgearbeiten

1. **PR-Review und Merge-Entscheidung** durch den Auftraggeber (kein Merge in diesem Paket).
2. **CORS-Härtung** für `api/cv-improvement.mjs` prüfen (Allowlist statt `*`), falls der Endpunkt produktiv erreichbar gemacht wird.
3. **Routing-Klärung** der `/api/v1/cv-improvement…`-Clientpfade (Rewrite oder Client-Aufrufe entfernen) als eigenes Paket.
4. **Match-Impact-Validierung:** behoben (`8ba0c43`); eigener Regressionstest mit gemocktem Matching/keine KI-Aufrufe. Endpunkt bleibt produktiv ohne Rewrite unerreichbar.
5. **Restliche `Math.random`-IDs:** `applications/*`, `App.tsx`, `cvBuilder/*` erzeugen weiterhin nicht-sicherheitsrelevante UI-/Session-IDs mit `Math.random`; außerhalb des Alert-Sets, als künftige Härtung dokumentiert.
6. **Alert-Bereinigung auf `main`** erfolgt automatisch nach Merge und erneuter Analyse auf `main`; keine manuellen Dismissals.

## 15. Unabhängige Reviews (Subagenten)

Drei read-only Subagenten prüften den Branch parallel; alle Befunde wurden vor dem finalen Commit `e843ed8` adressiert oder dokumentiert.

| Review | Ergebnis | Eingearbeitet |
| --- | --- | --- |
| Security Review | **READY FOR SECURITY REVIEW**; keine BLOCKER/MAJOR. MINOR: O(n²)/Offset-Drift in `findRawTextEnd`, `<script/>`-Bypass, Legacy-Regexfilter in `filter.mjs`. | Linearer, case-insensitiver Scan ohne Lowercase-Kopie; `<script/>`/`<style/>` als Raw-Text-Start; `filter.mjs` auf den gemeinsamen Scanner migriert. |
| Tester (unabhängige Gates) | Alle ausführbaren Gates PASS; Doku-Abweichungen: falsche Baseline-Run-ID, 133→137 fokussierte Tests, Diffstat +717→+719, Heredoc-Reste am Dateiende. | Run-ID `45645491629`, Testzahlen/Diffstat aktualisiert, Heredoc entfernt. |
| Reviewer (final) | **BLOCKED** nur wegen Evidence-Gates (CodeQL-/Doku-Stand), nicht wegen Code; zusätzlich Scanner-Kanten, `filter`-Fixtures, Match-Impact, Entity-Abdeckung und `<svg/>`/`<math/>` als MINOR/NIT. | Finaler CodeQL-Lauf auf dem gepushten HEAD, Doku-Commit, §11-Zahlen; Vergleichstext-/Entity-/Match-Impact-/Foreign-Content-Punkte in `8ba0c43` behoben. |

Zusätzlich geprüft: `dangerouslySetInnerHTML` existiert nur hinter DOMPurify; keine Produktions-`innerHTML`-Sinks; keine neuen Netzwerkaufrufe/Abhängigkeiten; keine RIS-/AWS-/Terraform-/Cognito-/Consent-Änderung; keine Secrets in Diff oder Berichten.

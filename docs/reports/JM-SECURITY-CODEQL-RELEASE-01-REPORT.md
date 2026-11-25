# JM-SECURITY-CODEQL-RELEASE-01 — Controlled Main Merge & Verification

**Status:** **PRODUCTION VERIFIED — TRANSLATION LIVE CHECK BLOCKED BY MODEL PROVIDER** (Hotfix deployed; Wrapper-Fix im ausgelieferten Client live verifiziert)
**Datum:** 2026-11-25
**Repository:** `maynowak/mays-jobsearch`
**PR:** [#68](https://github.com/maynowak/mays-jobsearch/pull/68) — `security/jm-codeql-remediation-01` → `main`
**Geprüfter Code-HEAD:** `1cbba4e` · **Merge-Commit / Main-HEAD:** `b4157e5`

## 1. Merge und Deployments

| | Wert |
| --- | --- |
| PR | #68, `CLEAN`/`MERGEABLE`, Merge mit `--match-head-commit 1cbba4e` |
| Merge-Commit | `b4157e5` (`Merge pull request #68`) |
| `origin/main` | `b4157e5` |
| Vercel `mays-jobsearch` | `dpl_AWaZMp1gMfLeL4BA9UCVby1E7rFE` · Production · READY · 35 s |
| Vercel `mays-job-matcher` | `dpl_HETitnDLu17FSTeopvp2j7YHSyoc` · Production · READY · 43 s |
| Production-Domain | `https://www.mays-job-matcher.app` |
| Build-Identität | Footer `Version 2.2.0 · production · main · b4157e5` auf Domain und beiden Deployment-URLs |

Automatische Git-Deployments; kein manuelles `vercel --prod`, kein Force-Push, keine Branch-Löschung.

## 2. Security-Abnahme

- Baseline `main`/`df1fe01`: **86 offene Alerts** (17 high, 7 medium, 1 error, 3 warning, 58 note), Run `45645491629`.
- Release-HEAD `1cbba4e`: **0 offene Alerts**, CodeQL-Run `45679171026` (`success`); PR-CodeQL `45678578404` (`success`).
- Keine Regeln deaktiviert, keine Dateien ausgeschlossen, keine Alerts dismissed.
- `.github/workflows/codeql.yml`, `package.json`, `vercel.json`, `api/ris/**`, AWS/Terraform/Cognito/Consent unverändert.

## 3. Gates am Release-HEAD `1cbba4e`

| Gate | Ergebnis |
| --- | --- |
| TypeScript (`tsc -b`) | PASS |
| Production-Build | PASS |
| API-Syntax (`node --check api/**/*.mjs`) | PASS |
| Fokussierte Security-Suiten | 182 PASS / 12 Dateien (vor dem Display-Fix; danach 127 PASS in den 6 geänderten Suiten) |
| Serielle Vollsuite | **2158 PASS / 5 skipped** (203 Dateien PASS, 3 opt-in Live-Suiten skipped) |
| `git diff --check` | PASS |
| Secret-Scan | PASS |
| CodeQL | PASS (0 Alerts) |
| Vercel Preview | beide Projekte READY, Footer `preview · 1cbba4e` |

## 4. Job-Display-Vorher-/Nachher-Vergleich

16 identische Fixtures wurden auf `main` `aa57500` und dem Release-HEAD durch `stripHtml`, `htmlToPlainText`, `normalizeDescriptionText`, `evaluateDescription`, `descriptionPreview`, `prepareHtmlForRender` sowie durch die echten Cover-Letter-/Translation-Prompts (gemockter Chat) geführt. Ergebnis:

- **Kein unerwarteter Textverlust.** Alle Titel-/Arbeitgeber-/Standortfelder unverändert; Beschreibungen vollständig.
- **Bewusste Unterschiede:** Script-/Style-/noscript-/SVG-/MathML-Inhalte entfernt (Security), Block-/Listen-/Tabellenstruktur als Zeilenumbrüche erhalten, Entities (inkl. `&le;`, `&Omega;`) dekodiert, doppelt codiertes HTML zu reinem Text, `< 80k.` bleibt erhalten, `</p>` erscheint nicht als Rohtext.
- **URLs:** Query-Parameter bleiben intakt (`?a=1&copy=2` wird als `&amp;copy` korrekt serialisiert, nicht zu `©`).
- **Prompts:** identische fachliche Inhalte; zusätzliche Zeilenumbrüche bei HTML-Listen. Keine entfernten Qualifikationen.
- **Sicherheit:** 0 Treffer für `<script`, `onerror`, `javascript:`, `<style`, `alert(1)` in allen erzeugten Text-/HTML-Ausgaben.

## 5. Browser-E2E (vor Merge)

Neue deterministische E2E `tests/e2e/jm-job-display-release-01.mjs` mit gemockten Quellen:

- 5 Match-Karten + 1 Rich-HTML-Karte; 1440 und 390.
- Sichtbar: Titel, Arbeitgeber, Standort, Aufgaben/Anforderungen, Tabelle, Umlaute, `≤ ≥ ∞ Ω α`, `Gehalt < 80k.`, doppelt codiertes `Java` als `<strong>`.
- DOM: 0 `<script>`, 0 Event-Handler, 0 `javascript:`-Links, 0 XSS-Ausführung, 0 Overflow, 0 Console-/Page-Errors.
- Genau 1 `/api/jobs`- und 1 `/api/match`-Aufruf; keine zusätzlichen Detail-Abrufe.

## 6. Production-Smoke

Desktop 1440 und Mobile 390, Routen `/`, `/search`, `/profil`, `/profil?tab=applications`, `/cv-builder/workspace`, `/datenschutz`, `/impressum`, `/anmelden`:

- alle **HTTP 200**, 0 horizontaler Overflow, 0 Console-/Page-Errors.
- Footer überall `production · main · b4157e5`.

Job-Display auf Production (eine Suche, keine KI-Bewertung):

- **50 Treffer-Karten**, 1 `/api/jobs`-Aufruf, 0 `/api/match`, 0 `/api/job-details`.
- 4 Stichproben mit Beschreibungen 6.910 / 5.140 / 6.780 / 5.596 Zeichen.
- 0 rohe HTML-Fragmente (`</p>` etc.), 0 `<script`/`onerror`/`javascript:`, 0 Entity-Leaks; Titel/Arbeitgeber/Standort vorhanden.

## 7. Kritischer Fehler: Übersetzungsanzeige (Blocker)

**Beobachtung (Production):** Nach „Deutsch lesen“ beginnt die angezeigte Übersetzung mit dem Roh-Wrapper `{"translation":"` und endet mit `"}`. Der Originaltext ist nicht betroffen; die Übersetzung selbst ist inhaltlich vollständig.

**Reproduktion:** Modellantwort mit ungültigem JSON (unescaped Anführungszeichen/Zeilenumbrüche) → `parseTranslation` fällt auf Rohtext zurück und liefert den Wrapper mit.

**Ursache:** `api/job-details.mjs` → `parseTranslation()`: Bei fehlgeschlagenem `JSON.parse` wird `text` unverändert zurückgegeben. Der Fallback ist für reine Textantworten gedacht, entfernt aber weder `{"translation":"` noch `"}`.

**Einordnung:** **Vorbestehender Defekt, keine Regression dieses Releases.** `git diff aa57500..b4157e5 -- api/job-details.mjs` enthält keine Änderung an `parseTranslation` (0 Treffer); die Funktion ist auf `aa57500` identisch. Der Release hat nur die Eingabe-Extraktion (`translationPlainText`) verändert.

**Impact:** Sichtbarer Roh-JSON-Wrapper in der Übersetzungsansicht; keine Datenänderung, keine XSS-Ausführung, Originaltext weiterhin maßgeblich.

**Kein Rollback empfohlen:** Ein Rollback auf `aa57500` würde den Fehler nicht beheben und die 86 CodeQL-Alerts wieder einführen.

## 8. Hotfix-Vorschlag (Freigabe erforderlich)

1. `parseTranslation()` härten:
   - strikte JSON-Extraktion beibehalten;
   - bei ungültigem JSON den Wrapper `{"translation":"…"}` tolerant entfernen und JSON-Escapes (`\"`, `\\`, `\n`, `\r`, `\t`, `\/`, `\uXXXX`) auflösen;
   - niemals Text zurückgeben, der mit `{"translation"` beginnt;
   - Größenlimit weiterhin anwenden.
2. Client-Guard (Defense in Depth): Wrapper-Präfix in `RemainingCard` nicht anzeigen.
3. Regressionstests: valides JSON, Fenced JSON, ungültiges JSON mit unescaped Quotes/Newlines, abgeschnittenes JSON, doppelt codiertes JSON, reiner Text-Fallback.
4. Danach CodeQL + Vollsuite + Preview/Production-Übersetzung erneut prüfen.

**Benötigte Freigabe:** separater Hotfix-Branch/PR (kein direkter Main-Push) und erneutes Production-Deployment.

## 8a. Hotfix-Umsetzung und erneute Verifikation

| | Wert |
| --- | --- |
| Hotfix-Branch | `fix/jm-translation-json-unwrap-01` |
| Commit | `54703a8` |
| PR | [#69](https://github.com/maynowak/mays-jobsearch/pull/69), `CLEAN`/`MERGEABLE`, Merge mit `--match-head-commit` |
| Merge / `main` | `776112b` |
| CodeQL | PR-Run `45688309791` PASS; `main`-Analyse `45689378465` mit **0** Ergebnissen in `/language:javascript-typescript` |
| Vollsuite | **2166 PASS / 5 skipped** (204 Dateien) |
| Deployments | `mays-jobsearch` `dpl_93oR7aAqqAGHRk6hJNo77kLrZ2KB`, `mays-job-matcher` `dpl_2iMsaug3vqaHe3ss2ba5B5SbnWdE`, beide Production READY |
| Build-Identität | `production · main · 776112b` auf Domain und beiden Deployment-URLs |

**Fix:** `parseTranslation` entpackt strikte, gefencte, doppelt codierte, abgeschnittene und ungültige JSON-Antworten und dekodiert JSON-Escapes; der Client (`unwrapTranslationEnvelope`) entfernt als Defense in Depth jedes verbliebene `{"translation":…}`. Regressionstests: valides JSON, Fenced, unescaped Quotes/Newlines, abgeschnitten, doppelt codiert, Plain-Text, Client-Guard.

**Production-Nachweis (Client, ohne KI):** Auf `https://www.mays-job-matcher.app` wurde `/api/job-details` mit einer absichtlich malformed Wrapper-Antwort (`{"translation":"Er sagte "Hallo"\nWelt"}`) gemockt. Ergebnis: `translateCalls=1`, Anzeige beginnt mit `Er sagte "Hallo"`, **kein** `{"translation"`, **kein** `"translation":`, 0 Console-/Page-Errors.

**Live-Übersetzung:** Der Modell-Provider antwortet aktuell mit **502 `model_unavailable`** (zwei Versuche, auch nach Wartezeit); `/api/models` listet Free-Modelle, der Übersetzungsaufruf scheitert dennoch. Damit konnte die echte Modellübersetzung nicht erneut Ende-zu-Ende ausgeführt werden. Server-Parser ist durch die Regressionstests abgedeckt; der sichtbare Wrapper ist durch den live verifizierten Client-Guard ausgeschlossen.

**Legacy-Alerts:** `main` hat 0 offene Alerts in der aktuellen Kategorie `/language:javascript-typescript`. 21 ältere Alerts der retired Kategorie `/language:javascript` (Altzustand, Commit `31d8322`) bleiben offen, da diese Kategorie nicht mehr analysiert wird. Keine Dismissals, keine Regeländerung.

## 9. Status und offene Punkte

- Release `b4157e5` war wegen des Übersetzungs-Wrappers **nicht** verifiziert; Hotfix `776112b` ist deployt und der sichtbare Fehler ist behoben.
- **Offen:** eine echte Live-Übersetzung mit Modell (Provider derzeit 502). Sobald verfügbar, einmal mit einer harmlosen englischen Synthetik-Anzeige wiederholen; bis dahin bleibt dieser eine Check dokumentiert unverifiziert.
- Keine schreibenden Production-Tests nach dem Fehler; keine echten Bewerbungen/CVs verändert.
- Keine RIS-/AWS-/Terraform-/Cognito-/Consent-Änderung.
- Offene Härtungsaufgaben aus dem Security-Paket bleiben: CORS-Allowlist, Routing `/api/v1/cv-improvement…`, restliche `Math.random`-UI-IDs.
- Nach Provider-Recovery: Production-Übersetzung mit harmloser synthetischer Anzeige verifizieren; der Wrapper-Fix selbst ist live (Client) und per Tests (Server) belegt.

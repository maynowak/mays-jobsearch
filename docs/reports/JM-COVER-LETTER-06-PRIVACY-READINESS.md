# JM-COVER-LETTER-06-PRIVACY-READINESS

**Art:** Privacy Hardening / Provider-Test-Vorbereitung / Release-Gate
**Status:** **YELLOW — technische Härtung abgeschlossen, Produktionsfreigabe NO-GO**
**Datum:** 2026-11-01
**Deployment:** keines

## 1. Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `be3a3c1` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Änderungen

### G05 — Fail-Closed für unredigierte CV-Übertragung

**Frontend:**

- Die Option zur unredigierten CV-Übertragung wurde aus dem LetterModal entfernt.
- Der CV-Text wird immer über `anonymizeText()` geführt.
- Der Dialog zeigt nur noch:
  - „CV-Text vor der Übertragung anonymisieren“
  - Hinweis auf die Grenzen der Anonymisierung
  - Hinweis, dass unredigierte Übertragung in diesem Release nicht verfügbar ist.

**Backend (`api/cover-letter.mjs`):**

- `candidate.mode="cv"` akzeptiert nur noch `cv_anonymized=true`.
- Fehlendes oder `false` → HTTP 400 `cv_raw_not_allowed`.
- Manipulierte Frontend-Eingaben können die Sperre nicht umgehen.
- Der anonymisierte Pfad bleibt unverändert.

**Wichtig:** `cv_anonymized=true` ist ein Client-Signal, kein Beweis für eine
vollständige Anonymisierung. Die serverseitige Sperre verhindert nur den
ausdrücklich unredigierten Pfad; sie ersetzt keine inhaltliche PII-Prüfung.

### 30.000-Zeichen-Grenze

Die bereits in CL-05 korrigierte Grenze bleibt aktiv:

- Browser und Server lehnen zu lange CV-Texte transparent ab.
- Keine stille Kürzung.
- Keine KI-Zusammenfassung, kein zweiter PDF-Parser.

## 3. Datenschutz-Datenfluss

```text
Browser
  ├─ ausgewähltes PDF (lokal, kein Upload an /api/cover-letter)
  ├─ extractPdfText() lokal
  ├─ anonymizeText() standardmäßig
  ├─ ausgewählte Stellenbeschreibung + Job-/Profilfelder
  └─ POST /api/cover-letter
        ├─ serverseitige Validierung/Längenbegrenzung
        ├─ kein Redis-/RIS-/DB-Schreibpfad
        └─ Prompt an OpenRouter oder EdenAI
              └─ Antwort: Anschreibentext → Browser
```

### Übertragene Datenkategorien

- Jobtitel, Arbeitgeber, Ort, URL/Quelle, Tags
- ausgewählte Stellenbeschreibung
- Beschreibungsherkunft
- bestätigte manuelle Bewerberangaben
- anonymisierter CV-Text (falls CV gewählt)
- Zielberufe, Sprache, Stil, Länge, Modell-ID

### Nicht übertragen

- PDF-Datei
- CV-Dokument-ID
- CV-Hash
- Redis-/RIS-Daten
- Cookies/neue Identitäten

## 4. Providerübersicht

| Provider | Konfiguration | Standardmodell (Code) | Grenzen |
|---|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` in Production konfiguriert | `openai/gpt-4o-mini` | Free-Model-Prüfung, Monatsbudget 1000 Requests, Soft-USD beratend |
| EdenAI | `EDENAI_API_KEY` in Production konfiguriert | `cloudflare/@cf/google/gemma-7b-it-lora` | Monatsbudget 200 Requests, Soft-USD beratend |

Die tatsächlich aktiven Modelle und Fallback-Reihenfolge können durch
`OPENROUTER_MODEL`, `EDENAI_MODEL` und `MODEL_FALLBACK_MAX_ATTEMPTS`
konfiguriert sein. Produktive Werte wurden nicht ausgelesen.

Nicht aus dem Repository belegbar und daher **nicht behauptet**:

- konkrete Auftragsverarbeitungsverträge
- Datenstandorte/Regionen der Provider
- Trainings-/Speicherfristen
- konkrete Drittlandstransfers
- Provider-Löschprozesse

## 5. Logging und Datenminimierung

- Provider loggen Modell, Status, Fehlercode – keinen Prompt und keine
  CV-Inhalte.
- `api/cover-letter` loggt keine Request-Bodies.
- Der Prompt enthält die ausgewählte Beschreibung und ggf. den anonymisierten
  CV-Text; beides ist für die Funktion erforderlich.
- URLs/Quellen werden nur als Stellenreferenz übertragen.
- Keine unnötigen CV-Metadaten (Dateiname, Dokument-ID, Hash).
- Keine zusätzliche Persistenz.

## 6. Bestehende Datenschutztexte — Befund

Geprüft:

- `public/legal/datenschutz.md`
- `public/legal/datenschutz.html`
- `docs/mays_job_matcher_datenschutzerklaerung_1.0.md`
- `src/components/Privacy.tsx`

Befunde:

1. Der öffentliche Text beschreibt allgemein externe KI- und CV-Verarbeitung,
   aber nicht den konkreten Anschreiben-Assistenten.
2. Er enthält noch die Aussage zu einem „zeitlich begrenzten serverseitigen
   Cache für strukturierte Profilinformationen“. Der CV-Profil-Cache wurde
   bereits entfernt; die Formulierung ist zu prüfen/zu korrigieren.
3. Die unredigierte CV-Übertragung wird nicht erwähnt; nach der Härtung ist sie
   technisch nicht verfügbar. Der Text sollte dennoch klarstellen, dass
   CV-Texte für die Anschreibengenerierung anonymisiert übertragen werden.
4. Es fehlen konkrete Empfänger-, Transfer- und Aufbewahrungsinformationen für
   OpenRouter/EdenAI. Diese sind nicht aus dem Repository belegbar.
5. Eine vollständige Anonymisierung wird nicht garantiert; das muss im
   Endtext klar bleiben.

### Vorgeschlagene Ergänzungen (nicht veröffentlicht)

**DE:**

> Für den Anschreiben-Assistenten werden die ausgewählte Stellenbeschreibung,
> die von Ihnen ausgewählten Bewerberangaben und – sofern Sie einen
> Lebenslauf auswählen – der daraus lokal extrahierte, anonymisierte
> CV-Text an einen externen KI-Anbieter übermittelt. Das Anschreiben wird
> nicht serverseitig gespeichert. Eine vollständige Anonymisierung kann nicht
> garantiert werden. Konkrete Anbieter, Empfänger, Aufbewahrungsfristen und
> Drittlandtransfers sind vor Veröffentlichung zu ergänzen.

**EN:**

> For the cover-letter assistant, the selected job description, the applicant
> information you provide and — if you select a CV — the locally extracted,
> anonymized CV text are sent to an external AI provider. The cover letter is
> not stored server-side. Complete anonymization cannot be guaranteed.
> Specific providers, recipients, retention periods and international transfers
> must be added before publication.

**Keine Veröffentlichung** ohne separate rechtliche Freigabe.

## 7. G09 — Synthetischer Live-Testplan

**`LIVE PROVIDER TEST: NOT EXECUTED`**

Keine echten Provideraufrufe durchgeführt.

### Testmatrix

| ID | Stelle | Bewerber | Erwartung |
|---|---|---|---|
| A | Cloud Engineer, AWS/Terraform | synthetischer CV mit AWS/Terraform | passende technische Schwerpunkte; keine erfundenen Zertifikate |
| B | Softwareentwickler, React/TypeScript | teilweise passende Kenntnisse | ehrliche Passung, keine erfundenen Berufsjahre |
| C | Projektmanager | Gast ohne CV, manuelle Angaben | allgemeine, aber konkrete Motivation; begrenzte Informationsbasis sichtbar |
| D | Stelle ohne Beschreibung | synthetischer CV | allgemeiner Text; keine erfundenen Anforderungen |
| E | Stelle fordert Kubernetes | CV ohne Kubernetes | Lücke nicht überspielen; keine erfundene Qualifikation |
| F | englischsprachige Stelle | englischer CV | englischer Text, korrekte Sprache |

### Vor jeder Durchführung

- ausdrückliche Benutzerfreigabe
- zulässiges Testbudget
- Provider-Verfügbarkeit
- Modellwahl und erwartete Kosten
- ausschließlich synthetische Daten
- keine echten personenbezogenen CVs

### Prüfkriterien

- Modellrouting und Fallback
- fachliche Passung
- Faktentreue
- Umgang mit fehlenden Qualifikationen
- Sprachqualität und Länge
- keine erfundenen Abschlüsse/Zeiten/Zertifikate/Gehälter
- keine Interviewabschnitte
- Prompt-Injection-Resistenz
- keine ungewollten personenbezogenen Daten

## 8. Regression

| Prüfung | Ergebnis |
|---|---|
| Cover-Letter-API | PASS — 13 Tests |
| LetterModal | PASS — 29 Tests |
| Modellrouting/Fallback | PASS |
| Serverseitige Raw-CV-Sperre | PASS |
| Gastmodus / CV-Auswahl | PASS |
| JobDescriptionReview / CL-01–CL-05 | PASS |
| Gesamtsuite | **1097 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| `/api/jobs` | 1 — kein zusätzlicher Request |
| `/api/job-details` | 0 |
| `/api/profile` | 1 — nur CV-Workflow |
| `/api/cover-letter` vor Start | 0 |
| `/api/cover-letter` nach Start | 1 |
| Ausgewählte Beschreibung/CV-Text | im Request |
| CV-Datei/-Hash/-ID | nicht im Request |
| Interviewabschnitt | nicht im Request/Response |
| Console Errors | keine |

`LIVE PROVIDER TEST: NOT EXECUTED`

## 9. Release-Gates

| Gate | Bewertung | Begründung |
|---|---|---|
| G01 Git-Integrität | **PASS** | Baseline geprüft, Remote synchron |
| G02 API-Vertrag | **PASS** | Felder/Modellrouting geprüft |
| G03 Modellrouting/Fallback | **PASS** | `options.model`, Legacy-Fallback, Tests |
| G04 Beschreibung/CV-Zuordnung | **PASS** | Selected-only, keine Fremd-CVs |
| G05 Datenschutz und Datenminimierung | **BLOCKED** | Technische Raw-Sperre PASS; finale Rechtsgrundlage/Anonymisierungsgrenze und Datenschutzfreigabe offen |
| G06 Sitzung/Race | **PASS** | Sequenz-/Identity-/Selection-Guards |
| G07 Frontend/Barrierefreiheit | **PASS** | Desktop/Mobil, Fokus, Export |
| G08 Tests/Browser-E2E | **PASS** | 1097/5, TypeScript, Build, E2E |
| G09 Modellqualität | **NOT VERIFIED** | `LIVE PROVIDER TEST: NOT EXECUTED` |
| G10 Datenschutztexte/Freigabe | **BLOCKED** | Texte nicht final, Rechtsprüfung offen |

### Gesamtbewertung

**YELLOW — technisch gehärtet, Produktionsfreigabe weiterhin NO-GO.**

Die unredigierte CV-Übertragung ist technisch fail-closed. Eine Freigabe des
anonymisierten Pfads allein aufgrund dieser Änderung ist ausdrücklich **nicht**
erfolgt: G05/G10 bleiben bis zur rechtlichen und Datenschutz-Freigabe blockiert,
G09 bis zu einem autorisierten Live-Test unverifiziert.

## 10. Offene Punkte

1. Rechtliche Bewertung der anonymisierten CV-Übertragung und der
   Anonymisierungsgrenzen.
2. Anbieter-/Empfänger-/Drittlandtransfer-Angaben für OpenRouter/EdenAI.
3. Konkrete Aufbewahrungs- und Löschfristen.
4. Autorisierter synthetischer Live-Provider-Test.
5. Finale DE/EN-Datenschutztexte und öffentliche Freigabe.
6. Entscheidung, ob die Raw-Option dauerhaft entfernt bleibt (empfohlen).

## 11. Git

- Fail-Closed-Korrektur: `3c54742`
- Dokumentations-Commit: `96559c1`
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung.

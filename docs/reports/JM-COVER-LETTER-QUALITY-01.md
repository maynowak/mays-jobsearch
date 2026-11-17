# JM-COVER-LETTER-QUALITY-01

**Status:** `MERGED / PRODUCTION DEPLOYED / SYNTHETIC PRODUCTION E2E VERIFIED`

**Date:** 2026-11-17
**Repository:** `maynowak/mays-jobsearch`
**Baseline:** `origin/main` `da1ebbb8cff28637874b17d2ee068ab64419968e`
**Final `origin/main`:** `fd50caffa3367ae6c83ee3718915f02488cfe67c`
**Release PR:** #28 merged
**Branch:** `feature/jm-cover-letter-quality-01`
**PR:** #28 (merged as `fd50caffa3367ae6c83ee3718915f02488cfe67c`)

## 1. Bisherige Prompt-Struktur

Der vorhandene Pfad bestand aus:

- `LetterModal` → `generateCoverLetter` → `/api/cover-letter`
- Jobkontext: Titel, Firma, Ort, Tags, Quelle, ausgewählte Beschreibung
- Bewerberkontext: Skills, Erfahrung, Qualifikationen, Motivation, Startdatum,
  Gehalt, optional anonymisierter CV-Text
- Optionen: Sprache, alter `style`, alte `length`, Zielrollen, Modell
- Regeln gegen erfundene Fakten und Interviewfragen

Es fehlten strukturierte Angaben zu Qualitätsklasse, Schreibstil, Tonalität,
Empfänger, belegten Erfolgen, Umzug, Beschäftigungspräferenz und zusätzlichen
Hinweisen. Der Prompt enthielt außerdem keine explizite
Professional-/Executive-/Public-Sector-Qualitätssteuerung und keine klare
250–350-Wörter-Zielspanne.

## 2. CoverLetterBriefV1

Neu in `src/lib/coverLetterRequest.ts`:

```ts
interface CoverLetterBriefV1 {
  qualityClass: "standard" | "professional" | "executive";
  writingStyle: "modern" | "classic" | "technical" | "public_sector";
  tone: "confident" | "formal" | "balanced" | "warm";
  language: "de" | "en";
  length: "short" | "standard";
  format: "letter" | "body_only";
  recipientName?: string;
  recipientRole?: string;
  motivation?: string;
  keyAchievements?: string[];
  availability?: string;
  relocation?: string;
  salaryExpectation?: string;
  employmentPreference?: string;
  additionalInstructions?: string;
}
```

Bestehende Candidate-Felder (`motivation`, `start_date`,
`salary_expectation`) bleiben kompatibel. Der Brief wird optional an
`/api/cover-letter` übergeben; `professional` ist Default. Leere optionale
Felder werden nicht erfunden.

## 3. Prompt und Datenfluss

Der bestehende `chat()`-Router, Modellwahl, Consent, Anonymisierung und
Versionierung bleiben erhalten. Der Prompt erhält jetzt zusätzlich:

- Qualitätsklasse, Schreibstil, Tonalität, Sprache, Länge und Format
- Ansprechpartner/Funktion, falls angegeben
- belegte Erfolge, Verfügbarkeit, Umzug, Gehalt, Beschäftigungspräferenz
- zusätzliche Hinweise
- konkrete Struktur: Einstieg, belegte Erfahrung, Aufgabenbezug, Motivation,
  handlungsorientierter Abschluss
- 250–350 Wörter bei `standard`, 150–220 bei `short`
- strikte Regeln gegen generische Floskeln, erfundene Führung, Zertifikate,
  Erfolge, Startdaten, Umzug und ATS-Scores
- `body_only` ohne Anrede/Signatur; `letter` als vollständiger Brief

Die vorhandene `extractPdfText`-/Anonymisierungskette bleibt unverändert. Es
werden keine zusätzlichen Provider, Dienste, Persistenzschichten oder
ATS-Daten übertragen.

## 4. UI

Im bestehenden `LetterModal` gibt es jetzt die kompakte Sektion
**„Anschreiben gestalten“**:

- Qualitätsklasse
- Schreibstil
- Tonalität
- Format
- Länge
- optionale Details: Ansprechpartner, Funktion, belegte Erfolge, Umzug,
  Beschäftigungspräferenz, zusätzliche Hinweise

Bestehende Motivation, Startdatum und Gehaltsvorstellung bleiben in den
Bewerberinformationen. Das Formular bleibt optional und wird nicht zur
Pflichtlandschaft.

## 5. Synthetische Qualitätsbeispiele

Ausschließlich synthetische Daten; keine echten CV- oder Bewerberdaten.
Provider: vorhandener Preview-Router. Die Modellqualität variiert; die
folgenden Beispiele nutzten `nvidia/nemotron-3-ultra-550b-a55b:free` bzw.
`cohere/north-mini-code:free`.

### Öffentlicher Dienst / IT-Administration

Briefing: `professional`, `public_sector`, `formal`, Empfängerin
„Frau Beispiel“, 5 Jahre kommunale IT-Administration, Active Directory,
Migration von 200 Arbeitsplätzen, Verfügbarkeit 01/2027.

Ergebnis: **191 Wörter**, konkreter Stellenbezug, Active Directory und
Migrationserfolg belegt, keine ATS-/Matching-Metadaten, kein erfundener
Arbeitgeber.

### Senior Software Architect

Briefing: `executive`, `technical`, `confident`, AWS/Terraform/Kubernetes/
TypeScript, technische Leitung von Architekturinitiativen, AWS Associate.
Ergebnis: **205 Wörter**, Plattformarchitektur und technische Standards
konkret verknüpft, Führungsbezug nur aus dem ausdrücklich angegebenen
„technische Leitung“ abgeleitet.

### Cloud Engineer

Briefing: `professional`, `modern`, `balanced`, `short`, keine Motivation,
kein Startdatum, kein Empfänger. Ergebnis: **111 Wörter**, neutrale Anrede,
keine erfundene Motivation, keine erfundene Verfügbarkeit, keine
Platzhalter. Der Prompt verlangt ausdrücklich, fehlende Angaben nicht zu
erfinden.

Zusätzlich entfernt `sanitizeLetter()` bracketed placeholders wie
`[Ihr Name]` aus der Ausgabe.

## 6. Tests

```text
npx vitest run tests/api/cover-letter.test.mjs \
  src/components/LetterModal.test.tsx
# 88 PASS

npm run build
# PASS

npx vitest run --no-file-parallelism
# 1943 PASS / 11 skipped
```

Abgedeckt:

- Standard-/Professional-/Executive-Briefing
- Public-Sector-Schreibstil
- fehlende Motivation, Empfänger, Startdatum, Umzug
- keine erfundenen Zertifikate/Erfolge
- keine ATS-Scores im Prompt/Letter
- bestehende Versionierung und Modellwahl
- deutsche und englische Ausgabe
- Prompt-Injection-/Datenregeln
- Platzhalter-Entfernung

## 7. Release / Production

- PR #28 regular merge: `fd50caffa3367ae6c83ee3718915f02488cfe67c`.
- Final `origin/main`: `fd50caffa3367ae6c83ee3718915f02488cfe67c`.
- Vercel Production: `mays-job-matcher` and `mays-jobsearch` SUCCESS; both
  domains serve bundle `fd50caf`.
- No manual deployment.
- Post-merge gates: build PASS; focused cover-letter tests 88 PASS; serial
  full suite 1943 PASS / 11 skipped.

### Synthetische Production-E2E

`POST /api/cover-letter` gegen `www.mays-job-matcher.app`, ausschließlich
synthetische Daten.

**Professional / Public Sector**

- sichtbarer Prompt-Meta-Modus: `quality_class=professional`,
  `writing_style=public_sector`, `tone=formal`
- echtes Anschreiben mit korrekter Anrede („Sehr geehrte Frau Beispiel“)
- 178–225 Wörter je nach Provider-Lauf
- Active Directory, kommunale Erfahrung, 200-Arbeitsplätze-Migration belegt
- keine Platzhalter, keine ATS-/Matching-Scores

**Executive / Technical**

- sichtbarer Prompt-Meta-Modus: `quality_class=executive`,
  `writing_style=technical`, `tone=confident`
- echtes Anschreiben, 191 Wörter
- AWS, Terraform, Kubernetes und TypeScript konkret mit den Aufgaben verknüpft
- Führungsbezug nur aus der ausdrücklich angegebenen technischen Leitung
- keine Platzhalter, keine ATS-/Matching-Scores

Verwendetes Modell: `nvidia/nemotron-3-ultra-550b-a55b:free` (Preview/Provider-
Qualität variiert; einzelne Läufe liefern generische Konversation).

## 8. Bekannte Einschränkungen

- Die Ausgabequalität hängt weiterhin vom gewählten Free-Model ab. Einzelne
  Modelle liefern generische Konversation statt Anschreiben; die bestehende
  Modellwahl bleibt der Recovery-Pfad.
- Es wurden keine echten CV-/Bewerberdaten verwendet.
- Kein neuer Provider und keine neue Persistenz, kein neuer Provider und keine Änderung an
  ATS-Scoring oder RIS.

## 9. Git

- `9c02907` — strukturiertes Cover-Letter-Briefing
- `d6efcbe` — Platzhalter-Entfernung
- `c55c01f` — Feature-Dokumentation
- Release-Dokumentation auf `docs/jm-cover-letter-quality-release-01`

PR #28 ist gemerged; Feature-Branch retained. Kein Merge der Docs-Branch nach `main`.

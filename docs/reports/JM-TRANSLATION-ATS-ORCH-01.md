# JM-TRANSLATION-ATS-ORCH-01 — Baseline / Ursachenmatrix

**Status:** `INVESTIGATION IN PROGRESS — BEFUND B BESTÄTIGT`

**Date:** 2026-11-16
**Baseline:** `origin/main` `154c698333682afd0b68454666738abc9713f194`
**Branch:** `feature/jm-translation-ats-orchestrator-01`

## ORCH-00 — Datenfluss

### A — Übersetzung

- `RemainingCard` startet die Übersetzung nur per Klick.
- `translateJobDescription` sendet ausschließlich den öffentlichen
  Beschreibungstext an `/api/job-details` (`action: "translate"`).
- Der Provider liefert Plaintext; `parseTranslation` übernimmt die Antwort.
- Die Anzeige läuft über `renderSanitizedHtml` → `plainTextToHtml`:
  Absätze, Markdown-Listen, Überschriften und Zeilenumbrüche werden in
  sichere HTML-Blöcke übersetzt; Originaltext bleibt separat.
- ATS nutzt weiterhin `job.description`/`job.descriptionPlain`, nicht den
  Übersetzungszustand.

Synthetische lange Anzeige mit Überschriften und Listen:
`575` Zeichen, `17` Zeilenumbrüche, `9` Bullet-Zeilen in der
Provider-Antwort. Damit ist die Struktur in der API-Antwort vorhanden.
Ein konkreter Client-Formatierungsfehler ist mit diesem Fixture noch nicht
reproduziert; die bestehende `plainTextToHtml`-Pipeline deckt die Struktur ab.

### B — CV-/ATS-Skilldatenfluss

```text
PDF → extractPdfText() → normalized text → /api/profile (Modell)
→ suggestedProfile.skills → CvProfileResult / Skill-Selection
→ ausgewählte Skills → ATS-Profil → /api/ats-analysis
```

Der ATS-Skill-Dialog verwendet `cvState.suggestedProfile.skills`.
`extractPdfText()` liefert den PDF-Text; die Skill-Liste wird nicht aus einem
deterministischen CV-Skillparser, sondern aus dem Profil-Modell übernommen.

**Bestätigter Befund:** `api/profile.mjs` begrenzt die Modellantwort mit
`cleanStringList()` hart auf **20 Einträge**. Ein synthetischer CV mit 30
eindeutigen Technologien liefert exakt 20 Skills zurück. Damit ist die
sichtbare Teilmenge primär ein Profil-Snapshot-/Cap-Problem, kein
PDF-Parserfehler.

Zusätzlicher Prompt-Befund: Der Profil-Prompt fordert nur „key skills“, nicht
alle ausdrücklich genannten Technologien.

## Ursachenmatrix

| Beobachtung | Status | Nachweis | Minimale Korrektur |
|---|---|---|---|
| A: lange Übersetzung unleserlich | **offen** | synthetische Antwort strukturiert; `plainTextToHtml` vorhanden | erst nach Reproduktion |
| B: nur Teil der CV-Technologien im ATS-Dialog | **bestätigt** | 30-Term-CV → 20 Skills; `cleanStringList(...).slice(0,20)` | Cap erhöhen, Prompt auf alle genannten Skills |
| B: ATS-Findings vs. CV-Liste | teilweise bestätigt | Findings basieren auf ausgewählten ATS-Skills; CV-Liste ist Modell-Snapshot | Quelle/Zähler in UI kennzeichnen |
| A: Übersetzung vs. ATS | bestätigt getrennt | ATS-Payload enthält Originalbeschreibung | keine Änderung nötig |

## Sicherheits-/Privacy-Status

- Synthetische Daten für die Diagnose.
- Keine echte CV-Datei in Git, Logs, Screenshots oder Provider-Prompts.
- Keine RIS-/AWS-/Cognito-/Persistenz-/Consent-Änderung.
- Keine Scoring-Änderung.

## Nächste Schritte

1. Profil-Skill-Cap und Prompt gezielt korrigieren.
2. UI-Quelle/zwei Zähler sichtbar machen.
3. Übersetzungsformatierung nur bei reproduziertem Fehler ändern.
4. Fokussierte Tests, Build, Gesamtsuite; danach Bericht finalisieren.

## ORCH-02 — Ergebnis

Der bestätigte Engpass lag in `api/profile.mjs`:

- `cleanStringList()` begrenzte die Modellantwort auf 20 Einträge.
- Der Profil-Prompt forderte nur „key skills“.
- Ein synthetischer CV mit 30 eindeutigen Technologien lieferte vor der
  Korrektur exakt 20 Skills.

Umgesetzt:

- Skills-Cap von 20 auf 100 erhöht; Zielrollen bleiben auf 20 begrenzt.
- Prompt fordert alle ausdrücklich genannten Technologien, Werkzeuge,
  Plattformen, Sprachen, Frameworks, Datenbanken, Cloud-Services, Methoden
  und Zertifizierungen; keine Erfindung.
- `maxTokens` von 900 auf 1800 erhöht.
- Skill-Auswahl zeigt jetzt die Anzahl „{selected} von {total} im CV
  erkannten Skills ausgewählt“ und nennt die Herkunft der Vorschläge.
- Keine Änderung an CV-Parser, Profilpersistenz, RIS-Daten oder ATS-Scoring.

## ORCH-01 — Ergebnis

Die Übersetzungs-API lieferte bei einem synthetischen langen Text mit
Überschriften und Listen strukturierten Plaintext (575 Zeichen, 17
Zeilenumbrüche, 9 Bullet-Zeilen). Die bestehende `plainTextToHtml`-Pipeline
erzeugt daraus Absätze, Überschriften und Listen. Ein konkreter
Client-Formatierungsfehler war mit diesem Fixture nicht reproduzierbar; es
wurde daher keine spekulative Änderung an der Darstellung vorgenommen.
Zusätzlicher Regressionstest für lange Übersetzungsstruktur ergänzt.

## Tests

```text
npx vitest run tests/api/profile-skills.test.js \
  src/lib/safeHtml.test.ts \
  src/components/RemainingCard.test.tsx
# 49 PASS

npm run build
# PASS

npx vitest run --no-file-parallelism
# 1931 PASS / 11 skipped
```

## Git

- `c4acec5` — Baseline-/Ursachenbericht
- `27bf766` — Profil-Skill-Cap-/Prompt-/UI-Korrektur
- Dokumentations-Commit folgt separat.

Branch gepusht: `feature/jm-translation-ats-orchestrator-01`.
Kein Merge, kein Production-Deployment.

## Status

**B — PARTIAL / NEEDS DECISION:** B ist reproduzierbar bestätigt und lokal
korrigiert; A ist mit dem synthetischen Langtext nicht bestätigt. Für eine
weitere A-Korrektur wird die konkrete betroffene Anzeige bzw. der
Übersetzungs-Response benötigt.

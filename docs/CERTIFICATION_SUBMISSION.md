# May's Job Matcher — Zertifizierungs- und Prüfungsdokumentation

Dokumentationsstand: 2026-08-17 · main `e722edf` · Production LIVE

Dieses Dokument fasst den vollständigen Entwicklungsprozess, die Architektur, die Verifikation und
die Production-Bereitstellung von **May's Job Matcher** zusammen. Es dient als technischer Nachweis
für die vierte Zertifizierung und folgt den belegbaren Fakten aus Repository, Tests und Deployments.

- Live-Anwendung: <https://mays-job-matcher.vercel.app>
- Repository: GitHub (`maynowak/mays-jobsearch`)
- Workflow-Definition: `docs/DEVELOPMENT_WORKFLOW.md`
- Feature-Beweisbeispiel: `docs/reports/FEATURE_AI_MATCHING_TIMEOUT.md`

---

## 1. Projektziel

May's Job Matcher ist ein KI-gestützter Job-Suchassistent. Er holt aktuelle Stellenangebote aus
öffentlichen Quellen, bewertet sie automatisch mit kostenlosen KI-Modellen gegen das Profil einer
Person (Fähigkeiten, Zielrolle, Städte) und präsentiert die besten Treffer mit Begründung und
Interview-Vorbereitung. Das Projekt vereint eine moderne Frontend-SPA mit serverlosen Backend-Funktionen.

## 2. Ausgangssituation

- Einfacher Browser-Auftritt, zunächst ohne React.
- Matching über KI, jedoch mit sehr langen Wartezeiten bei Provider-Störungen.
- Kein dokumentierter Feature-/Release-Workflow.
- Fehlende Trennung von Timeout-, Netzwerk- und Modell-Verfügbarkeitsfehlern.

Aus der Beobachtung entstand das abgeschlossene Feature **AI Matching Timeout & Fallback Responsiveness**
(siehe Abschnitt 7): Es verkürzt Wartezeiten und unterscheidet Fehlerursachen sauber.

## 3. Technische Architektur

- **Frontend:** React + TypeScript (strict) + Vite. Zuständig für Suche, CV-Upload, Modell-Auswahl,
  Ergebnisdarstellung, Bewerbungsgenerator und Alert-Anmeldung.
- **Backend:** Node.js serverless functions (ESM, `.mjs`) auf Vercel Functions.
- **Daten:** Job-Pool aus Arbeitnow (öffentliche API) und Arbeitsagentur-Feed (Apify Actor),
  gecacht in Upstash Redis (L1-Jobs, L2-Dataset-Reuse, CV-Profil-Cache).
- **Cron:** täglicher E-Mail-Digest (`/api/cron/digest`, 07:00 UTC).
- **Frontend→Backend:** Same-Origin fetch; alle Endpunkte liefern JSON.

Vollständige Architektur: `docs/ARCHITECTURE.md`.

## 4. AI-/Provider-Konzept

- **Provider-Router** (`api/_lib/providers/index.mjs`): zentraler `chat()`-Einstieg, aggregiert den
  Katalog kostenloser Modelle über alle Provider und fällt bei Provider-Erschöpfung automatisch auf
  den nächsten enabled Provider zurück.
- **OpenRouter** (primär): kostenlose Modelle werden über die Provider-Metadaten ermittelt
  (Pricing = 0, Text-Ein-/Ausgabe, nicht abgelaufen) — keine harte Modell-Liste.
- **EdenAI** (optional zweiter Provider): OpenAI-kompatible V3-API, gleiche Free-Eligibility-Logik.
- **Client-Fallback:** bei `model_unavailable` versucht die App maximal `MODEL_FALLBACK_MAX_ATTEMPTS`
  (Default 3) andere kostenlose Modelle; `timeout`/`network_error` stoppen weitere Versuche.
- **Sicherheits-Konzept:** alle API-Keys ausschließlich serverseitig (`process.env`), nie im Browser,
  nie in Dokumentation oder Build-Informationen.

Details: `docs/AI_PROVIDERS.md`.

## 5. Sicherheits- und Secret-Konzept

- Keys nur auf dem Server; `.env`/`.vercel/` sind gitignored.
- `/api/usage` (Verbrauchs-Diagnostik) ist token-geschützt (`USAGE_DIAGNOSTICS_TOKEN`), sonst deaktiviert.
- Secret Audit bei jedem Checkpoint: der Diff wird auf Keys/Tokens geprüft, bevor committet wird.
- Keine Secrets in Dokumentation, README, Build-Artefakten oder Reports.

## 6. Entwicklungsworkflow

Verbindlicher Ablauf (`docs/DEVELOPMENT_WORKFLOW.md`):

```
main → feature/<name> → Development → Preview → Abnahme → Merge → Production → Branch schließen
```

- Jedes Feature läuft auf einem eigenen Branch; `main` bleibt Integrations-/Release-Branch.
- Nach jedem Step: Report aktualisieren → Tests → `git status` → `git diff --check` → Secret Audit →
  Commit → Push.
- **Recovery-/Checkpoint-System:** pro Feature existiert ein Report (`docs/reports/FEATURE_*.md`) mit
  Step-Matrix und Status. Bei Absturz wird nur der letzte gepushte COMPLETE-Checkpoint als sicher
  angesehen; es wird nicht aus Chat-/Terminal-Historie rekonstruiert.
- **Deployment vs. Git-HEAD:** ein Deployment entspricht nicht automatisch dem aktuellen Git-HEAD.
  Jede Abnahme prüft die tatsächliche Deployment-Identität (Deployment-Commit aus Vercel-Metadaten ==
  Build-Identity im Artefakt == Environment). Der Footer zeigt `Version · Environment · Commit-SHA`.

## 7. Feature-Entwicklung am konkreten Beispiel — AI Matching Timeout & Fallback

Schritt-für-Schritt-Beweis in `docs/reports/FEATURE_AI_MATCHING_TIMEOUT.md` (Steps 1–10, alle COMPLETE).

### Ausgangsproblem (beobachtet)

Vorheriger beobachteter Production-Wert: **~125+ Sekunden** Gesamtwartezeit beim Matching. Wichtig:
dieser Wert war nur beobachtet und **nicht reproduzierbar**; die Bedingungen waren nicht identisch.
Es gab keine saubere Unterscheidung von Timeout-, Netzwerk- und Modell-Verfügbarkeitsfehlern.

### Änderungen

| Bereich | Vorher | Nachher |
|---|---|---|
| EdenAI-Timeout | 55 s | **30 s** |
| OpenRouter-Timeout | 40 s | **25 s** |
| Timeout-Fehler | (pauschal Modellfehler) | **`timeout` (HTTP 504)** |
| Netzwerkfehler | (pauschal Modellfehler) | **`network_error` (HTTP 502)** |
| Modell nicht verfügbar | — | **`model_unavailable`** (transient, Fallback erlaubt) |

### Client-Verhalten

- `timeout` / `network_error` → **kein unnötiger weiterer Matching-Request**.
- `model_unavailable` → Fallback auf ein anderes freies Modell weiterhin möglich (Client-Fallback).

### Verifikation

- Gezielte Tests: **42/42** grün.
- Regression: **116/116** grün.
- `tsc -b`: PASS · `vite build`: PASS · `git diff --check`: sauber · Secret Audit: sauber.

### Development Live Test

Sandbox-Versuche: 5.5 / 6.4 / 7.0 s, aber 502 `bad_ai_response` wegen Sandbox-Modellverhalten.
Diese Werte sind **kein** Production-Performance-Nachweis und werden hier nicht als solcher geführt.

### Preview

Preview-Deployment mit verifizierter Deployment-Identität (Deployment-Commit == Build-Identity).

### Merge nach main

Fast-forward-Merge (kein Merge-Commit, keine History-Rewrite) nach vollständigem Merge-Gate auf main.

### Production Deployment

- Genau ein Production-Deployment, Source `main`.
- **Production Deployment Commit:** `6ff72e7`
- Deployment ID: `dpl_DH75keaahuFaa19W7GKxRYPBJg4e`
- Environment: `production` · Status: `READY`
- Footer Build-Identity: `Version 2.0.0 · production · 6ff72e7` == Deployment-Commit.
- Wichtige Unterscheidung: Der spätere main-Stand `e722edf` enthält nur Dokumentations-Commits;
  der deployed Code wurde davon nicht verändert. **Deployment ≠ späterer Git-HEAD.**

### Kontrollierter Production-Test

Genau **1** kontrollierter POST `/api/match` (kleines Testprofil + 3 Inline-Testjobs, kein Apify,
keine echten Bewerberdaten):

| Messwert | Ergebnis |
|---|---|
| Gesamtzeit | **20.3 s** |
| HTTP-Status | 502 |
| Fehlercode | `model_unavailable` |
| Provider | OpenRouter |
| Modell | `dots-studio/dots-3-note-preview:free` (FREE) |
| Attempts | 1 |
| Fallback | keiner (nur ein Provider enabled) |
| Timeout | nein |
| Network Error | nein |
| Apify | 0 |
| AI Requests | 1 |

**Einordnung:** Der kontrollierte Production-Request erreichte den Provider, wurde mit
`model_unavailable` beendet und innerhalb **20,3 s** abgeschlossen; kein unnötiger Retry/Fallback
erfolgte. Der Test war kein erfolgreicher Matching-Response, aber ein erfolgreicher Nachweis des
neuen Timeout-/Fehlerverhaltens. Es wird ausdrücklich **nicht** behauptet, dass „AI Matching vollständig
funktioniert".

**Vergleich:** Der kontrollierte Production-Test benötigte 20,3 s und lag damit deutlich unter dem zuvor
beobachteten Production-Wert von ~125+ s (alter Wert nur beobachtet, nicht reproduzierbar, Bedingungen
nicht identisch).

## 8. Tests und Verifikation

- **116/116 Tests** (Vitest): Frontend (`src/api.test.ts`), Serverless-Funktionen, Provider-Integration
  (OpenRouter/EdenAI/Router), Job-Sources, Apify-Cache.
- **TypeScript:** `npx tsc -b` PASS (strict).
- **Build:** `npm run build` PASS.
- **Live-Verifikation:** Endpunkte gegen deployed Vercel-Funktionen geprüft (`/api/model`, `/api/models`,
  Smoke-Test der Production-URL).
- Bei jedem Checkpoint: `git diff --check` + Secret Audit.

## 9. Development

Entwicklungs-Umgebung über `vercel dev` (lokale Runtime). Verwendet für interne Live-Tests der Feature-Logik
im laufenden Build; als separate Stufe vom Preview/Production klar getrennt.

## 10. Preview

Preview-Deployments sind separat öffentlich erreichbar (`VERCEL_ENV=preview`) und dienen der Abnahme.
Die Deployment-Identität wird gegen die tatsächlichen Vercel-Metadaten verifiziert (siehe Abschnitt 6).

## 11. Merge nach main

- Fast-forward bevorzugt, wenn der Feature-Branch direkt auf `main` basiert.
- Kein unnötiger Merge-Commit, kein Rebase, keine History-Rewrites.
- Nach dem Merge: erneutes vollständiges Test-Gate auf `main` (Tests, tsc, build, diff-check, Secret Audit).

## 12. Production Deployment

- Explizites Deployment via CLI (`vercel --prod --scope maymilly`), kein automatisches Git-Deployment.
- Genau ein Deployment pro Release; nach jedem Schritt wird Deployment-Commit, Environment, Source-Branch
  und Production-URL aus Vercel ausgelesen und gegen die Build-Identity geprüft.

## 13. Kontrollierter Production-Test

Siehe Abschnitt 7. Ein einzelner, kontrollierter AI-Request mit deterministischen Testdaten; keine
Testserie, kein Apify, keine künstliche Last, keine Wiederholung bei Unsicherheit.

## 14. Gemessene Ergebnisse

- Production-Live-Request: 20,3 s (502 `model_unavailable`, OpenRouter, FREE-Modell, 1 Attempt).
- Zuvor beobachteter Production-Wert: ~125+ s (beobachtet, nicht reproduzierbar).
- Sandbox-Entwicklungsversuche: 5.5 / 6.4 / 7.0 s (kein Performance-Nachweis, Modellverhalten).

## 15. Recovery-/Dokumentationsstrategie

- Feature-Reports (`docs/reports/FEATURE_*.md`) mit Step-Matrix, Status und Commit je Step.
- Pushed COMPLETE-Checkpoints sind maßgeblich; Absturz-Wiederaufnahme ab dem letzten gepushten Checkpoint.
- Keine Rekonstruktion aus Chat-Historie, wenn eine Recovery-Datei existiert.

## 16. Lessons Learned

- **Messbarkeit vor Optimierung:** Das ursprüngliche 125+-s-Problem war nur beobachtet; erst gezielte
  Messungen lieferten belastbare Zahlen. Beobachtung und reproduzierbare Messung klar trennen.
- **Fehlerursachen unterscheiden:** Timeout, Netzwerk und Modellverfügbarkeit sind verschiedene Zustände;
  gemeinsame Codes verstecken die Ursache und führen zu falschen Fallback-Entscheidungen.
- **Kosten- und Nutzungsdisziplin:** genau ein kontrollierter Production-Request mit FREE-Modell;
  keine Testserien, kein Apify ohne Bedarf, keine künstliche Last.
- **Identitäts-Nachweis:** Deployment-Identität immer über Vercel-Metadaten + Build-Identity verifizieren,
  nie aus Git-HEAD ableiten.
- **Dokumentation als Qualitätsmerkmal:** der Checkpoint-Workflow macht den Prozess nachvollziehbar und
  ist gleichzeitig Wiederaufnahme-Schutz.

## 17. Nächste geplante Entwicklung (Backlog, NICHT implementiert)

**Model Availability / Health Check** (Roadmap-Sprint 2.2, `docs/ROADMAP.md`):

- Hintergrundprüfung nach Seitenaufbau; Health-/Availability-Status wird gecacht.
- Tatsächliche Verfügbarkeit von Modellen nicht nur aus dem Katalog ableiten.
- Model-Combobox zeigt den tatsächlichen Status.
- Während laufender Matching-Suche ist die Combobox deaktiviert; nach Abschluss wieder aktiv.
- Free-Modelle bevorzugen, Kosten kontrollieren, keine unnötigen Provider-Requests, keine künstliche Last.

Dieses Feature ist **geplant**, nicht vorhanden.

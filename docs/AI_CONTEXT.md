# AI Project Context

## Project

**My Job Matcher**

A job search assistant with AI-powered matching, cover-letter generation and daily digest alerts.

## Current Project Status

- Core matching: completed (`/api/jobs` + `/api/match`)
- Multi-city search: completed
- AI cover-letter generator: completed
- Daily job alerts: implemented (needs Upstash + Resend keys for real delivery)
- Model info display: completed
- Production deployment: verified
- Deployment target: Vercel
- Live: https://mays-job-matcher.vercel.app

## AI-Assisted Development

AI was used as an active development partner, not only for text generation.

### Documented AI collaborators

- **DeepSeek V4 Flash Free (opencode)** — implementation of the full application: frontend, serverless functions, error handling, shared `_lib` modules, multi-city filtering, cover-letter generator, alert system, cron digest, deployment to Vercel, environment variable setup, live endpoint verification, project documentation.
- **GPT (OpenAI)** — Chief Architect: planning, architecture and technical review.
- **Nemotron** — analysis, cross-checking, technical second opinion, documentation review and plausibility control (role details in `docs/AI_TEAM.md`).

The project documentation was used as a shared context so that AI-assisted changes remained aligned with the project architecture.

## AI Working Agreement

Every AI assistant working on this repository should:

1. Read `AI_CONTEXT.md` first.
2. Read `ARCHITECTURE.md`.
3. Read `DESIGN_SYSTEM.md`.
4. Read `PROJECT_RULES.md`.
5. Understand the project vision before proposing implementation changes.
6. Distinguish observations from hypotheses.
7. Make small, reversible changes.
8. Preserve the existing architecture unless a structural change is explicitly justified.
9. Run `node --check` after implementation changes.
10. Verify serverless endpoints live where possible.
11. Summarize modified files and the reason for each change.

## Collaboration Model

**Human Developer — Maymilly Nowak**

- Product Owner
- final technical decisions
- testing and browser validation
- deployment decisions

**AI collaborators**

- support analysis, implementation, review, documentation and technical exploration
- do not replace human QA or final decision-making

## Important Development Principle

The project uses AI collaboratively and iteratively:

**Human observation → AI analysis → small technical change → syntax check → live endpoint test → human evaluation → Git checkpoint**

## AI-gestützter Entwicklungsprozess (AI-assisted development process)

Every feature follows the same iterative loop:

1. Human idea / goal
2. Formulation of the prompt
3. AI-generated proposal
4. Technical check
5. Manual adjustment
6. Test / deploy
7. Re-evaluation
8. Next iteration

The AI replaces neither the project decision nor the QA process. The project owner decides design, functionality and final implementation; AI contributions are proposals that must be verified against the real application before they are accepted.

## Verbindliche Arbeitsregeln für Agenten

Der vollständige Ablauf ist in **`docs/DEVELOPMENT_WORKFLOW.md`** dokumentiert.
Die folgenden Regeln sind für jeden Agenten verbindlich:

- **Feature-Arbeiten erfolgen auf Feature-Branches.**
  `main` bleibt Integrations-/Release-Branch.
- Ein Feature wird nach erfolgreicher Abnahme nach `main` gemergt.
- Nach dem Production-Deployment wird der Feature-Branch geschlossen.
- **Jeder Step erzeugt einen nachvollziehbaren Checkpoint.**
  Nach jedem Step: Report aktualisieren → Tests → `git status` → `git diff --check` →
  Secret Audit → Commit → Push.
- **BLOCKED bedeutet STOPP.** Keine eigenständigen Workarounds, kein Übergehen ohne Freigabe.
- **Die Recovery-Datei ist nach einem Absturz maßgeblich.**
  `docs/reports/FEATURE_*.md` ist die Arbeitsgrundlage; nicht aus alten Chat-/Terminal-Ausgaben
  rekonstruieren.
- **Deployment-Stand und Git-HEAD sind unterschiedliche Zustände.**
  Kein Agent darf aus einem vermeintlich aktuellen Git-HEAD schließen, dass dieser bereits
  Production entspricht. Jedes Deployment wird über seine tatsächliche Deployment-Identität
  (Deployment Commit / Build Identity / Environment) geprüft.

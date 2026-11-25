# Development

## Kommandos

```bash
npm install
npm run dev
npm run build
npm test
npx vitest run --maxWorkers=1
```

## Qualitätsgates

- TypeScript/Build: `npm run build`
- Fokussierte Vitest-Suiten für den geänderten Bereich
- Serielle Vollsuite
- Playwright-E2E für betroffene UI-Flows
- `git diff --check` und Secret-Scan
- CodeQL und Vercel-Preview-Checks im PR

## Workflow

Feature-Branch von `main` → kleine Schritte → Tests → Commit/Push →
Preview-Abnahme → PR → Merge nur mit Freigabe → automatisches
Production-Deployment → Production-Smoke.

Verbindlich: [AGENTS.md](https://github.com/maynowak/mays-jobsearch/blob/main/AGENTS.md) und
[Development Workflow](https://github.com/maynowak/mays-jobsearch/blob/main/docs/DEVELOPMENT_WORKFLOW.md).

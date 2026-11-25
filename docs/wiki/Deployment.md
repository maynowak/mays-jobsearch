# Deployment

## Production

- https://www.mays-job-matcher.app/
- https://mays-jobsearch.vercel.app/
- Aktueller Build: `df1fe01` · Version 2.2.0 · `production · main`

## Automatisierung

`vercel.json` aktiviert `git.deploymentEnabled.main`. Ein Merge nach `main`
startet automatisch die Production-Deployments der Projekte
`mays-jobsearch` und `mays-job-matcher`. Beide Deployments müssen READY sein
und denselben Build-SHA im Footer zeigen.

Manuelles `vercel --prod` ist nur mit ausdrücklicher Freigabe zulässig.

## Gates

TypeScript/Build, fokussierte Tests, serielle Vollsuite, E2E, CodeQL,
Vercel-Preview/Deployment-Checks, Production-Smoke.

Kanonisch: [Deployment](https://github.com/maynowak/mays-jobsearch/blob/main/docs/DEPLOYMENT.md)

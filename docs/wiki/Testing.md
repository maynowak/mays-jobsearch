# Testing

## Suiten

- **Vitest/Testing Library:** Komponenten, Hooks, Libs; `npm test`.
- **API-Tests:** separat unter `tests/api/`, nicht in `npm test`.
- **Serielle Vollsuite:** `npx vitest run --maxWorkers=1`.
- **Playwright-E2E:** `tests/e2e/*.mjs`, überwiegend synthetisch und mit
  gemockten `/api/**`-Antworten.

## Wichtige E2E-Skripte

- Profil-/Responsive-Layout: `jm-profile-applications-responsive-fix-01`
- CV-Import/Radar: `jm-cv-import-navigator-02`
- CV-Editor/Radar: `jm-cv-editor-navigator-03`
- Bewerbungen/Edit-Dialog/Own-Letter: `jm-application-edit-tab-navigation-01`

## Bekannte Altlast

`cv-builder-workflow-02a` erwartet den alten Buttontext „Lebenslauf speichern“
statt „Entwurf übernehmen“ und schlägt bereits auf der vorherigen Main-Basis
fehl. Keine Produktregression; minimale Testkorrektur empfohlen.

Kanonisch: [Development Workflow](https://github.com/maynowak/mays-jobsearch/blob/main/docs/DEVELOPMENT_WORKFLOW.md)

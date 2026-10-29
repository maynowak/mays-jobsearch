# MAYS-UI-ORCHESTRATOR-01 — S0 Baseline

- Stage: S0 — Bestand und Eignung
- Status: COMPLETE
- Date: 2026-10-29
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `feature/ui-orchestrator-s0`
- HEAD at start and end of S0: `529bc84fcf919d4a892c2c59bf2b2836d2f0f377`
- `origin/main`: same HEAD at preflight.

## Working-tree protection

The working tree was already dirty before branch creation. The feature branch
was created without reset, clean or stash. Existing user changes remain
untouched and unstaged:

- modified: `src/components/SourcesInfo.test.tsx`, `src/i18n.tsx`
- untracked privacy documents, reports, assets, `main.tsx`,
  `tests/inference_integrity.ts` and related files

No package installation, lockfile change, source implementation or CSS change
was made in S0.

## Repository baseline

- React `19.2.8`, TypeScript `~5.9.0`, Vite `^8.2.1`, Vitest `^4.1.10`.
- Existing runtime dependencies: `react-oidc-context`, `oidc-client-ts`,
  `pdfjs-dist`, `dompurify`, React/DOM.
- No Tailwind, shadcn/ui, Radix, MUI, Chakra, Bootstrap, `clsx` or
  `classnames` dependency exists in `package.json` or the lockfile.
- Styling is custom CSS: `src/styles.css` and `src/landingpage2.css`, globally
  loaded by `index.html`. Design tokens are in `src/styles.css:1-159`.
- Strict TypeScript has `noUnusedLocals` and `noUnusedParameters`; additions
  must remain explicit and small.
- Routing: `/` → `LandingPage2` via `src/rootRoute.ts`; all other paths use
  `App`. `/search` uses the App `Navbar` with Alerts; `/` uses the shared
  `Navbar` with `route="landing"`, which intentionally excludes Alerts.

## Required fix verification

- Dashboard translation keys are committed at HEAD in `src/i18n.tsx`:
  EN `511-533`, DE `1059-1081`; all 23 `dashboard.*` keys are present in both.
- AUTH-NAVBAR-10 is committed:
  - `35ac935` contains the shared Navbar/logout fix.
  - `396d8d8` and `529bc84` document the fix and push.
  - `src/lib/authFlow.ts` sends `client_id + logout_uri` only.
- Current dirty `src/i18n.tsx` changes are unrelated (`sources_info.label`,
  `cv.improvementError`) and were not included or relied upon.

## Collision and architecture risks

- Global `*`, `[hidden]` and `body` selectors exist in `src/styles.css:161-175`.
- Global `@keyframes spin` occurs twice (`2212`, `5219`). New component styles
  must use namespaced selectors/keyframes.
- Dashboard CSS has duplicate `.aurora-content-grid` rule families (`6920`,
  `7386+`); later responsive rules win. Do not globally consolidate during
  this initiative.
- Existing classes are mostly namespaced (`aurora-*`, `lp2-*`), but the global
  stylesheet load order can affect copied component defaults.
- The `/dev/dashboard` route is described as dev-only but is not guarded by
  `import.meta.env.DEV` in `App.tsx`; this is a pre-existing security/release
  risk, not part of S0 UI integration.
- `npm run preview` serves the built frontend only and does not provide
  serverless `/api/*`; `vercel dev` is required for full local-stack checks.
- OIDC defaults point to production callback/logout URLs unless local
  `VITE_*` overrides are supplied. UI preview must not be treated as auth E2E.

## License/source review

### shadcn/ui

- Official documentation: <https://ui.shadcn.com/docs>.
- Official source repository: <https://github.com/shadcn-ui/ui>.
- Official CLI package: `shadcn` on npm, per the official documentation.
- Source repository license at review time: MIT, copyright shadcn 2023.
- MIT requires retaining the copyright and permission notice in copies or
  substantial portions. Copied component source must retain applicable notices.
- shadcn is a source-distribution system, not a runtime component dependency.

### Aceternity Aurora Background

- Official component: <https://ui.aceternity.com/components/aurora-background>.
- Official installation is source distribution through
  `npx shadcn@latest add @aceternity/aurora-background`.
- The official component page documents Tailwind CSS v3/v4 animation setup and
  props; it does not present a conventional per-file SPDX header/license.
- Official Aceternity license page: <https://ui.aceternity.com/licence>.
  That page describes the paid/Pro Aceternity License and prohibits source
  redistribution as a competing library. Aceternity's official component
  reference states that free components are usable in personal/commercial end
  products, while the source itself is copied into the consumer project.
- This repository is a public AGPL application, not a UI component marketplace.
  App use is likely within the stated end-product permission, but the exact
  free-component terms are not an OSI license and the public source-copy
  implications are not fully explicit. No Aurora source is copied in S0.

## Integration decision

1. **Do not install packages in S0.**
2. **shadcn/ui:** the prior `FOUNDATION-01-FOLLOW-UP-EXECUTION_LOG.md`
   concluded that the existing CSS token architecture was sufficient and that
   no primitive layer was needed; it also identified Tailwind as a requirement
   and shadcn as unsuitable for that baseline. Therefore do not add the full
   catalog or a Tailwind migration. If S1 still requires a component, prototype
   only the minimum source-level primitive after a fresh need test and explicit
   dependency/license review.
3. **Aceternity Aurora:** defer copying the Aurora component until its free
   component license/source-distribution terms are explicitly accepted for
   this public AGPL repository. The technical Tailwind requirement and current
   custom-CSS architecture make it non-minimal. The independent shadcn
   foundation may proceed without Aurora.
4. **Preview boundary:** use Vite `dev`/`preview` on localhost for visual work;
   use `vercel dev` only when API behavior is required. No preview is a
   production/authentication proof.

## S0 checks

- Git baseline and branch creation: PASS.
- Repository/config/dependency inspection: PASS.
- Committed translation and auth-fix checks: PASS.
- Official source/license review: PASS for source identification; Aurora legal
  compatibility remains a documented decision gate.
- Tests/build: not run because S0 changed documentation only; no implementation
  files were modified.

## S0 outcome

S0 is complete. S1 may proceed on this feature branch with a narrowly scoped
technical shadcn prototype. Aurora remains blocked pending explicit license
acceptance; S4 profile replacement must not begin before the required
comparison screenshots and recommendation.

# MAYS-UI-S1 — Gemeinsame Komponenten auf bestehender CSS-Basis

- Status: COMPLETE
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- S0 baseline: `50745e2`
- S1 implementation commit: `680dc59`

## Preflight

HEAD was `50745e2` and the branch contained the pre-existing user changes
reported in S0. No user file was reset, cleaned, stashed, staged or committed.
No package or lockfile was changed.

## Implemented components

Added a minimal source-level basis using existing tokens and classes:

- `src/components/ui/Card.tsx`
  - variants: `default`, `primary`, `features`
  - reuses `.aurora-card*`
- `src/components/ui/Button.tsx`
  - variants: `primary`, `danger`, `ghost`
  - reuses `.aurora-btn*` and `.btn-ghost`
- `src/components/ui/Badge.tsx`
  - tones: `neutral`, `soon`, `active`
  - uses namespaced `.ui-badge*` rules and existing semantic tokens
- `src/components/ui/DashboardNavigation.tsx`
  - translated labels supplied by the caller
  - active item, `aria-current`, keyboard/button interaction
- `src/components/UiComponentsPreview.tsx`
  - local reference composition using the existing `useLang()` context
  - no change to `/profil` or the existing dashboard composition

No package, Tailwind, shadcn or Aceternity code was added. No general CSS
cleanup was performed.

## Local development route and guard

- New route: `/dev/ui-components`.
- Existing `/dev/dashboard` route now also uses the shared `isDevOnlyRoute`
  guard in `src/lib/devRoute.ts`.
- Both previews require `import.meta.env.DEV`.
- In a production Vite preview build, both paths rendered the normal landing
  fallback and did not render `.aurora-dashboard` or `.ui-components-preview`.
- The production fallback is not a demo view; no demo UI is shipped through
  either route.

## Verification

- Component interaction tests: PASS — 4 tests.
- DEV route guard tests: PASS — 2 tests.
- Full suite: PASS — 829 passed, 5 skipped; 75 files passed, 3 skipped.
- `npm run build`: PASS; existing Vite large-chunk warning only.
- `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.
- Dev browser preview `/dev/ui-components`: DE/EN at 390px and 1440px,
  no horizontal overflow, translated labels, navigation selection interaction:
  PASS.
- Production Vite preview: `/dev/dashboard` and `/dev/ui-components` did not
  render demo views: PASS.
- CSS regression smoke check for `/`, `/search`, `/profil`: DE/EN at 390px and
  1440px, no horizontal overflow, one Navbar and one Footer: PASS.
- Preview checked frontend rendering only. No API behavior was claimed; Vite
  preview does not serve serverless functions.

## Scope

- `/profil` was not replaced.
- Landingpage content, Searchpage behavior, auth providers, language provider,
  API, AWS, Cognito, RIS, DNS and deployment were not changed.
- Existing user changes remain outside the commit.

S1 is complete in commit `680dc59`. The next stage may continue with the existing Aurora visual
language, while the S4 profile replacement remains blocked until its required
comparison screenshots and recommendation are prepared.

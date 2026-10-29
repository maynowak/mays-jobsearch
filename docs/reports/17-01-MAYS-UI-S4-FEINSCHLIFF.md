# MAYS-UI-S4 — Feinschliff und technische Abnahme

- Status: IMPLEMENTATION COMPLETE; TECHNICAL ACCEPTANCE PARTIAL; PROFIL NOT REPLACED
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `30916de`
- Implementation commit: `5edb171`; final code commit: `0820537`

## Corrections

- Demo status is neutral in both languages: `Demo` / `Demo`; demo no longer
  displays `Authentifiziert` or an active authenticated status.
- Real authenticated status remains derived from the existing auth wrapper and
  profile state. No online/availability check is performed.
- The unsupported `Modalität / Modality` row was removed from Dashboard-V2.
- Coming-soon navigation entries are disabled, visibly distinct and arranged
  vertically as title plus `In Vorbereitung / Coming soon`. Active entries
  remain selectable; no new targets or fake actions were added.
- Footer legal links now wrap with defined spacing; mobile hides separator
  glyphs so no leading/standalone separator can appear.
- Footer build identity now shows version, environment, branch and short SHA.

## Build identity finding

`buildInfo.ts` already derives identity without hardcoding:

1. `package.json` version
2. `VERCEL_ENV`, otherwise `development`
3. `VERCEL_GIT_COMMIT_SHA`, otherwise `git rev-parse --short=7 HEAD`
4. `VERCEL_GIT_COMMIT_REF`, otherwise current Git branch

The old screenshot hash was a stale frozen dev/preview artifact from an older
process/build, not a hardcoded Dashboard value. A fresh build at `0820537`
displayed:

`Version 2.1.0 · development · feature/ui-orchestrator-s0 · 0820537`

No hosting or production configuration was changed.

## Bundle measurement

Comparable `npm run build` measurements, CSS and JS only:

| Build | CSS | JS | Delta |
|---|---:|---:|---:|
| Baseline `30916de` | 122,940 B | 952,837 B | — |
| Target `0820537` | 123,180 B | 953,132 B | +240 B / +295 B |

Relative increase: CSS +0.20%, JS +0.03%. Existing Vite warning about chunks
over 500 kB remains unchanged in category.

## Verification

- Focused S4 tests: PASS — 16 tests across Dashboard-V2, auth preview, Footer
  and shared UI components.
- Current working-tree full suite: PASS — 838 passed, 5 skipped; 77 files
  passed, 3 skipped.
- `npm run build`: PASS; `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.
- Real dictionaries: DE/EN demo and auth status tests pass; no raw keys.
- Browser DEV preview: `/dev/dashboard-v2` and `/dev/dashboard-v2-auth`, DE/EN,
  390/768/1440px; no overflow, one Footer, disabled coming-soon entries,
  long-value wrapping, focus, 200% zoom smoke and reduced-motion checked.
- Landingpage, Searchpage and `/profil` smoke checks: one Footer, no overflow,
  no new raw keys; `/profil` was not replaced.
- Fresh production Vite preview: all new DEV routes render no demo/auth view.
- Updated comparison screenshots with fixed demo data are in
  `docs/evidence/mays-ui-s4/`; regenerated from final HEAD `e3b0d9b`.

## Clean-checkout gate

An isolated checkout at final code commit `0820537` was built successfully
with a fresh temporary `npm ci --ignore-scripts` installation. API syntax also
passed. The clean full suite was **NOT GREEN** for two pre-existing baseline
tests:

1. Two `Imprint.test.tsx` assertions require `VITE_CONTACT_EMAIL`, which is
   intentionally supplied only by the ignored local `.env.local` and is absent
   from a clean checkout. No secret was copied or committed.
2. The current working-tree English `SourcesInfo.test.tsx` correction remains
   a pre-existing user change and was not committed; it is intentionally not
   part of the clean-checkout gate.

Result: S4 UI checks are GREEN, but the clean-checkout suite has this explicit
baseline blocker. It is not caused by the Dashboard-V2 changes and must be
resolved separately without staging user files before claiming a fully green
repository gate.

## Auth and S4 decision

- Controlled auth mocks: PASS for loading, error, signed-out login, signed-in
  claims and logout handler.
- Real Cognito authenticated E2E: **NOT VERIFIED**; no real session available.
- Technical comparison: Dashboard-V2 remains the recommended candidate.
- `/profil` remains unchanged. Stop here before any profile replacement or
  product selection.

No packages, Tailwind, shadcn, Aceternity, AWS, Cognito, RIS, DNS, push or
deployment changes were made. Final code/evidence commits: `5edb171`,
`0820537`, and the S4 documentation/evidence commit follows.

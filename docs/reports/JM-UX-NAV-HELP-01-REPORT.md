# JM-UX-NAV-HELP-01 — Unified UX & May Assistant

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO PUSH, MERGE OR DEPLOY`
**Branch:** `feature/jm-ux-nav-help-01`
**Feature commit:** `5ddf5f1`
**Date:** 2026-11-09

## Scope

Jobsearch navigation, dashboard structure, durable-CV processing handoff and the
reusable May help surface. No RIS/AWS/Terraform change, no real user data and
no deployment.

## Navigation and dashboard

- Shared shell width for top navigation and dashboard: `min(1180px, 94vw)`.
- Consistent 44 px touch targets, active state and focus ring in the top menu.
- Desktop dashboard keeps the sidebar; it is sticky and has its own scroll area.
- Mobile uses a compact section `<select>` instead of a second persistent nav.
- Tablet portrait (`768–900 px`) uses the compact main menu, preventing the
  language/links overlap observed at 768 px.
- Dashboard navigation scrolls the active item into view and respects
  `prefers-reduced-motion`.

## Durable CV processing

- Each ready durable CV shows a prominent **„Verarbeiten“** action.
- `downloadCvFile` uses the existing authenticated BFF and the existing
  presigned download URL; there is no second upload and no new analysis engine.
- The downloaded PDF becomes a normal session `File` and is handed to the
  existing `handleCvUploadStart` workflow. Consent, anonymisation and model
  selection therefore remain unchanged.
- Processing is allowed only with verified identity, active CV storage consent
  and a `ready` CV.
- Storage consent is not reused as AI consent; the existing separate CV/AI
  consent gate still runs.
- Loading, per-CV error, retry and handoff status are visible. Identity changes
  invalidate in-flight downloads through the existing session epoch guard.
- Duplicate top-level upload was removed; the CV list owns upload actions.
  Session and durable storage are explicitly distinguished in the UI.

## May help

- Reusable `MayHelp` component with the required greeting:
  „Hallo, ich bin May! Ich helfe dir bei deinen Bewerbungen.“
- Context-sensitive text for overview, CV, applications, job preferences and
  settings.
- No chat, no input, no hidden API call; ready for a later chatbot extension.

## Screenshots

Assets: `docs/reports/assets/JM-UX-NAV-HELP-01/`

| Width | Overflow | Main menu | Dashboard navigation | May |
| --- | --- | --- | --- | --- |
| 320 px | none | burger | compact select | visible |
| 390 px | none | burger | compact select | visible |
| 430 px | none | burger | compact select | visible |
| 768 px | none | burger | desktop sidebar | visible |
| 1024 px | none | desktop | desktop sidebar | visible |
| 1440 px | none | desktop | desktop sidebar | visible |

Screenshots use the local `/dev/dashboard-v2` demo surface with demo data, not
real identities.

## Verification

| Check | Result |
| --- | --- |
| Focused navigation/CV/May tests | **55 passed** |
| Full suite, serial | **1633 passed**, 5 skipped |
| Production build | **PASS** |
| Screenshot overflow check | **none at all six widths** |

The parallel full run showed the existing timing-sensitive
`ManualSearchProfiles`/`CvBuilderEditorPdf` flakes; all pass in isolation and in
the serial full run.

## Boundaries

- No push, merge or deployment.
- No RIS/AWS/Terraform or privacy-contract change.
- No new dependencies.
- No real user data in tests.
- S3 versions/backups/PITR remain out of scope.

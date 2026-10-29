# MAYS-UI-S5 — Fachbereiche als Arbeitspakete

- Status: **PLANNING COMPLETE; NO FEATURE IMPLEMENTATION**
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `bd94cdc` (`chore: bump version to 2.2.0`)
- Scope: Dashboard-V2 roadmap and work-package specification only
- `/profil`: unchanged; no production route replacement
- Real Cognito E2E: **NOT VERIFIED**; retained as an S4 open point

## 1. Preflight and evidence rules

The repository path is `/home/dci-student/projects/Mays-Jobsearch`. The working
tree contained pre-existing user changes before this planning work:

```text
M  src/components/SourcesInfo.test.tsx
M  src/i18n.tsx
?? several user documents, images, reports and local test files
```

Those files were not edited, staged or committed. This report distinguishes
the following states:

- **IMPLEMENTED** — code exists in the repository; this does not by itself
  mean production or real-account verification.
- **VERIFIED** — a report or automated/browser test provides explicit evidence.
- **PLANNED** — a documented target, not an available feature.
- **NOT VERIFIED** — code, contract, environment or real integration could not
  be proven in this task.

Read before planning:

- `AGENTS.md`, `docs/AGENTS.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/AI_AUDITLOG.md`
- `docs/reports/13-01-MAYS-UI-S0-BASELINE.md`
- `docs/reports/14-01-MAYS-UI-S1-COMPONENTS.md`
- `docs/reports/15-01-MAYS-UI-S2-AURORA-DASHBOARD.md`
- `docs/reports/16-01-MAYS-UI-S3-PROFIL-ANBINDUNG.md`
- `docs/reports/17-01-MAYS-UI-S4-FEINSCHLIFF.md`

## 2. Existing foundation — consolidated findings

### Dashboard and authentication

**IMPLEMENTED:** S1 provides the reusable CSS-only primitives:

- `src/components/ui/Card.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/DashboardNavigation.tsx`

**IMPLEMENTED / VERIFIED:** `src/components/DashboardV2.tsx` renders fixed
personal claims, account state, logout for authenticated preview, and disabled
future entries for CV, applications, job preferences and settings. `src/App.tsx`
guards `/dev/dashboard-v2` and `/dev/dashboard-v2-auth` with DEV-only routing;
`src/lib/devRoute.ts` contains the guard. `/profil` still renders
`src/components/Profile.tsx`.

**IMPLEMENTED:** `src/main.tsx` supplies `AuthProvider`; OIDC configuration is
in `src/lib/oidcConfig.ts`, and login/logout helpers are in
`src/lib/authFlow.ts`. `Profile.tsx` currently displays `sub`, `email`, and
`name` from `auth.user?.profile` and offers logout only.

**VERIFIED:** controlled auth loading, error, signed-out, signed-in and logout
preview states are covered by S3/S4 evidence. **NOT VERIFIED:** a real Cognito
session, claims from the deployed user pool, or a real logout round trip.

### Profile and search data

**IMPLEMENTED:** `Profile` in `src/types.ts` currently consists of:

```text
skills: string
targetRoles: string[]
city: string
radiusKm: number | null
workModes: WorkMode[]
employmentTypes: EmploymentType[]
```

`src/components/SearchForm.tsx` edits these values, including skills, multiple
target roles, city autocomplete, radius, work mode and employment type.
`src/api.ts` serializes them for `/api/jobs`, `/api/match`, alerts and related
flows. The search form is React state; durable authenticated preference storage
does not exist. Therefore search input reuse is real, but saved user preference
semantics are **PLANNED / NOT IMPLEMENTED**.

### CV flow, processing and privacy

**IMPLEMENTED:** `src/components/CvUpload.tsx` validates PDF type and a 10 MB
limit, supports keyboard activation and drag/drop, and starts the shared
workflow. `src/App.tsx` coordinates the overlay states. `src/lib/pdf.ts` parses
in-browser; `src/lib/anonymize.ts` performs optional local anonymization;
`src/lib/cvProfileStore.ts` keeps named search/ATS lists in session memory with
a 12-hour expiry and purges legacy localStorage keys.

**IMPLEMENTED:** `src/components/CvConsentGate.tsx`,
`src/components/ConsentGate.tsx` and `src/components/PrivacyNotice.tsx` provide
consent UI. The extracted text hash can be sent to `/api/profile` on cache
miss. ATS analysis, improvement and reanalysis use `/api/ats-analysis.mjs` and
`/api/cv-improvement.mjs`; related UI is in `src/components/AtsOverlay.tsx`
and the CV workflow in `src/App.tsx`.

**IMPLEMENTED:** cover-letter generation and `.txt` download are in
`src/components/LetterModal.tsx`, `src/api.ts` and `api/cover-letter.mjs`.
This is a transient generated artifact, not an application record or CV export.

**VERIFIED:** local consent/anonymization and CV workflow tests exist in
`src/App.test.tsx` and privacy reports. **NOT VERIFIED:** all live production
provider/API paths and any durable account-linked CV storage. A user may still
choose non-anonymized processing; future requirements must not silently change
that privacy contract.

### Applications

**IMPLEMENTED:** job objects and match results exist in `src/types.ts`; job
details, matching and cover-letter APIs exist in `src/api.ts` and `api/`.

**NOT IMPLEMENTED:** there is no application entity, application API, saved
application store, status history, notes model, reminder model or dashboard
application screen. `DashboardV2` only displays a disabled navigation item.
`docs/ROADMAP.md` describes an application tracker as planned, but that is not
evidence of an implemented feature. No contract exists in this repository or
in another repository available to this task.

### Settings, language and storage

**IMPLEMENTED:** `src/i18n.tsx` detects DE/EN, updates `<html lang>`, and
persists the language in `localStorage["mj-lang"]`; `src/components/Navbar.tsx`
exposes the language control on desktop/mobile. CV profile lists are explicitly
session-memory-only in `src/lib/cvProfileStore.ts`.

**NOT IMPLEMENTED:** a user settings screen, notification preference model,
account preference API, account deletion flow, account export flow, or a
user-managed model API-key feature. Existing alert subscription is a separate
email flow through `src/api.ts` and `api/alerts.mjs`, backed by the alert helper
and not a general settings contract.

**NOT VERIFIED:** exact token storage behavior of the external OIDC library in
the deployed environment. No new storage behavior is assumed in S5.

## 3. Work-package overview

| ID | Work package | Reuse first | Current state | Priority | Rough effort* |
|---|---|---|---|---|---:|
| S5.1 | Mein Profil | claims, `Profile`, existing form primitives | partial display only | P1 | 3–5 days |
| S5.2 | Lebenslauf | complete existing CV workflow | substantial UI exists; dashboard integration open | P1 | 3–6 days |
| S5.3 | Bewerbungen | `Job`, match and letter output only | no application model/API | P3, contract-first | 5–10 days |
| S5.4 | Job-Präferenzen | `Profile` and `SearchForm` fields | no durable settings | P2 | 3–6 days |
| S5.5 | Einstellungen | i18n and existing browser controls | no settings screen | P2 | 2–4 days |

\* Estimates assume one engineer familiar with the repository, no new package,
no external service contract delay, and separate review/testing time. Backend
contract and privacy decisions can extend S5.2–S5.4.

Recommended order: **S5.1 → S5.4 → S5.5 → S5.2 → S5.3**. S5.3 starts with
a parallel data-model investigation, but implementation waits for an explicit
persistence contract. S5.1 and S5.4 share form validation decisions; one
integrator should reconcile them before coding.

## 4. Detailed work packages

### S5.1 — Mein Profil

#### User goal and flow

An authenticated user can inspect identity claims and, where the product owns
the value, edit profile attributes without confusing identity-provider data
with application preferences:

1. Open “Mein Profil” from Dashboard-V2.
2. See loading, authenticated, signed-out and error states.
3. Choose edit; editable fields receive focus and show current values.
4. Validate locally, submit, show pending state, then success or field/form
   error; cancel restores the last confirmed values.
5. E-mail change is a separate flow, not an ordinary profile-field update.

#### Existing foundation and classification

- **IMPLEMENTED:** claims display and logout in `src/components/Profile.tsx`.
- **IMPLEMENTED:** auth context in `src/main.tsx`, `src/lib/authFlow.ts`,
  `src/lib/oidcConfig.ts`.
- **IMPLEMENTED:** `DashboardUser` mapping in
  `src/components/DashboardV2AuthenticatedPreview.tsx` and
  `src/components/DashboardV2.tsx`.
- **PLANNED:** editable application profile form in Dashboard-V2.
- **NOT VERIFIED:** provider support for changing name/e-mail and any write API.

#### Proposed scope and exclusions

In scope: display `sub` as read-only, display available name/e-mail claims,
define which non-identity fields belong to the application profile, edit/cancel,
validation, feedback and accessibility. Explicitly out of scope: changing the
Cognito subject, changing e-mail in the generic form, password/MFA management,
account deletion, export and any new identity-provider endpoint.

#### UI components and states

Reuse `Card`, `Button`, `Badge`, `DashboardNavigation`, existing `.field` and
alert/focus tokens in `src/styles.css`. Add only a feature-specific form
component after the data contract is approved. Required states: loading,
read-only/signed-out, empty claim (`-` plus explanation), edit, dirty, saving,
success, validation error, server error and cancellation. DE/EN labels and
mobile single-column layout are required; keyboard order, labels, focus return
and error association must be tested.

#### Data flow, storage and decisions

Current source is OIDC claims, read-only in this repository. Before
implementation decide whether editable fields are:

- provider-owned claims (requires an approved Cognito/user-management contract),
- application-owned profile data (requires authenticated API + persistence), or
- local-only draft data (not suitable for a durable profile unless explicitly
  presented as such).

**Recommendation:** keep `sub` and current e-mail read-only; first implement
only application-owned fields after a server contract identifies user ownership,
authorization, validation and storage. Do not persist profile data in
localStorage as a substitute for an account contract. Treat e-mail change as a
separate security-reviewed flow.

#### Acceptance criteria and tests

- Claims render correctly for DE/EN, loading, error and signed-out states.
- Read-only fields cannot be submitted as editable fields.
- Valid edit → pending → success; cancel causes no write.
- Invalid values are announced and linked to controls; no raw i18n keys.
- No horizontal overflow at 390/768/1440 px; keyboard and reduced-motion checks
  pass.
- Tests: component states, validation, cancel/save contract mock, auth claim
  mapping, accessibility query, browser smoke. Integration proof requires an
  approved authenticated API contract; otherwise mark NOT VERIFIED.

#### Dependencies, steps and follow-up prompt

Dependencies: S5.4 shared form conventions; an authenticated persistence or
provider-write decision; real Cognito E2E remains separate. Steps: contract
decision → read-only UX → form/validation → write adapter → tests/browser
acceptance → report. Suggested commits: `docs:` contract, `feat:` form,
`test:` acceptance, `docs:` verification.

**Follow-up prompt:**

> Implement S5.1 only after approving the data contract in
> `docs/reports/18-01-MAYS-UI-S5-FACHBEREICHE-ARBEITSPAKETE.md`. Preserve
> `/profil`, do not add local persistence or Cognito write behavior without an
> explicit contract. Build a DE/EN accessible profile form from the existing
> Dashboard-V2 primitives, with loading/error/signed-out/edit/save/cancel states,
> tests and a separate real-Cognito NOT VERIFIED statement.

### S5.2 — Lebenslauf

#### User goal and flow

An authenticated user can enter the CV area, choose a PDF, review file and
processing information, grant the appropriate consent, observe progress, review
the derived profile/analysis and remove the current CV data.

#### Existing foundation and classification

- **IMPLEMENTED / VERIFIED:** upload validation and drag/drop in
  `src/components/CvUpload.tsx`.
- **IMPLEMENTED:** PDF parsing in `src/lib/pdf.ts`; optional anonymization in
  `src/lib/anonymize.ts`.
- **IMPLEMENTED:** consent gates in `src/components/CvConsentGate.tsx`,
  `src/components/ConsentGate.tsx`, and `src/components/PrivacyNotice.tsx`.
- **IMPLEMENTED:** profile creation through `src/api.ts` → `api/profile.mjs`;
  ATS and improvement through `api/ats-analysis.mjs` and
  `api/cv-improvement.mjs`.
- **IMPLEMENTED:** session-only named CV search/ATS lists in
  `src/lib/cvProfileStore.ts`, with explicit remove-data behavior.
- **IMPLEMENTED:** cover-letter text download, not CV export, in
  `src/components/LetterModal.tsx`.
- **NOT VERIFIED:** live production provider behavior and durable account CV
  storage; **NOT IMPLEMENTED:** document export/download.

#### Scope and separation of processing/storage/consent

In scope: dashboard entry point, file selection, preview metadata (not raw PDF
upload), progress/error/remove states, reuse of the existing workflow, and
clear explanation of browser processing versus server cache/API processing.
Out of scope: silently introducing durable CV storage, automatic external
application submission, or a new parser/provider.

Required separation:

1. **Browser processing:** `File` selection, PDF text extraction, normalization,
   optional anonymization and hash happen locally.
2. **Server processing/cache:** only the currently contracted extracted payload
   and hash may reach `/api/profile` on cache miss; verify the API contract and
   TTL before extending it.
3. **Consent:** CV processing consent precedes processing; AI ATS optimization
   has its own consent. Storage consent must be a separate decision if durable
   account storage is proposed.

**Recommendation:** initially expose the existing session-only workflow in the
dashboard without adding durable CV storage. Any account-linked storage needs a
separate privacy review, retention/deletion contract and authenticated API.

#### UI components and states

Reuse `CvUpload`, workflow overlay components, `Card`, `Button`, `Badge`, alert
styles and progress/status components already in `src/App.tsx`. Add a dashboard
container only if it does not duplicate workflow state. States: no document,
selected metadata, parsing, consent required, anonymization choice, model
selection, processing, profile ready, analysis, improvement, empty/error,
remove confirmation and removed success. DE/EN, keyboard dropzone operation,
focus restoration and mobile layout are acceptance requirements.

#### Acceptance criteria and tests

- PDF/type/size validation and keyboard/drop paths remain covered.
- Browser processing is visible and no PDF binary is sent to the API.
- Consent precedes each applicable external/AI operation; no consent is implied
  by upload.
- Progress, API error, empty text and removal are friendly and recoverable.
- Session expiry/removal behavior is documented and tested; durable storage is
  not claimed.
- Tests: `CvUpload`, consent gates, PDF/anonymization/hash flow, API request
  shape, store TTL/reset, improvement/ATS transitions, DE/EN browser smoke and
  network payload inspection. Live provider verification remains separate.

#### Dependencies, steps and follow-up prompt

Dependencies: privacy decision, S5.1 authenticated placement, existing API
contracts. Parallel investigation: verify `/api/profile`, ATS and improvement
retention/response contracts. Steps: contract/privacy inventory → dashboard
composition → state/error polish → tests → browser and data-flow evidence.

**Follow-up prompt:**

> Implement S5.2 by reusing the existing CV workflow. Do not add durable CV
> storage or change consent semantics. Add only the Dashboard-V2 container and
> missing states after documenting browser/server/consent data flow. Verify no
> PDF binary upload, DE/EN accessibility, removal, TTL and API error behavior;
> report live provider checks separately as VERIFIED or NOT VERIFIED.

### S5.3 — Bewerbungen

#### User goal and flow

The user can review personally selected opportunities, filter them, open a
detail view, and record a manually chosen application status. No automatic
submission or external action is part of this package.

#### Existing foundation and classification

- **IMPLEMENTED:** `Job`, `Match`, job details and cover-letter output in
  `src/types.ts`, `src/api.ts`, `api/job-details.mjs` and
  `api/cover-letter.mjs`.
- **IMPLEMENTED:** generated cover letter can be copied/downloaded as text;
  it is not an application record.
- **NOT IMPLEMENTED:** application entity, persistence, API, status history,
  notes, filters, detail screen or dashboard implementation.
- **PLANNED:** roadmap application tracker (`docs/ROADMAP.md`); documentation
  alone is not an implementation or contract.

#### Contract-first recommendation

Before UI coding, approve a minimal model, for example:

```text
Application {
  id, userId, jobSnapshot or jobRef, status,
  appliedAt?, followUpAt?, note?, createdAt, updatedAt
}
```

Define status vocabulary, ownership/authorization, job deletion behavior,
snapshot versus live reference, timestamps/time zone, pagination/filter query,
optimistic update/conflict behavior, retention and deletion. **Recommendation:**
start with an authenticated application-owned API and a small status enum
(`saved`, `planned`, `applied`, `interview`, `rejected`, `withdrawn`), but do
not implement this proposal until backend/privacy approval. Snapshot the
minimum display fields so later job-source changes do not erase the user's
record; never store a full job description or CV by default.

#### UI, data flow and exclusions

Reuse `Card`, `Button`, `Badge`, table/list styles, existing `Job` detail
presentation and i18n. Planned flow: loading list → empty state → filter/search
→ row/card detail → manual status change → confirmed success or rollback/error.
Mobile uses cards or responsive rows; desktop may use a table. Data must flow
through a typed API adapter, not localStorage-only state for a claimed account
feature. Exclude automatic application sending, scraping, external ATS actions,
cover-letter auto-send and reminders until separately specified.

#### Acceptance criteria and tests

- No application screen ships before the model/API contract is approved.
- Once approved, list/detail/filter/status transitions are authorized to the
  current user and survive the documented persistence boundary.
- Empty/loading/error/offline/conflict states are explicit; DE/EN and keyboard
  table/card navigation work at mobile widths.
- Tests: model validation, API contract fixtures, authorization/error mapping,
  filter/status reducer, component states and browser smoke. Integration proof
  must include a non-production authenticated API environment; otherwise mark
  NOT VERIFIED.

#### Dependencies, steps and follow-up prompt

This is the lowest-priority feature because it has no existing persistence
contract. Parallel work: data-model and privacy review. Integration owner
merges the approved contract before UI implementation.

**Follow-up prompt:**

> First perform a contract-only investigation for S5.3. Inspect existing Job,
> Match, detail and cover-letter shapes, then propose and review the minimal
> authenticated Application model/API, status enum, ownership, retention and
> snapshot policy. Do not build UI, local persistence, auto-submit or external
> ATS actions until the contract is explicitly approved.

### S5.4 — Job-Präferenzen

#### User goal and flow

The user can review and edit the same target role, skills, city, radius, work
mode and employment type used by search, then choose whether to apply the
values once or save them as a named account preference.

#### Existing foundation and classification

- **IMPLEMENTED:** `Profile` model in `src/types.ts`.
- **IMPLEMENTED:** field parsing, city autocomplete and controls in
  `src/components/SearchForm.tsx` and `src/hooks/useCityAutocomplete.ts`.
- **IMPLEMENTED:** query serialization in `src/api.ts` and server-side
  best-effort filters in `api/jobs.mjs`.
- **IMPLEMENTED:** CV-derived named search profiles in
  `src/lib/cvProfileStore.ts`, but session-only and tied to a CV hash.
- **NOT IMPLEMENTED:** durable authenticated preference editor or canonical
  account preference store.

#### Data model and recommendation

Use the existing `Profile` shape as the canonical field vocabulary. Resolve
whether a saved preference is one default profile or multiple named profiles,
how it relates to CV-derived profiles, and whether alert subscriptions copy or
reference it. **Recommendation:** separate three concepts: transient search
draft, CV-scoped session profile, and authenticated account default preference.
Do not copy the same fields into a second incompatible type; define one typed
mapping and an explicit source/precedence rule.

#### UI, data flow and states

Reuse SearchForm field components and validation, `Card`, `Button`, Badge and
autocomplete. Flow: load account preference (or empty), edit, validate, save or
cancel, then explicitly “use for this search”. Saving must not automatically
trigger a job search unless the user activates search. Storage is **NOT
IMPLEMENTED** today; an authenticated API/persistence contract is required for
the dashboard feature. Browser-only draft persistence, if later desired, must
be labeled as a draft and not presented as a saved account preference.

States: loading, empty, populated, dirty, saving, saved, validation error,
server error, conflict and signed-out. DE/EN, keyboard autocomplete, mobile
controls, minimum one employment type behavior and radius semantics must be
covered.

#### Acceptance criteria, dependencies and follow-up prompt

- Identical field semantics between search and preferences; no duplicate
  normalization rules.
- Save/cancel behavior and precedence between transient/CV/account profiles are
  documented and tested.
- Saved preference does not initiate a search; explicit search does.
- Tests cover parsing, serialization, validation, autocomplete keyboard use,
  API contract and DE/EN browser behavior.

Dependencies: S5.1 form conventions and an authenticated persistence decision;
S5.2 for CV-profile relationship. Estimated 3–6 days after contract approval.

**Follow-up prompt:**

> Implement S5.4 only after defining the canonical relationship between
> transient search state, CV-scoped session profiles and authenticated account
> preferences. Reuse `Profile` and SearchForm controls; do not duplicate field
> semantics or persist to localStorage as a substitute for an account API.
> Add save/cancel/loading/error states, DE/EN accessibility tests and prove
> that saving never starts a search automatically.

### S5.5 — Einstellungen

#### User goal and flow

The user can change supported presentation and notification options, understand
where each option applies, and receive immediate or confirmed feedback without
seeing unavailable account capabilities as if implemented.

#### Existing foundation and explicit gaps

- **IMPLEMENTED:** DE/EN toggle and `localStorage["mj-lang"]` in
  `src/i18n.tsx`/`src/components/Navbar.tsx`; `<html lang>` is updated.
- **IMPLEMENTED:** alert subscription API exists in `src/api.ts` and
  `api/alerts.mjs`, but this is not a general settings store.
- **IMPLEMENTED:** CV data removal is a workflow action, not an account
  settings page.
- **NOT IMPLEMENTED:** settings route/screen, durable notification preference,
  account deletion, account export or user model API-key storage.

#### Storage and scope matrix

| Setting | Current storage | Scope | S5 recommendation |
|---|---|---|---|
| Language | browser `localStorage` key `mj-lang` | device/browser | keep; show immediate feedback |
| Alert subscription | server alert store via `/api/alerts` | email/profile contract | keep separate until authenticated ownership is decided |
| CV session lists | JS session memory, 12h lazy TTL | current tab/session | keep privacy boundary; do not relabel as account setting |
| Model API key | none | undefined | open decision; do not store or implement |
| Delete account | none | undefined | not available; do not present as action |
| Export account data | none | undefined | not available; do not present as action |

**Recommendation:** implement a small settings shell only around already
supported language behavior first. Keep alert management separate until its
ownership/verification model is clarified. Treat user-provided model API keys
as an explicit security/privacy decision; no browser, server or encrypted
storage solution is approved by this plan.

#### UI, states and acceptance

Reuse `Card`, `Button`, language control and existing alert/consent patterns.
Provide setting-specific scope text, loading/saving/error/success states only
where a real contract exists, and disabled/not-available explanations for
unimplemented account deletion/export/API-key features. DE/EN, keyboard and
mobile checks are required. Tests must verify `mj-lang`, `<html lang>`, no raw
keys, no secret values in DOM/build, and that unsupported actions are absent or
clearly unavailable.

**Follow-up prompt:**

> Implement S5.5 language settings only using the existing `i18n.tsx` contract.
> Do not add API-key storage, account deletion, export or notification
> persistence. Separately document the alert ownership decision. Verify DE/EN,
> localStorage behavior, html lang, keyboard/mobile UI and absence of claims
> for unavailable features.

## 5. Cross-package delivery and verification plan

### Parallel discovery

The following can proceed independently before implementation:

1. S5.1: identity versus application-owned profile contract.
2. S5.2: API retention/payload and privacy/consent evidence.
3. S5.3: application model, authorization and persistence contract.
4. S5.4/S5.5: storage matrix and preference ownership.

One responsible integrator reconciles shared field names, form validation,
loading/error semantics, i18n keys, navigation IDs and privacy wording before
any feature branch implementation. No new framework or package is needed for
this plan.

### Frontend versus backend work

| Package | Frontend work | Backend/contract work |
|---|---|---|
| S5.1 | claims/edit form, states, accessibility | decide provider write vs authenticated app profile API |
| S5.2 | dashboard CV container and state presentation | verify existing profile/ATS contracts; durable storage only after privacy approval |
| S5.3 | table/cards, filters, detail, status controls | new authenticated application model/API required |
| S5.4 | shared preference form and explicit “use” action | authenticated preference persistence required |
| S5.5 | language settings shell and scope messaging | alert/settings ownership decision; no API-key solution assumed |

### Common acceptance gate

Each implementation step must include typed contracts, DE/EN dictionaries,
keyboard/mobile/reduced-motion checks, loading/empty/error/success states,
component and integration tests, `npm run build`, `node --check api/**/*.mjs`
when API code changes, `git diff --check`, secret audit and an updated report.
Real Cognito E2E must remain separately labeled until actually run.

## 6. S5 exit criteria and open decisions

S5 planning is complete when this report, `docs/ROADMAP.md` and
`docs/AI_AUDITLOG.md` are committed. S5 feature delivery is **not** complete:
the five packages remain planned and no new feature logic or storage was added.

Blocking decisions before implementation:

1. Is the profile application-owned or Cognito-owned?
2. Is durable CV storage required, and what retention/consent applies?
3. What authenticated application model/API is approved?
4. Is there one default preference or multiple named account profiles?
5. Are alerts account-owned, email-owned, or a separate subscription?
6. Is any model API-key support in scope? Recommendation: defer pending a
   security review.
7. Which account deletion/export obligations must be supported before release?

No ambiguity above is silently treated as a product decision.

# Deployment

#Vercel

#Serverless Functions

#Vercel Cron

#Environment Variables

## Environments: Development → Preview → Production

Die reale Vercel-Strategie unterscheidet drei Umgebungen:

| Umgebung | Befehl | `VERCEL_ENV` | Zweck |
|---|---|---|---|
| Development | `vercel dev` | `development` | lokale Runtime, interne Tests |
| Preview | `vercel deploy` | `preview` | öffentliche Abnahme-Umgebung |
| Production | `vercel --prod` | `production` | Live-Betrieb |

**Development ≠ Preview ≠ Production.** Jede Umgebung hat eine eigene `VERCEL_ENV`-Bezeichnung
und eigene Deployment-Artefakte.

## Deployment vs. Git-HEAD

**Ein Deployment entspricht NICHT automatisch dem aktuellen Git-HEAD.**

Bei der Abnahme werden folgende Werte getrennt dokumentiert und miteinander verglichen:

| Wert | Bedeutung |
|---|---|
| Git HEAD | aktueller lokaler Commit |
| Deployment Commit | Commit, aus dem das Deployment tatsächlich gebaut wurde (Vercel-API, `meta.githubCommitSha`) |
| Build Identity | zur Build-Zeit im Artefakt eingefrorene Werte (Version / Environment / Commit-SHA) |
| Environment | `development` / `preview` / `production` |

Prüfung pro Umgebung:

1. Deployment-Commit (Vercel-API) == Git-HEAD des deployten Stands.
2. Build Identity im Artefakt == Deployment-Commit (der Footer zeigt `Version · Environment · Commit-SHA`
   des tatsächlich gebauten Artefakts).
3. Environment-Label des Artefakts == erwartete Umgebung.

Der zuletzt getestete Deployment-Stand kann älter sein als der aktuelle Git-HEAD (z. B. nach
Report-/Doku-Commits ohne neues Deployment). Der Footer friert die Identität des gebauten
Artefakts ein und wechselt nicht, wenn Git danach weiterverändert wird. Keine Secrets in
Build-Informationen aufnehmen.

## Deploy

The project does **not** rely on automatic Vercel Git deployment — production is deployed explicitly.

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod --scope maymilly
```

`--scope maymilly` is required because the local CLI token is associated with another Vercel account/team (`gregornowak-6756`), while the project lives in the `maymilly` team.

## Project

Vercel project: `maymilly/mays-job-matcher`

Live URL: https://mays-job-matcher.vercel.app

## Environment variables (all server-side)

| Variable | Purpose | Where used | Required? | Secret? |
|---|---|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter authentication for all AI calls (matching, profile extraction, cover letters) — primary AI provider | `api/_lib/providers/openrouter.mjs` | Required for AI features (one AI provider must be configured) | Yes |
| `OPENROUTER_MODEL` (optional) | Override the default/fallback model resolution | `api/_lib/model.mjs` | Optional (default model constant used if unset) | No |
| `OPENROUTER_ENABLED` (optional) | Enable/disable the OpenRouter provider (default `true`) | `api/_lib/providers/index.mjs` | Optional (safe default) | No |
| `EDENAI_API_KEY` (optional) | EdenAI production key — second AI provider, used when OpenRouter is exhausted or disabled | `api/_lib/providers/edenai.mjs` | Optional — needed for the EdenAI provider in production | Yes |
| `EDENAI_DEV_API_KEY` (optional) | EdenAI sandbox token for dev/preview (simulated responses, no cost, same endpoint) | `api/_lib/providers/edenai.mjs` | Optional | Yes |
| `EDENAI_ENV` (optional) | Force EdenAI key mode: `production` → `EDENAI_API_KEY`, anything else → prefers `EDENAI_DEV_API_KEY`; defaults to `VERCEL_ENV` (`production` → `EDENAI_API_KEY`) | `api/_lib/providers/edenai.mjs` | Optional | No |
| `EDENAI_MODEL` (optional) | Override the default EdenAI model | `api/_lib/model.mjs` | Optional (default model constant used if unset) | No |
| `EDENAI_ENABLED` (optional) | Enable/disable the EdenAI provider (default `true`) | `api/_lib/providers/index.mjs` | Optional (safe default) | No |
| `APIFY_API_TOKEN` (optional) | Apify authentication for Apify-based job sources (currently Arbeitsagentur) | `api/_lib/sources/apify/client.mjs` | Optional — without it only Arbeitnow is used | Yes |
| `JOB_SOURCE_ARBEITNOW_ENABLED` (optional) | Enable/disable the Arbeitnow job source (default `true`) | `api/_lib/config.mjs` | Optional (safe default) | No |
| `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` (optional) | Enable/disable the Arbeitsagentur job source (default `true`) | `api/_lib/config.mjs` | Optional (safe default) | No |
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint for job-source/detail caches, cost counters and alert subscriptions | `api/_lib/cache.mjs`, `api/_lib/alerts.mjs` | Required for caching and alerts | Credentials — server-side only |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token (same uses as above) | `api/_lib/cache.mjs`, `api/_lib/alerts.mjs` | Required for caching and alerts | Yes |
| `RESEND_API_KEY` | Resend authentication for the daily digest emails | `api/cron/digest.mjs` | Required for digest emails | Yes |
| `DIGEST_FROM` | Sender address (verified Resend domain) | `api/cron/digest.mjs` | Required for digest emails | No |
| `CRON_SECRET` | Protects `/api/cron/digest` (Bearer auth) | `api/cron/digest.mjs` | Optional (cron also trusts `x-vercel-cron`) | Yes |
| `OPENROUTER_MONTHLY_MAX_REQUESTS` | OpenRouter request-count backstop for the cost guard (default `1000`/month) | `api/_lib/config.mjs` / `api/_lib/usage.mjs` | Optional (safe default) | No |
| `EDENAI_MONTHLY_MAX_REQUESTS` | EdenAI request-count backstop (default `200`/month) | `api/_lib/config.mjs` / `api/_lib/usage.mjs` | Optional (safe default) | No |
| `APIFY_MONTHLY_MAX_RUNS` | Apify Actor-run backstop for the cost guard (default `100`/month) | `api/_lib/config.mjs` / `api/_lib/usage.mjs` | Optional (safe default) | No |
| `MODEL_FALLBACK_MAX_ATTEMPTS` | Max AI fallback attempts, exposed to the client via `/api/models` (default `3`) | `api/_lib/config.mjs` / `api/models.mjs` / client | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_HOURS` | Apify dataset reuse window during peak hours 08:00–18:00 (default `6`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` | Apify dataset reuse window off-peak (default `12`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_TIMEZONE` | IANA timezone for the Apify peak window (default `Europe/Berlin`; DST handled automatically, no hardcoded UTC offset) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_START` | Apify peak window start, `HH:MM` (default `08:00`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_END` | Apify peak window end, `HH:MM` (default `18:00`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `USAGE_DIAGNOSTICS_TOKEN` | Protects `GET /api/usage` (via `x-usage-token` header or `Authorization: Bearer`). Unset → endpoint disabled (403). Must be set to enable reading usage diagnostics | `api/usage.mjs` | Optional — recommended for operators (secure default: disabled) | Yes |
| `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` | Advisory OpenRouter spend limit (USD), shown in `/api/usage`; does NOT block (provider dashboard is authoritative) | `api/_lib/config.mjs` | Optional (default `0.80`) | No |
| `EDENAI_MONTHLY_SOFT_LIMIT_USD` | Advisory EdenAI spend limit (USD), shown in `/api/usage`; does NOT block | `api/_lib/config.mjs` | Optional (default `1.00`) | No |
| `APIFY_MONTHLY_SOFT_LIMIT_USD` | Advisory Apify spend limit (USD), shown in `/api/usage`; does NOT block | `api/_lib/config.mjs` | Optional (default `4.00`) | No |

`.env.example` contains placeholders only. Real credentials are never committed to Git.

### Setting `USAGE_DIAGNOSTICS_TOKEN` on Vercel (Production)

The `/api/usage` diagnostics endpoint is **disabled (HTTP 403) until this token is set**. To enable it:

```bash
# generate a random secret once, e.g.:
openssl rand -hex 32          # or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
vercel env add USAGE_DIAGNOSTICS_TOKEN   # select Production
vercel --prod --scope maymilly            # redeploy so the variable is used
```

Then read the diagnostics with:

```bash
curl -H "x-usage-token: <your-token>" https://mays-job-matcher.vercel.app/api/usage
```

The token is a server-side secret: it must never be added to the frontend bundle, `.env.example` is only a placeholder, and it never appears in responses or logs.

## RIS ApplicationV1 and Consent BFF (server-only, disabled by default)

The RIS application storage path is disabled unless all required server values are present. The consent BFF has its own activation switch and can be enabled independently of application storage. The partner credential must never use a `VITE_*` name and must never be exposed to the browser. The server-side test-user allowlist is an additional test gate, not a replacement for RIS partner authorization.

| Variable | Purpose | Required for BFF? | Secret? |
|---|---|---|---|
| `RIS_APPLICATION_STORAGE_ENABLED` | Explicit application-storage opt-in; default/absent = OFF | Yes, `true` for remote application mode | No |
| `RIS_CONSENT_SERVICE_ENABLED` | Independent consent-BFF opt-in; default/absent = OFF; does not require application storage | Yes, `true` for consent mode | No |
| `RIS_API_BASE_URL` | Official HTTPS RIS partner base URL | Yes | No |
| `RIS_PARTNER_CREDENTIAL` | Server-side partner credential sent as `X-Api-Credential` | Yes | Yes |
| `RIS_API_KEY` | Supported compatibility alias for the partner credential | Alternative to `RIS_PARTNER_CREDENTIAL` | Yes |
| `RIS_API_CREDENTIAL` | Additional compatibility alias | Alternative | Yes |
| `RIS_COGNITO_ISSUER` | Expected Cognito issuer for access tokens | Yes | No |
| `RIS_COGNITO_CLIENT_ID` | Expected Cognito client/audience | Yes | No |
| `RIS_TEST_USER_ALLOWLIST` | Server-side `<issuer>|<sub>` test identities; empty = deny all | Yes for test mode | Sensitive |
| `RIS_CONSENT_TEXT_VERSION` | Server-owned consent text version; must equal the canonical client version | Yes for a grant | No |
| `RIS_CONSENT_TEXT_SHA256` | SHA-256 of the canonical consent text (UTF-8) | Yes for a grant | No |
| `RIS_CONSENT_TEXT_STATE` | `APPROVED` only after operator/legal approval; `DRAFT` or absent blocks | Yes for a grant | No |
| `RIS_API_TIMEOUT_MS` | RIS request timeout, default 10000 | No | No |
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` | Browser opt-in for remote preview; default OFF | Client-side only | No |
| `VITE_RIS_APPLICATION_MIGRATION_MOCK` | Local migration mock only; keep OFF outside local tests | No | No |

`RIS_API_BASE_URL` must be the official partner endpoint and use HTTPS. `RIS_COGNITO_ISSUER` and `RIS_COGNITO_CLIENT_ID` must match the partner registration. Do not read, print or commit secret values. Production and Preview are separate environments; a key in Production does not make Preview ready.

Consent and application storage are independently activated. `RIS_CONSENT_SERVICE_ENABLED=true` with `RIS_APPLICATION_STORAGE_ENABLED=false` enables only the consent BFF; the reverse leaves consent disabled. Both modes reuse the same `RIS_API_BASE_URL`, partner credential, Cognito issuer/client and test-user allowlist.

### Consent notice approval gate

`RIS_CONSENT_NOTICE_VERSION` is only a mapping from this app to a RIS notice version. It is **not** an approval and must never be treated as one. Before reporting `grantAllowed` and again immediately before writing a grant, the BFF reads the live catalogue from `GET /v1/partner/me/consents` and requires the catalogue entry for the configured version to satisfy all of:

- the entry exists for `purpose=application-storage` and `noticeVersion` equals the server-configured value,
- `noticeState` is `APPROVED` or `ACTIVE` (RIS `GRANTABLE_NOTICE_STATES`),
- `noticeApproved` is boolean `true`,
- `acceptedForNewGrant` is boolean `true`.

The state check is load-bearing: with RIS `CONSENT_NOTICE_STATE_ENFORCED=false`, a `DRAFT` notice reports `acceptedForNewGrant: true` and a `SUPERSEDED` notice reports `noticeApproved: true` **and** `acceptedForNewGrant: true`. The flags alone would therefore accept a superseded notice; `DRAFT` and `SUPERSEDED` are rejected by the state check regardless of the flags.

Anything else fails closed: missing or malformed catalogue, unknown/changed version, `DRAFT`/`SUPERSEDED` state, non-boolean approval flags, RIS error or timeout. `GET /api/ris/consents` returns `noticeVersion`, `noticeState`, `noticeApproved`, `acceptedForNewGrant`, `grantAllowed` and `noticeReason` so the UI can explain the block; legal approval references are never returned.

### Consent text mapping (candidate — not approved)

The Jobsearch side additionally binds the consent to the exact declaration text it displays (`src/lib/applicationStorageConsent.ts`):

| Item | Value |
| --- | --- |
| Text version | `application-storage-consent-2026-11-07-v4` |
| SHA-256 (UTF-8, `paragraphs.join("\n\n")`) | `8722aed9fa78e5ee49c2b5e5a031bfd53a7109bf625dfb0e0c99743fd82443c7` |
| Purpose | `application-storage` |
| RIS notice version | `1.0` |
| State | `DRAFT` / candidate for operator approval |

The text is a complete German first-person declaration candidate. It is **not legally approved**; no `legalApprovalRef` exists for it. The operator must approve the exact text and then configure the same version and hash server-side:

- `RIS_CONSENT_TEXT_VERSION` must equal the canonical version,
- `RIS_CONSENT_TEXT_SHA256` must equal the canonical hash,
- `RIS_CONSENT_TEXT_STATE` must be `APPROVED` (only after approval).

`GET /api/ris/consents` returns `textVersion`, `textHash`, `textState`, `textMapped`, `textApproved` and `textReason` in addition to the notice fields. `grantAllowed` is `true` only when the RIS notice is grantable **and** the text mapping is approved. The browser compares the server version/hash with its own canonical values and fails closed on any mismatch. `POST` re-checks the text mapping before writing and returns `503 consent_text_not_configured` / `503 consent_text_mismatch` or `409 consent_text_not_approved`; no RIS grant call is made.

Blocked grants use `409` for notice-state reasons (`notice_not_active`, `notice_not_approved`, `notice_not_accepted`, `notice_version_unknown`) and `503` for `notice_version_not_mapped`, `notice_catalog_invalid` or `notice_catalog_unavailable`. A blocked grant never calls the RIS grant endpoint. Withdrawal stays available regardless of notice state.

Activation implication: setting `RIS_CONSENT_NOTICE_VERSION=1.0` while RIS keeps notice `1.0` in `DRAFT` leaves grants blocked, and so does an absent, `DRAFT` or mismatching text mapping. That is the intended fail-closed behaviour. Do not work around it by enabling other flags, editing the browser code or changing the version; both the RIS notice and the Jobsearch text mapping must be explicitly approved first. The privacy policy release version is independent of the consent notice version.

**RIS-DEV activation sequence (separate operator GO required):** (1) approve the exact consent text and the RIS notice `application-storage/1.0`, set the RIS notice to `APPROVED`/`ACTIVE` with a real `legalApprovalRef`; (2) set `RIS_CONSENT_NOTICE_VERSION=1.0`, `RIS_CONSENT_TEXT_VERSION=application-storage-consent-2026-11-07-v4`, `RIS_CONSENT_TEXT_SHA256=8722aed9fa78e5ee49c2b5e5a031bfd53a7109bf625dfb0e0c99743fd82443c7` and `RIS_CONSENT_TEXT_STATE=APPROVED` in the target environment; (3) enable RIS `CONSENT_NOTICE_STATE_ENFORCED=true`; (4) grant a synthetic consent; (5) enable `APPLICATION_CONSENT_ENFORCED=true` for the write gate. Keep the allowlist restricted to the synthetic test identity and do not enable production `VITE_RIS_APPLICATION_STORAGE_ENABLED` for the general audience. The superseded candidates `application-storage-consent-2026-11-07-v1` (SHA-256 `2615314738ca991f232314529d0bd473585758b4d1dd4b780f29bcc4c5289953`), `...-v2` (SHA-256 `232cc8206261b5d14f7a269f63a58320f76eea435a65f7e039b25c62d26da0ca`) and `...-v3` (SHA-256 `696f9e66d8098b2dce56a93418ba598145b669934662e2b52d9a332731517668`) are historical only and must not be configured. RIS `3ed915b` accepts only the v3 identity as Art. 9 proof; RIS must add v4 before a v4 pilot grant can be accepted.

**Art. 9 special-category consent.** The v4 text adds an explicit Art. 9(2)(a) DSGVO consent for special categories in application documents, including Sexualleben und sexuelle Orientierung. It states the consent is voluntary, requires no assignment to a specific category and no disclosure of whether such data exists, and that no automatic categorisation or inference of gender, gender identity or sexual orientation takes place. The UI renders a separate checkbox (unchecked by default) with the label "Ich willige ausdrücklich in die Speicherung besonderer Kategorien personenbezogener Daten gemäß Art. 9 Abs. 2 lit. a DSGVO ein."; the grant button stays disabled until it is checked, in addition to the notice/text gates. The browser sends only `specialCategoriesConsent: true/false`; text version, hash and the nine category codes (`health`, `religious_or_philosophical_beliefs`, `trade_union_membership`, `political_opinions`, `sexual_orientation`, `sex_life`, `biometric_data`, `genetic_data`, `racial_or_ethnic_origin`) are server-owned. The BFF rejects a grant without explicit consent (`422 special_categories_consent_required`) before any RIS grant call, and sends `specialCategoriesConsent`, `specialCategories`, `externalTextVersion` and `externalTextSha256`. RIS must persist these fields with the consent and echo them in the consent status; missing fields are mapped fail-closed to `false`/empty/`null` and are shown as an unproven backend proof. Withdrawal is unchanged and does not require the special-category flag.

**Per-user remote capability (no client allowlist).** `VITE_RIS_APPLICATION_STORAGE_ENABLED=true` alone does not enable remote mode. For an authenticated identity the app now probes `GET /api/ris/consents` (`src/lib/applications/remoteCapability.ts`); remote mode is used only when the probe succeeds for the current verified `iss + sub` profile key. The BFF remains authoritative: it verifies the access token, the server-only `RIS_TEST_USER_ALLOWLIST` and the consent-service configuration. A missing/expired token, `401`, `403 test_user_not_allowed`, `503`, network failure or any other error keeps the app in session mode; the result is bound to the profile key, so a previous user's capability cannot leak across a logout/identity switch, and existing session applications are never transferred automatically. Guests and unconfigured environments always stay in session mode. Do not add an issuer/sub allowlist to the browser bundle or move `RIS_TEST_USER_ALLOWLIST` into a `VITE_*` variable.

**Defence in depth status.** RIS wired `CONSENT_NOTICE_STATE_ENFORCED` into Terraform in `81634d8`, but the variable defaults to `false` and is not enabled in any deployed environment. Until it is explicitly enabled, the Jobsearch BFF gate is the only effective notice-approval barrier.

## Add an environment variable (CLI)

```bash
vercel env add OPENROUTER_API_KEY   # then choose production / preview / development
vercel --prod --scope maymilly      # redeploy so the variable is used
```

## Cron

Defined in `vercel.json`:

- path: `/api/cron/digest`
- schedule: `0 7 * * *` (daily 07:00 UTC)
- protected via `Authorization: Bearer <CRON_SECRET>` or the `x-vercel-cron` header

## Function runtime

`vercel.json` sets `maxDuration: 60` for all `api/**/*.mjs` functions. The match pipeline keeps the AI evaluation to at most 10 candidates so requests complete within this limit.

## Cost guard & usage

- The app tracks its own monthly usage counters in Upstash Redis and exposes them via `GET /api/usage` (no secrets in the response). The endpoint is protected by `USAGE_DIAGNOSTICS_TOKEN`; without it, it is disabled (403). See `README.md` → "Cost guard & usage" and `ARCHITECTURE.md` → "Cost guard & usage".
- Guards use counter-based backstops (`OPENROUTER_MONTHLY_MAX_REQUESTS`, `EDENAI_MONTHLY_MAX_REQUESTS`, `APIFY_MONTHLY_MAX_RUNS`). The `*_SOFT_LIMIT_USD` values are advisory and never block.
- AI provider fallback: when one AI provider hits its request-count backstop (or its quota is exhausted: `free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`), the router automatically retries on the other enabled provider. See `docs/AI_PROVIDERS.md`.
- **Job Source Registry**: job sources are now modular (`api/_lib/sources/`). Each source can be independently enabled/disabled via `JOB_SOURCE_*_ENABLED`. Disabled sources produce no requests, no cost, no jobs. The `/api/jobs` meta includes `sourceCounts` (post-dedup per source), `disabledSources`, and `sourceDetails`.
- **Per-source usage counters**: the `/api/usage` snapshot now includes a `jobSources` object with per-source counters (`requests` for all sources; `runs`, `datasetReuses`, `cacheHits`, `cacheMisses` for Apify-based sources).
- Apify dataset reuse is time-of-day aware in `Europe/Berlin` (default): peak 08:00–18:00 uses the peak reuse window (6 h), off-peak the off-peak window (12 h). Summer/winter time is resolved automatically via the IANA timezone.
- Apify cache keys are now collision-free across multiple Actors: `job-source:<sourceId>:<query>|<location>` (L1) and `job-source:<sourceId>:dataset:<query>|<location>` (L2).

## Durable CV storage (separate BFF)

The durable CV path is separate from ApplicationV1 and is disabled unless all
flags and the CV consent text mapping are explicitly configured.

| Variable | Purpose |
| --- | --- |
| `RIS_CV_STORAGE_ENABLED` | Enables `/api/ris/cvs` (server-only). |
| `RIS_CV_CONSENT_NOTICE_VERSION` | RIS notice version mapped to the CV purpose (`1.0` candidate). |
| `RIS_CV_CONSENT_TEXT_VERSION` | `cv-storage-consent-2026-11-08-v1`. |
| `RIS_CV_CONSENT_TEXT_SHA256` | `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036`. |
| `RIS_CV_CONSENT_TEXT_STATE` | `APPROVED` only after operator/legal approval; `DRAFT`/absent blocks grants. |
| `VITE_RIS_CV_STORAGE_ENABLED` | Browser opt-in for the durable CV UI; default `false`. |
| `CV_STORAGE_CONSENT_ENFORCED` (RIS) | Enforce `cv-storage` on new CV writes; reads/download/delete remain allowed. Default `false`; Terraform wiring exists, activation requires a separate plan/apply GO. |

The browser receives only short-lived presigned PUT/GET URLs. The private
document bucket must allow the exact Jobsearch origin via S3 CORS; that CORS
resource is defined in the RIS documents module and requires a reviewed plan
before activation.

## Durable search-profile storage (separate BFF)

Manual, CV-search and ATS profiles use one BFF route and the existing RIS
contracts. The feature is disabled unless all flags and the separate consent
text mapping are explicitly configured.

| Variable | Purpose |
| --- | --- |
| `RIS_SEARCH_PROFILE_STORAGE_ENABLED` | Enables `/api/ris/search-profiles` (server-only). |
| `RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION` | RIS notice version mapped to `search-profile-storage` (`1.0` candidate). |
| `RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION` | `search-profile-storage-consent-2026-11-08-v2`. |
| `RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256` | `75919c8bc219c938bdd2452a8bf02955997d1336ba2ca716bc691dd54eaa7ef6`. |
| `RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE` | `APPROVED` only after operator/legal approval; `DRAFT`/absent blocks grants. |
| `VITE_RIS_SEARCH_PROFILE_STORAGE_ENABLED` | Browser opt-in for the durable search-profile UI; default `false`. |
| `SEARCH_PROFILE_STORAGE_CONSENT_ENFORCED` (RIS) | Enforce the separate consent on manual/CV-search/ATS writes; list/get/delete remain allowed. Default `false`; activation needs a separate plan/apply GO. |

`RIS_SEARCH_PROFILE_CONSENT_SYNTHETIC=true` is a local synthetic-test hook
only. It never substitutes for operator approval and must not be used for real
users.

Option A applies: manual profiles have no CV parent; CV-search profiles need a
durable RIS `cvId`; ATS profiles need a durable CV-search profile id. Session
CVs and their profile lists remain session-only.

## CI/CD

- Not automated — deployments are performed explicitly via the CLI (see above).
- Recommended: push to GitHub → import in Vercel → auto-deploy on push.

## Rollback (Guest Model A)

- **Do not roll back to a commit before `8f04af8` / `21609f3`.** That would
  re-enable TheirStack/JobsPipe for guests and could reintroduce `mj_session`.
- Apify incident: set `JOB_SOURCE_ARBEITSAGENTUR_ENABLED=false` (and/or remove
  `APIFY_API_TOKEN`). This disables only the approved Arbeitsagentur path.
- Code rollback: redeploy the last release commit that already contains the
  source policy and cookie removal (`b2cb191` or later). If no such deployment
  exists, roll forward with a reviewed fix; this is a deployment blocker.
- Keep all Redis keys, counters and budgets. Never flush Redis during rollback.
- Never re-enable `Set-Cookie: mj_session`; legacy cookies stay deleted.
- A rollback must not silently allow TheirStack, JobsPipe or unknown paid
  providers.

#Domain

- Custom domain not yet configured.

#CI/CD

- Planned (GitHub + Vercel auto-deploy).

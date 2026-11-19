# JM-VERCEL-ANALYTICS-01 — Vercel Web Analytics Integration

**Status:** `IMPLEMENTED / LOCAL VERIFIED`  
**Privacy:** `VENDOR DOCUMENTATION REVIEWED — LEGAL/CONSENT DECISION OPEN`  
**Production activation:** `BLOCKED` — Analytics remains disabled by default  
**Branch:** `feature/jm-vercel-analytics-01`  
**No Main merge or Production deployment.**

## 1. Technical Integration

Installed the official package:

```bash
npm install @vercel/analytics
```

Resolved version:

```text
@vercel/analytics 2.0.1
```

Integrated in the central React entry point `src/main.tsx`:

```tsx
import { VercelAnalytics } from "./lib/vercelAnalytics";

// exactly one instance, outside the route-specific root components
<VercelAnalytics />
```

`src/lib/vercelAnalytics.tsx` contains the single React/Vite integration:

```tsx
import { Analytics } from "@vercel/analytics/react";

export function VercelAnalytics({ enabled = isVercelAnalyticsEnabled() }) {
  return enabled ? <Analytics /> : null;
}
```

- Uses only `@vercel/analytics/react`; no Next.js imports.
- Exactly one Analytics instance in the app tree.
- No custom events and no use of `track()`.
- No CV, application, profile, consent, token or email payload is passed.
- Existing SPA routing is unchanged.
- No additional tracking SDK was installed.
- No tracking request is made by this app while the activation flag is off.

## 2. Activation Gate

Default-off flag:

```text
VITE_VERCEL_ANALYTICS_ENABLED=false
```

Activation requires all of the following:

1. Explicit `VITE_VERCEL_ANALYTICS_ENABLED=true` in the target build/deployment.
2. Vercel Web Analytics enabled for the relevant Vercel project.
3. Privacy/legal approval of the exact data processing and any required consent decision.
4. A documented decision on whether an analytics consent is required for the target audience.

No Vercel dashboard setting, environment variable or production deployment was changed.

## 3. Privacy Review — Vendor Documentation

Reviewed current Vercel documentation:

- Web Analytics overview (last updated 2026-08-11)
- Quickstart (last updated 2026-06-08)
- Using Web Analytics (last updated 2026-09-16)
- Privacy and Compliance (last updated 2026-06-26)

Documented vendor behavior:

- Visitor identification uses a request-derived hash, not third-party cookies.
- The visitor hash is reset after 24 hours and is not used for cross-site tracking.
- Vercel describes collected data as aggregated/anonymized.
- Data points may include timestamp, URL/dynamic path, referrer, filtered query
  parameters, geolocation, OS/version, browser/version, device type and script
  version.
- The docs state that no personal identifier is intentionally collected and no
  cross-application/session reconstruction is intended.
- Vercel explicitly provides configuration for redacting sensitive URL/query data.

**Cookie-free does not mean consent-free.** Vercel's vendor documentation is
not a legal decision for this application. The following remain open:

- legal basis and necessity assessment under GDPR/ePrivacy/TDDDG;
- controller/processor roles and the applicable Vercel DPA;
- whether the visitor hash/geolocation/URL data is personal data in this context;
- whether a consent gate is required before the script is loaded;
- retention/dashboard/export rules in the actual Vercel account;
- any required update to the public privacy policy before activation.

The existing privacy policy already mentions Vercel as hosting provider and
states that active analysis/tracking depends on the productive configuration.
No policy text was changed while Analytics remains disabled, because adding
specific active-processing claims would not yet be justified.

## 4. Tests

| Check | Result |
|---|---|
| Analytics unit tests | **5 PASS** |
| Disabled flag renders no Analytics component | PASS |
| Explicit enable renders exactly one component | PASS |
| Central entry point contains exactly one mount | PASS |
| No custom tracking calls / CV payloads | PASS |
| `npm run build` | PASS |
| Full suite | **2005 PASS / 11 skipped** |

The full-suite first run reported four unrelated timing/UI failures in
`App.test.tsx` and `ApplicationsSection.test.tsx`; both files passed together
on isolated retry (`135/135`) and the complete suite then passed
(`2005/2005`). No Analytics code or data flow is involved.

No network tracking request was made; the Analytics component is not rendered
while the flag is false.

## 5. Files

- `package.json` / `package-lock.json`
- `src/lib/vercelAnalytics.tsx`
- `src/lib/vercelAnalytics.test.tsx`
- `src/main.tsx`
- `.env.example`
- `docs/DEPLOYMENT.md`

## 6. Git / Release

- Feature branch: `feature/jm-vercel-analytics-01`
- No Main merge.
- No Production deployment.
- No RIS, AWS, Terraform or Cognito change.
- No analytics consent platform or custom event was added.

## 7. Required Follow-up Before Activation

1. Legal/privacy approval of purpose, data categories, legal basis and consent.
2. Decide whether to load Analytics only after a separate analytics consent or
   under an approved non-consent legal basis.
3. Update the public privacy policy with the confirmed processing details,
   recipients, retention and rights information.
4. Enable Vercel Web Analytics in the dashboard and set the build flag only in
   the approved environment.
5. Re-run build, smoke checks and a privacy sign-off before release.

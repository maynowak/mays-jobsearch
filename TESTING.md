# TESTING PLAYBOOK — MAYS JOB MATCHER

This is the prominent, canonical testing guide for the Jobsearch repository.
It covers unit/integration tests, the existing Chromium E2E scripts, and the
additional CDP-based checks used for the Profile Command Center.

## 1. Quick commands

```bash
npm ci

npm run build
# tsc -b && vite build

npx vitest run --maxWorkers=2
# Full frontend suite; API tests are excluded by vitest.config.ts

git diff --check
```

Focused examples:

```bash
npx vitest run src/components/ProfileCommandCenter.test.tsx \
  src/components/DashboardV2.test.tsx --maxWorkers=2

npm run test:e2e:profile-ux-final
npm run test:e2e:profile-storage-consent
```

Existing E2E scripts use synthetic browser sessions and mocked `/api/**`
responses. They do not require a real RIS/AWS/Cognito login.

## 2. Chromium / Playwright CDP workflow

The Profile Command Center was additionally checked against a running
Chromium instance through the Chrome DevTools Protocol (CDP).

### Start Chromium

```bash
google-chrome \
  --user-data-dir=/tmp/opencode/mays-live-e2e-profile \
  --remote-debugging-port=9223 \
  --no-first-run \
  --no-default-browser-check \
  https://www.mays-job-matcher.app/
```

### Connect Playwright

```js
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = browser.contexts()[0];
const page = context.pages().find((p) =>
  p.url().includes('mays-job-matcher.app')
);
```

### Important: authenticated tabs

`sessionStorage` is **per browser tab**. Opening a new Playwright page does
not inherit an authenticated OIDC session from another tab.

For production-authenticated checks:

1. Use the already-authenticated existing tab in the browser context.
2. Navigate that same tab with `page.goto(...)`.
3. Do not copy production tokens into a new tab or a test script.
4. Do not use a synthetic token against production.

This is the correct pattern for all six profile routes:

```js
const tabs = [
  'overview',
  'profile',
  'cv',
  'applications',
  'preferences',
  'settings',
];

for (const tab of tabs) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      `https://www.mays-job-matcher.app/profil?tab=${tab}`,
      { waitUntil: 'networkidle', timeout: 90000 }
    );
    await page.waitForTimeout(500);
    // assertions: dashboard title, active nav, header/nav geometry,
    // mobile/desktop navigation, overflow, console errors.
  }
}
```

The production six-tab check used exactly this pattern.

## 3. Production assertion set

For each viewport and tab, assert:

```js
const result = await page.evaluate(() => {
  const nav = document.querySelector('.navbar');
  const header = document.querySelector('.dashboard-v2__header');
  const main = document.querySelector('main');
  const rect = (el) => el
    ? { top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }
    : null;

  return {
    dashboard: Boolean(document.querySelector('#dashboard-v2-title')),
    shell: main?.className ?? null,
    nav: rect(nav),
    header: rect(header),
    active: document.querySelector(
      '.aurora-sidebar-active [aria-current="page"]'
    )?.textContent?.trim() ?? null,
    mobileSwitcher: getComputedStyle(
      document.querySelector('.dashboard-v2__mobile-nav')
    ).display,
    sidebar: getComputedStyle(
      document.querySelector('.dashboard-v2__navigation-card')
    ).display,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    background: getComputedStyle(main).backgroundImage
      .includes('job-matcher-next-step-searchpage'),
  };
});
```

Expected values:

- `dashboard === true`
- `shell` contains `layout-profile-command`
- Header top is below the 61 px navbar:
  - 1440 px: about 93 px
  - 390 px: about 77 px
- Desktop: sidebar visible, mobile switcher hidden.
- Mobile: sidebar hidden, mobile switcher visible.
- Active `aria-current="page"` matches the selected tab.
- `overflow === 0`.
- No console/page errors and no failed requests.
- Background contains `job-matcher-next-step-searchpage`.

## 4. Screenshot privacy rule

Never commit an authenticated screenshot with real email, subject, CV,
application or search-profile data.

Before a screenshot, inject a privacy mask **only for the screenshot**:

```js
await page.addStyleTag({
  content: `
    .dashboard-v2__details dd,
    .cv-storage-card,
    .profile-card,
    .application-card,
    .profile-manager__section,
    .dashboard-v2__manual-item,
    .profile-card-list,
    .cv-document-list__list {
      visibility: hidden !important;
    }
  `,
});
```

Prefer local demo/synthetic screenshots for visual evidence. If a masked
production screenshot is not reliable, do not commit it; report the structural
assertions instead.

## 5. Responsive matrix

Minimum required:

| Width | Layout |
|---:|---|
| 320 px | small phone |
| 390 px | phone |
| 768 px | tablet (desktop sidebar starts) |
| 1024 px | small desktop |
| 1440 px | desktop |

Test each in German and English. The profile visual matrix used 30 synthetic
views and `docs/evidence/jm-profile-ux-01/` for evidence.

## 6. Preview-specific authentication rule

The Vercel preview host does not automatically share the production Cognito
callback. For `JM-PROFILE-UX-02`, the preview login redirected to:

```text
auth.mays-job-matcher.app/login
redirect_uri=https://www.mays-job-matcher.app/auth/callback
```

Therefore the preview host receives no auth callback. Do not copy production
tokens and do not bypass auth. Mark authenticated preview testing as
`AUTHENTICATED PREVIEW VERIFICATION BLOCKED` unless a separately approved
preview callback/test identity exists.

## 7. Local E2E port pitfall

`tests/e2e/profile-ux-final-polish.mjs` uses a fixed port (`5214`). If an old
Vite server from another worktree already owns that port, the test can run
against the wrong checkout and show misleading UI.

Check first:

```bash
lsof -nP -iTCP:5214 -sTCP:LISTEN
```

If an old server belongs to a previous test session, use a free port for the
new run or stop only the server you started. Never kill an unrelated process
without checking its command line. This exact issue caused a false failure
during UX-01 and was resolved by rerunning on a free port.

## 8. Evidence paths

```text
docs/evidence/jm-profile-ux-01/   16 local synthetic visual screenshots
docs/evidence/jm-profile-ux-02/   two unauthenticated preview screenshots
docs/evidence/jm-profile-ux-03/   production public-shell screenshots
docs/reports/JM-PROFILE-UX-01-COMMAND-CENTER-REPORT.md
docs/reports/JM-PROFILE-UX-02-PREVIEW-ACCEPTANCE-REPORT.md
docs/reports/JM-PROFILE-UX-03-CONTROLLED-INTEGRATION-RELEASE-REPORT.md
```

## 9. Scope boundaries

The profile visual tests must not:

- change Cognito/OIDC/consent/CV storage logic,
- delete or mutate real RIS data,
- copy production tokens,
- deploy to Production,
- claim a passing authenticated test without a working authorized session.

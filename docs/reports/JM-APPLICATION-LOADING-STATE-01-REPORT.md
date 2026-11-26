# JM-APPLICATION-LOADING-STATE-01 — Applications loading, retry and pagination

- Date: 2026-11-26
- Branch: `feature/jm-application-loading-state-01`
- Base: `origin/main` `c63911f`
- Scope: Jobsearch frontend only (`ApplicationsSection`, i18n, styles, focused tests)
- Status: **IMPLEMENTED / VERIFIED LOCAL — NO MAIN MERGE/DEPLOY**

## Problem

`ApplicationsSection` used a single boolean `loading` plus the shared action-error
state for the initial list request:

- a failed list request stopped loading but left an empty list, so the UI fell
  through to “Noch keine Bewerbungen”;
- there was no retry action;
- only the first page was used although repositories return `nextCursor`;
- the repository/refresh effect could race and a stale response could still
  commit items.

## Implementation

### Explicit load state

- `ApplicationLoadState = "loading" | "ready" | "empty" | "error"`.
- Initial state is `loading`.
- `ready` is set only after a successful non-empty first page.
- `empty` is set only after a successful empty first page (a mutation that removes
  the last item also renders the empty state, because no load is pending and the
  last successful operation produced zero items).
- `error` is set only by a failed first-page request; the empty state is not
  rendered while `loading` or `error`.
- The load error is kept in its own `loadError` state and no longer reuses the
  action-error channel.

### Retry and latest-request-wins

- A retry button (`Erneut versuchen` / `Retry`) increments a reload token; the
  load effect then aborts the previous first-page controller, resets the cursor
  and reloads page one.
- Every first-page request gets a monotonically increasing request id. A response
  commits only if it is still the latest request, the repository identity is
  unchanged, the component is mounted and the controller was not aborted.
- A successful retry clears `loadError`; no stale error remains.

### Pagination

- `nextCursor` from the first page enables a guarded “Weitere Bewerbungen laden”
  button.
- Page requests are appended by `localId`; duplicates returned by the server (or
  by an overlapping page) are filtered out.
- A separate `loadingMore` state renders the in-progress label and disables the
  button; a synchronous ref guard rejects a second concurrent page request.
- Page generation is captured before the request. A first-page reload aborts and
  invalidates any in-flight page request, so only the latest request may commit.
- If a page request fails, already-loaded items stay visible and the inline error
  plus “Weitere Bewerbungen erneut laden” retries the same cursor. On success the
  new page is appended without duplicates.

### Existing behaviour preserved

- Filtering, sorting, cockpit metrics, action-needed groups, selection, edit/CV
  reference logic and the manual-draft reload path are unchanged in behaviour.
- The manual-draft path now commits its reload with cursor + load-state through
  the same helper.
- New i18n keys are present in both DE and EN:
  `applications.loadError`, `applications.retry`, `applications.loadMore`,
  `applications.loadingMore`, `applications.loadMoreRetry`.

## Request-count evidence

Focused tests use a fake `ApplicationRepository.list` spy. Observed call counts:

| Test | Calls | Evidence |
| --- | --- | --- |
| Initial loading, then empty | 1 | loading shown before resolve; empty only after resolve |
| Error then retry | 2 | 1 failing + 1 retry; stale error removed |
| Stale request after `refreshToken` change | 2 | 1 stale + 1 current; stale response ignored |
| Load more with overlapping item | 2 | 1 first page + 1 page; duplicate `localId` filtered |
| Two synchronous load-more clicks | 2 | second click produces no request |
| Page failure + inline retry | 3 | first page, failed page, retried page; loaded items retained |

## Verification

- `npx vitest run src/components/ApplicationsSection.loadingStates.test.tsx`:
  **7 passed**.
- Focused applications set (`ApplicationsSection[.manual|.remote|.loadingStates]`):
  **72 passed**.
- Broader application/i18n filter (`vitest run Application src/i18n.test.tsx`):
  **285 passed / 22 files**.
- `npx tsc -b` and `npm run build`: PASS.
- `git diff --check`: PASS.
- Secret scan over the diff: only the benign local state name `reloadToken`
  matched “token”; no credentials, keys or private data.

## Limitations

- Pagination is client-driven over the repository’s cursor contract. The session
  repository defaults to 50 items, so “load more” appears only with larger lists.
  Server-side status filtering is not added; the existing client filter still
  applies to the pages loaded so far.
- Retry reloads page one and replaces the current list deterministically; it does
  not attempt to preserve a previously loaded page offset.
- Page errors reuse the existing `errorLabel` mapping; no new error taxonomy.
- Verification is component-level with a fake repository. No live RIS/browser E2E,
  no authenticated storage call, no RIS/AWS/Terraform/Cognito/consent change and
  no production deployment in this task.

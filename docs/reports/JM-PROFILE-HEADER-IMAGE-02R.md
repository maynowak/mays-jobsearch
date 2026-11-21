# JM-PROFILE-HEADER-IMAGE-02R — Original Cyan Globe Header

**Status:** `MERGED TO MAIN / PRODUCTION DEPLOYED`

**Branch:** `feature/jm-profile-header-image-02r`

**Merge commit:** `ad9646a` (PR #50)

**Base:** `origin/main` (`22d5bd9`)
**Scope:** profile header artwork only. Dual-AI background, particles, cards, navigation, navbar, CV workspace, RIS, AWS, Cognito, consent and analytics unchanged.

## 1. Original Artwork

Source used exclusively:

```text
LeuchtendesProfilheaderHG.png
2170 × 725 original
```

Prepared assets:

```text
src/assets/images/jm-profile-header-cyan-original.webp  (original ratio)
src/assets/images/jm-profile-header-cyan-globe-alpha.webp
src/assets/images/jm-profile-header-cyan-waves-wide-alpha.webp
```

The globe is a proportional circular crop with transparent edges. Only the
wave layer was widened horizontally for the right-side header extension. The
previous `jaymzart`-derived header asset was removed and is no longer used.

## 2. Composition

Desktop header:

- left 0–roughly 33%: dark text protection gradient;
- globe layer starts at **38%**, width 22%, proportional `auto 100%`;
- waves run from the globe to the right edge;
- wave layer uses horizontal extension only;
- alpha masks blend all image edges into the dark header;
- no `cover`, no `100% 100%` on the globe;
- no image animation;
- original brightness retained: image opacity **1**, no saturation/brightness
  filter, no global dimming.

The text gradient only protects the left third; the globe and wave grid remain
bright cyan on the right.

## 3. Responsive Behavior

| Width | Result |
|---|---|
| 1920 px | globe and waves bright, globe around the middle header area |
| 1440 px | globe and waves balanced, text protected |
| 768 px | globe proportionally reduced, controlled crop, cards readable |
| 390 px | globe reduced and partially secondary to text, no overflow |

## 4. Visual Acceptance

Screenshots:

```text
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-02R/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
└── profile-reduced-motion-1440.webp
```

Acceptance checks:

- globe is round, no continent stretching;
- cyan continents and grid waves are bright and not artificially darkened;
- globe starts in the middle header area, waves continue to the right edge;
- header text/status badges remain readable;
- no hard rectangular image edges;
- no horizontal page overflow;
- mobile retains a reduced motif without blocking text;
- no page/console errors.

## 5. Tests and Build

| Check | Result |
|---|---|
| Profile command-center test | **4 PASS** |
| Header browser E2E 1920/1440/768/390 | **PASS** |
| Reduced-motion E2E | **PASS** |
| Full Vitest suite | **2004 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

No production write, auth, RIS, consent, CV persistence or analytics operation
was performed.

## 6. Git and Production

- Implementation: `341b2e5`
- Docs/audit: `26ea0fa`
- PR #50 merged to `main` as `ad9646a`; branch retained.
- Automatic Vercel Production deployments:
  - `www.mays-job-matcher.app` → `dpl_447LbL3WvpKT23nByMojQ3cY7JCq` READY
  - `mays-jobsearch.vercel.app` → `dpl_em3cNcpBS9CtHLMh4uGpSJyTcuiz` READY
- Production footer SHA: `ad9646a`; `/` and `/profil` return HTTP 200.
- No manual `vercel --prod`; authenticated visual review remains account-gated.

## 7. Open Points

- The visual E2E uses the synthetic `/dev/dashboard-v2` profile shell; an
  authenticated production header check remains a separate account-gated
  verification.
- Mobile intentionally reduces the globe to protect text legibility.

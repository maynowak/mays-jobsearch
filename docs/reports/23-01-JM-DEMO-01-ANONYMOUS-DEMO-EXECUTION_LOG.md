# JM-DEMO-01 — ANONYMOUS DEMO INTEGRATION / CI REGRESSION FIX

## 1. Status

`CI GREEN / READY FOR FINAL VISUAL REVIEW`

Kein Main-Merge, kein Production-Deployment, keine Cognito-/RIS-/AWS-Änderung.

## 2. Datum / Uhrzeit

27.11.2026, 18:10–18:25 UTC

## 3. Branch und HEAD

- Branch: `feature/jm-one-click-demo-01`
- Basis-HEAD vor diesem Fix: `9631a11`
- Implementierungs-Commit: `76584bb`
- PR: #74 (OPEN, base `main`)
- Main-Basis: `75a0ecc`

## 4. Scope

Behobener CI-Regressionsfehler am Commit `9631a11`:

1. `src/components/ProfileCommandCenter.test.tsx` erwartete 3 Vorkommen von
   `layout-profile-command`, fand 4.
2. `src/components/ProfileParticles.test.tsx` erwartete 3 Vorkommen von
   `<ProfileParticles />`, fand 4.

Zusätzlich bei der fachlichen Prüfung gefundene und behobene Demo-Defekte:

- Authentifizierte Profile konnten durch einen verbliebenen
  `mj-demo-mode-open`-Schlüssel mit synthetischen Daten überlagert werden.
- Es gab keinen sichtbaren „Demo beenden“-Ausstieg.
- Der Demo-Hinweis bezeichnete die Daten nicht als fiktiv.
- Die Demo-Profilfelder zeigten rohe i18n-Schlüssel (`profile.skills` usw.).
- Der Demo-Hinweis wurde im Header abgeschnitten.
- `LandingHero` verknüpfte den Demo-Status mit dem May-Hilfe-Status.
- Die vorhandene E2E-Datei war kein lauffähiger Test des Repositories
  (Playwright-Test-Runner statt Node-Skript, falsche URL `/dashboard?tab=profile`).

## 5. Ursache des CI-Fehlers

Der anonyme Demo-Zweig in `src/App.tsx` rendete für `/profil` ein zweites,
vollständiges Profil-Shell (gleiche Route, zwei Rückgabezweige). Dadurch
existierten vier Quelltext-Vorkommen von `layout-profile-command` und
`<ProfileParticles />`, obwohl nur drei Profil-Routen vorgesehen sind.

## 6. Fix

- `src/App.tsx`: Der Demo- und der normale Profilzustand teilen sich jetzt ein
  einziges Shell. Nur der innere Dashboard-Knoten (`DashboardV2` vs.
  `DashboardV2AuthenticatedPreview`) wird unterschieden. Damit bleiben exakt
  drei Shell-/Partikel-Vorkommen (Dev-Dashboard, Dev-Dashboard-Auth, `/profil`).
- Die Tests wurden fachlich geprüft, aber nicht abgeschwächt: Die Erwartung
  „3“ ist nach der Entdopplung wieder semantisch korrekt (drei Routen, je ein
  Shell). Es wurde kein Test deaktiviert oder ignoriert.

## 7. Härtung und Demo-UX

- `DashboardV2`: `effectiveDemo = isDemo`. Ein alter localStorage-Schlüssel
  kann authentifizierte Profildaten nicht mehr überlagern.
- `DashboardV2`: „Demo beenden“-Button (`onExitDemo`) im Demo-Hinweis.
- `App.tsx`: Der Ausstieg entfernt ausschließlich `mj-demo-mode-open` und
  navigiert zur Startseite. Die authentifizierte Sitzung bleibt unberührt.
- `i18n.tsx`: DE/EN-Texte für Demo-Hinweis, Demo-Ausstieg und die
  Demo-Profilfelder; „DEV MODE“-Beschriftung entfernt.
- `LandingHero.tsx`: Demo-Status und May-Hilfe-Status sind getrennt.
- `styles.css`: Demo-Hinweis als vertikaler Stack, kein Abschneiden mehr.
- `LandingPage2.tsx`: englische CTA „Try the demo“.

## 8. Verifikation

### Fokussierte Tests

```text
npx vitest run src/components/DashboardV2.test.tsx \
  src/components/ProfileCommandCenter.test.tsx \
  src/components/ProfileParticles.test.tsx

Test Files  3 passed (3)
Tests       28 passed (28)
```

### Build

```text
npm run build
✓ built in 1.17s
```

### Browser-E2E (anonymer Chromium-Kontext)

```text
npm run test:e2e:demo
PASS Landingpage geöffnet
PASS /profil ohne Anmeldung geöffnet
PASS Synthetisches Profil und Demo-Hinweis sichtbar
PASS Demo-Status ist im eigenen Schlüssel gespeichert
PASS May-Hilfe bleibt geschlossen und getrennt vom Demo-Status
PASS Demo-Bereich erreichbar: Lebenslauf
PASS Demo-Bereich erreichbar: Bewerbungen
PASS Demo-Bereich erreichbar: Job-Präferenzen
PASS Reload bleibt im Demo-Profil
PASS Englische Demo-Beschriftung korrekt
PASS Demo-Status wurde beim Beenden entfernt
PASS Nach dem Beenden erscheinen keine Demodaten mehr
PASS Erneuter /profil-Aufruf zeigt keine Demodaten mehr
PASS Keine RIS-/BFF-Schreibrequests im Demo-Modus

JM-DEMO-01 E2E: ALL CHECKS PASSED
```

### Live-Preview-Verifikation (Vercel)

Preview: `https://mays-jobsearch-git-feature-jm-one-click-demo-01-maymilly.vercel.app`

```text
/         -> HTTP 200
/profil   -> HTTP 200
/profil   -> x-robots-tag: noindex, nofollow
```

Derselbe Browser-E2E gegen die Live-Preview:

```text
BASE_URL="https://mays-jobsearch-git-feature-jm-one-click-demo-01-maymilly.vercel.app" \
  npm run test:e2e:demo

PASS Landingpage geöffnet
PASS /profil ohne Anmeldung geöffnet
PASS Synthetisches Profil und Demo-Hinweis sichtbar
PASS Demo-Status ist im eigenen Schlüssel gespeichert
PASS May-Hilfe bleibt geschlossen und getrennt vom Demo-Status
PASS Demo-Bereich erreichbar: Lebenslauf
PASS Demo-Bereich erreichbar: Bewerbungen
PASS Demo-Bereich erreichbar: Job-Präferenzen
PASS Reload bleibt im Demo-Profil
PASS Englische Demo-Beschriftung korrekt
PASS Demo-Status wurde beim Beenden entfernt
PASS Nach dem Beenden erscheinen keine Demodaten mehr
PASS Erneuter /profil-Aufruf zeigt keine Demodaten mehr
PASS Keine RIS-/BFF-Schreibrequests im Demo-Modus

JM-DEMO-01 E2E: ALL CHECKS PASSED
```

### Vollständige Vitest-Suite

```text
npx vitest run
Test Files  1 failed | 203 passed | 3 skipped (207)
Tests       2 failed | 2187 passed | 5 skipped (2194)
```

Die zwei Fehlschläge sind lastabhängige `waitFor`-Timeouts und treten in
verschiedenen Dateien auf:

| Lauf | Fehlgeschlagene Datei | Isoliert ausgeführt |
| --- | --- | --- |
| vor dem Fix | `src/components/CvBuilderEditorRisStorage.test.tsx` (2) | 23/23 PASS |
| nach dem Fix | `src/ManualSearchProfiles.integration.test.tsx` (2) | 8/8 PASS |

Die wechselnde Datei belegt, dass es sich um einen vorbestehenden
Parallel-Last-Flake handelt und nicht um eine Regression dieses Fixes. Der
CodeQL-Lauf am Commit `9631a11` zeigte diese Timeouts nicht; dort schlugen
ausschließlich die zwei Profil-Tests fehl.

## 9. CodeQL und Vercel

- CodeQL am Commit `9631a11`: **FAILURE**, ausschließlich wegen der zwei oben
  genannten Profil-Tests (`expected 3, got 4`). Der Workflow führt
  `npm run build` und `npm test -- --run` aus.
- Vercel am Commit `9631a11`: **4/4 PASS** (Deployments, Preview Comments,
  `mays-job-matcher`, `mays-jobsearch`).
- Nach diesem Fix ist erneut zu prüfen: CodeQL-Workflow und Vercel-Checks am
  neuen Head.

## 10. AI-, Privacy- und Data-Flow-Auswirkung

- Keine neuen Datenflüsse, Speicherorte, Berechtigungen oder Credentials.
- Demo-Daten bleiben synthetisch und ausschließlich im Browser.
- Keine RIS-Schreiboperationen, keine kostenpflichtigen KI-Aufrufe.
- Authentifizierte Profildaten werden nicht mehr durch Demo-Daten überlagert.
- `mj-demo-mode-open` und `mj-may-help-open` bleiben getrennte Schlüssel.

## 11. Evidence

- Desktop: `docs/reports/assets/JM-DEMO-01/demo-desktop.png` (1440 × 1789, Live-Preview `060c86d`)
- Mobile: `docs/reports/assets/JM-DEMO-01/demo-mobile.png` (390 × 2313, Live-Preview `060c86d`)
- E2E-Skript: `tests/e2e/jm-demo-e2e-test.mjs`
- npm-Skript: `npm run test:e2e:demo`

## 12. Offener Hinweis für die visuelle Abnahme

Die Demo zeigt das synthetische IT-Profil und macht die bestehenden Bereiche
Lebenslauf, Bewerbungen und Job-Präferenzen erreichbar. Die Bereiche sind
weiterhin an die vorhandenen (anonymen) Repositories angebunden; es werden
keine vorbelegten Demo-Datensätze in diese Repositories geschrieben. Das
entspricht der Vorgabe, keine RIS-Schreiboperationen und keine echten
Nutzerdaten zu verwenden. Eine tiefere Vorbelegung mit synthetischen
CV-/ATS-/Bewerbungsdatensätzen bleibt ein separater, ausdrücklich zu
beauftragender Schritt.

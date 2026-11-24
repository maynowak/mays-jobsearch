# JM-CV-UPLOAD-PRIVACY-INFO-05

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `feature/jm-cv-upload-privacy-info-05`

**Implementation commit:** `afdb6b0`

**Base:** `origin/main` `91f92a4` (autohydration PR #57 merged)

## 1. Ziel

Der lange Datenschutzhinweis im CV-Upload-Bereich der Suchseite wird
standardmäßig geschlossen hinter einem kompakten, barrierearmen
Informationselement angezeigt. Der vollständige Text bleibt in beiden
Sprachen unverändert.

## 2. Umsetzung

`src/components/CvUpload.tsx` ersetzt die bisherige offene Zeile

```tsx
<p className="cv-privacy">{t("cv.privacyNote")}</p>
```

durch ein natives Disclosure:

- `<details>` / `<summary>` ohne Hover-Abhängigkeit;
- geschlossen beim ersten Rendern;
- Klick, Enter und Space öffnen/schließen über das native Element;
- Screenreader erhalten den vollständigen Summary-Namen und den
  Expanded/Collapsed-Zustand;
- Icon und Chevron sind `aria-hidden`;
- Summary-Ziel ist mindestens 44 px hoch;
- der vollständige `cv.privacyNote`-Text bleibt unverändert.

Neue i18n-Titel:

- DE: `Datenschutz & KI-Verarbeitung`
- EN: `Privacy & AI processing`

Das Glass-Design liegt im normalen Dokumentfluss vor dem Uploadfeld. Es gibt
keine absolute Positionierung, kein Overlay und keine Überdeckung des
Dropzones.

## 3. Komponententest

`src/components/CvUpload.test.tsx` prüft:

- geschlossener Ausgangszustand;
- vollständiger unveränderter deutscher Datenschutztext im DOM;
- Klick öffnet und schließt das native `<details>`;
- englischer Titel und unveränderter englischer Text;
- Fokus auf dem nativen Summary für Tastaturbedienung.

## 4. Visuelle Kontrolle

Chromium-E2E `tests/e2e/cv-upload-privacy-info-05.mjs`:

| Breite | Summary-Höhe | Overflow | Überdeckung | Enter öffnet |
|---|---:|---:|---|---|
| 1440 px | 44 px | 0 | nein | PASS |
| 390 px | 44 px | 0 | nein | PASS |

Geprüft wurden geschlossener und geöffneter Zustand, vollständiger Text,
Konsolenfehler und die Position des Hinweises oberhalb des Uploadfeldes.
Screenshots lagen lokal unter `/tmp/opencode/cv-upload-privacy-info-05/` und
wurden visuell geprüft; keine personenbezogenen Daten.

## 5. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| CvUpload-Komponententests | **3 PASS** |
| Fokussierte App/CvUpload-Tests | **103 PASS** |
| Volle Vitest-Suite, seriell | **2032 PASS / 11 skipped** |
| Production build (`tsc -b && vite build`) | PASS |
| Visuelles E2E 1440/390 | PASS |
| `git diff --check` | PASS |
| Secret-Scan | PASS |

## 6. Grenzen

- Keine Änderung an Datenschutztexten, Consent-Logik, CV-Verarbeitung,
  RIS-/AWS-Schnittstellen, Cognito, ATS-Profilen oder Login-Hydration.
- Keine UX-08A- oder ATS-Speicherfix-Änderung.
- Kein Main-Merge und kein Production-Deployment.
- Keine echten CV-/Bewerberdaten und keine externen Schreiboperationen.

`READY FOR VISUAL REVIEW`

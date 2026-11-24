# JM-PROFILE-CV-STUDIO-SPOTLIGHT-12

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `feature/jm-profile-cv-studio-spotlight-12`

**Implementation commit:** `7f03a8f`

**Design basis:** `feature/jm-profile-visual-11` / `ed5c461`

## 1. Ziel

Der Bereich „Meine Lebensläufe“ unter Profil → Lebenslauf wurde als
hervorgehobene Premium-CV-Studio-Karte gestaltet, abgestimmt auf den
Silver-Metallic-Header und die Cyan-Glow-Karten aus Visual-11.

Layout, Kartenpositionen, CV-Daten, Bearbeitungsfunktionen und der darunter
liegende Bereich „Dauerhaft gespeicherte Lebensläufe“ bleiben unverändert.

## 2. Umsetzung

`src/components/CvBuilderProfileList.tsx`:

- Silber-Cyan-Glass-Fläche mit 2px Cyan-Rahmen, sanftem Glow,
  Metallreflex und 3D-Glass-Kanten;
- Studio-Kennzeichnung **“✦ CV STUDIO”**;
- modernes Dokument-Icon oben rechts;
- Überschrift „Meine Lebensläufe“ und bestehender Erklärungstext bleiben;
- sichtbare Kennzeichnung **“Nur für diese Sitzung”** im Kopf und im
  Empty State;
- bestehender `onCreate`-Handler unverändert;
- Premium-CTA **“✦ Neuen Lebenslauf gestalten →”**;
- „Bestehenden Entwurf übernehmen“ bleibt als sekundäre Aktion erhalten;
- Empty State mit Dokument-Symbol, freundlichem Hinweis und ruhiger,
  nicht gestrichelter Glasfläche;
- bestehende Listen-, Edit-, Duplicate-, Rename-, Download- und
  Delete-Aktionen bleiben unverändert.

Neue i18n-Texte:

- `cvBuilder.profiles.studioBadge`: „CV Studio“
- `cvBuilder.profiles.sessionOnly`: „Nur für diese Sitzung“
- `cvBuilder.profiles.createCta`: „Neuen Lebenslauf gestalten“
- `cvBuilder.profiles.emptyTitle`: „Dein erster Entwurf wartet“

Die Styles sind ausschließlich unter
`.layout-profile-command .cv-builder-profiles` ergänzt. Keine globalen
Suchseiten- oder Standardkarten ändern sich. Reduced Motion deaktiviert die
neuen Übergänge.

## 3. Visuelle Prüfung

Chromium-E2E `tests/e2e/jm-profile-cv-studio-spotlight-12.mjs` mit dem
synthetischen Demo-Profil:

| Breite | Empty State | Filled State | Overflow |
|---|---|---|---|
| 1920 px | PASS | – | 0 |
| 1440 px | PASS | PASS | 0 |
| 768 px | PASS | – | 0 |
| 390 px | PASS | PASS | 0 |

Geprüft:

- 2px Cyan-Rahmen und Cyanglow der Studio-Karte;
- CTA-Mindesthöhe ≥ 48px und Gradient;
- Studio-Badge, Session-Kennzeichnung und Dokument-Icon;
- Empty State ohne gestrichelten Standardrahmen;
- befüllte Liste mit vorhandenen Aktionen;
- keine horizontalen Überläufe, keine überdeckten Aktionen;
- Tastatur-Fokuszustände bleiben über die bestehenden Controls erhalten.

Evidenz (committed):

```text
docs/reports/assets/JM-PROFILE-CV-STUDIO-SPOTLIGHT-12/
├── studio-empty-1920.webp
├── studio-empty-1440.webp
├── studio-empty-768.webp
├── studio-empty-390.webp
├── studio-filled-1440.webp
└── studio-filled-390.webp
```

## 4. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| CvBuilderProfileList-Tests | **4/4 PASS** |
| Volle Vitest-Suite, seriell | **2030 PASS / 11 skipped** |
| Production build | PASS |
| Visuelles E2E Empty/Filled | PASS |
| `git diff --check` | PASS |
| Secret-Scan | PASS |

## 5. Grenzen

- Keine Änderung an CV-Parsing, PDF-Export, RIS, ATS, Consent oder Storage.
- Keine Änderung an „Dauerhaft gespeicherte Lebensläufe“.
- Keine Änderung an Layout, Kartenpositionen oder bestehenden Aktionen.
- Keine RIS-/AWS-/Cognito-/Consent-Änderung.
- Kein Main-Merge und kein Production-Deployment.

`READY FOR VISUAL REVIEW`

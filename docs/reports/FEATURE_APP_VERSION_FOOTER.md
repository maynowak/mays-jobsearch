# Feature: App Version Footer

Branch:
feature/app-version-footer

Base:
main

Aktueller Step:
Step 2

Aktueller Status:
COMPLETE

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Bestandsanalyse | COMPLETE | 99c2fac |
| 2 | Versionstrategie | COMPLETE | — |
| 3 | Implementierung | PENDING | — |
| 4 | Tests | PENDING | — |
| 5 | Development Live Test | PENDING | — |
| 6 | Preview / Abnahme | PENDING | — |
| 7 | Merge-Vorbereitung | PENDING | — |
| 8 | Merge nach main | PENDING | — |
| 9 | Production | PENDING | — |
| 10 | Feature-Branch schließen | PENDING | — |

## Recovery-Regel

Bei Wiederaufnahme zuerst diese Datei lesen.

Nicht anhand einer vorherigen Console-Ausgabe raten.

Der letzte COMMITTED Checkpoint ist maßgeblich.

Nur mit dem nächsten PENDING Step fortfahren.

Bei BLOCKED oder FAILED:
- Ursache dokumentieren
- Status setzen
- Report committen
- pushen
- STOPP

Nach jedem abgeschlossenen Step:
1. Feature-Report aktualisieren
2. Tests prüfen
3. git status
4. git diff --check
5. Secret Audit
6. Commit
7. Push
8. erst danach nächsten Step beginnen

## Step 1 — Bestandsanalyse

Status: COMPLETE

Commit: 99c2fac

Kurzfassung der bereits durchgeführten Analyse:
- bestehendes Footer-Markup in src/App.tsx
- package.json Version 2.0.0
- Vercel System-Env verfügbar
- lokaler Dev-Fallback erforderlich
- CSS .footer vorhanden
- i18n de/en vorhanden
- noch kein Footer-Test

## Step 2 — Versionstrategie

Status: COMPLETE

Commit: —

### 1. VERSIONQUELLE

- **Single Source of Truth: `package.json` → `version` = `2.0.0`**
- Keine zweite manuell gepflegte Versionsnummer. Keine Version hartcodiert in React-Komponenten.
- Technik: `package.json` wird zur Build-Zeit über `vite.config.ts` eingelesen (Node-Umgebung, `fs`/JSON-Import) und als `define`-Konstante in den Client-Build injiziert (z. B. `__APP_VERSION__`).
- Kein `resolveJsonModule`-Zwang im `tsconfig.app.json`: der JSON-Import passiert nur in `vite.config.ts` (Node-Seite, `tsconfig.node.json` deckt das ab).
- Frontend liest die Version ausschließlich über die injizierte Konstante.

### 2. VERCEL/GIT-METADATEN

- Verwendbar und sinnvoll:
  - `VERCEL_GIT_COMMIT_SHA` → kurze Commit-Referenz (erste 7 Zeichen)
  - `VERCEL_GIT_COMMIT_REF` → Branch-Name (z. B. `main` / `feature/app-version-footer`)
  - `VERCEL_ENV` → `production` | `preview` | `development`
- Verfügbarkeit: Vercel-Project hat `autoExposeSystemEnvs: true` (im Projekt-JSON bestätigt) → diese Variablen sind in Vercel-Deployments zuverlässig im Build-Prozess verfügbar.
- Sicherheit: Commit-SHA und Branch-Ref sind keine geheimen Informationen → dürfen in den Client. Keine Secrets/API-Keys/Tokens werden injiziert.
- Diese Werte werden ebenfalls zur Build-Zeit über `define` in den Client-Build injiziert (Vercel setzt sie als `process.env` im Build-Kontext).

### 3. DEVELOPMENT / LOCAL FALLBACK

- `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_ENV` sind lokal / unter `vercel dev` **nicht zuverlässig** vorhanden.
- **Fallback-Strategie** (Build-Zeit in `vite.config.ts`):
  - Commit-SHA: `process.env.VERCEL_GIT_COMMIT_SHA` → sonst lokales Git (`git rev-parse --short HEAD`) → sonst `"dev"`
  - Branch: `process.env.VERCEL_GIT_COMMIT_REF` → sonst lokales Git (`git rev-parse --abbrev-ref HEAD`) → sonst `"dev"`
  - Environment: `process.env.VERCEL_ENV` → sonst `"development"`
- Darstellung unter `vercel dev`: z. B. `v2.0.0 · development · <kurzer lokaler Commit>` — identifiziert eindeutig die Dev-Build-Identität. Preview/Production zeigen `VERCEL_ENV` korrekt.
- Wichtig: Development = interne Live-Testumgebung via `vercel dev`; Preview und Production sind getrennte Umgebungen und bekommen ihre jeweilige `VERCEL_ENV`-Bezeichnung.

### 4. FOOTER-INFORMATIONEN (geplant, noch NICHT implementiert)

- App-Name + Versionsnummer: immer sichtbar (aus package.json).
- Environment-Label: `development` / `preview` / `production`.
- Build-/Commit-Referenz: kurze Commit-SHA (7 Zeichen), wenn verfügbar.
- Beispiel-Zeilen:
  - Development: `May's Job Matcher · v2.0.0 · development · abc1234`
  - Preview: `May's Job Matcher · v2.0.0 · preview · abc1234`
  - Production: `May's Job Matcher · v2.0.0 · production · abc1234`
- Bewusst KEINE weiteren technischen Details (kein voller SHA, keine Zeitstempel, keine Provider-Metadaten) — nicht unnötig viel öffentlich anzeigen.

### 5. SICHERHEITSBEWERTUNG

- Injiziert werden ausschließlich: Versionsnummer, `VERCEL_ENV`-Label, kurze Commit-SHA, Branch-Ref.
- Keine Secrets, keine API-Keys, keine Tokens, keine geheimen Env-Werte.
- Commit-SHA ist öffentlich (Git-Objekt) → kein Leak.
- Kein vollständiger Secrets-Wert landet im Client-Bundle.

### 6. ARCHITEKTUR

- **Kleinste saubere Lösung gewählt**:
  - `vite.config.ts`: liest Version + Vercel/Git-Metadaten zur Build-Zeit und injiziert sie über `define` (`__APP_VERSION__`, `__APP_ENV__`, `__APP_COMMIT_SHA__`, `__APP_BRANCH__`).
  - Ein kleines Frontend-Modul `src/lib/appInfo.ts` (neu): aggregiert die Build-Konstanten in eine typisierte, testbare Schnittstelle (z. B. `{ version, env, commitSha, branch }`).
  - Footer liest ausschließlich über `appInfo` — keine direkten Env-/Git-Zugriffe in React-Komponenten.
- Keine unnötige neue Architektur; bestehende `src/lib/`-Struktur und `src/i18n.tsx` werden wiederverwendet.
- Keine Änderung an Provider-/Matching-/Cache-/Safety-Logik.

### 7. TESTSTRATEGIE (geplant)

- `appInfo.ts` ist eine pure Funktion über injizierte Konstanten → einfach unit-testbar.
- Footer-Test (`src/components/Footer.test.tsx`, neu): prüft, dass Version, Environment-Label und Commit-Referenz korrekt angezeigt werden (de + en über `LangProvider`).
- `App.test.tsx`-Erweiterung: prüft, dass der Footer weiterhin im Matcher-/Landing-Layout gerendert wird.
- Vercel-Env-Werte werden in Tests als Build-Konstanten injiziert; für deterministische Tests kann `appInfo`/Footer die Konstante als Prop akzeptieren oder Tests setzen `vi.stubEnv`.

### 8. BETROFFENE DATEIEN IN STEP 3 (voraussichtlich)

- `vite.config.ts` — Build-Konstanten via `define` (+ Fallback-Logik)
- `src/lib/appInfo.ts` — neu: aggregierte, typisierte Versions-/Build-Info
- `src/components/Footer.tsx` — neu: dedizierte Footer-Komponente (extrahiert aus `src/App.tsx`), zeigt Version/Env/Commit
- `src/App.tsx` — ersetzt Inline-`<footer>` durch `<Footer />`
- `src/i18n.tsx` — ggf. neue Keys (z. B. `footer.versionLabel`) de/en
- `src/styles.css` — ggf. geringe Erweiterung des `.footer`-Styles für die Versionszeile
- `src/vite-env.d.ts` — Typ-Deklaration für `__APP_VERSION__` etc.
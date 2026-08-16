# Development Workflow

Dieses Dokument beschreibt den **verbindlichen Ablauf** für größere und mittlere Features im
My Job Matcher Projekt. Der Ablauf ist in der Praxis verifiziert (siehe
`docs/reports/FEATURE_APP_VERSION_FOOTER.md` als vollständiges Beispiel).

---

## 1. Verbindlicher Feature-Ablauf

### 01. Aktuellen main-Stand prüfen

- `git status` — Working Tree sauber
- `git rev-parse origin/main` — aktuellen Remote-Stand kennen
- Nicht auf einem veralteten Stand beginnen.

### 02. Feature-Branch von main erstellen

```bash
git checkout main
git pull origin main
git checkout -b feature/<name>
git push -u origin feature/<name>
```

- `main` bleibt Integrations-/Release-Branch.
- Jede Feature-Arbeit läuft auf einem eigenen Branch.

### 03. Feature-spezifische Recovery-Datei anlegen

- Feature-Report unter `docs/reports/FEATURE_<NAME>.md` anlegen.
- Enthält: Ziel, Step-Matrix (Step | Thema | Status | Commit), Recovery-Regel,
  Status COMPLETE / BLOCKED / FAILED pro Step.
- Der Report ist der **maßgebliche Recovery-Checkpoint**.

### 04. Arbeit in klar definierten Steps

- Jedes Feature wird in kleine, einzeln verifizierbare Steps zerlegt.
- Beispiel-Steps: Bestandsanalyse → Strategie → Implementierung → Tests →
  Development Live Test → Preview → Abnahme → Merge-Vorbereitung → Merge →
  Production → Branch schließen.

### 05. Nach JEDEM abgeschlossenen Step

1. Feature-Report aktualisieren (Status + Ergebnisse)
2. Tests ausführen (`npm test`)
3. `git status` prüfen
4. `git diff --check`
5. Secret Audit (keine Keys/Tokens/Secrets im Diff)
6. Commit erstellen (konventionelles Format)
7. Push nach `origin/<branch>`
8. Erst dann den nächsten Step beginnen

### 06. Bei BLOCKED / FAILED

- Ursache exakt dokumentieren
- Recovery-Checkpoint im Report setzen (Status BLOCKED/FAILED)
- Report committen
- pushen
- **STOPP**
- Keine eigenständigen Workarounds außerhalb der Freigabe.
- Kein Rebase, kein Merge, kein Deployment ohne Freigabe.

### 07. Development Live Test

- Lokale Runtime (`vercel dev`) starten.
- Feature im laufenden Build verifizieren (gerenderter DOM, sichtbares Verhalten).
- Entwicklung = interne Testumgebung, NICHT gleichzusetzen mit Preview/Production.

### 08. Preview Deployment

```bash
vercel deploy          # Preview, NICHT --prod
```

- Preview ist eine separate, öffentlich erreichbare Umgebung mit eigener `VERCEL_ENV=preview`.

### 09. Preview-Abnahme

- Preview-Artefakt gegen die tatsächliche Deployment-Identität prüfen (siehe Abschnitt 3).
- Feature funktional abnehmen (DE/EN, sichtbares Verhalten, keine Console-/Netz-Fehler).
- Secret Audit des gerenderten DOM.

### 10. Merge-Vorbereitung

- Branch-/Remote-Check: HEAD, `origin/<branch>`, `main`, `origin/main`, `merge-base`.
- Scope-Prüfung: `git diff main...feature` — nur Feature-Änderungen, keine fremden Änderungen.
- Datei-/Git-Check, Tests, tsc, Build, Secret Audit.
- Deployment-Identität dokumentieren (letzter getesteter Preview-Commit vs. aktueller HEAD).
- Merge-Bereitschaft feststellen. **Merge-ready ≠ merged.**

### 11. Feature nach main mergen

- Fast-forward bevorzugen, wenn der Feature-Branch direkt auf `main` basiert.
- Kein unnötiger Merge-Commit, kein Rebase, keine History-Rewrites.

### 12. main erneut prüfen

- `git rev-parse HEAD` == `git rev-parse origin/main`
- Feature-Code vollständig enthalten
- Tests, tsc, Build, `git diff --check`, Secret Audit auf main

### 13. Production Deployment

```bash
vercel --prod          # Production, Source main
```

- Genau EIN Production-Deployment.
- Vorher dokumentieren: Git main HEAD == origin/main.

### 14. Production-Artefakt gegen Deployment-Commit verifizieren

- Deployment-Commit (Vercel-Metadaten) == Footer-Build-SHA des deployten Artefakts.
- Environment = `production`, Source = `main`, Status = Ready.
- DE/EN, Footer sichtbar, keine Console-/Netz-Fehler, Secret Audit.

### 15. Feature-Branch lokal und remote schließen

```bash
git branch -d feature/<name>
git push origin --delete feature/<name>
```

- Nur den Feature-Branch löschen, nie `main`.

### 16. Abschlussbericht

- Step-Ergebnisse, finaler main HEAD, Production Deployment ID/URL/Commit,
  Footer Build SHA, Version, Tests, Build, Secret Audit, Branch-Status.

---

## 2. Vercel Workflow

| Umgebung | Befehl | `VERCEL_ENV` | Zweck |
|---|---|---|---|
| Development | `vercel dev` | `development` | lokale Runtime, interne Tests |
| Preview | `vercel deploy` | `preview` | öffentliche Abnahme-Umgebung |
| Production | `vercel --prod` | `production` | Live-Betrieb |

**Development ≠ Preview ≠ Production.** Ein Preview-Deployment darf nie als Development
bezeichnet werden, Production nie als Preview.

Für jedes Deployment wird, wenn relevant, die **tatsächliche Build-/Deployment-Identität**
geprüft. Beispiel: Der Footer zeigt `Version 2.0.0 · production · abc1234` — Versionsnummer,
Environment-Label und kurze Commit-SHA des tatsächlich gebauten Stands.

**Keine Secrets in Build-Informationen aufnehmen.** Injiziert werden nur öffentliche Werte
(Versionsnummer, Environment-Label, kurze Commit-SHA, Branch-Name).

---

## 3. Deployment-Identität vs. Git-HEAD

Der Workflow unterscheidet ausdrücklich:

| Zustand | Bedeutung |
|---|---|
| Git HEAD | aktueller lokaler Commit |
| Deployment Commit | Commit, aus dem ein Deployment tatsächlich gebaut wurde (Vercel-Metadaten) |
| Build Identity | zur Build-Zeit eingefrorene Werte im Artefakt (Version/Env/SHA) |
| Production-Stand | aktuell auf der Live-URL laufendes Artefakt |

**Regel:**

- Es darf NICHT angenommen werden, dass der Git HEAD automatisch dem deployten Zustand entspricht.
- Der zuletzt getestete Deployment-Stand kann älter sein als der aktuelle Git HEAD (z. B. nach
  Report-/Doku-Commits, die kein neues Deployment ausgelöst haben).
- Ein Deployment wird immer über seine **tatsächliche Deployment-Identität** geprüft:
  Deployment Commit (Vercel-API) == Build Identity im Artefakt.
- Der Footer zeigt genau diese eingefrorene Identität und wechselt nicht, wenn Git danach
  weiterverändert wird.

---

## 4. Recovery nach IDE-/VS-/Agent-Absturz

Bei Absturz von Visual Studio / VS Code / Agent / Terminal:

1. Repository-Zustand prüfen (`git status`).
2. Aktuellen Branch feststellen (`git branch --show-current`).
3. Letzten gepushten Commit feststellen (`git rev-parse HEAD`, `git rev-parse origin/<branch>`).
4. Feature-Report / Recovery-Datei lesen (`docs/reports/FEATURE_*.md`).
5. Letzten Status COMPLETE / BLOCKED feststellen.
6. **NICHT** aus alten Chat-/Terminal-Ausgaben rekonstruieren, wenn eine Recovery-Datei existiert.
7. Bei COMPLETE: mit dem nächsten freigegebenen Step fortfahren.
8. Bei BLOCKED: Blocker zuerst klären; keine automatische Fortsetzung.
9. Working Tree prüfen (keine halbfertigen/unerwarteten Änderungen).
10. Vor Fortsetzung Tests/Build nur entsprechend dem letzten dokumentierten Checkpoint
    ausführen.

**Die Recovery-Datei ist die maßgebliche Arbeitsgrundlage nach einem Absturz.**
Nur ein gepusster COMPLETE-Checkpoint gilt als sicher abgeschlossen.
# Contributing

Code Style.

- Vanilla JavaScript.
- No new dependencies without approval.
- Friendly error messages with `{ error, code }`.

Commit Messages.

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`, `chore:`.

Ordnerstruktur.

- Frontend: `index.html`, `styles.css`, `app.js`.
- Backend: `api/**/*.mjs`.
- Shared helpers: `api/_lib/`.

Regeln.

- Keys nur über `process.env`, nie im Frontend.
- Nach Änderungen: `node --check <file>`.
- Fehler immer freundlich ausgeben.
- Dokumentation in `docs/` pflegen.

## Git Lifecycle

Der verbindliche Ablauf für Features:

```
main
  ↓
feature/<name>
  ↓
Development
  ↓
Preview
  ↓
Abnahme
  ↓
Merge nach main
  ↓
Production
  ↓
Feature-Branch schließen
```

Details und alle Checkpoints: `docs/DEVELOPMENT_WORKFLOW.md`.

### Branch-Erstellung

```bash
git checkout main
git pull origin main
git checkout -b feature/<name>
git push -u origin feature/<name>
```

- `main` ist Integrations-/Release-Branch; Feature-Arbeit läuft auf `feature/<name>`.

### Merge

- **Fast-forward bevorzugen**, wenn der Feature-Branch direkt auf dem aktuellen `main` basiert
  und keine konkurrierenden main-Änderungen existieren (`git merge --ff-only`).
- Kein unnötiger Merge-Commit, kein Rebase, keine History-Rewrites.

### Push

- Nach jedem abgeschlossenen Step: Report aktualisieren → Tests → `git status` →
  `git diff --check` → Secret Audit → Commit → Push.

### Branch-Cleanup

Nach erfolgreichem Production-Deployment:

```bash
git branch -d feature/<name>
git push origin --delete feature/<name>
```

- Nur den Feature-Branch löschen, niemals `main`.

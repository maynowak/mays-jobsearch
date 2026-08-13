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

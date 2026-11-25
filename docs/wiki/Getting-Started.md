# Getting Started

## Production nutzen

1. Öffne https://www.mays-job-matcher.app/.
2. Starte eine Suche oder melde dich für Konto-, Bewerbungs- und RIS-Funktionen an.
3. Nach der Anmeldung stehen sechs Profilbereiche zur Verfügung: Übersicht,
   Mein Profil, Lebenslauf, Bewerbungen, Job-Präferenzen, Einstellungen.

## Lokal starten

```bash
git clone git@github.com:maynowak/mays-jobsearch.git
cd mays-jobsearch
npm install
npm run dev
```

Vite läuft unter `http://localhost:5173`. Für die vollständige Runtime mit
Serverless Functions:

```bash
npm i -g vercel
vercel login
vercel dev
```

`vercel dev` läuft unter `http://localhost:3000`.

## Erste Schritte

1. Stelle eine Suche zusammen (Fähigkeiten, Zielrolle, Ort).
2. Prüfe die Treffer und die KI-Begründung an der Originalanzeige.
3. Lege bei Bedarf eine Bewerbung an.
4. Importiere optional einen Lebenslauf im CV-Workspace.

Weiter: [User Guide](User-Guide) · [Development](Development) ·
[Deployment](Deployment)

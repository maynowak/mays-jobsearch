# Architecture

## Schichten

```text
React/TypeScript (src/)
   │ same-origin fetch
   ▼
Vercel Functions (api/*.mjs)
   ├── AI/Provider-Router (OpenRouter, EdenAI)
   ├── Jobquellen (Arbeitnow, Apify/Arbeitsagentur)
   ├── Redis (Caches, Guards, Alerts)
   ├── ATS/CV-Analyse
   └── RIS-BFF (/api/ris/*)
          │ server-only Partner-Credential
          ▼
       Externes RIS
```

## Frontend

- `App.tsx` — Routing und zentrale Zustände.
- `DashboardV2` — Profil-Shell mit sechs Bereichen.
- `ApplicationsSection` — Bewerbungen, Edit-Dialog, eigenes Anschreiben.
- CV-Workspace — Importvorschau, Editor, Live-Vorschau.
- `RadarNavigator` — gemeinsamer Navigationskern für Match-, Import- und
  Editor-Radar; `CvBuilderScrollHands` für Turbo-Scrollen.
- i18n — DE/EN-Texte zentral in `src/i18n.tsx`.

## BFF und RIS

Der Browser spricht nur mit `api/*`. RIS-Zugriffe laufen über
`api/ris/router.mjs` und die Handler unter `api/_lib/ris/`. Partner-Credential
und Test-Allowlist bleiben serverseitig. Session- und Remote-Repositories
teilen denselben Anwendungsvertrag; die Remote-Capability wird über die BFF
geprüft.

## Zwei-Repository-Grenze

- **`maynowak/mays-jobsearch`** (dieses Repository): Frontend, Vercel-BFF,
  Jobquellen, Matching, CV-Workspace und BFF-Adapter.
- **`maynowak/Mays-Recruiting-Intelligence-System`** (RIS): separat betriebener
  Dienst mit eigenem Code, API, Datenmodell, Consent-/Löschpfaden, AWS und
  Deployments.

Dieses Repository enthält keinen RIS-Code und greift nicht direkt auf
RIS-Datenbanken, AWS, Cognito oder RIS-Deployments zu. Der einzige RIS-Egress
ist die serverseitige BFF. RIS-bezogene Tests/Berichte hier belegen nur die
Jobsearch-Seite; RIS-Interna gehören ins RIS-Repository und benötigen ein
eigenes Mandat.

## Persistenz und Einwilligungen

Anwendungen, CVs und Suchprofile haben getrennte Consent-Zwecke. DRAFT-Notices
werden nicht aktiviert; fehlende Einwilligungen halten Schreibpfade
geschlossen. Details im Repository.

Kanonisch: [Architektur](https://github.com/maynowak/mays-jobsearch/blob/main/docs/ARCHITECTURE.md) ·
[API-Vertrag](https://github.com/maynowak/mays-jobsearch/blob/main/docs/API_CONTRACT.md) ·
[Security & Privacy](Security-and-Privacy)

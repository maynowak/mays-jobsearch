# API Integrations

## Öffentliche BFF-Endpunkte (Auswahl)

| Bereich | Endpunkt |
| --- | --- |
| Jobs | `GET /api/jobs` |
| Matching | `POST /api/match` |
| Profil extrahieren | `POST /api/profile` |
| Anschreiben | `POST /api/cover-letter` |
| Modelle | `GET /api/models` |
| ATS/Analyse | `POST /api/ats-analysis` |
| CV-Verbesserung | `POST /api/cv-improvement` |
| Job-Details | `GET /api/job-details` |
| Usage | `GET /api/usage` (Token) |
| Alerts/Digest | `POST/GET/DELETE /api/alerts`, `POST /api/cron/digest` |

## RIS-BFF

`/api/ris/applications`, `/api/ris/consents`, `/api/ris/cvs`,
`/api/ris/cv-consents`, `/api/ris/search-profiles`,
`/api/ris/search-profile-consents`, `/api/ris/erasure`.

Alle RIS-Routen laufen über einen serverseitigen Router; der Browser erhält
kein Partner-Credential. Details und Verträge stehen im Repository.

Kanonisch: [API-Vertrag](https://github.com/maynowak/mays-jobsearch/blob/main/docs/API_CONTRACT.md) ·
[API-Inventar](https://github.com/maynowak/mays-jobsearch/blob/main/docs/API_INVENTORY.md) ·
[Routen-Standard](https://github.com/maynowak/mays-jobsearch/blob/main/docs/API_VERSIONING_STANDARD.md)

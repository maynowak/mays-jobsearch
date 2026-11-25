# Job Search

## Quellen

- **Arbeitnow** (öffentliche API)
- **Arbeitsagentur** über einen Apify Actor

Weitere optionale Quellen sind im Repository dokumentiert; aktiv sind nur die
konfigurierten und freigegebenen Quellen.

## Ablauf

1. Suchprofil (Fähigkeiten, Zielrolle, Ort, optional Umkreis/Arbeitsmodell/
   Arbeitszeit).
2. Kombinierter Job-Pool mit quellenübergreifender Deduplizierung.
3. Keyword-Vorauswahl, maximal zehn Kandidaten.
4. KI-Bewertung mit Score, Begründung und Vorbereitungsfrage.
5. Top 5 sofort, weitere Treffer lokal ohne zweiten Request.

## Grenzen

Scores sind Vorschläge. Prüfe die Originalanzeige. Bei dünner oder fehlender
Stellenbeschreibung ist die Bewertung eingeschränkt.

Kanonisch: [Architektur](https://github.com/maynowak/mays-jobsearch/blob/main/docs/ARCHITECTURE.md) ·
[Jobquellen](https://github.com/maynowak/mays-jobsearch/blob/main/docs/JOB_SOURCES.md)

==========================================================
VERCEL-ERGÄNZUNG
==========================================================

Prüfe vor dem Deployment die vorhandene vercel.json und
berücksichtige die bestehende Serverless-Struktur.

Baue das Projekt und deploye anschließend mit:

vercel --prod

Nenne mir nach erfolgreichem Deployment die tatsächlich erzeugte
Live-URL.

Verifiziere anschließend die relevanten Endpunkte der Live-URL
mit curl, insbesondere:

/api/jobs
/api/model
/...

Prüfe nur tatsächlich vorhandene bzw. für das Projekt relevante
API-Endpunkte. Keine Endpunkte erfinden.

Halte dich dabei vollständig an:

docs/AI_AGENT_PLAYBOOK.md

und

docs/PROJECT_RULES.md

Constraints:

- Keine neuen Dependencies
- Keine Designänderungen
- Keine Änderung der bestehenden Serverless-Struktur
- Keine zusätzlichen Features
- Keine unnötigen Refactorings
- Bestehende Architektur erhalten

Validation:

1. npm run build
2. vercel --prod
3. Live-URL ermitteln
4. Relevante API-Endpunkte der Live-URL mit curl prüfen
5. Ergebnisse der curl-Tests dokumentieren

Falls Deployment oder Endpoint-Tests fehlschlagen:

- Fehler analysieren
- Ursache feststellen
- sofern technisch möglich beheben
- erneut builden/deployen/testen

Die Aufgabe darf erst als abgeschlossen betrachtet werden,
wenn Build und Deployment erfolgreich sind und die relevanten
Live-Endpunkte überprüft wurden.

==========================================================
OUTPUT
==========================================================

Liefere am Ende entsprechend AI_AGENT_PLAYBOOK.md:

- Zusammenfassung
- geänderte Dateien
- Begründung der Änderungen
- Build-Ergebnis
- Deployment-Ergebnis
- Live-URL
- verifizierte API-Endpunkte
- curl-Ergebnisse
- eventuell verbleibende bekannte Einschränkungen

Anschließend schlage einen Git-Commit vor.

Commit-Titel (Conventional Commit)

Commit-Highlights mit den wichtigsten Änderungen.

commit und push
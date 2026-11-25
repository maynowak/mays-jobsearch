# Benutzerhandbuch — May's Job Matcher

**Stand:** 2026-11-25 · Production `df1fe01`

Diese Anleitung beschreibt die tatsächlich vorhandenen Bedienabläufe. Alle
UI-Bezeichnungen entsprechen der deutschen Oberfläche; die englischen
Bezeichnungen stehen in Klammern, wo sie abweichen.

> KI-Ausgaben sind Vorschläge. Prüfe Bewertungen, Anschreiben und importierte
> Lebenslaufdaten immer selbst.

---

## 1. Einstieg und Anmeldung

1. Öffne [www.mays-job-matcher.app](https://www.mays-job-matcher.app/).
2. Für die Jobsuche kannst du direkt starten. Für Konto-, Bewerbungs- und
   RIS-Funktionen wähle **Anmelden** (Sign in) und melde dich über den
   Cognito-Login an.
3. Nach der Anmeldung öffnet sich **Profil** mit den sechs Bereichen:
   **Übersicht**, **Mein Profil**, **Lebenslauf**, **Bewerbungen**,
   **Job-Präferenzen**, **Einstellungen**.

Die Anmeldung ist keine Voraussetzung für den lokalen CV-Import oder den
strukturierten CV-Editor; diese arbeiten in der aktuellen Sitzung.

---

## 2. Profil anlegen und bearbeiten

- **Übersicht** zeigt Konto-/Profilinformationen und den Speicherstatus.
- **Mein Profil** enthält die persönlichen Angaben und den Einstieg in den
  Lebenslauf-Workspace.
- **Einstellungen** enthält Sprache, Datenschutz-/Speicherinformationen und
  Einwilligungen.

Der Profil-Header und die Sidebar bleiben beim Wechsel zwischen den Bereichen
an derselben Position. Auf kleinen Bildschirmen ersetzt **Dashboard-Bereich
wählen** die Sidebar.

---

## 3. Stellen suchen und Ergebnisse verstehen

1. Starte auf der Startseite oder unter **Suche**.
2. Gib Fähigkeiten, eine Zielrolle und einen Ort ein; optional Umkreis,
   Arbeitsmodell und Arbeitszeit.
3. Starte die Suche. Die App lädt Stellen, wählt Kandidaten vor und bewertet
   maximal zehn davon per KI.
4. Die ersten fünf Treffer werden angezeigt. Weitere bewertete Treffer kannst
   du lokal einblenden; dafür ist kein zweiter Suchlauf nötig.

Jede Trefferkarte zeigt einen Score, eine Begründung und eine
Vorbereitungsfrage. Der Score ist eine KI-Einschätzung, keine Garantie.
Prüfe die Originalanzeige.

---

## 4. Bewerbungen erstellen und verwalten

### Neue Bewerbung

1. Öffne **Profil → Bewerbungen**.
2. Wähle **Neue Bewerbung**.
3. Füge die Stellenbeschreibung ein, optional Stellenbezeichnung, Unternehmen,
   Standort und Original-URL.
4. Wähle **Als Entwurf anlegen**.

Im Session-Modus bleibt der Entwurf nur in dieser Sitzung; im RIS-Modus wird
er im Konto gespeichert. Die App zeigt den aktiven Modus an.

### Übersicht und Bearbeitung

- Bewerbungen lassen sich filtern, sortieren und in der Detailansicht öffnen.
- **Bewerbungsdaten bearbeiten** öffnet das Formular.
- Unverändertes Formular: Ein Tab- oder Bewerbungswechsel erfolgt sofort.
- Geändertes Formular: Es erscheint der Dialog **Ungespeicherte Änderungen**
  mit **Speichern und wechseln**, **Änderungen verwerfen** und
  **Weiter bearbeiten**.
- Schlägt das Speichern fehl, bleiben Dialog und alle Eingaben erhalten.

### Status, Verlauf und Wiedervorlagen

Die Detailansicht enthält Status, Verlauf, Kommunikation und Wiedervorlagen.
Statusänderungen und Löschungen werden bestätigt; im RIS-Modus wirken sie auf
den gespeicherten Datensatz.

---

## 5. Eigenes Anschreiben ohne KI

1. Öffne eine Bewerbung und den Tab **Dokumente**.
2. Wähle **Eigenes Anschreiben hinterlegen** (oder **bearbeiten**).
3. Schreibe den Text in **Dein Anschreibentext**. Die Vorschau aktualisiert
   sich live.
4. Wähle **Eigenes Anschreiben speichern**.

Wichtig:

- Es wird **keine KI** aufgerufen.
- Es wird **keine neue Anschreibenversion** erzeugt.
- Bereits vorhandene Versionen bleiben unverändert.
- Erfolg erscheint erst nach bestätigter Speicherung.
- Bei einem Speicherfehler bleibt dein Text im Editor erhalten.

Der Speichermodus wird angezeigt: **Nur für diese Sitzung gespeichert.** oder
**Über RIS in deinem Konto gespeichert.**

---

## 6. KI-Funktionen und ihre Grenzen

- **Anschreiben erstellen** öffnet den bestehenden KI-Assistenten.
- **Anschreiben mit KI verbessern** kann einen Entwurf überarbeiten und als
  Version speichern.
- **Aktuellen Entwurf als Version speichern** legt eine Version des aktuellen
  Textes an.

Grenzen:

- Die KI kann fehlerhafte oder allgemeine Texte liefern.
- Fehlende Anforderungen werden nicht erfunden; bei dünner Stellenbeschreibung
  bleibt der Text allgemeiner.
- Ein Modellausfall kann zu einem transparenten Provider-/Modell-Fallback
  führen; die Auswahl des Nutzers wird dabei nicht dauerhaft geändert.
- KI-Ausgaben sind keine rechtliche, fachliche oder persönliche Garantie.

---

## 7. Lebenslauf importieren

1. Öffne **Profil → Lebenslauf** oder den **CV-Workspace**.
2. Wähle **PDF importieren**.
3. Wähle eine PDF-Datei. Die Textextraktion läuft im Browser; die PDF-Datei
   wird nicht hochgeladen.
4. Nach **Lebenslauf analysiert** erscheint die Importvorschau.

Alternativ kannst du **Leeren Lebenslauf erstellen** oder einen vorhandenen
RIS-Lebenslauf importieren, sofern verfügbar.

---

## 8. Erkannte CV-Daten prüfen

Die Importvorschau zeigt erkannte Abschnitte und Prüfkandidaten:

- Abschnittsauswahl und Status (**Erkannt** / **Prüfung empfohlen**).
- **Details anzeigen** für die erkannten Zeilen.
- **Prüfliste** mit offenen, übernommenen und bewusst ausgeschlossenen
  Angaben.
- Filter nach Status, vorgeschlagenem Ziel und Grund.
- **Zuordnen zu** und **Übernehmen** bzw. **Nicht übernehmen**.
- Pagination, wenn mehr Kandidaten vorhanden sind.

Nichts wird automatisch übernommen. Erst **Angaben übernehmen** führt zur
Importauswahl; **Auswahl übernehmen** überträgt die bestätigten Angaben in den
Editor.

---

## 9. Strukturierten Lebenslauf bearbeiten

Der Editor enthält acht Abschnitte:

1. Persönliche Angaben
2. Berufliches Kurzprofil
3. Berufserfahrung
4. Ausbildung
5. Fähigkeiten
6. Projekte
7. Zertifikate
8. Sprachen und Links

Funktionen:

- **Alle Abschnitte aufklappen/einklappen** öffnet bzw. schließt alle
  Abschnitte gemeinsam.
- **Zum ersten Fehler** springt zum ersten Validierungsfehler, öffnet den
  betroffenen Abschnitt und fokussiert das Feld.
- **Vorschau** zeigt den Lebenslauf; **Klassisch**, **Modern** und **Kompakt**
  wechseln das Design.
- **PDF herunterladen** erzeugt die Datei lokal.
- **PDF dauerhaft speichern** ist nur mit Login und passender RIS-Freigabe
  verfügbar.
- **Entwurf übernehmen** übernimmt den Editor-Stand in die Anwendung.

Eingaben bleiben bei reinen Ansichtsaktionen erhalten; Expand/Collapse und
Template-Wechsel speichern nichts und ändern keine CV-Daten.

---

## 10. Radar-Navigation verwenden

Im Fullpage-CV-Import und im strukturierten CV-Editor gibt es eine
Radar-Navigation:

- **Importübersicht** bzw. **Abschnittsübersicht** öffnet die Liste der Ziele.
- Marker zeigen Abschnitte, Prüfkandidaten und Aktionen; Status wird zusätzlich
  als Text/ARIA ausgegeben.
- Ein Klick oder die Tastatur (Enter) springt zum Ziel und fokussiert es.
- **Escape** schließt die Übersicht und gibt den Fokus zurück.
- Bei eingeklappten Abschnitten öffnet die Navigation den Zielabschnitt.
- Auf schmalen Bildschirmen ist der Radar über eine kompakte Schaltfläche
  erreichbar.

Die Marker werden nach Layoutänderungen (Expand/Collapse) neu gemessen; es
werden keine künstlichen Positionen verwendet.

---

## 11. Abschnitte auf- und einklappen

- **Alle Abschnitte aufklappen** öffnet alle einklappbaren Abschnitte.
- **Alle Abschnitte einklappen** schließt sie.
- Die Schaltfläche wechselt ihre Beschriftung abhängig vom Zustand und zeigt
  `aria-pressed`.
- Radar und Turbo-Hände bleiben dabei sichtbar.
- Einzelne Abschnitte können weiterhin über ihre Summary geöffnet werden.

Das Aufklappen ist **kein** Screenshot-Modus und löst keine KI-, ATS- oder
RIS-Anfrage aus.

---

## 12. Screenshot-Modus nutzen

- Im CV-Import: **📸 Screenshot-Ansicht** / **Screenshot-Ansicht beenden**.
- Im CV-Editor: **Ansicht wechseln**.

Im Screenshot-Modus werden Radar, Turbo-Hände und störende Bedienelemente
ausgeblendet; die Abschnitte werden für eine saubere Darstellung geöffnet.
Beim Verlassen wird der vorherige Aufklappzustand wiederhergestellt.

Der Screenshot-Modus erstellt **keinen** Screenshot und überträgt keine Daten.
Es ist eine reine Darstellungsansicht.

---

## 13. Session- und dauerhafte Speicherung unterscheiden

| Anzeige | Bedeutung |
| --- | --- |
| **Nur in dieser Sitzung** | Daten bleiben im Speicher des Tabs; Reload beendet sie. |
| **In deinem Konto gespeichert** | Dauerhafte Speicherung über RIS, nur mit Login, Freigabe und Einwilligung. |

- Session-Daten werden nicht automatisch ins Konto übertragen.
- RIS ist ein separat betriebener Dienst; die App erreicht ihn ausschließlich
  über die serverseitige BFF. RIS-Interna sind nicht Teil dieser Anwendung.
- Der RIS-Modus wird über eine serverseitige Capability-Prüfung aktiviert,
  nicht nur über ein UI-Flag.
- Fehlende Berechtigungen oder Einwilligungen halten die App im Session-Modus.
- Ein Wechsel des Kontos beendet die bisherige Session-Sicht.

---

## 14. Einwilligungen und Datenlöschung verstehen

Unter **Einstellungen → Datenschutz & Datenspeicherung** siehst du den Status
der Einwilligungen für:

- Anwendungs-/Bewerbungsspeicherung,
- CV-Speicherung,
- Suchprofil-Speicherung.

Du kannst Einwilligungen erteilen oder widerrufen. Widerruf und Löschung
wirken auf die jeweilige RIS-Funktion; bereits gespeicherte Daten werden nach
dem dokumentierten RIS-Löschpfad behandelt. Die App zeigt den Status an und
behauptet keine sofortige physische Löschung, wenn der Löschpfad nur einen
Löschmarker setzt.

Weitere Informationen:

- [Datenschutzerklärung](https://www.mays-job-matcher.app/datenschutz)
- [Datenschutzprinzipien](https://www.mays-job-matcher.app/datenschutzprinzipien)
- [Security & Privacy (Wiki)](wiki/Security-and-Privacy.md)

---

## Tipps und Grenzen

- Prüfe KI-Scores und Anschreiben immer an der Originalanzeige.
- Ein Modell kann trotz Katalog temporär nicht verfügbar sein; die App nutzt
  dann transparent einen passenden Fallback.
- Der PDF-Import ist eine lokale Textextraktion, keine OCR-Garantie für
  Scans.
- Zwei-Spalten-PDFs und ungewöhnliche Layouts können die Erkennung
  einschränken; prüfe die Vorschläge in der Prüfliste.
- Bei fehlenden Berechtigungen bleiben RIS-Funktionen bewusst deaktiviert.

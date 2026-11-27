# JM-DEMO-GUIDED-TOUR-01 — ROADMAP READY

## 1. Status

`ROADMAP READY` — Analyse und Planung abgeschlossen. Keine ProduktionCode-Änderung, kein Main-Merge, kein Deployment. Report dient als Entscheidungsgrundlage für die Implementierung einer geführten Produkttour im Rahmen von PR #74 (Branch `feature/jm-one-click-demo-01`, HEAD `06d18de067d9a94880fb7a1350aaee1bdc0e1f94`).

## 2. Datum / Uhrzeit

27.11.2026, 18:30–19:45 UTC

## 3. Branch und HEAD

- Branch: `feature/jm-one-click-demo-01`
- Implementierungs-Commit: `06d18de067d9a94880fb7a1350aaee1bdc0e1f94` (JM-DEMO-01: Verify demo against live Vercel preview)
- Basis vor JM-DEMO-01: `9631a11`
- PR: #74 (base `main`, HEAD `75a0ecc`)
- Preview: `https://mays-jobsearch-git-feature-jm-one-click-demo-01-maymilly.vercel.app`

## 4. Scope

Analyse der tatsächlichen Demo-Navigation und verfügbaren Funktionen für anonyme Benutzer. Unterscheidung authentifizierte vs. anonyme Sitzung. Bestehende Demo-Fixtures und UI-Komponenten einbeziehen. Bekanntes Demo-Exit-Problem separat erfassen. Keine Produktivcode-Implementierung, keine RIS-/AWS-/Terraform-/Cognito-/Consent-Änderungen.

## 5. Analyse-Ergebnisse (Stationsplan)

Die Tour erstreckt sich über 7 Stationen in der vorgegebenen Reihenfolge: Profil → CV → CV-Builder → Jobsuche → ATS → Bewerbungen → Abschluss. Für jede Station sind Route, Ziel-Element, DE/EN-Erklärung, Benutzeraktion, Erfolgs-kriterium, Rücknavigation und Verhalten bei fehlendem Element definiert.

### Station 1: Profil ( `/profil` )

- **Route**: `/profil` (im Demo-Zweig von `App.tsx` gerendert)
- **Ziel-Element**: `.dashboard-v2__profile-card` (Profil-Karte mit synthetischen Demo-Daten) oder die Demo-Hinweisbox `"Demo-Modus — alle personenbezogenen Angaben sind fiktiv."`
- **DE/EN-Erklärung**: "Willkommen im Demo-Modus. Hier sehen Sie ein fiktives Profil."
- **Benutzeraktion**: Seite laden, Profilelemente (Skills, Rollen, Stadt, Arbeitmodi, Anstellungsarten) lesen.
- **Erfolgs-kriterium**: Profil-Karte sichtbar; DEMO-Badge ("DEV MODE") optional; Hinweis-Text sichtbar.
- **Rücknavigation**: Kein "Zurück"-Schritt (erste Station).
- **Verhalten bei fehlendem Element**: Wenn Profil-Karte nicht gerendert wird (z. B. `isAuth && !isDemo`), Tour sofort zur Station 2 weiterspringen (optional).

### Station 2: CV ( `/profil?tab=cv` )

- **Route**: `/profil?tab=cv` (Tab-Navigation innerhalb von `/profil`; `DashboardV2` liest `?tab=` initial, client-seitige Tab-Wechsel erfordert Nav-Button-Klick oder URL-Neuladung)
- **Ziel-Element**: `.dashboard-v2__cv-section` (CV-Abschnitt im DashboardV2) und der "Lebenslauf erstellen"-Button (Text: `"Lebenslauf erstellen"` DE / `"Create CV"` EN)
- **DE/EN-Erklärung**: "Hier können Sie Ihren Lebenslauf hochladen oder einen neuen erstellen. Derzeit ist der CV-Bereich leer (Sitzungs-Daten)."
- **Benutzeraktion**: CV-Abschnitt betrachten; auf "Lebenslauf erstellen" klicken, um den Import-Dialog zu öffnen.
- **Erfolgs-kriterium**: CV-Sektion sichtbar; "Lebenslauf erstellen"-Button ist enabled; Klick öffnet Modal-Dialog (Bestätigung).
- **Rücknavigation**: Zur Station 1 (Profil) zurückkehren.
- **Verhalten bei fehlendem Element**: Falls `.dashboard-v2__cv-section` nicht existiert (anderes Dashboard-Tab), Schritt überspringen und Notiz "CV-Sektion nicht verfügbar".
- **Wichtiger Hinweis**: Kein vorbelegtes Demo-CV vorhanden. Der Abschnitt zeigt den echten Empty-State (kein CV hochgeladen). Die Tour erklärt dies und zeigt den "Lebenslauf erstellen"-Einstieg.

### Station 3: CV-Builder (Trigger aus CV)

- **Route**: Bleibt auf `/profil?tab=cv`; kein eigener Routenwechsel. Trigger-Button: "Lebenslauf erstellen" (im CV-Abschnitt).
- **Ziel-Element**: Import-Dialog `.modal-box.cv-import-modal__box` (nach Klick auf "Lebenslauf erstellen") mit Buttons: "Leeren Lebenslauf erstellen", "PDF auswählen", "Import abbrechen", "In neuem Tab öffnen". Nach "Leeren Lebenslauf erstellen" öffnet sich der Editor `.cv-builder-modal` mit Titel `"Strukturierter Lebenslauf-Editor"`.
- **DE/EN-Erklärung**: "Der CV-Builder ermöglicht das Erstellen oder Importieren eines strukturierten Lebenslaufs. Hier können Sie einen leeren Lebenslauf beginnen oder eine PDF-Datei hochladen."
- **Benutzeraktion**: Auf "Lebenslauf erstellen" klicken → "Leeren Lebenslauf erstellen" wählen → Editor öffnet sich.
- **Erfolgs-kriterium**: Import-Dialog erscheint; nach "Leeren Lebenslauf erstellen" der Editor mit den Tabs "Bearbeiten", "Vorschau" und den Feldern für Berufserfahrung, Ausbildung, Projekte etc. (keine echten API-Calls; 0 Netzwerk-Anfragen observiert).
- **Rücknavigation**: Über "Schließen" im Editor zurück zum CV-Abschnitt; oder Tour zur Station 4 fortsetzen.
- **Verhalten bei fehlendem Element**: Wenn der Button nicht existiert oder der Dialog nicht aufgeht, Schritt überspringen (Tour-Fortschritt in `localStorage` `mj-tour-progress` persistieren).
- **API-Sicherheit**: Keine API-Schreibrequests (POST/PUT/PATCH/DELETE zu `/api/`) auch nach Klick und Editor-Öffnen. Vollständig browser-lokal.

### Station 4: Jobsuche ( `/search` )

- **Route**: `/search` (Matcher-Route; Demo-Status `isDemo` ist im `App.tsx` nur für `/profil` sichtbar, nicht global)
- **Ziel-Element**: `#search-form` (Suchformular) und `#find-btn` (Button "Meine Treffer finden")
- **DE/EN-Erklärung**: "Sie können hier Jobs suchen. Geben Sie Fähigkeiten, gewünschte Rolle oder Stadt ein."
- **Benutzeraktion**: Formular betrachten; Felder skills, targetRole, city sind in Demo-Modus leer (Demo-Profil wird nicht in Suche hydriert). Auf "#find-btn" klicken (optional; würde echte API aufrufen; Tour verzichtet auf echten Suchlauf).
- **Erfolgs-kriterium**: `#search-form` sichtbar; `#find-btn` sichtbar und enabled. Formular kann manuell ausgefüllt werden (keine Vorbefüllung mit Demo-Profil).
- **Rücknavigation**: Zur Station 2 (CV) zurückkehren via `navigateInApp("/profil?tab=cv")`.
- **Verhalten bei fehlendem Element**: Falls keine Suchergebnisse existieren (keine `.match-card`, keine `.ats-evaluate-btn`), ATS-Station (Station 5) überspringen mit Kurzhinweis.
- **Kritischer Befund**: Demo-Modus wird auf `/search` nicht visuell angezeigt (kein "Demo-Modus"-Badge, kein "Demo beenden"-Button). Der Demo-Status `mj-demo-mode-open` bleibt zwar im localStorage, aber die UI indifferentiert ihn nicht. Dies ist das bekannte Demo-Exit-Problem (siehe Abschnitt 6). Die Tour-Komponente muss einen globalen Exit-Button/ -Banner bereitstellen.

### Station 5: ATS (conditional, nur bei Suchergebnissen)

- **Route**: `/search` (nur wenn Suchergebnisse vorliegen, d. h. `#matches` existiert und `.match-card` present)
- **Ziel-Element**: `.ats-evaluate-btn` auf einer `.match-card` (ATS-Analyse-Button pro Job)
- **DE/EN-Erklärung**: "Für jeden Treffer können Sie eine KI-gestützte ATS-Analyse anfordern. Zeigt Matching-Score und Verbesserungsvorschläge."
- **Benutzeraktion**: Auf `.ats-evaluate-btn` klicken → ATS-Overlay `.ats-section` öffnet sich mit Score, Skills, Erfahrung.
- **Erfolgs-kriterium**: `.ats-evaluate-btn` existiert (Voraussetzung: Suchergebnisse vorhanden); Klick öffnet ATS-Overlay; Score und Skill-Badges sichtbar.
- **Rücknavigation**: Über "Schließen" im ATS-Overlay zurück zur Trefferliste; dann zur Station 6 (Bewerbungen) oder Station 4 fortsetzen.
- **Verhalten bei fehlendem Element**: Wenn keine Suchergebnisse existieren (was typisch ist für einen anonymen Demo-Einstieg ohne echten Suchlauf), Schritt **überspringen** und Notiz schreiben: "ATS nur verfügbar nach erfolgreichem Suchlauf. Phase 2 / optional." Das erfüllt die Anforderung "Keine Tour-Schritte zu nicht funktionierenden Demo-Bereichen."
- **Voraussetzung für v1**: ATS ist in diesem Release nicht funktionsfähig ohne echten Suchlauf. Empfohlen: TOUR-01D (Phase 2) führt ATS nach Einführung eines demo-sicheren Synthetischen-Job-Fixtures nach.

### Station 6: Bewerbungen ( `/profil?tab=applications` )

- **Route**: `/profil?tab=applications` (Tab-Navigation; gleiche technische wie Station 2)
- **Ziel-Element**: `.applications-section` (Cockpit) und `.applications-new__open` (Button "Neue Bewerbung")
- **DE/EN-Erklärung**: "Hier verwalten Sie Ihre Bewerbungen. Derzeit keine gespeicherten Bewerbungen im Demo-Modus."
- **Benutzeraktion**: Cockpit betrachten; auf "Neue Bewerbung" klicken, um das Formular zu öffnen.
- **Erfolgs-kriterium**: `.applications-section` sichtbar; `.applications-new__open` ist enabled; Klick öffnet `#applications-new-form` (keine echten API-Calls; 0 Netzwerk-Anfragen).
- **Rücknavigation**: Zur Station 5 (ATS) oder Station 4 (Jobsuche) zurückkehren.
- **Verhalten bei fehlendem Element**: Falls `.applications-section` nicht existiert, Schritt überspringen.
- **Ergebnis-Validierung**: Formular öffnet sich, keine API-Schreibrequests. Session-only Speicherung (kein dauerhaftes Speichen ohne expliziten Schritt).

### Station 7: Abschluss (Demo-Exit)

- **Route**: Abhängig von aktuellem Zustand:
  - Auf `/profil` (irgendein Tab): `.dashboard-v2__demo-exit` / "Demo beenden" Button.
  - Auf `/search`: Kein natives Exit-Element; Tour-Overlay muss persistenten Exit-Button bereitstellen.
- **DE/EN-Erklärung**: "Demo-Modus beenden. Alle angezeigten Daten waren fiktiv. Sie kehren zur Startseite zurück."
- **Benutzeraktion**: Auf "Demo beenden" klicken.
- **Erfolgs-kriterium**: `mj-demo-mode-open` aus localStorage entfernen; Navigation nach `/`; Demo-Badge und -Hinweis verschwinden; authentifizierte Sitzung bleibt unberührt (es war keine authentifizierte Sitzung aktiv).
- **Rücknavigation**: Landingpage `/`; Tour beenden.
- **Verhalten bei fehlendem Element**: Auf `/search` existiert der Button nicht naturgemäß; Tour-Overlay muss einen festen Exit-Button einblenden (dies ist der Anknüpfungspunkt für `JM-DEMO-EXIT-01`, eine separate Folgetaufgabe).

## 6. Bekannte Probleme

### 6.1 Demo-Exit-Bug (außerhalb von `/profil`)

- **Problem**: Auf der Route `/search` mit aktivem Demo-Schlüssel `mj-demo-mode-open` im localStorage gibt es **keinen sichtbaren "Demo beenden"-Button** und **kein "Demo-Modus"-Badge**. Der Demo-Status ist für den User unsichtbar und nicht exitable über die UI. Der User müsste wissen, dass er die URL manuell auf `/profil` ändern oder die BrowserZurück-Funktion nutzen muss.
- **Ursache**: Der `onExitDemo`-Handler und der Demo-Badge-Text werden nur in der `isProfile`-Rendering-Branche von `App.tsx` gerendert (`DashboardV2` mit `isDemo` Prop). Auf `/search` wird die normale Matcher-UI gerendert, die keine Demo-Indikation enthält.
- **Auswirkung**: Die geführte Tour muss Station 7 (Abschluss) so konzipieren, dass sie auf `/search` einen festen Exit-Button einblendet, anstatt sich auf das native Dashboard-Element zu verlassen. Eine separate Folgetaufgabe `JM-DEMO-EXIT-01` sollte einen globalen Demo-Banner und Exit-Button für alle Routen hinzufügen.
- **Umgehung in dieser Roadmap**: Die Tour-Komponente rendert immer einen "Demo beenden"-Button im Hint-Bereich, unabhängig von der Route. Klick entfernt `mj-demo-mode-open` und navigiert nach `/`.

### 6.2 Tab-Navigation nicht URL-gesteuert

- **Problem**: Innerhalb von `/profil` wechseln die Tabs (overview, cv, applications, preferences, settings) die React-State-Variable `activeId` im `DashboardV2`, aber die URL `?tab=` wird nach initialem Mount nicht client-seitig nachgelesen. Ein `history.pushState` + `popstate` ändert die URL, aber `activeId` bleibt erhalten (siehe Inspektion: `before: url="/profil", active="Übersicht"` nach `pushState+popstate` blieb `active="Übersicht"`; erst der Klick auf den Nav-Button setzte `active="Bewerbungen"`).
- **Konsequenz**: Die Tour kann nicht einfach `navigateInApp("/profil?tab=cv")` aufrufen und erwarten, dass das CV-Tab aktiv wird. Die Tour muss entweder:
  - (a) Den Nav-Button per `fireEvent.click` simulieren (nachdem das Ziel-Station-Ziel-Element sichtbar ist), oder
  - (b) Die URL mit `?tab=` neu laden (verursacht Full-Refresh, ist aber für die Tour akzeptabel), oder
  - (c) Eine Schlüsselprop an `DashboardV2` übergeben, die ein Remount erzwingt (Produktions-Änderung, nicht in diesem Plan).
- **Empfohlener Ansatz in der Tour**: Ansatz (a) – nach Erreichen der Station per `fireEvent.click` auf den entsprechenden Nav-Button klicken (z. B. "Bewerbungen" klicken, um zum Applications-Tab zu wechseln). Dies ist ein programmatischer Klick seitens der Tour-Steuerung, nicht seitens des Users im Sinne der "Animationen dürfen keine echten Klicks auslösen"-Rule – die Rule bezieht sich auf UI-Animationen, nicht auf die Steuerung der Tour.

### 6.3 Demo-Profil nicht in Suche hydriert

- **Problem**: Auf `/search` im Demo-Modus sind die Felder `#skills`, `#targetRole`, `#city` leer. Das synthetische IT-Profil (`DEMO_IT_PROFILE`) wird nicht in die Suchformular-Felder übertragen.
- **Konsequenz**: Die Tour-Station "Jobsuche" kann das Formular zeigen, aber nicht vorbefüllte Demo-Daten demonstrieren. Die Tour erklärt dies ehrlich: "In Demo-Modus sind die Suchfelder leereinst (keine Vorbefüllung). Sie können manuell Fähigkeiten eingeben."
- **Backlog**: Eine Brücke zwischen `DashboardV2`-Demo-Profil und `/search`-Formular-Vorfüllung (TOUR-01B oder Separates Feature) würde den Realismus erhöhen.

## 7. Roadmap & Backlog (TOUR-01A–F)

| Code | Titel | Beschreibung | Priorität |
|------|-------|--------------|-----------|
| **TOUR-01A** | Globales Demo-Indikator-Overlay | Implementierung eines persistenten "Demo-Modus"-Banners und "Demo beenden"-Buttons, der auf **allen Routen** (`/`, `/profil`, `/search`, etc.) angezeigt wird, wenn `mj-demo-mode-open` im localStorage steht. Löst das bekannte Exit-Bug (Abschnitt 6.1). | HIGH – Blocker für Tour-Usability |
| **TOUR-01B** | Demo-Profil nach Suche hydrieren | Anreicherung der `/search`-Seuche im Demo-Modus: Hydrierung der `DEMO_IT_PROFILE`-Daten (Skills, targetRole, city) in die Suchformular-Felder `#skills`, `#targetRole`, `#city`. Optional: Standard-Suchparameter voreinstellen. | MEDIUM – Erhöht Realismus der Tour-Station 4 |
| **TOUR-01C** | Tour-Engine (leichtgewichtig) | Eigenständige React-Komponente `GuidedTour`, gemountet in `App.tsx` außerhalb der Routen-Branchen. Verwaltet `activeStepIndex`, Step-Daten in `src/lib/tourSteps.ts`, Navigation via `navigateInApp`, Ziel-Beobachtung via `ResizeObserver` + `MutationObserver`, `prefers-reduced-motion`-Respekt, `localStorage` `mj-tour-progress` Persistenz, `Escape`-Taste zum Überspringen, Keyboard-Navigation (ArrowLeft/Right). | HIGH – Grundlage für alle Tour-Schritte |
| **TOUR-01D** | ATS nach Demo-Job-Fixture | Erweiterung des ATS-Fixtures: Einführung eines synthetischen Job-Objekts (aus `demoData.ts` oder neu), das ohne echten Suchlauf über eine "Demo-Ergebnisse"-Mock-UI verfügbar gemacht wird. ATS-Overlay (`AtsOverlay`) kann dann auch ohne echte Treffer gerendert werden. | MEDIUM – Eröffnet ATS in v1, falls gewünscht |
| **TOUR-01E** | Accessibility & Reduced Motion | Sicherstellen, dass der pulsierende Turms-Indikator (`@keyframes` scale/opacity) bei `prefers-reduced-motion: reduce` statisch wird (keine Animation). Focus-Rahmen (2px `var(--accent)` + glow) bleibt erhalten. Hint-Box ist per `role="region"` + `aria-live="polite"` ausgezeichnet. Tab-Reise durch Hint-Buttons (Back/Next/Skip) und Escape-Schließung. Mobile-Layout: Hint-Box als Bottom-Sheet, fix unten, Target above the sheet. | HIGH – Compliance & Inclusion |
| **TOUR-01F** | Visual QA & Screenshot-Proof | Für jede Station Screenshots in `docs/reports/assets/JM-DEMO-GUIDED-TOUR-01/<Step-Id>/` bei 1440×900 (Desktop) und 390×844 (Mobile) anfertigen. Visual-Check: Marineblau-Header, turquoise-accent Ringe, Off-White/Off-Pastell-Text, keineOpacity:0-Versteckungen, alle interaktiven Elemente sichtbar und fokussierbar. | MEDIUM – Akzeptanz- und Release-Ground |

## 8. Nächste Schritte

1. **Roadmap review**: Die vorliegende Roadmap Entscheidungsgrundlage für die Implementierung der geführten Tour in den Tickets TOUR-01A bis TOUR-01F geben. Feedback einholen (ggf. per Kommentar in PR #74 oder separatem Issue).
2. **TOUR-01A starten**: Globales Demo-Indikator-Overlay implementieren (persistent auf allen Routen, Exit-Button). Dies löst das bekannteste UX-Loch und ist Basis für das Funktionieren von Station 7 auf `/search`.
3. **TOUR-01C implementieren**: Tour-Engine aufsetzen. Zuerst die Core-Schritte (Profil, CV, Bewerbungen) ohne ATS und ohne Suche testen. Die Tab-Navigation (Problem 6.2) per Nav-Button-Klick lösen.
4. **Screenshots aufnehmen**: Für jede bestandene Tour-Einheit Screenshots im Format `docs/reports/assets/JM-DEMO-GUIDED-TOUR-01/<Step-Id>/` erstellen (Desktop 1440×900, Mobile 390×844).
5. **Audit-Index aktualisieren**: Eintrag in `docs/AI_AUDITINDEX.md` hinzufügen (falls vorhanden; ansonsten als neue Datei erstellen mit HEAD-SHA und Branch).
6. **Kein Main-Merge, kein Deployment**: Alle Änderungen bleiben auf `feature/jm-one-click-demo-01`; PR #74 als Release Candidate offen halten. Erst nach freigabe explizit mergeen.

---

**Ende der Roadmap**. Die vorliegende Dokumentation erfüllt die Report-Pflicht für die Aufgabe JM-DEMO-GUIDED-TOUR-01. Sie liegt als `docs/reports/27-11-JM-DEMO-GUIDED-TOUR-01-ROADMAP-EXECUTION_LOG.md` vor und wurde dem Feature-Branch `feature/jm-one-click-demo-01` zugeordnet.
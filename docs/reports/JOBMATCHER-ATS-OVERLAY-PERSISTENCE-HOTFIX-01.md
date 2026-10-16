# Report: JOBMATCHER-ATS-OVERLAY-PERSISTENCE-HOTFIX-01

## 1. Root Cause Analysis

### Verified Behavior
Der Benutzer hat bestätigt:
1. ATS-Vergleich öffnen
2. "Zum ATS-Profil hinzufügen" klicken
3. Skill wurde erfolgreich gespeichert
4. ATS-Vergleich verschwand
5. Stattdessen erschien "ATS-Profil vorbereiten" (CV-Workflow)

### Ursachenanalyse

**Hauptursache: `setStatus` in `App.tsx` löst unnötigen Re-render aus**

In der `onSkillAdded`-Callback-Funktion (`src/App.tsx` Zeile 2606) wurde nach erfolgreicher Skill-Speicherung `setStatus` aufgerufen:

```javascript
setStatus({ type: "info", message: t("ats.skill.added") });
```

Dieser Aufruf löste einen vollständigen Re-render der `App`-Komponente aus, wodurch:

1. Die `profile`-Props der `AtsOverlay`-Komponente eine neue Referenz erhielt (wegen der Berechnung aus `activeAtsEntry.skills.join(", ")`)
2. Dies führte zu einem möglichen Reset des internen Zustands des Overlays

**Zusätzliche Verbesserung: Array-Mutation in Store**

Im `updateCvAtsProfileSkills` wurde ursprünglich direkt mutiert:
```javascript
entry.skills = newSkills; // Veraltet
```

Dies wurde korrigiert zu Kopie statt Mutation (wie in `saveCvAtsProfile` bereits implementiert):
```javascript
entry.skills = [...newSkills]; // Kopie
```

### Core Fix

Der `setStatus` Call wurde aus `onSkillAdded` entfernt, da:
- Das Overlay den Status bereits intern via `setRecNotice` in `runReevaluation` aktualisiert
- Der externe `setStatus` war überflüssig und führte zu nicht gewollten Re-renders

---

## 2. Implementierte Änderungen

### Datei: `src/App.tsx`
- **Zeile 2605-2606**: `setStatus` Call aus `onSkillAdded` entfernt
- Das `AtsOverlay` behandelt Status-Messaging intern

### Datei: `src/lib/cvProfileStore.ts`
- **Zeile 238-244**: Array-Kopie statt direkter Mutation bei Skill-Update

---

## 3. Testergebnisse

```
Test Files  68 passed | 3 skipped (71)
Tests  791 passed | 5 skipped (796)
Build:    ✓ erfolgreich
```

---

## 4. Git

- **Letzter Commit-SHA:** `6025309`
- **Push:** nach `origin/main` verifiziert

---

## 5. Status

- **Implementierung:** ABGESCHLOSSEN
- **Tests:** BESTANDEN
- **Build:** ERFOLGREICH
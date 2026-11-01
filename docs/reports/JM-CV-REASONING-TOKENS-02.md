# JM-CV-REASONING-TOKENS-02

**Art:** CV-Processing / OpenRouter-Modellfehler / Reasoning-Token-Budget
**Status:** ROOT CAUSE IDENTIFIZIERT — Code-Fix implementiert, Live-Test offen
**Datum:** 2026-11-01

## 1. Korrektur des ersten Befunds

Die erste Einordnung in `JM-CV-MODEL-UNAVAILABLE-DIAGNOSIS-01.md` war
unvollständig: Sie beschrieb das Symptom (`empty-content` bei mehreren
Free-Modellen), aber nicht den App-seitigen Auslöser. Die genauere Analyse
zeigt einen reproduzierbaren Zusammenhang mit Reasoning-Tokens und dem
kleinen `max_tokens`-Budget.

**Der Fehler ist nicht:**

- die CV-Anonymisierung,
- ein OpenRouter-Quota-/Abrechnungsfehler,
- eine zu lange CV-Eingabe (das Beispielmodell hat 1.000.000 Token Kontext),
- ein bezahltes statt freies Modell.

**Der Fehler ist:**

`/api/profile` ruft ein optionales Reasoning-Modell mit `maxTokens: 900` auf.
OpenRouter zählt Reasoning-Tokens gegen dieses Limit. Wenn das Modell das
Budget vollständig zum Denken verbraucht, liefert es `finish_reason: "length"`
mit leerem `content`. Der Provider mappt diesen leeren Inhalt auf
`model_unavailable` und antwortet mit HTTP 502.

## 2. Evidence

### 2.1 Produktions-Logs

Für `/api/profile` wurden HTTP-200-Antworten mit leerem Modellinhalt
protokolliert:

```text
[ai] provider=openrouter model=nvidia/nemotron-3.5-super-vl:free stage=empty-content status=200
[ai] provider=openrouter model=dots-studio/dots-3-note-preview:free stage=empty-content attempt=2 status=200
[ai] provider=openrouter model=cohere/north-mini-code:free stage=empty-content attempt=3 status=200
[ai] provider=openrouter model=openrouter/free stage=empty-content attempt=3 status=200
```

Das sind **keine** 429-/Quota-Fehler. OpenRouter antwortet mit 200; der
App-Provider wirft erst danach `502 model_unavailable`, weil `content` leer ist.

### 2.2 Modell-Metadaten (read-only aus `GET /api/v1/models`)

Beispiel `nvidia/nemotron-3.5-super-vl:free`:

```json
{
  "context_length": 1000000,
  "architecture": {
    "input_modalities": ["text", "image", "video"],
    "output_modalities": ["text"]
  },
  "pricing": { "prompt": "0", "completion": "0" },
  "supported_parameters": [
    "include_reasoning", "max_tokens", "reasoning", "response_format",
    "structured_outputs", "temperature", "tool_choice", "tools", "top_p"
  ],
  "reasoning": { "mandatory": false }
}
```

Damit ist das Modell:

- kostenlos,
- textfähig,
- strukturierte Ausgabe-fähig,
- **optionales Reasoning-Modell**.

`reasoning.mandatory: false` bedeutet: Reasoning kann für den Request
deaktiviert werden. Das war im Code nicht der Fall.

### 2.3 Code-Ursache

`api/profile.mjs` setzt:

```js
maxTokens: 900
```

Die bisherige Eligibility-Prüfung in
`api/_lib/providers/openrouter.mjs` prüfte nur:

```js
m?.architecture?.supports_reasoning === true
```

Dieses Feld ist in der aktuellen OpenRouter-Modellliste für die betroffenen
Modelle nicht gesetzt. Deshalb wurden Reasoning-Modelle als normale
Chat-Modelle behandelt. Im Request wurde kein `reasoning`-Parameter gesendet.
Das Modell konnte das 900-Token-Budget vollständig für Reasoning verbrauchen
und lieferte leeren `content`.

OpenRouter dokumentiert genau dieses Verhalten:

> Reasoning tokens count against `max_tokens` … if the model spends all of it
> reasoning, the response returns `finish_reason: "length"` with an empty
> `content`.

### 2.4 Warum mehrere Modelle betroffen waren

Die Fallback-Kette versuchte nacheinander mehrere aktuelle Free-Modelle:
`nvidia/...`, `dots-studio/...`, `cohere/...` und `openrouter/free`.
Mehrere davon sind optional reasoning-fähig; `openrouter/free` ist ein
dynamischer Router ohne eigene Reasoning-Metadaten. Dadurch konnte jeder
Versuch am selben Budgetproblem scheitern.

## 3. Fix

### 3.1 Reasoning-Policy im Modellkatalog

`api/_lib/providers/openrouter.mjs` klassifiziert Modelle jetzt über
`reasoning.mandatory`:

- `mandatory: true` → Modell wird **nicht** angeboten/verwendet.
- `mandatory: false` → Modell bleibt verfügbar; Reasoning wird pro Request
  deaktiviert.
- Legacy `architecture.supports_reasoning: true` ohne neues
  `reasoning`-Objekt → konservativ als mandatory behandelt.

Zusätzlich werden ausgeschlossen:

- dynamische Router (`openrouter/*`),
- Modelle mit Audio-/Nicht-Text-Ausgabe (z. B. Lyria-Musikmodelle).

### 3.2 Request-seitige Deaktivierung

Für JSON-Aufgaben sendet der Provider bei optionalen Reasoning-Modellen:

```json
"reasoning": { "enabled": false }
```

Das betrifft insbesondere:

- `/api/profile` (`maxTokens: 900`),
- `/api/match` (`maxTokens: 2500`),
- ATS-Optimierung (`maxTokens: 200`).

Der Cover-Letter-Pfad (`json: false`) bleibt unverändert; dort wird kein
Reasoning-Feld erzwungen.

### 3.3 Diagnose-Logging

Bei leerem `content` werden künftig zusätzlich protokolliert:

```text
finish=length completion_tokens=900 reasoning_tokens=900
```

Damit ist beim nächsten Auftreten sofort sichtbar, ob das Budget wieder durch
Reasoning verbraucht wurde. Inhalte/Prompts werden weiterhin nicht geloggt.

## 4. Auswirkung auf den Modellkatalog

Zum Analysezeitpunkt (read-only OpenRouter-Metadaten) ergab die neue Policy:

- 13 statt 17 textfähige Free-Modelle,
- ausgeschlossen: `recursive/flint-v1.0:free` und
  `liquid/lfm-2.5-2.6b:free` (mandatory reasoning),
- ausgeschlossen: Lyria-Musikmodelle (Audio-Ausgabe),
- ausgeschlossen: `openrouter/free` (dynamischer Router),
- `nvidia/nemotron-3.5-super-vl:free`, `dots-studio/...` und
  `cohere/...` bleiben verfügbar; bei ihnen wird Reasoning deaktiviert.

Der Katalog ist weiterhin dynamisch. Die Policy verhindert nicht, dass ein
Anbieter ein Modell trotz `enabled: false` leer beantwortet. In diesem Fall
greift die bestehende Modell-Fallback-Kette und die UI bleibt im Modellschritt.

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| OpenRouter-Provider-Tests | 9 passed |
| Reasoning-Request-Body | `{"reasoning":{"enabled":false}}` bestätigt |
| Mandatory-Reasoning-Modell | aus Katalog gefiltert |
| Audio-Ausgabemodell | aus Katalog gefiltert |
| Leerer Content | 502 `model_unavailable` + `finish`/`reasoning_tokens`-Log bestätigt |
| Gesamtsuite | **1100 passed, 5 skipped** |
| TypeScript/Build | PASS |

**LIVE PROVIDER TEST: NOT EXECUTED** — es wurden keine neuen echten
Provider-Generierungsaufrufe durchgeführt. Die Prüfung nutzt vorhandene
Produktions-Logs, die öffentliche OpenRouter-Modellliste und Mock-Tests.

## 6. Erwartetes Verhalten nach Deployment

1. Modell `nvidia/nemotron-3.5-super-vl:free` wird mit
   `reasoning: { enabled: false }` aufgerufen.
2. Das 900-Token-Budget steht dem sichtbaren JSON zur Verfügung.
3. Bei Erfolg liefert `/api/profile` ein Profil statt 502.
4. Falls der Anbieter trotzdem leer antwortet, versucht die Client-Fallback-
   Kette das nächste Modell; die UI bleibt am Modellschritt und zeigt den
   Fehler dort.

## 7. Offene Punkte

- **Live-Verifikation:** Der Fix ist noch nicht gegen den echten Provider
  verifiziert. Dafür wäre ein autorisierter synthetischer Lauf mit
  Budgetfreigabe nötig.
- **Provider-Treue:** Ob `reasoning.enabled: false` von jedem optionalen
  Modell anbieterübergreifend respektiert wird, kann erst der Live-Test zeigen.
- **Modellqualität:** Ein nicht-leeres, aber unbrauchbares JSON wird weiterhin
  als `bad_ai_response` behandelt.

## 8. Git / Audit

- Vorheriger UI-Fix: `626739b`
- Diagnose 01: `3338121` / `8156ab7`
- Dieser Fix: Commit nach Verifikation.
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung, keine echten
  Provideraufrufe.

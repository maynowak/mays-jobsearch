/**
 * SEARCH-PROFILE STORAGE CONSENT TEXT (technical candidate)
 *
 * Separate first-person declaration for durable manual, CV-search and ATS
 * search-profile storage in RIS. It is intentionally separate from the
 * ApplicationV1 and CV storage consents. The text is a candidate for
 * operator/legal approval and grants nothing by itself.
 *
 * The canonical text is `paragraphs.join("\n\n")`; the SHA-256 is computed
 * over its exact UTF-8 bytes and must match the server-side BFF mapping.
 */

export const SEARCH_PROFILE_STORAGE_CONSENT_TEXT_VERSION =
  "search-profile-storage-consent-2026-11-08-v1" as const;

export const SEARCH_PROFILE_STORAGE_CONSENT_TEXT_SHA256 =
  "926d1b9bbeefac4b97a5c51e3b6e6c1ed33a3affc3698e07456132be39b0f0f8";

export const SEARCH_PROFILE_STORAGE_CONSENT_PURPOSE = "search-profile-storage" as const;
export const SEARCH_PROFILE_STORAGE_CONSENT_RIS_NOTICE_VERSION = "1.0" as const;
export const SEARCH_PROFILE_STORAGE_CONSENT_STATE = "DRAFT" as const;
export const SEARCH_PROFILE_STORAGE_CONSENT_PRIVACY_POLICY_VERSION = "1.1" as const;

export const SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS = [
  "Ich willige ein, dass der RIS-Speicherdienst meine manuellen Suchprofile, meine CV-Suchprofile und meine ATS-Suchprofile dauerhaft in meinem angemeldeten Konto speichert, damit ich sie später abrufen, bearbeiten, für Suchen und ATS-Analysen verwenden und löschen kann.",
  "Gespeichert werden: Profilname, Beschreibung, Suchkonfiguration (Skills, Zielrollen, Ort, Radius, Arbeitsmodelle und Beschäftigungsarten), Matching-Präferenzen (Muss-, Wunsch- und Ausschlusskriterien), ATS-Kriterien (Zielrollen, Skills und Anforderungen), Zeitstempel und Version sowie bei CV-Suchprofilen die Referenz auf den ausgewählten dauerhaft gespeicherten CV und bei ATS-Profilen die Referenz auf das übergeordnete Suchprofil. PDF-Dateien, im Browser ausgelesene CV-Texte, KI-Prompts und Provider-Nutzlasten werden durch diese Einwilligung nicht gespeichert.",
  "Die Speicherung erfolgt in der bestehenden RIS-Infrastruktur. Sie löst keine KI-Anfrage aus und übermittelt keine Profilinhalte an KI- oder sonstige Anbieter. Das Anlegen, Bearbeiten, Laden oder Löschen eines Profils ruft kein Modell auf.",
  "Ich kann diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Der Widerruf blockiert neue Schreibzugriffe; bereits gespeicherte Profile bleiben im Rahmen der bestehenden Rechte lesbar und löschbar. Der Widerruf ist nicht automatisch eine sofortige physische Löschung.",
  "Gespeicherte Suchprofile bleiben bestehen, bis ich sie lösche. Sicherungen, Protokolle und gesetzliche Aufbewahrungspflichten können eine Löschung verzögern oder begrenzen.",
  "Diese Einwilligung gilt ergänzend zu den Datenschutzhinweisen unter /datenschutz (Datenschutzrichtlinie Version 1.1 vom 7. November 2026) und ersetzt diese nicht. Sie ist getrennt von der ApplicationV1-Speicherung und der CV-Speicherung."
] as const;

export const SEARCH_PROFILE_STORAGE_CONSENT_TEXT =
  SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS.join("\n\n");

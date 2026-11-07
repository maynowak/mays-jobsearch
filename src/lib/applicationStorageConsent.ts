/**
 * APPLICATION-STORAGE CONSENT TEXT (candidate)
 *
 * Complete German first-person declaration for optional durable ApplicationV1
 * storage in RIS. This text is a **candidate for operator/legal approval**, not
 * an approved declaration. It must not be presented as approved and it grants
 * nothing by itself.
 *
 * The canonical text is `paragraphs.join("\n\n")`. The SHA-256 digest is
 * computed over the exact UTF-8 bytes of that canonical string; the integrity
 * test recomputes it. Never edit a paragraph without recomputing the hash and
 * updating the server mapping in `api/_lib/ris/consentText.mjs`.
 */

export const APPLICATION_STORAGE_CONSENT_TEXT_VERSION =
  "application-storage-consent-2026-11-07-v1" as const;

export const APPLICATION_STORAGE_CONSENT_PURPOSE = "application-storage" as const;

/** RIS notice this text is intended to map to (RIS keeps it DRAFT today). */
export const APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION = "1.0" as const;

/** Candidate state: the text is not approved for production use. */
export const APPLICATION_STORAGE_CONSENT_STATE = "DRAFT" as const;

export const APPLICATION_STORAGE_CONSENT_PRIVACY_POLICY_VERSION = "1.1" as const;

export const APPLICATION_STORAGE_CONSENT_PARAGRAPHS = [
  "Ich willige ein, dass der RIS-Speicherdienst meine Bewerbungsdaten im nachfolgend beschriebenen Umfang dauerhaft speichert, damit ich sie später abrufen, bearbeiten, exportieren und löschen kann. Diese Einwilligung gilt ergänzend zu den Datenschutzhinweisen unter /datenschutz (Datenschutzrichtlinie Version 1.1 vom 7. November 2026) und ersetzt diese nicht.",
  "Gespeichert werden: meine Bewerbungen mit Stellenbezug (jobId, Titel, Unternehmen, Ort, Quelle und URL), meine Anschreiben und Anschreiben-Versionen, der Dokumentstatus, Verweise auf ausgewählte CV- und Suchprofile sowie Bewerbungsdatum und -kanal, Kontaktangaben, Notizen, Gehaltsvorstellung und -angebot, Wiedervorlagen und Verlaufsereignisse (Feedback, Interview, Notizen).",
  "Nicht gespeichert werden durch diese Einwilligung: PDF-Dateien, im Browser ausgelesene CV-Texte, KI-Prompts oder Provider-Nutzlasten. Verweise auf CV- und Suchprofile verweisen nur auf die jeweilige Ressource und enthalten keine Dokumentkopie.",
  "Der Zweck der Speicherung ist ausschließlich der spätere Abruf, die Änderung, der Export und die Löschung der ausgewählten Bewerbungsdaten durch mich.",
  "RIS ist der Speicherdienst; die Daten liegen in der bestehenden RIS-/AWS-Infrastruktur. Diese Einwilligung betrifft keine KI-Analyse und keine Übermittlung an KI- oder sonstige Provider. Eine Einwilligung in eine KI-Verarbeitung ist nicht Teil dieser Erklärung und wird durch sie nicht erteilt.",
  "Mit dieser Einwilligung wird die dauerhafte Speicherung der genannten Daten für mein angemeldetes Konto freigeschaltet. Ohne diese Einwilligung bleiben die abhängigen Speicherfunktionen gesperrt.",
  "Ich kann diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Der Widerruf blockiert neue abhängige Schreibzugriffe. Bereits gespeicherte Daten bleiben im Rahmen der bestehenden Rechte lesbar, exportierbar und löschbar; der Widerruf ist nicht automatisch eine sofortige physische Löschung.",
  "Für ApplicationV1 ist derzeit keine pauschale Aufbewahrungsfrist freigegeben. Gespeicherte Bewerbungen bleiben bestehen, bis ich sie lösche. Sicherungen, Protokolle und gesetzliche Aufbewahrungspflichten können eine Löschung verzögern oder begrenzen.",
] as const;

export const APPLICATION_STORAGE_CONSENT_TEXT = APPLICATION_STORAGE_CONSENT_PARAGRAPHS.join("\n\n");

/**
 * SHA-256 over the exact UTF-8 canonical text above. Recomputed and asserted by
 * `src/lib/storageConsent.test.ts`; the same value must be configured in the BFF
 * (`RIS_CONSENT_TEXT_SHA256`) before a grant can be allowed.
 */
export const APPLICATION_STORAGE_CONSENT_TEXT_SHA256 =
  "2615314738ca991f232314529d0bd473585758b4d1dd4b780f29bcc4c5289953";

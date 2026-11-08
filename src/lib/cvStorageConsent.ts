/**
 * CV-STORAGE CONSENT TEXT (technical candidate)
 *
 * Separate first-person declaration for durable CV-PDF storage in RIS. It is
 * intentionally separate from the ApplicationV1 storage consent. The text is a
 * candidate for operator/legal approval and grants nothing by itself.
 *
 * The canonical text is `paragraphs.join("\n\n")`; the SHA-256 is computed
 * over its exact UTF-8 bytes and must match the server-side BFF mapping.
 */

export const CV_STORAGE_CONSENT_TEXT_VERSION =
  "cv-storage-consent-2026-11-08-v1" as const;

export const CV_STORAGE_CONSENT_TEXT_SHA256 =
  "2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036";

export const CV_STORAGE_CONSENT_PURPOSE = "cv-storage" as const;
export const CV_STORAGE_CONSENT_RIS_NOTICE_VERSION = "1.0" as const;
export const CV_STORAGE_CONSENT_STATE = "APPROVED" as const;
export const CV_STORAGE_CONSENT_PRIVACY_POLICY_VERSION = "1.1" as const;

export const CV_STORAGE_SPECIAL_CATEGORIES = [
  "health",
  "religious_or_philosophical_beliefs",
  "trade_union_membership",
  "political_opinions",
  "sexual_orientation",
  "sex_life",
  "biometric_data",
  "genetic_data",
  "racial_or_ethnic_origin",
] as const;

export const CV_STORAGE_CONSENT_PARAGRAPHS = [
  "Ich willige ein, dass der RIS-Speicherdienst meinen hochgeladenen Lebenslauf als PDF-Datei sowie die zugehörigen Dokumentmetadaten (Dateiname, Dateigröße, Inhaltstyp, Prüfsumme, Speicherstatus) dauerhaft in meinem angemeldeten Konto speichert, damit ich ihn später abrufen, herunterladen, für Bewerbungen auswählen und löschen kann.",
  "Die Datei wird verschlüsselt in der bestehenden RIS-/AWS-Infrastruktur gespeichert. Die Speicherung erfolgt getrennt von einer KI-Verarbeitung; beim Speichern wird keine KI-Anfrage ausgelöst und es werden keine CV-Inhalte an KI-Anbieter übermittelt.",
  "Ich willige ausdrücklich nach Art. 9 Abs. 2 lit. a DSGVO ein, dass besondere Kategorien personenbezogener Daten, die in dem von mir hochgeladenen Lebenslauf enthalten sind, gespeichert werden, soweit ich diese Angaben selbst bereitstelle. Das betrifft insbesondere Gesundheitsdaten, Angaben zu religiösen oder weltanschaulichen Überzeugungen, die Gewerkschaftszugehörigkeit, politische Meinungen, das Sexualleben und die sexuelle Orientierung, biometrische Daten, genetische Daten sowie Angaben zur rassischen oder ethnischen Herkunft. Diese ausdrückliche Einwilligung ist freiwillig, erfordert keine Zuordnung zu einer bestimmten Kategorie und keine Offenlegung, ob solche Daten überhaupt vorliegen, und kann jederzeit mit Wirkung für die Zukunft widerrufen werden; sie ist nicht Voraussetzung für die übrigen Lebenslauf-Funktionen. Eine automatische Kategorisierung oder Ableitung von Geschlecht, Geschlechtsidentität oder sexueller Orientierung findet nicht statt.",
  "Ich kann diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Der Widerruf blockiert neue Uploads und Änderungen; bereits gespeicherte Lebensläufe bleiben im Rahmen der bestehenden Rechte lesbar, herunterladbar und löschbar. Der Widerruf ist nicht automatisch eine sofortige physische Löschung.",
  "Gespeicherte Lebensläufe bleiben bestehen, bis ich sie lösche. Sicherungen, Protokolle und gesetzliche Aufbewahrungspflichten können eine Löschung verzögern oder begrenzen.",
  "Diese Einwilligung gilt ergänzend zu den Datenschutzhinweisen unter /datenschutz (Datenschutzrichtlinie Version 1.1 vom 7. November 2026) und ersetzt diese nicht."
] as const;

export const CV_STORAGE_CONSENT_TEXT = CV_STORAGE_CONSENT_PARAGRAPHS.join("\n\n");

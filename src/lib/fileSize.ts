// CV-FILESIZE-DISPLAY-01: Anzeige-Formatierung fuer Dateigroessen.
// Reine Darstellungsfunktion — die tatsaechliche Dateigroesse bleibt unveraendert.
//
// Vorher wurde in CvDocumentList hart auf MB gerundet
// (`(size / 1024 / 1024).toFixed(1)`), wodurch jede gueltige PDF unter 50 KB als
// "0.0 MB" erschien. Hier wird die Groesse in die passende Einheit (B/KB/MB/GB)
// umgerechnet und locale-korrekt formatiert (de: "25,0 KB", en: "25.0 KB").

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const BASE = 1024;

function formatNumber(value: number, fractionDigits: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
}

/**
 * Formatiert eine Byte-Groesse lesbar.
 *
 * - 0 Bytes (und ungueltige/negative Werte) -> "0 B"
 * - Bytes werden ohne Nachkommastelle angezeigt
 * - KB/MB/GB werden mit einer Nachkommastelle angezeigt
 *
 * @param bytes Groesse in Bytes
 * @param locale BCP-47-Locale fuer die Zahlenformatierung (z. B. "de-DE")
 */
export function formatFileSize(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return `0 ${FILE_SIZE_UNITS[0]}`;
  }

  let unitIndex = 0;
  let scaled = bytes;

  while (scaled >= BASE && unitIndex < FILE_SIZE_UNITS.length - 1) {
    scaled /= BASE;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${formatNumber(Math.round(scaled), 0, locale)} ${FILE_SIZE_UNITS[unitIndex]}`;
  }

  let rounded = Math.round(scaled * 10) / 10;
  // 1048575 Bytes wuerden sonst als "1024,0 KB" erscheinen — auf die naechste
  // Einheit hochziehen, damit die Grenze lesbar bleibt.
  if (rounded >= BASE && unitIndex < FILE_SIZE_UNITS.length - 1) {
    unitIndex += 1;
    rounded = Math.round((scaled / BASE) * 10) / 10;
  }

  return `${formatNumber(rounded, 1, locale)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

/** Locale-Kennung fuer die Groessenanzeige aus der App-Sprache. */
export function fileSizeLocale(lang: string): string {
  return lang === "en" ? "en-US" : "de-DE";
}

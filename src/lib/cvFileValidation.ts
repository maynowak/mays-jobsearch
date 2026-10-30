// CV-FILESIZE-DISPLAY-01 (Upload-Guard):
// Gemeinsame Validierung fuer alle CV-Upload-Einstiegspunkte
// (CvUpload.tsx Single-Upload, CvDocumentList/App Mehrfach-Upload).
//
// Vorher pruefte nur der Single-Upload (CvUpload) Dateityp und Groesse; der
// Mehrfach-Upload in App.handleAddCvFiles uebernahm jede Datei ungeprueft —
// auch 0-Byte-Dateien, die anschliessend als "verarbeitungsbereit" galten.

export const MAX_CV_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (bestehendes Limit)

export type CvFileRejection = "not-pdf" | "too-large" | "empty";

export interface RejectedCvFile {
  file: File;
  reason: CvFileRejection;
}

export interface CvFilePartition {
  accepted: File[];
  rejected: RejectedCvFile[];
}

/** PDF-Erkennung wie im bestehenden Upload (MIME-Typ oder ".pdf"-Endung). */
export function isPdfFile(file: File): boolean {
  const mimeOk = file.type === "application/pdf" || file.type === "";
  const extOk = file.name.toLowerCase().endsWith(".pdf");
  return mimeOk && extOk;
}

/**
 * Prueft eine einzelne Datei gegen die bestehenden Grenzen.
 * Rueckgabe `null` bedeutet: Datei ist annehmbar.
 *
 * Wichtig: Eine kleine, aber gueltige PDF wird NICHT abgelehnt — nur exakt
 * 0 Bytes gelten als leer/nicht verarbeitbar.
 */
export function validateCvFile(file: File): CvFileRejection | null {
  if (!isPdfFile(file)) return "not-pdf";
  if (file.size > MAX_CV_FILE_SIZE_BYTES) return "too-large";
  if (file.size === 0) return "empty";
  return null;
}

/** Teilt eine Datei-Auswahl in annehmbare und abgelehnte Dateien. */
export function partitionCvFiles(files: Iterable<File>): CvFilePartition {
  const accepted: File[] = [];
  const rejected: RejectedCvFile[] = [];
  for (const file of files) {
    const reason = validateCvFile(file);
    if (reason) rejected.push({ file, reason });
    else accepted.push(file);
  }
  return { accepted, rejected };
}

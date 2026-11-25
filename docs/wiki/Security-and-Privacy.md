# Security & Privacy

## Grenzen

- RIS ist ein separat betriebener externer Dienst; der Browser spricht nie
  direkt mit RIS.
- Partner-Credential, Test-Allowlist und Consent-Konfiguration bleiben
  serverseitig.
- Keine Secrets in `VITE_*`, Browser-Bundles, Logs oder Screenshots.
- Keine echten Kontodaten in Dokumentation oder Tests.

## Datenflüsse

- CV-PDFs werden im Browser verarbeitet und nicht als Datei hochgeladen.
- KI-Aufrufe laufen über die BFF; Provider-Keys bleiben serverseitig.
- Session-Daten bleiben im Tab; RIS-Speicherung erfordert Login, Freigabe und
  passende Einwilligung.
- Anwendungs-, CV- und Suchprofil-Speicherung haben getrennte Consent-Zwecke.

## Löschung

Einwilligungen können widerrufen werden. Der tatsächliche Löschpfad (inkl.
Löschmarker/physischer Purge) ist im RIS-Vertrag und in den Reports
dokumentiert; die UI behauptet keine weitergehende Garantie.

Kanonisch: [Datenschutz](https://www.mays-job-matcher.app/datenschutz) ·
[Datenschutzprinzipien](https://www.mays-job-matcher.app/datenschutzprinzipien) ·
[AUTH_COGNITO](https://github.com/maynowak/mays-jobsearch/blob/main/docs/AUTH_COGNITO.md)

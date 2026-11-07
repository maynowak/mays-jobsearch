import { useEffect, useState } from "react";
import { useLang } from "../i18n";

const PRIVACY_DOCUMENT_PATH = "/legal/datenschutz.md";

export default function Privacy() {
  const { t } = useLang();
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(PRIVACY_DOCUMENT_PATH)
      .then((response) => {
        if (!response.ok) throw new Error("privacy document unavailable");
        return response.text();
      })
      .then((text) => {
        if (active) setDocumentText(text);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card legal-page">
      <h2>{t("footer.privacy")}</h2>
      {documentText ? (
        <pre className="legal-document">{documentText}</pre>
      ) : (
        <p className="legal-placeholder">
          {failed
            ? "Die Datenschutzerklärung konnte nicht geladen werden."
            : "Datenschutzerklärung wird geladen …"}
        </p>
      )}
      <p>
        <a href={PRIVACY_DOCUMENT_PATH} target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung als Markdown öffnen
        </a>
      </p>
      <p>
        <a href="/datenschutzprinzipien">Klare Datenschutzprinzipien</a>
      </p>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export default function Privacy() {
  const { t } = useLang();
  const [content, setContent] = useState<string>("Lade Datenschutz...");

  useEffect(() => {
    fetch("/legal/datenschutz.md")
      .then((r) => r.ok ? r.text() : Promise.reject("fetch failed"))
      .then(setContent)
      .catch(() => setContent("Datenschutztext konnte nicht geladen werden."));
  }, []);

  return (
    <section className="card legal-page">
      <h2>{t("footer.privacy")}</h2>
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}>{content}</pre>
      <p style={{ marginTop: 24 }}>
        <a href="/datenschutzprinzipien">Klare Datenschutzprinzipien</a>
      </p>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export default function Principles() {
  const { t } = useLang();
  const [content, setContent] = useState<string>("Lade Prinzipien...");

  useEffect(() => {
    fetch("/legal/prinzipien.md")
      .then((r) => r.ok ? r.text() : Promise.reject("fetch failed"))
      .then(setContent)
      .catch(() => setContent("Prinzipien konnten nicht geladen werden."));
  }, []);

  return (
    <section className="card legal-page">
      <h2>Klare Datenschutzprinzipien</h2>
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{content}</pre>
      <p style={{ marginTop: 24 }}>
        <a href="/datenschutz">{t("footer.privacy")}</a>
      </p>
    </section>
  );
}

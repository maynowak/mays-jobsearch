import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export default function Principles() {
  const { t } = useLang();
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    fetch("/legal/prinzipien.md")
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent("Prinzipien nicht verfügbar."));
  }, []);

  return (
    <section className="card legal-page">
      <h2>Klare Datenschutzprinzipien</h2>
      <div className="legal-content" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
        {content}
      </div>
      <p style={{ marginTop: 24 }}>
        <a href="/datenschutz">{t("footer.privacy")}</a>
      </p>
    </section>
  );
}

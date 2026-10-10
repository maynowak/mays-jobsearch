import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export default function Principles() {
  const { t } = useLang();
  const [content, setContent] = useState<string>("Lade Prinzipien...");

  useEffect(() => {
    fetch("/legal/prinzipien.md", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed " + r.status);
        return r.text();
      })
      .then(setContent)
      .catch((e) => {
        console.error("Prinzipien fetch error", e);
        setContent("Prinzipien konnten nicht geladen werden.");
      });
  }, []);

  return (
    <section className="card legal-page">
      <h2>Klare Datenschutzprinzipien</h2>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{content}</div>
      <p style={{ marginTop: 24 }}>
        <a href="/datenschutz">{t("footer.privacy")}</a>
      </p>
    </section>
  );
}

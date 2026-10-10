import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export default function Privacy() {
  const { t } = useLang();
  const [content, setContent] = useState<string>("Lade Datenschutz...");

  useEffect(() => {
    fetch("/legal/datenschutz.md", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed " + r.status);
        return r.text();
      })
      .then(setContent)
      .catch((e) => {
        console.error("Datenschutz fetch error", e);
        setContent("Datenschutztext konnte nicht geladen werden. Bitte Seite neu laden.");
      });
  }, []);

  return (
    <section className="card legal-page">
      <h2>{t("footer.privacy")}</h2>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}>{content}</div>
      <p style={{ marginTop: 24 }}>
        <a href="/datenschutzprinzipien">Klare Datenschutzprinzipien</a>
      </p>
    </section>
  );
}

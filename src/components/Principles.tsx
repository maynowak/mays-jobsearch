import { useLang } from "../i18n";

export default function Principles() {
  const { t } = useLang();
  return (
    <section className="card legal-page">
      <h2>Klare Datenschutzprinzipien</h2>
      <p>
        <a href="/legal/prinzipien.md" target="_blank" rel="noopener noreferrer">
          Datenschutzprinzipien als Markdown öffnen
        </a>
      </p>
      <p>
        <a href="/datenschutz">{t("footer.privacy")}</a>
      </p>
    </section>
  );
}

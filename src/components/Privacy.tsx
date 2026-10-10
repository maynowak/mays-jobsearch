import { useLang } from "../i18n";

export default function Privacy() {
  const { t } = useLang();
  return (
    <section className="card legal-page">
      <h2>{t("footer.privacy")}</h2>
      <p>
        <a href="/legal/datenschutz.md" target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung als Markdown öffnen
        </a>
      </p>
      <p>
        <a href="/datenschutzprinzipien">Klare Datenschutzprinzipien</a>
      </p>
    </section>
  );
}

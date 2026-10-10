import { useLang } from "../i18n";

export default function Privacy() {
  const { t } = useLang();
  return (
    <section className="card legal-page">
      <h2>{t("footer.privacy")}</h2>
      <p>
        Diese Seite befindet sich in der Entwicklung. Die vollständige Datenschutzerklärung wird zu einem späteren Zeitpunkt veröffentlicht.
      </p>
      <p>
        <a href="/impressum">{t("footer.imprint")}</a>
      </p>
    </section>
  );
}

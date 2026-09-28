import { useLang } from "../i18n";
import { legalConfig, getContactEmailDisplay } from "../config/legal";

export default function Imprint() {
  const { t } = useLang();
  const { email, isPlaceholder: emailPlaceholder } = getContactEmailDisplay();
  const addressPlaceholder = legalConfig.isDev;

  return (
    <section id="impressum" className="legal-page">
      <div className="legal-container">
        <header className="legal-header">
          <h1>{t("legal.imprintTitle")}</h1>
        </header>

        <section className="legal-section" aria-labelledby="provider-heading">
          <h2 id="provider-heading">{t("legal.providerHeading")}</h2>
          <dl className="legal-dl">
            <dt>{t("legal.providerName")}</dt>
            <dd>
              {legalConfig.isDev
                ? t("legal.providerNameDev")
                : "[Betreibername noch einzusetzen]"}
            </dd>

            <dt>{t("legal.providerAddress")}</dt>
            <dd className={addressPlaceholder ? "legal-placeholder" : ""}>
              {legalConfig.isDev
                ? t("legal.addressDev")
                : "[noch nicht festgelegt]"}
            </dd>
          </dl>
        </section>

        <section className="legal-section" aria-labelledby="contact-heading">
          <h2 id="contact-heading">{t("legal.contactHeading")}</h2>
          <dl className="legal-dl">
            <dt>{t("legal.contactEmail")}</dt>
            <dd className={emailPlaceholder ? "legal-placeholder" : ""}>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </dl>
        </section>

        <p className="legal-dev-notice" aria-live="polite">
          {t("legal.devNotice")}
        </p>
      </div>
    </section>
  );
}
import { useLang } from "../i18n";
import { legalConfig, getContactEmailDisplay } from "../config/legal";

export default function Imprint() {
  const { t } = useLang();
  const { email, isPlaceholder: emailPlaceholder } = getContactEmailDisplay();
  const addressPlaceholder = legalConfig.isDev;

  return (
    <section id="impressum" className="legal-page">
      <div className="legal-container">
        <div className="legal-watermark">Personendatenschutz</div>
        <header className="legal-header">
          <h1>{t("legal.imprintTitle")}</h1>
        </header>

        <div className="legal-grid">
          <div className="legal-card">
            <h3>{t("legal.privacyColumn")}</h3>
            <ul>
              <li><a href="/datenschutz">{t("footer.privacy")}</a></li>
              <li><a href="/datenschutzprinzipien">{t("footer.privacyPrinciples")}</a></li>
            </ul>
          </div>
          <div className="legal-card">
            <h3>{t("legal.aboutColumn")}</h3>
            <ul>
              <li><a href="/">Startseite</a></li>
              <li><a href="/impressum">Impressum</a></li>
            </ul>
          </div>
          <div className="legal-card">
            <h3>{t("legal.developersColumn")}</h3>
            <ul>
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer">API / Docs</a></li>
              <li><a href="mailto:support@example.com">Kontakt Entwickler</a></li>
            </ul>
          </div>
        </div>

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
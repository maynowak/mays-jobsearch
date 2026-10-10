import { useLang } from "../i18n";
import { appInfo } from "../lib/appInfo";
import type { AppInfo } from "../lib/appInfo";

interface Props {
  info?: Partial<AppInfo>;
}

export default function Footer({ info = {} }: Props) {
  const { t } = useLang();
  const { version, env, commitSha } = { ...appInfo, ...info };

  return (
    <footer className="footer">
      <nav className="footer-links" aria-label={t("footer.legalAriaLabel")}>
        <a href="/impressum">{t("footer.imprint")}</a>
        <span aria-hidden="true">·</span>
        <a href="/datenschutz">{t("footer.privacy")}</a>
        <span aria-hidden="true">·</span>
        <a href="/datenschutzprinzipien">{t("footer.privacyPrinciples")}</a>
      </nav>
      <p>
        {t("footer.pre")}{" "}
        <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">
          Arbeitnow
        </a>
        {" · "}
        <a href="https://www.arbeitsagentur.de" target="_blank" rel="noopener noreferrer">
          Arbeitsagentur
        </a>
        {t("footer.post")}
      </p>
      <p className="footer-version">
        {t("footer.version")} {version} · {env} · {commitSha}
      </p>
    </footer>
  );
}

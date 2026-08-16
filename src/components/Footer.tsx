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

import { useLang } from "../i18n";

export default function Hero() {
  const { t } = useLang();
  return (
    <header className="hero">
      <div className="hero-inner">
        <h1>May&rsquo;s Job Matcher</h1>
        <p className="tagline">{t("hero.tagline")}</p>
      </div>
    </header>
  );
}
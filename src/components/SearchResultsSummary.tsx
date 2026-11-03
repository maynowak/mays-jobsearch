import { useLang } from "../i18n";

interface Props {
  count: number;
  matching: boolean;
  onJump: () => void;
  onMatch: () => void;
}

export default function SearchResultsSummary({ count, matching, onJump, onMatch }: Props) {
  const { t } = useLang();
  const countLabel =
    count === 1
      ? t("searchResults.foundOne")
      : t("searchResults.foundMany", { count });
  const jumpLabel =
    count === 1
      ? t("searchResults.jumpOne")
      : t("searchResults.jumpMany", { count });

  return (
    <section id="search-results-summary" className="search-results-summary" aria-labelledby="search-results-summary-title">
      <div className="search-results-summary__copy">
        <p id="search-results-summary-title" className="search-results-summary__count" role="status">
          {countLabel}
        </p>
        <p className="search-results-summary__hint">{t("searchResults.hint")}</p>
      </div>
      <div className="search-results-summary__actions">
        <button type="button" className="btn-ghost search-results-summary__jump" onClick={onJump}>
          {jumpLabel}
        </button>
        <button
          id="match-btn"
          type="button"
          className="match-btn"
          onClick={onMatch}
          disabled={matching}
          aria-busy={matching}
        >
          <span className="match-btn__icon" aria-hidden="true">✨</span>
          <span className="btn-label">
            {matching ? t("search.matching") : t("search.matchButton")}
          </span>
          {matching && <span className="spinner" />}
        </button>
      </div>
    </section>
  );
}

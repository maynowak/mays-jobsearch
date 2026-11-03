import { useEffect, useId, useState } from "react";
import { useLang } from "../i18n";
import type {
  CoverLetterVersionV1,
} from "../lib/applications/contractTypes";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";

interface Props {
  application: SessionApplicationV1;
}

type Selection = "current" | string;

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function sourceLabel(t: (key: string) => string, source: CoverLetterVersionV1["source"]): string {
  return t(`applications.letterComparison.source.${source}`);
}

export default function ApplicationLetterComparison({ application }: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const selectFromId = useId();
  const selectToId = useId();
  const versions = application.documents.coverLetterVersions;
  const versionSignature = versions.map((version) => version.versionId).join("|");
  const latestVersionId = versions.at(-1)?.versionId ?? "current";
  const [fromId, setFromId] = useState<Selection>("current");
  const [toId, setToId] = useState<Selection>(latestVersionId);

  useEffect(() => {
    setFromId("current");
    setToId(latestVersionId);
  }, [application.localId, versionSignature, latestVersionId]);

  useEffect(() => {
    if (fromId !== "current" && !versions.some((version) => version.versionId === fromId)) {
      setFromId("current");
    }
    if (toId !== "current" && !versions.some((version) => version.versionId === toId)) {
      setToId(latestVersionId);
    }
  }, [fromId, latestVersionId, toId, versions]);

  const optionLabel = (version: CoverLetterVersionV1, index: number): string =>
    t("applications.letterComparison.versionOption", {
      number: index + 1,
      date: formatDate(version.createdAt, locale),
    });

  const resolve = (selection: Selection) => {
    if (selection === "current") {
      return {
        label: t("applications.letterComparison.current"),
        current: true,
        content: application.documents.coverLetterDraft,
        version: null as CoverLetterVersionV1 | null,
        index: null as number | null,
      };
    }
    const index = versions.findIndex((version) => version.versionId === selection);
    const version = index >= 0 ? versions[index] : null;
    return {
      label: version
        ? t("applications.letterComparison.versionLabel", { number: index + 1 })
        : t("applications.letterComparison.current"),
      current: !version,
      content: version?.content ?? application.documents.coverLetterDraft,
      version,
      index: version ? index : null,
    };
  };

  const renderPanel = (side: "from" | "to", selection: Selection) => {
    const resolved = resolve(selection);
    const headingId = `${selectFromId}-${side}-panel`;
    return (
      <section className="applications-letter-comparison__panel" aria-labelledby={headingId}>
        <h4 id={headingId}>{resolved.label}</h4>
        {resolved.current ? (
          <p className="letter-hint">{t("applications.letterComparison.currentHint")}</p>
        ) : resolved.version ? (
          <dl className="applications-letter-comparison__meta">
            <div>
              <dt>{t("applications.letterComparison.created")}</dt>
              <dd>{formatDate(resolved.version.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{t("applications.letterComparison.sourceLabel")}</dt>
              <dd>{sourceLabel(t, resolved.version.source)}</dd>
            </div>
            {resolved.version.language && (
              <div>
                <dt>{t("applications.letterComparison.language")}</dt>
                <dd>{resolved.version.language.toUpperCase()}</dd>
              </div>
            )}
            {resolved.version.model && (
              <div>
                <dt>{t("applications.letterComparison.model")}</dt>
                <dd>{resolved.version.model}</dd>
              </div>
            )}
            <div>
              <dt>{t("applications.letterComparison.versionId")}</dt>
              <dd>{resolved.version.versionId}</dd>
            </div>
          </dl>
        ) : null}
        <pre className="applications-letter-comparison__text">
          {resolved.content || t("applications.letterComparison.emptyText")}
        </pre>
      </section>
    );
  };

  return (
    <section className="applications-letter-comparison" aria-labelledby="applications-letter-comparison-title">
      <h4 id="applications-letter-comparison-title">{t("applications.letterComparison.title")}</h4>
      {versions.length === 0 ? (
        <>
          <p className="letter-hint">{t("applications.letterComparison.noVersions")}</p>
          <section className="applications-letter-comparison__panel" aria-labelledby="applications-letter-comparison-current">
            <h4 id="applications-letter-comparison-current">{t("applications.letterComparison.current")}</h4>
            <p className="letter-hint">{t("applications.letterComparison.currentHint")}</p>
            <pre className="applications-letter-comparison__text">
              {application.documents.coverLetterDraft || t("applications.letterComparison.emptyText")}
            </pre>
          </section>
        </>
      ) : (
        <>
          <div className="applications-letter-comparison__selectors">
            <label className="letter-field" htmlFor={selectFromId}>
              <span>{t("applications.letterComparison.from")}</span>
              <select
                id={selectFromId}
                value={fromId}
                onChange={(event) => setFromId(event.target.value)}
              >
                <option value="current">{t("applications.letterComparison.currentOption")}</option>
                {versions.map((version, index) => (
                  <option key={version.versionId} value={version.versionId}>
                    {optionLabel(version, index)}
                  </option>
                ))}
              </select>
            </label>
            <label className="letter-field" htmlFor={selectToId}>
              <span>{t("applications.letterComparison.to")}</span>
              <select
                id={selectToId}
                value={toId}
                onChange={(event) => setToId(event.target.value)}
              >
                <option value="current">{t("applications.letterComparison.currentOption")}</option>
                {versions.map((version, index) => (
                  <option key={version.versionId} value={version.versionId}>
                    {optionLabel(version, index)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {fromId === toId && (
            <p className="applications-letter-comparison__same" role="status">
              {t("applications.letterComparison.same")}
            </p>
          )}
          <div className="applications-letter-comparison__panels">
            {renderPanel("from", fromId)}
            {renderPanel("to", toId)}
          </div>
        </>
      )}
    </section>
  );
}

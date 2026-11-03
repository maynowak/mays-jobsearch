import { useLang } from "../i18n";
import {
  isCvBuilderEntryEmpty,
  type CvBuilderDraftV1,
  type CvBuilderEducationV1,
  type CvBuilderExperienceV1,
} from "../lib/cvBuilder/contractTypes";

export type CvBuilderTemplate = "classic" | "modern" | "compact";

interface Props {
  draft: CvBuilderDraftV1;
  template: CvBuilderTemplate;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH_RE = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

function validMonth(value: string | undefined): string | null {
  return value && MONTH_RE.test(value) ? value : null;
}

function formatMonth(value: string | undefined, _lang: "de" | "en"): string | null {
  const month = validMonth(value);
  if (!month) return null;
  const [year, monthPart] = month.split("-");
  return `${monthPart}/${year}`;
}

function formatRange(
  entry: { startMonth: string; endMonth?: string; current: boolean },
  lang: "de" | "en",
  presentLabel: string
): string {
  const rawStart = validMonth(entry.startMonth);
  const start = formatMonth(entry.startMonth, lang);
  if (!rawStart || !start) return "";
  if (entry.current) return `${start} – ${presentLabel}`;
  const rawEnd = validMonth(entry.endMonth);
  const end = formatMonth(entry.endMonth, lang);
  if (!rawEnd || !end || rawEnd < rawStart) return start;
  return `${start} – ${end}`;
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function notEmpty(entry: Record<string, unknown>): boolean {
  return !isCvBuilderEntryEmpty(entry);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cv-preview__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function HistoryEntry({
  entry,
  lang,
  presentLabel,
}: {
  entry: CvBuilderExperienceV1 | CvBuilderEducationV1;
  lang: "de" | "en";
  presentLabel: string;
}) {
  const title = "position" in entry ? entry.position : entry.degree;
  const subtitle = "employer" in entry ? entry.employer : entry.institution;
  const range = formatRange(entry, lang, presentLabel);
  return (
    <li className="cv-preview__history-item">
      <div className="cv-preview__history-head">
        <div>
          <h3>{title}</h3>
          <p className="cv-preview__muted">{subtitle}</p>
        </div>
        {range && <span className="cv-preview__date">{range}</span>}
      </div>
      {entry.description?.trim() && <p className="cv-preview__body">{entry.description}</p>}
    </li>
  );
}

export default function CvBuilderPreview({ draft, template }: Props) {
  const { t, lang } = useLang();
  const presentLabel = t("cvBuilder.preview.present");
  const experience = draft.experience.filter((entry) => notEmpty(entry as unknown as Record<string, unknown>));
  const education = draft.education.filter((entry) => notEmpty(entry as unknown as Record<string, unknown>));
  const projects = draft.projects.filter((entry) => notEmpty(entry as unknown as Record<string, unknown>));
  const certificates = draft.certificates.filter((entry) => notEmpty(entry as unknown as Record<string, unknown>));
  const languages = draft.languages.filter((entry) => entry.language.trim());
  const links = draft.links.filter((entry) => entry.label.trim() && safeHttpUrl(entry.url));
  const hasContent =
    Boolean(
      draft.personal.fullName?.trim() ||
        draft.personal.email?.trim() ||
        draft.personal.phone?.trim() ||
        draft.personal.location?.trim() ||
        draft.profile.headline?.trim() ||
        draft.profile.summary?.trim() ||
        draft.skills.length
    ) ||
    experience.length > 0 ||
    education.length > 0 ||
    projects.length > 0 ||
    certificates.length > 0 ||
    languages.length > 0 ||
    links.length > 0;

  const email = draft.personal.email?.trim() ?? "";
  const emailIsSafe = EMAIL_RE.test(email);

  return (
    <div
      className={`cv-preview cv-preview--${template}`}
      aria-label={t("cvBuilder.preview.aria")}
      data-template={template}
    >
      {!hasContent ? (
        <div className="cv-preview__empty">
          <h2>{t("cvBuilder.preview.title")}</h2>
          <p>{t("cvBuilder.preview.empty")}</p>
        </div>
      ) : (
        <article className="cv-preview__sheet">
          <header className="cv-preview__header">
            {draft.personal.fullName?.trim() ? (
              <h1>{draft.personal.fullName}</h1>
            ) : (
              <h1>{t("cvBuilder.preview.namePlaceholder")}</h1>
            )}
            {draft.profile.headline?.trim() && <p className="cv-preview__headline">{draft.profile.headline}</p>}
            {(email || draft.personal.phone?.trim() || draft.personal.location?.trim()) && (
              <ul className="cv-preview__contact" aria-label={t("cvBuilder.preview.contact")}>
                {email && (
                  <li>
                    {emailIsSafe ? <a href={`mailto:${email}`}>{email}</a> : email}
                  </li>
                )}
                {draft.personal.phone?.trim() && <li>{draft.personal.phone}</li>}
                {draft.personal.location?.trim() && <li>{draft.personal.location}</li>}
              </ul>
            )}
          </header>

          {draft.profile.summary?.trim() && (
            <Section title={t("cvBuilder.section.profile")}>
              <p className="cv-preview__body">{draft.profile.summary}</p>
            </Section>
          )}

          {experience.length > 0 && (
            <Section title={t("cvBuilder.section.experience")}>
              <ul className="cv-preview__history">
                {experience.map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} lang={lang} presentLabel={presentLabel} />
                ))}
              </ul>
            </Section>
          )}

          {education.length > 0 && (
            <Section title={t("cvBuilder.section.education")}>
              <ul className="cv-preview__history">
                {education.map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} lang={lang} presentLabel={presentLabel} />
                ))}
              </ul>
            </Section>
          )}

          {draft.skills.length > 0 && (
            <Section title={t("cvBuilder.section.skills")}>
              <ul className="cv-preview__tags" aria-label={t("cvBuilder.section.skills")}>
                {draft.skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </Section>
          )}

          {projects.length > 0 && (
            <Section title={t("cvBuilder.section.projects")}>
              <ul className="cv-preview__history">
                {projects.map((entry) => (
                  <li className="cv-preview__history-item" key={entry.id}>
                    <h3>{entry.name}</h3>
                    {entry.technologies.length > 0 && (
                      <p className="cv-preview__technologies">{entry.technologies.join(" · ")}</p>
                    )}
                    {entry.description?.trim() && <p className="cv-preview__body">{entry.description}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {certificates.length > 0 && (
            <Section title={t("cvBuilder.section.certificates")}>
              <ul className="cv-preview__compact-list">
                {certificates.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.name}</strong>
                    {entry.issuer?.trim() && <span> · {entry.issuer}</span>}
                    {formatMonth(entry.date, lang) && <span className="cv-preview__date"> · {formatMonth(entry.date, lang)}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {languages.length > 0 && (
            <Section title={t("cvBuilder.languagesTitle")}>
              <ul className="cv-preview__compact-list">
                {languages.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.language}</strong> · {t(`cvBuilder.level.${entry.level}`)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {links.length > 0 && (
            <Section title={t("cvBuilder.linksTitle")}>
              <ul className="cv-preview__links">
                {links.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.label}</span>
                    <a href={safeHttpUrl(entry.url) ?? undefined} target="_blank" rel="noopener noreferrer">
                      {entry.url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </article>
      )}
    </div>
  );
}

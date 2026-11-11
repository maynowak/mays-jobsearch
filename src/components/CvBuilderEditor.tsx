import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n";
import { parseTargetRoles, formatTargetRoles } from "../lib/skills";
import {
  createCertificateEntry,
  createEducationEntry,
  createExperienceEntry,
  createLanguageEntry,
  createLinkEntry,
  createProjectEntry,
  hasCvBuilderContent,
  isCvBuilderEntryEmpty,
  type CvBuilderDraftV1,
  type CvBuilderLanguageLevel,
  type CvBuilderLinkKind,
} from "../lib/cvBuilder/contractTypes";
import {
  cvBuilderErrorsFor,
  validateCvBuilderDraft,
  type CvBuilderValidationError,
} from "../lib/cvBuilder/validation";
import { acquireBodyScrollLock, releaseBodyScrollLock } from "../lib/scrollLock";
import CvBuilderPreview from "./CvBuilderPreview";
import {
  CV_BUILDER_TEMPLATES,
  type CvBuilderTemplate,
} from "../lib/cvBuilder/templates";

interface Props {
  draft: CvBuilderDraftV1;
  onChange: (draft: CvBuilderDraftV1) => void;
  onClose: () => void;
  initialTemplate?: CvBuilderTemplate;
  onTemplateChange?: (template: CvBuilderTemplate) => void;
  onSave?: () => Promise<void> | void;
  dirty?: boolean;
  saved?: boolean;
  saving?: boolean;
  saveError?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function errorId(path: string): string {
  return `cv-builder-error-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function FieldError({ errors, path }: { errors: CvBuilderValidationError[]; path: string }) {
  const { t } = useLang();
  const matches = cvBuilderErrorsFor(errors, path);
  if (!matches.length) return null;
  return (
    <p id={errorId(path)} className="cv-builder-field-error" role="alert">
      {t(`cvBuilder.error.${matches[0].code}`)}
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  errors,
  path,
  maxLength,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors: CvBuilderValidationError[];
  path: string;
  maxLength: number;
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  placeholder?: string;
}) {
  const invalid = cvBuilderErrorsFor(errors, path).length > 0;
  const inputId = `cv-builder-field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="cv-builder-field-wrap">
      <label className="cv-builder-field" htmlFor={inputId}>
        <span>{label}</span>
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId(path) : undefined}
        />
      </label>
      <FieldError errors={errors} path={path} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  errors,
  path,
  maxLength,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors: CvBuilderValidationError[];
  path: string;
  maxLength: number;
  rows?: number;
  placeholder?: string;
}) {
  const invalid = cvBuilderErrorsFor(errors, path).length > 0;
  const inputId = `cv-builder-field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="cv-builder-field-wrap">
      <label className="cv-builder-field" htmlFor={inputId}>
        <span>{label}</span>
        <textarea
          id={inputId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={rows}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId(path) : undefined}
        />
      </label>
      <FieldError errors={errors} path={path} />
    </div>
  );
}

function MonthField({
  label,
  value,
  onChange,
  errors,
  path,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors: CvBuilderValidationError[];
  path: string;
  disabled?: boolean;
}) {
  const invalid = cvBuilderErrorsFor(errors, path).length > 0;
  const inputId = `cv-builder-field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="cv-builder-field-wrap">
      <label className="cv-builder-field" htmlFor={inputId}>
        <span>{label}</span>
        <input
          id={inputId}
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId(path) : undefined}
        />
      </label>
      <FieldError errors={errors} path={path} />
    </div>
  );
}

function LanguagesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useLang();
  const [text, setText] = useState(() => formatTargetRoles(value));
  return (
    <div className="cv-builder-field">
      <label>
        <span>{t("cvBuilder.skillsLabel")}</span>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseTargetRoles(event.target.value));
          }}
          rows={3}
          placeholder={t("cvBuilder.skillsPlaceholder")}
        />
      </label>
      <p className="cv-builder-hint">{t("cvBuilder.skillsHint")}</p>
    </div>
  );
}

function TechnologiesInput({
  value,
  onChange,
  errors,
  path,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  errors: CvBuilderValidationError[];
  path: string;
}) {
  const { t } = useLang();
  const [text, setText] = useState(() => formatTargetRoles(value));
  const inputId = `cv-builder-field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="cv-builder-field-wrap">
      <label className="cv-builder-field" htmlFor={inputId}>
        <span>{t("cvBuilder.projectTechnologies")}</span>
        <input
          id={inputId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseTargetRoles(event.target.value));
          }}
          maxLength={500}
          placeholder={t("cvBuilder.projectTechnologiesPlaceholder")}
          aria-invalid={cvBuilderErrorsFor(errors, path).length > 0}
          aria-describedby={cvBuilderErrorsFor(errors, path).length ? errorId(path) : undefined}
        />
      </label>
      <FieldError errors={errors} path={path} />
    </div>
  );
}

function EntryActions({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const removeTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
      return;
    }
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      removeTriggerRef.current?.focus();
    }
  }, [confirming]);

  return (
    <div className="cv-builder-entry-actions">
      {confirming ? (
        <div className="cv-builder-remove-confirm" role="alert">
          <span>{t("cvBuilder.removeConfirm")}</span>
          <button ref={confirmRef} type="button" className="btn-ghost cv-builder-remove-yes" onClick={onRemove}>
            {t("cvBuilder.removeYes")}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              restoreFocusRef.current = true;
              setConfirming(false);
            }}
          >
            {t("cvBuilder.cancel")}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn-ghost"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={t("cvBuilder.moveUp")}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={t("cvBuilder.moveDown")}
          >
            ↓
          </button>
          <button
            ref={removeTriggerRef}
            type="button"
            className="btn-ghost"
            onClick={() => setConfirming(true)}
          >
            {t("cvBuilder.remove")}
          </button>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  summaryText,
}: {
  title: string;
  children: React.ReactNode;
  summaryText: string;
}) {
  return (
    <details className="cv-builder-section">
      <summary>
        <span>{title}</span>
        <span className="cv-builder-section__meta">{summaryText}</span>
      </summary>
      <div className="cv-builder-section__body">{children}</div>
    </details>
  );
}

export default function CvBuilderEditor({
  draft,
  onChange,
  onClose,
  initialTemplate = "classic",
  onTemplateChange,
  onSave,
  dirty = false,
  saved = false,
  saving = false,
  saveError = "",
}: Props) {
  const { t, lang } = useLang();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const viewMountedRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const exportingRef = useRef(false);
  const addRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [focusAfterRemove, setFocusAfterRemove] = useState<string | null>(null);
  const [successDismissed, setSuccessDismissed] = useState(false);
  const savingRef = useRef(false);
  const [template, setTemplate] = useState<CvBuilderTemplate>(initialTemplate);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const errors = useMemo(() => validateCvBuilderDraft(draft), [draft]);
  const errorCount = errors.length;
  const entryCount =
    draft.experience.length +
    draft.education.length +
    draft.projects.length +
    draft.certificates.length +
    draft.languages.length +
    draft.links.length;

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    acquireBodyScrollLock();
    headingRef.current?.focus();
    return () => {
      releaseBodyScrollLock();
      previousFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!focusAfterRemove) return;
    addRefs.current[focusAfterRemove]?.focus();
    setFocusAfterRemove(null);
  }, [focusAfterRemove, draft]);

  useEffect(() => {
    if (!viewMountedRef.current) {
      viewMountedRef.current = true;
      return;
    }
    if (mobileView === "preview") previewHeadingRef.current?.focus();
    else editorPaneRef.current?.focus();
  }, [mobileView]);

  const requestClose = () => {
    if (dirty && onSave) {
      setCloseConfirm(true);
      return;
    }
    onClose();
  };

  const saveCurrent = async () => {
    if (!onSave || saving || savingRef.current) return;
    savingRef.current = true;
    try {
      await onSave();
    } catch {
      // The parent keeps the editor open and reports the conflict.
    } finally {
      savingRef.current = false;
    }
  };

  const saveAndClose = async () => {
    if (!onSave || saving || savingRef.current) return;
    savingRef.current = true;
    try {
      await onSave();
      setCloseConfirm(false);
      onClose();
    } catch {
      // The parent keeps the editor open and reports the conflict.
    } finally {
      savingRef.current = false;
    }
  };

  const selectTemplate = (next: CvBuilderTemplate) => {
    setTemplate(next);
    onTemplateChange?.(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (closeConfirm) setCloseConfirm(false);
        else requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, dirty, onSave, closeConfirm, saving]);

  useEffect(() => {
    if (dirty) setSuccessDismissed(false);
  }, [dirty]);

  const updatePersonal = (key: keyof CvBuilderDraftV1["personal"], value: string) => {
    onChange({ ...draft, personal: { ...draft.personal, [key]: value } });
  };
  const updateProfile = (key: keyof CvBuilderDraftV1["profile"], value: string) => {
    onChange({ ...draft, profile: { ...draft.profile, [key]: value } });
  };

  const move = <T,>(list: T[], index: number, direction: -1 | 1): T[] => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const removeAt = <T,>(list: T[], index: number): T[] =>
    list.filter((_, entryIndex) => entryIndex !== index);

  const handleExportPdf = async () => {
    if (exportingRef.current) return;
    setExportMessage("");
    setExportError("");
    if (errorCount > 0) {
      setExportError(t("cvBuilder.exportInvalid"));
      return;
    }
    if (!hasCvBuilderContent(draft)) {
      setExportError(t("cvBuilder.exportNoData"));
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    try {
      const pdfExport = await import("../lib/cvBuilder/pdfExport");
      const bytes = await pdfExport.createCvBuilderPdf(draft, template, { language: lang });
      pdfExport.downloadCvBuilderPdf(bytes, pdfExport.cvBuilderFileName(draft));
      setExportMessage(t("cvBuilder.exportSuccess"));
    } catch {
      setExportError(t("cvBuilder.exportError"));
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  const emptyLabel = (entry: Record<string, unknown>) =>
    isCvBuilderEntryEmpty(entry) ? <p className="cv-builder-empty-entry">{t("cvBuilder.emptyEntry")}</p> : null;

  return (
    <div
      className="modal cv-builder-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-box cv-builder-modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-builder-title"
      >
        <div className="modal-head cv-builder-modal__head">
          <div>
            <h3 ref={headingRef} id="cv-builder-title" tabIndex={-1}>
              {t("cvBuilder.title")}
            </h3>
            <p className="modal-sub">{t("cvBuilder.intro")}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label={t("cvBuilder.close")}
            onClick={requestClose}
          >
            ×
          </button>
        </div>

        <div className="cv-builder-notice" role="note">
          <strong>{t("cvBuilder.sessionNote")}</strong>
          <span>{t("cvBuilder.pdfNote")}</span>
        </div>

        {errorCount > 0 && (
          <p className="cv-builder-validation-summary" role="alert">
            {t("cvBuilder.validationSummary")}
          </p>
        )}
        <p className="cv-builder-counts" role="status">
          {t("cvBuilder.counts", { entries: entryCount, errors: errorCount })}
        </p>

        <div className="cv-builder-toolbar">
          <div className="cv-builder-view-switch" role="group" aria-label={t("cvBuilder.view.group")}>
            <button
              type="button"
              aria-pressed={mobileView === "edit"}
              className={mobileView === "edit" ? "active" : ""}
              onClick={() => setMobileView("edit")}
            >
              {t("cvBuilder.view.edit")}
            </button>
            <button
              type="button"
              aria-pressed={mobileView === "preview"}
              className={mobileView === "preview" ? "active" : ""}
              onClick={() => setMobileView("preview")}
            >
              {t("cvBuilder.view.preview")}
            </button>
          </div>
          <div className="cv-builder-template-switch" role="group" aria-label={t("cvBuilder.template.label")}>
            {CV_BUILDER_TEMPLATES.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={template === entry}
                className={template === entry ? "active" : ""}
                onClick={() => selectTemplate(entry)}
              >
                {t(`cvBuilder.template.${entry}`)}
              </button>
            ))}
          </div>
        </div>

        <nav className="cv-builder-nav" aria-label={t("cvBuilder.sections")}>
          {[
            ["personal", "cvBuilder.section.personal"],
            ["profile", "cvBuilder.section.profile"],
            ["experience", "cvBuilder.section.experience"],
            ["education", "cvBuilder.section.education"],
            ["skills", "cvBuilder.section.skills"],
            ["projects", "cvBuilder.section.projects"],
            ["certificates", "cvBuilder.section.certificates"],
            ["languages", "cvBuilder.section.languages"],
          ].map(([key, labelKey]) => (
            <a
              key={key}
              href={`#cv-builder-${key}`}
              onClick={(event) => {
                event.preventDefault();
                const section = document.getElementById(`cv-builder-${key}`);
                const details = section?.querySelector("details");
                if (details) details.open = true;
                setMobileView("edit");
                section?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              {t(labelKey)}
            </a>
          ))}
        </nav>

        <div className="cv-builder-workspace" data-view={mobileView}>
          <div
            ref={editorPaneRef}
            className="cv-builder-editor-pane"
            role="region"
            aria-label={t("cvBuilder.view.edit")}
            tabIndex={-1}
          >
            <div className="cv-builder-sections">
          <section id="cv-builder-personal">
            <Section
              title={t("cvBuilder.section.personal")}
              summaryText={draft.personal.fullName || t("cvBuilder.emptyEntry")}
            >
              <div className="cv-builder-grid">
                <TextField
                  label={t("cvBuilder.fullName")}
                  value={draft.personal.fullName ?? ""}
                  onChange={(value) => updatePersonal("fullName", value)}
                  errors={errors}
                  path="personal.fullName"
                  maxLength={200}
                  autoComplete="name"
                />
                <TextField
                  label={t("cvBuilder.email")}
                  value={draft.personal.email ?? ""}
                  onChange={(value) => updatePersonal("email", value)}
                  errors={errors}
                  path="personal.email"
                  maxLength={320}
                  type="email"
                  autoComplete="email"
                />
                <TextField
                  label={t("cvBuilder.phone")}
                  value={draft.personal.phone ?? ""}
                  onChange={(value) => updatePersonal("phone", value)}
                  errors={errors}
                  path="personal.phone"
                  maxLength={80}
                  type="tel"
                  autoComplete="tel"
                />
                <TextField
                  label={t("cvBuilder.location")}
                  value={draft.personal.location ?? ""}
                  onChange={(value) => updatePersonal("location", value)}
                  errors={errors}
                  path="personal.location"
                  maxLength={200}
                  autoComplete="address-level2"
                />
              </div>
            </Section>
          </section>

          <section id="cv-builder-profile">
            <Section
              title={t("cvBuilder.section.profile")}
              summaryText={draft.profile.headline || t("cvBuilder.emptyEntry")}
            >
              <div className="cv-builder-grid">
                <TextField
                  label={t("cvBuilder.headline")}
                  value={draft.profile.headline ?? ""}
                  onChange={(value) => updateProfile("headline", value)}
                  errors={errors}
                  path="profile.headline"
                  maxLength={200}
                />
                <TextAreaField
                  label={t("cvBuilder.summary")}
                  value={draft.profile.summary ?? ""}
                  onChange={(value) => updateProfile("summary", value)}
                  errors={errors}
                  path="profile.summary"
                  maxLength={4000}
                  rows={5}
                  placeholder={t("cvBuilder.summaryHint")}
                />
              </div>
            </Section>
          </section>

          <section id="cv-builder-experience">
            <Section
              title={t("cvBuilder.section.experience")}
              summaryText={`${draft.experience.length}`}
            >
              {draft.experience.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.experience.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <TextField
                      label={t("cvBuilder.position")}
                      value={entry.position}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === entry.id ? { ...item, position: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`experience.${index}.position`}
                      maxLength={200}
                    />
                    <TextField
                      label={t("cvBuilder.employer")}
                      value={entry.employer}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === entry.id ? { ...item, employer: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`experience.${index}.employer`}
                      maxLength={200}
                    />
                    <MonthField
                      label={t("cvBuilder.startMonth")}
                      value={entry.startMonth}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === entry.id ? { ...item, startMonth: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`experience.${index}.startMonth`}
                    />
                    <MonthField
                      label={t("cvBuilder.endMonth")}
                      value={entry.endMonth ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === entry.id ? { ...item, endMonth: value || undefined } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`experience.${index}.endMonth`}
                      disabled={entry.current}
                    />
                  </div>
                  <label className="cv-builder-checkbox">
                    <input
                      type="checkbox"
                      checked={entry.current}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === entry.id
                              ? { ...item, current: event.target.checked, endMonth: event.target.checked ? undefined : item.endMonth }
                              : item
                          ),
                        })
                      }
                    />
                    <span>{t("cvBuilder.current")}</span>
                  </label>
                  <TextAreaField
                    label={t("cvBuilder.description")}
                    value={entry.description ?? ""}
                    onChange={(value) =>
                      onChange({
                        ...draft,
                        experience: draft.experience.map((item) =>
                          item.id === entry.id ? { ...item, description: value } : item
                        ),
                      })
                    }
                    errors={errors}
                    path={`experience.${index}.description`}
                    maxLength={5000}
                    rows={4}
                  />
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.experience.length - 1}
                    onMoveUp={() => onChange({ ...draft, experience: move(draft.experience, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, experience: move(draft.experience, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, experience: removeAt(draft.experience, index) });
                      setFocusAfterRemove("experience");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.experience = element; }}
                onClick={() => onChange({ ...draft, experience: [...draft.experience, createExperienceEntry()] })}
              >
                + {t("cvBuilder.addExperience")}
              </button>
            </Section>
          </section>

          <section id="cv-builder-education">
            <Section title={t("cvBuilder.section.education")} summaryText={`${draft.education.length}`}>
              {draft.education.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.education.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <TextField
                      label={t("cvBuilder.institution")}
                      value={entry.institution}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          education: draft.education.map((item) =>
                            item.id === entry.id ? { ...item, institution: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`education.${index}.institution`}
                      maxLength={200}
                    />
                    <TextField
                      label={t("cvBuilder.degree")}
                      value={entry.degree}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          education: draft.education.map((item) =>
                            item.id === entry.id ? { ...item, degree: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`education.${index}.degree`}
                      maxLength={200}
                    />
                    <MonthField
                      label={t("cvBuilder.startMonth")}
                      value={entry.startMonth}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          education: draft.education.map((item) =>
                            item.id === entry.id ? { ...item, startMonth: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`education.${index}.startMonth`}
                    />
                    <MonthField
                      label={t("cvBuilder.endMonth")}
                      value={entry.endMonth ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          education: draft.education.map((item) =>
                            item.id === entry.id ? { ...item, endMonth: value || undefined } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`education.${index}.endMonth`}
                      disabled={entry.current}
                    />
                  </div>
                  <label className="cv-builder-checkbox">
                    <input
                      type="checkbox"
                      checked={entry.current}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          education: draft.education.map((item) =>
                            item.id === entry.id
                              ? { ...item, current: event.target.checked, endMonth: event.target.checked ? undefined : item.endMonth }
                              : item
                          ),
                        })
                      }
                    />
                    <span>{t("cvBuilder.current")}</span>
                  </label>
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.education.length - 1}
                    onMoveUp={() => onChange({ ...draft, education: move(draft.education, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, education: move(draft.education, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, education: removeAt(draft.education, index) });
                      setFocusAfterRemove("education");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.education = element; }}
                onClick={() => onChange({ ...draft, education: [...draft.education, createEducationEntry()] })}
              >
                + {t("cvBuilder.addEducation")}
              </button>
            </Section>
          </section>

          <section id="cv-builder-skills">
            <Section title={t("cvBuilder.section.skills")} summaryText={`${draft.skills.length}`}>
              <LanguagesInput value={draft.skills} onChange={(skills) => onChange({ ...draft, skills })} />
              {draft.skills.length > 0 && (
                <ul className="cv-builder-tags">
                  {draft.skills.map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              )}
            </Section>
          </section>

          <section id="cv-builder-projects">
            <Section title={t("cvBuilder.section.projects")} summaryText={`${draft.projects.length}`}>
              {draft.projects.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.projects.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <TextField
                      label={t("cvBuilder.projectName")}
                      value={entry.name}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          projects: draft.projects.map((item) =>
                            item.id === entry.id ? { ...item, name: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`projects.${index}.name`}
                      maxLength={200}
                    />
                    <TechnologiesInput
                      value={entry.technologies}
                      onChange={(technologies) =>
                        onChange({
                          ...draft,
                          projects: draft.projects.map((item) =>
                            item.id === entry.id ? { ...item, technologies } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`projects.${index}.technologies`}
                    />
                  </div>
                  <TextAreaField
                    label={t("cvBuilder.description")}
                    value={entry.description ?? ""}
                    onChange={(value) =>
                      onChange({
                        ...draft,
                        projects: draft.projects.map((item) =>
                          item.id === entry.id ? { ...item, description: value } : item
                        ),
                      })
                    }
                    errors={errors}
                    path={`projects.${index}.description`}
                    maxLength={3000}
                    rows={3}
                  />
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.projects.length - 1}
                    onMoveUp={() => onChange({ ...draft, projects: move(draft.projects, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, projects: move(draft.projects, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, projects: removeAt(draft.projects, index) });
                      setFocusAfterRemove("projects");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.projects = element; }}
                onClick={() => onChange({ ...draft, projects: [...draft.projects, createProjectEntry()] })}
              >
                + {t("cvBuilder.addProject")}
              </button>
            </Section>
          </section>

          <section id="cv-builder-certificates">
            <Section title={t("cvBuilder.section.certificates")} summaryText={`${draft.certificates.length}`}>
              {draft.certificates.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.certificates.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <TextField
                      label={t("cvBuilder.certificateName")}
                      value={entry.name}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          certificates: draft.certificates.map((item) =>
                            item.id === entry.id ? { ...item, name: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`certificates.${index}.name`}
                      maxLength={200}
                    />
                    <TextField
                      label={t("cvBuilder.certificateIssuer")}
                      value={entry.issuer ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          certificates: draft.certificates.map((item) =>
                            item.id === entry.id ? { ...item, issuer: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`certificates.${index}.issuer`}
                      maxLength={200}
                    />
                    <MonthField
                      label={t("cvBuilder.certificateDate")}
                      value={entry.date ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          certificates: draft.certificates.map((item) =>
                            item.id === entry.id ? { ...item, date: value || undefined } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`certificates.${index}.date`}
                    />
                  </div>
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.certificates.length - 1}
                    onMoveUp={() => onChange({ ...draft, certificates: move(draft.certificates, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, certificates: move(draft.certificates, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, certificates: removeAt(draft.certificates, index) });
                      setFocusAfterRemove("certificates");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.certificates = element; }}
                onClick={() => onChange({ ...draft, certificates: [...draft.certificates, createCertificateEntry()] })}
              >
                + {t("cvBuilder.addCertificate")}
              </button>
            </Section>
          </section>

          <section id="cv-builder-languages">
            <Section title={t("cvBuilder.section.languages")} summaryText={`${draft.languages.length + draft.links.length}`}>
              <h4>{t("cvBuilder.languagesTitle")}</h4>
              {draft.languages.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.languages.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <TextField
                      label={t("cvBuilder.language")}
                      value={entry.language}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          languages: draft.languages.map((item) =>
                            item.id === entry.id ? { ...item, language: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`languages.${index}.language`}
                      maxLength={100}
                    />
                    <label className="cv-builder-field">
                      <span>{t("cvBuilder.languageLevel")}</span>
                      <select
                        value={entry.level}
                        onChange={(event) =>
                          onChange({
                            ...draft,
                            languages: draft.languages.map((item) =>
                              item.id === entry.id
                                ? { ...item, level: event.target.value as CvBuilderLanguageLevel }
                                : item
                            ),
                          })
                        }
                      >
                        {(["basic", "conversational", "professional", "fluent", "native"] as const).map((level) => (
                          <option key={level} value={level}>{t(`cvBuilder.level.${level}`)}</option>
                        ))}
                      </select>
                      <FieldError errors={errors} path={`languages.${index}.level`} />
                    </label>
                  </div>
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.languages.length - 1}
                    onMoveUp={() => onChange({ ...draft, languages: move(draft.languages, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, languages: move(draft.languages, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, languages: removeAt(draft.languages, index) });
                      setFocusAfterRemove("languages");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.languages = element; }}
                onClick={() => onChange({ ...draft, languages: [...draft.languages, createLanguageEntry()] })}
              >
                + {t("cvBuilder.addLanguage")}
              </button>

              <h4>{t("cvBuilder.linksTitle")}</h4>
              {draft.links.length === 0 ? <p className="cv-builder-empty">{t("cvBuilder.noEntries")}</p> : null}
              {draft.links.map((entry, index) => (
                <fieldset className="cv-builder-entry" key={entry.id}>
                  <legend>{t("cvBuilder.entryNumber", { number: index + 1 })}</legend>
                  {emptyLabel(entry as unknown as Record<string, unknown>)}
                  <div className="cv-builder-grid">
                    <label className="cv-builder-field">
                      <span>{t("cvBuilder.linkKind")}</span>
                      <select
                        value={entry.kind}
                        onChange={(event) =>
                          onChange({
                            ...draft,
                            links: draft.links.map((item) =>
                              item.id === entry.id
                                ? { ...item, kind: event.target.value as CvBuilderLinkKind }
                                : item
                            ),
                          })
                        }
                      >
                        {(["portfolio", "github", "linkedin", "other"] as const).map((kind) => (
                          <option key={kind} value={kind}>{t(`cvBuilder.linkKind.${kind}`)}</option>
                        ))}
                      </select>
                    </label>
                    <TextField
                      label={t("cvBuilder.linkLabel")}
                      value={entry.label}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          links: draft.links.map((item) =>
                            item.id === entry.id ? { ...item, label: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`links.${index}.label`}
                      maxLength={200}
                    />
                    <TextField
                      label={t("cvBuilder.linkUrl")}
                      value={entry.url}
                      onChange={(value) =>
                        onChange({
                          ...draft,
                          links: draft.links.map((item) =>
                            item.id === entry.id ? { ...item, url: value } : item
                          ),
                        })
                      }
                      errors={errors}
                      path={`links.${index}.url`}
                      maxLength={1000}
                      type="url"
                    />
                  </div>
                  <EntryActions
                    canMoveUp={index > 0}
                    canMoveDown={index < draft.links.length - 1}
                    onMoveUp={() => onChange({ ...draft, links: move(draft.links, index, -1) })}
                    onMoveDown={() => onChange({ ...draft, links: move(draft.links, index, 1) })}
                    onRemove={() => {
                      onChange({ ...draft, links: removeAt(draft.links, index) });
                      setFocusAfterRemove("links");
                    }}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn-ghost"
                ref={(element) => { addRefs.current.links = element; }}
                onClick={() => onChange({ ...draft, links: [...draft.links, createLinkEntry()] })}
              >
                + {t("cvBuilder.addLink")}
              </button>
            </Section>
          </section>
        </div>
          </div>

          <div
            className="cv-builder-preview-pane"
            role="region"
            aria-label={t("cvBuilder.preview.aria")}
          >
            <h4 ref={previewHeadingRef} tabIndex={-1}>
              {t("cvBuilder.preview.title")}
            </h4>
            <CvBuilderPreview draft={draft} template={template} />
          </div>
        </div>

        <div className="cv-builder-footer">
          <div className={`cv-builder-save-status${saveError ? " is-error" : ""}`} role="status" aria-live="polite">
            <span>
              {saving
                ? t("cvBuilder.status.saving")
                : saveError
                  ? t("cvBuilder.status.error")
                  : dirty
                    ? saved
                      ? t("cvBuilder.status.unsaved")
                      : t("cvBuilder.status.notSaved")
                    : saved
                      ? t("cvBuilder.status.saved")
                      : t("cvBuilder.status.notSaved")}
            </span>
            {saved && !dirty && !saving && !saveError && !successDismissed && (
              <strong>{t("cvBuilder.saveSuccess")}</strong>
            )}
          </div>
          {saved && !dirty && !saving && !saveError && !successDismissed && (
            <div className="cv-builder-save-success" role="status">
              <p>{t("cvBuilder.saveSuccess")}</p>
              <div className="cv-builder-footer__actions">
                <button type="button" className="btn-ghost" onClick={onClose}>
                  {t("cvBuilder.toCvOverview")}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setSuccessDismissed(true)}>
                  {t("cvBuilder.continueEditing")}
                </button>
                <button
                  type="button"
                  className="letter-btn"
                  onClick={() => void handleExportPdf()}
                  disabled={exporting || errorCount > 0 || !hasCvBuilderContent(draft)}
                >
                  {t("cvBuilder.exportPdf")}
                </button>
              </div>
            </div>
          )}
          <p className="cv-builder-hint">{t("cvBuilder.sectionHint")}</p>
          <div className="cv-builder-footer__actions">
            {onSave && (
              <button
                type="button"
                className="letter-btn"
                onClick={() => void saveCurrent()}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? t("cvBuilder.saving") : t("cvBuilder.save")}
              </button>
            )}
            <button
              type="button"
              className="letter-btn cv-builder-export"
              onClick={() => void handleExportPdf()}
              disabled={exporting || errorCount > 0 || !hasCvBuilderContent(draft)}
              aria-busy={exporting}
            >
              {exporting ? t("cvBuilder.exporting") : t("cvBuilder.exportPdf")}
            </button>
            <button type="button" className="btn-ghost" onClick={requestClose}>
              {t("cvBuilder.closeFooter")}
            </button>
          </div>
          {saveError && <p className="letter-review-warning" role="alert">{saveError}</p>}
          {exportMessage && <p className="letter-review-success" role="status">{exportMessage}</p>}
          {exportError && <p className="letter-review-warning" role="alert">{exportError}</p>}
          {closeConfirm && (
            <div className="cv-builder-unsaved" role="alertdialog" aria-label={t("cvBuilder.unsavedTitle")}>
              <h4>{t("cvBuilder.unsavedTitle")}</h4>
              <p>{t("cvBuilder.unsavedText")}</p>
              <div className="cv-builder-footer__actions">
                <button type="button" className="letter-btn" onClick={() => void saveAndClose()} disabled={saving}>
                  {saving ? t("cvBuilder.saving") : t("cvBuilder.saveAndClose")}
                </button>
                <button type="button" className="btn-ghost" onClick={onClose}>
                  {t("cvBuilder.discardAndClose")}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setCloseConfirm(false)}>
                  {t("cvBuilder.keepEditing")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

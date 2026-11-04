import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n";
import type { ModelOption } from "../types";
import { ApplicationRepositoryError } from "../lib/applications/repositoryTypes";
import {
  ApiError,
  generateCoverLetter,
  isFreeQuotaExceeded,
  isModelUnavailable,
  withModelFallback,
} from "../api";
import { anonymizeText } from "../lib/anonymize";
import { diffText } from "../lib/textDiff";
import {
  MAX_REVISION_DRAFT_LENGTH,
  MAX_REVISION_FEEDBACK_LENGTH,
  type CoverLetterLanguage,
  type CoverLetterLength,
  type CoverLetterStyle,
} from "../lib/coverLetterRequest";
import type {
  CoverLetterVersionV1,
} from "../lib/applications/contractTypes";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";

interface Props {
  application: SessionApplicationV1;
  models?: ModelOption[];
  defaultModel?: string | null;
  recommendedModel?: string | null;
  busy?: boolean;
  onSaveVersion?: (version: CoverLetterVersionV1) => Promise<SessionApplicationV1>;
  onAdoptDraft?: (content: string) => Promise<SessionApplicationV1>;
  onDirtyChange?: (dirty: boolean) => void;
  onNavigateToOverview?: () => void;
  onShowApplicationList?: () => void;
  onOpenDraft?: () => void;
}

interface Improvement {
  applicationId: string;
  sourceId: Selection;
  sourceLabel: string;
  sourceText: string;
  suggestion: string;
  model: string | null;
  receivedAt: string;
  usedFallback: boolean;
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

function localVersionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `letter-${crypto.randomUUID()}`;
  }
  return `letter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function actionErrorLabel(t: (key: string) => string, err: unknown): string {
  if (err instanceof ApplicationRepositoryError) return t(`applications.error.${err.code}`);
  return t("letter.improve.error");
}

export default function ApplicationLetterComparison({
  application,
  models = [],
  defaultModel = null,
  recommendedModel = null,
  busy = false,
  onSaveVersion,
  onAdoptDraft,
  onDirtyChange,
  onNavigateToOverview,
  onShowApplicationList,
  onOpenDraft,
}: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const selectFromId = useId();
  const selectToId = useId();
  const versions = application.documents.coverLetterVersions;
  const latestVersionId = versions.at(-1)?.versionId ?? "current";
  const [fromId, setFromId] = useState<Selection>("current");
  const [toId, setToId] = useState<Selection>(latestVersionId);
  const [model, setModel] = useState<string>(defaultModel ?? models[0]?.id ?? "");
  const [letterLanguage, setLetterLanguage] = useState<CoverLetterLanguage>(() =>
    lang === "de" ? "German" : "English"
  );
  const [letterStyle, setLetterStyle] = useState<CoverLetterStyle>("professional");
  const [letterLength, setLetterLength] = useState<CoverLetterLength>("one_page");
  const [feedback, setFeedback] = useState("");
  const [consent, setConsent] = useState(false);
  const [improvement, setImprovement] = useState<Improvement | null>(null);
  const [improveError, setImproveError] = useState("");
  const [improving, setImproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [adoptConfirm, setAdoptConfirm] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [savedVersionNumber, setSavedVersionNumber] = useState<number | null>(null);
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<"saved" | "adopted" | null>(null);
  const requestSeqRef = useRef(0);
  const actionSeqRef = useRef(0);
  const savingRef = useRef(false);
  const adoptingRef = useRef(false);
  const suggestionRef = useRef<HTMLTextAreaElement>(null);
  const improveButtonRef = useRef<HTMLButtonElement>(null);
  const restoreImproveFocusRef = useRef(false);
  const actionStatusRef = useRef<HTMLParagraphElement>(null);
  const adoptConfirmRef = useRef<HTMLButtonElement>(null);
  const adoptTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreAdoptFocusRef = useRef(false);
  const comparisonRef = useRef<HTMLElement>(null);
  const toSelectRef = useRef<HTMLSelectElement>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const appIdRef = useRef(application.localId);

  useEffect(() => {
    setFromId("current");
    setToId(latestVersionId);
    appIdRef.current = application.localId;
    requestSeqRef.current += 1;
    actionSeqRef.current += 1;
    inFlightRef.current = false;
    savingRef.current = false;
    adoptingRef.current = false;
    setImproving(false);
    setImprovement(null);
    setImproveError("");
    setFeedback("");
    setLetterLanguage(lang === "de" ? "German" : "English");
    setLetterStyle("professional");
    setLetterLength("one_page");
    setConsent(false);
    setSaving(false);
    setAdopting(false);
    setActionMessage("");
    setActionError("");
    setAdoptConfirm(null);
    setSavedContent(null);
    setSavedVersionNumber(null);
    setSavedVersionId(null);
    setSuccessAction(null);
  }, [application.localId]);

  useEffect(() => {
    const preferred = defaultModel && models.some((entry) => entry.id === defaultModel)
      ? defaultModel
      : models[0]?.id ?? "";
    setModel((current) =>
      models.some((entry) => entry.id === current) ? current : preferred
    );
  }, [defaultModel, models]);

  useEffect(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setImproving(false);
    setImprovement(null);
    setImproveError("");
    setConsent(false);
    setActionMessage("");
    setActionError("");
    setAdoptConfirm(null);
    setSavedContent(null);
    setSavedVersionNumber(null);
    setSavedVersionId(null);
    setSuccessAction(null);
  }, [fromId]);

  useEffect(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setImproving(false);
    setImprovement(null);
    setImproveError("");
    setConsent(false);
    setActionMessage("");
    setActionError("");
    setSavedContent(null);
    setSavedVersionNumber(null);
    setSavedVersionId(null);
    setSuccessAction(null);
  }, [model]);

  useEffect(() => {
    if (fromId === "current") return;
    const source = versions.find((version) => version.versionId === fromId);
    if (source?.language === "de") setLetterLanguage("German");
    else if (source?.language === "en") setLetterLanguage("English");
  }, [fromId, versions]);

  useEffect(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setImproving(false);
    setImprovement(null);
    setImproveError("");
    setConsent(false);
    setActionMessage("");
    setActionError("");
    setSavedContent(null);
    setSavedVersionNumber(null);
    setSavedVersionId(null);
    setSuccessAction(null);
  }, [letterLanguage, letterLength, letterStyle]);

  useEffect(() => {
    if (fromId !== "current" && !versions.some((version) => version.versionId === fromId)) {
      setFromId("current");
    }
    if (toId !== "current" && !versions.some((version) => version.versionId === toId)) {
      setToId(latestVersionId);
    }
  }, [fromId, latestVersionId, toId, versions]);

  const previousLatestVersionRef = useRef(latestVersionId);
  useEffect(() => {
    const previousLatest = previousLatestVersionRef.current;
    previousLatestVersionRef.current = latestVersionId;
    if (previousLatest === latestVersionId) return;
    if (fromId === "current") {
      setToId(latestVersionId);
    }
  }, [fromId, latestVersionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
      actionSeqRef.current += 1;
    };
  }, []);

  const proposalSaved = Boolean(
    improvement &&
    savedContent !== null &&
    savedContent === improvement.suggestion.trim()
  );
  const proposalDirty = Boolean(improvement) && !proposalSaved;

  useEffect(() => {
    onDirtyChange?.(proposalDirty);
  }, [onDirtyChange, proposalDirty]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (adoptConfirm) {
      adoptConfirmRef.current?.focus();
      return;
    }
    if (restoreAdoptFocusRef.current) {
      restoreAdoptFocusRef.current = false;
      adoptTriggerRef.current?.focus();
    }
  }, [adoptConfirm]);

  useEffect(() => {
    if (actionMessage) actionStatusRef.current?.focus();
  }, [actionMessage]);

  useEffect(() => {
    if (improvement || !restoreImproveFocusRef.current) return;
    restoreImproveFocusRef.current = false;
    improveButtonRef.current?.focus();
  }, [improvement]);

  const handleSaveVersion = async () => {
    if (!improvement || !onSaveVersion || savingRef.current || adoptingRef.current || improving || busy) return;
    const content = improvement.suggestion.trim();
    if (!content) {
      setActionError(t("letter.improve.empty"));
      return;
    }
    if (content.length > 50_000) {
      setActionError(t("letter.improve.saveTooLong"));
      return;
    }
    const requestAppId = appIdRef.current;
    const requestSeq = actionSeqRef.current;
    savingRef.current = true;
    setSaving(true);
    setActionError("");
    setActionMessage("");
    setSuccessAction(null);
    setSavedVersionId(null);
    const nextVersion: CoverLetterVersionV1 = {
      versionId: localVersionId(),
      jobId: application.job.jobId,
      createdAt: new Date().toISOString(),
      content,
      source: "revised",
      language: letterLanguage === "German" ? "de" : "en",
      ...(improvement.model ? { model: improvement.model } : {}),
    };
    try {
      const updated = await onSaveVersion(nextVersion);
      if (
        !mountedRef.current ||
        actionSeqRef.current !== requestSeq ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      const number = updated.documents.coverLetterVersions.length;
      setSavedContent(content);
      setSavedVersionNumber(number);
      setSavedVersionId(nextVersion.versionId);
      setSuccessAction("saved");
      setActionMessage(t("letter.improve.saved", { number }));
      setToId(updated.documents.coverLetterVersions.at(-1)?.versionId ?? "current");
    } catch (err) {
      if (
        !mountedRef.current ||
        actionSeqRef.current !== requestSeq ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      setActionError(actionErrorLabel(t, err));
    } finally {
      if (actionSeqRef.current === requestSeq) {
        savingRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
    }
  };

  const handleAdoptDraft = async (versionId: string) => {
    if (!onAdoptDraft || adoptingRef.current || savingRef.current || improving || busy) return;
    const version = versions.find((entry) => entry.versionId === versionId);
    if (!version) return;
    const requestAppId = appIdRef.current;
    const requestSeq = actionSeqRef.current;
    adoptingRef.current = true;
    setAdopting(true);
    setActionError("");
    setActionMessage("");
    setSuccessAction(null);
    setSavedVersionId(null);
    try {
      await onAdoptDraft(version.content);
      if (
        !mountedRef.current ||
        actionSeqRef.current !== requestSeq ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      setActionMessage(t("letter.improve.adopted"));
      setSuccessAction("adopted");
      restoreAdoptFocusRef.current = false;
      setAdoptConfirm(null);
    } catch (err) {
      if (
        !mountedRef.current ||
        actionSeqRef.current !== requestSeq ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      setActionError(actionErrorLabel(t, err));
    } finally {
      if (actionSeqRef.current === requestSeq) {
        adoptingRef.current = false;
        if (mountedRef.current) setAdopting(false);
      }
    }
  };

  const draftNotSaved = !versions.some(
    (version) => version.content === application.documents.coverLetterDraft
  );

  const handleToChange = (value: Selection) => {
    if (adoptConfirm) restoreAdoptFocusRef.current = true;
    setToId(value);
    setAdoptConfirm(null);
    setActionError("");
    setActionMessage("");
  };

  const suggestionDiff = useMemo(
    () => (improvement ? diffText(improvement.sourceText, improvement.suggestion) : null),
    [improvement]
  );

  useEffect(() => {
    if (!improvement) return;
    const editor = suggestionRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [improvement]);

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

  const resolvedFrom = resolve(fromId);

  const improvementError = (err: unknown): string => {
    if (isFreeQuotaExceeded(err)) return t("model.quotaExceeded");
    if (isModelUnavailable(err)) return t("model.unavailable");
    if (err instanceof ApiError && err.code === "bad_ai_response") return t("letter.improve.empty");
    return t("letter.improve.error");
  };

  const handleImprove = async () => {
    if (busy || inFlightRef.current || improving) return;
    if (!resolvedFrom.content.trim()) {
      setImproveError(t("letter.improve.emptySource"));
      return;
    }
    if (resolvedFrom.content.length > MAX_REVISION_DRAFT_LENGTH) {
      setImproveError(t("letter.improve.tooLong"));
      return;
    }
    if (!model) {
      setImproveError(t("letter.improve.noModels"));
      return;
    }
    if (!consent) {
      setImproveError(t("letter.improve.error"));
      return;
    }

    const source = resolvedFrom;
    const requestAppId = appIdRef.current;
    const requestSourceId = fromId;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    inFlightRef.current = true;
    setImproving(true);
    setImproveError("");
    setSuccessAction(null);
    setSavedVersionId(null);

    const request = {
      job: {
        title: application.job.title,
        company_name: application.job.companyName,
        location: application.job.location,
        url: application.job.originalUrl ?? "",
        source: application.job.source,
        tags: [],
        description: "",
        description_origin: "original" as const,
      },
      candidate: {
        mode: "manual" as const,
        skills: [],
        experience: "",
        qualifications: "",
        motivation: "",
      },
      options: {
        language: letterLanguage,
        style: letterStyle,
        length: letterLength,
        target_roles: [],
        model,
      },
      operation: "revise" as const,
      revision: {
        draft_text: anonymizeText(source.content),
        draft_anonymized: true,
        ...(feedback.trim() ? { feedback: anonymizeText(feedback.trim()) } : {}),
      },
    };

    try {
      const result = await withModelFallback({
        initialModel: model,
        availableModels: models.map((entry) => entry.id),
        recommendedModel,
        request: (selectedModel, attempt) =>
          generateCoverLetter(
            { ...request, options: { ...request.options, model: selectedModel } },
            attempt
          ),
      });
      if (
        !mountedRef.current ||
        requestSeqRef.current !== requestId ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      const suggestion = String(result.data.letter ?? "").trim();
      if (!suggestion) {
        if (
          !mountedRef.current ||
          requestSeqRef.current !== requestId ||
          appIdRef.current !== requestAppId
        ) {
          return;
        }
        setImproveError(t("letter.improve.empty"));
        return;
      }
      setImprovement({
        applicationId: requestAppId,
        sourceId: requestSourceId,
        sourceLabel: source.label,
        sourceText: source.content,
        suggestion,
        model: result.attempts.find((attempt) => attempt.ok)?.model ?? model,
        receivedAt: new Date().toISOString(),
        usedFallback: result.usedFallback,
      });
      setSavedContent(null);
      setSavedVersionNumber(null);
    } catch (err) {
      if (
        !mountedRef.current ||
        requestSeqRef.current !== requestId ||
        appIdRef.current !== requestAppId
      ) {
        return;
      }
      setImproveError(improvementError(err));
    } finally {
      if (requestSeqRef.current === requestId) {
        inFlightRef.current = false;
        setImproving(false);
      }
    }
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
        {side === "to" && resolved.version && onAdoptDraft && (
          <div className="applications-letter-comparison__adopt">
            {adoptConfirm === resolved.version.versionId ? (
              <div className="applications-confirm" role="alert">
                <p>
                  {t("letter.improve.adoptConfirm")}
                  {draftNotSaved ? ` ${t("letter.improve.draftNotSaved")}` : ""}
                </p>
                <button
                  ref={adoptConfirmRef}
                  type="button"
                  className="letter-btn"
                  onClick={() => void handleAdoptDraft(resolved.version!.versionId)}
                  disabled={improving || adopting || saving || busy}
                >
                  {t("letter.improve.adoptConfirmYes")}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    restoreAdoptFocusRef.current = true;
                    setAdoptConfirm(null);
                  }}
                  disabled={adopting || saving || busy}
                >
                  {t("applications.cancel")}
                </button>
              </div>
            ) : (
              <button
                ref={adoptTriggerRef}
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setAdoptConfirm(resolved.version!.versionId);
                  setActionError("");
                  setActionMessage("");
                }}
                disabled={improving || adopting || saving || busy}
              >
                {t("letter.improve.adoptDraft")}
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <section ref={comparisonRef} className="applications-letter-comparison" aria-labelledby="applications-letter-comparison-title">
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
                disabled={improving || saving || adopting || busy}
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
                ref={toSelectRef}
                id={selectToId}
                value={toId}
                onChange={(event) => handleToChange(event.target.value)}
                disabled={improving || saving || adopting || busy}
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

      <section className="applications-letter-improvement" aria-labelledby="applications-letter-improvement-title">
        <h4 id="applications-letter-improvement-title">{t("letter.improve.title")}</h4>
        <p className="applications-letter-improvement__source">
          <strong>{t("letter.improve.source")}:</strong> {resolvedFrom.label}
        </p>
        <div className="applications-letter-improvement__options">
          <label className="letter-field">
            <span>{t("letter.improve.language")}</span>
            <select
              value={letterLanguage}
              onChange={(event) => setLetterLanguage(event.target.value as CoverLetterLanguage)}
              disabled={improving || saving || adopting || busy}
            >
              <option value="German">{t("letter.improve.language.german")}</option>
              <option value="English">{t("letter.improve.language.english")}</option>
            </select>
          </label>
          <label className="letter-field">
            <span>{t("letter.improve.style")}</span>
            <select
              value={letterStyle}
              onChange={(event) => setLetterStyle(event.target.value as CoverLetterStyle)}
              disabled={improving || saving || adopting || busy}
            >
              <option value="professional">{t("letter.improve.style.professional")}</option>
              <option value="warm">{t("letter.improve.style.warm")}</option>
              <option value="concise">{t("letter.improve.style.concise")}</option>
              <option value="formal">{t("letter.improve.style.formal")}</option>
            </select>
          </label>
          <label className="letter-field">
            <span>{t("letter.improve.length")}</span>
            <select
              value={letterLength}
              onChange={(event) => setLetterLength(event.target.value as CoverLetterLength)}
              disabled={improving || saving || adopting || busy}
            >
              <option value="short">{t("letter.improve.length.short")}</option>
              <option value="one_page">{t("letter.improve.length.one_page")}</option>
              <option value="detailed">{t("letter.improve.length.detailed")}</option>
            </select>
          </label>
          {models.length > 0 && (
            <label className="letter-field">
              <span>{t("letter.improve.model")}</span>
              <select value={model} onChange={(event) => setModel(event.target.value)} disabled={improving || saving || adopting || busy}>
                {models.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {models.length === 0 && <p className="letter-hint">{t("letter.improve.noModels")}</p>}
        <label className="letter-field">
          <span>{t("letter.improve.feedback")}</span>
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={3}
            maxLength={MAX_REVISION_FEEDBACK_LENGTH}
            placeholder={t("letter.improve.feedbackPlaceholder")}
            disabled={improving || saving || adopting || busy}
          />
        </label>
        <p className="letter-hint applications-letter-improvement__privacy">{t("letter.improve.privacy")}</p>
        <label className="applications-letter-improvement__consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={improving || saving || adopting || busy}
          />
          <span>{t("letter.improve.consent")}</span>
        </label>
        <div className="applications-letter-improvement__actions">
          <button
            ref={improveButtonRef}
            type="button"
            className="letter-btn"
            onClick={() => void handleImprove()}
            disabled={improving || busy || !consent || !model || !resolvedFrom.content.trim()}
          >
            {improving ? t("letter.improve.improving") : t("letter.improve.action")}
          </button>
        </div>
        {!resolvedFrom.content.trim() && <p className="letter-hint">{t("letter.improve.emptySource")}</p>}
        {improveError && <p className="letter-review-warning" role="alert">{improveError}</p>}
        {improvement && (
          <section className="applications-letter-improvement__preview" aria-labelledby="applications-letter-improvement-preview-title">
            <h5 id="applications-letter-improvement-preview-title">{t("letter.improve.suggestion")}</h5>
            <p className="letter-hint">
              {proposalSaved && savedVersionNumber
                ? t("letter.improve.savedHint", { number: savedVersionNumber })
                : t("letter.improve.notSaved")}
              {improvement.model ? ` · ${improvement.model}` : ""}
            </p>
            {improvement.usedFallback && <p className="letter-hint">{t("model.fallbackNote")}</p>}
            <div className="applications-letter-comparison__panels">
              <section className="applications-letter-comparison__panel" aria-labelledby={`${selectFromId}-improvement-original`}>
                <h4 id={`${selectFromId}-improvement-original`}>{improvement.sourceLabel}</h4>
                <pre className="applications-letter-comparison__text">{improvement.sourceText}</pre>
              </section>
              <section className="applications-letter-comparison__panel" aria-labelledby={`${selectFromId}-improvement-suggestion`}>
                <h4 id={`${selectFromId}-improvement-suggestion`}>{t("letter.improve.suggestion")}</h4>
                <label className="letter-field">
                  <span>{t("letter.improve.editLabel")}</span>
                  <textarea
                    ref={suggestionRef}
                    className="applications-letter-improvement__editor"
                    value={improvement.suggestion}
                    onChange={(event) =>
                      setImprovement((current) =>
                        current ? { ...current, suggestion: event.target.value } : current
                      )
                    }
                    aria-label={t("letter.improve.editLabel")}
                    disabled={saving || adopting || busy}
                  />
                </label>
              </section>
            </div>
            {suggestionDiff && (
              <section className="applications-letter-improvement__diff" aria-labelledby={`${selectFromId}-improvement-diff`}>
                <h5 id={`${selectFromId}-improvement-diff`}>{t("letter.improve.changes")}</h5>
                <p className="applications-letter-improvement__diff-summary">
                  {suggestionDiff.changeGroups === 0
                    ? t("letter.improve.noChanges")
                    : [
                        t("letter.improve.kept", { count: suggestionDiff.kept }),
                        t("letter.improve.added", { count: suggestionDiff.added }),
                        t("letter.improve.removed", { count: suggestionDiff.removed }),
                        t("letter.improve.changeGroups", { count: suggestionDiff.changeGroups }),
                      ].join(" · ")}
                </p>
                {suggestionDiff.truncated && (
                  <p className="letter-hint">{t("letter.improve.diffTruncated")}</p>
                )}
                <div
                  className="applications-letter-improvement__diff-text"
                  aria-label={t("letter.improve.diffAria")}
                >
                  {suggestionDiff.segments.map((segment, index) =>
                    segment.type === "removed" ? (
                      <del key={index}>{segment.text}</del>
                    ) : segment.type === "added" ? (
                      <ins key={index}>{segment.text}</ins>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    )
                  )}
                </div>
              </section>
            )}
            <div className="applications-letter-improvement__actions">
              <button type="button" className="btn-ghost" onClick={() => void handleImprove()} disabled={improving || busy}>
                {t("letter.improve.again")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  restoreImproveFocusRef.current = true;
                  setImprovement(null);
                  setImproveError("");
                  setActionMessage("");
                  setActionError("");
                  setSavedContent(null);
                  setSavedVersionNumber(null);
                }}
                disabled={improving || saving || adopting || busy}
              >
                {t("letter.improve.discard")}
              </button>
              {onSaveVersion && (
                <button
                  type="button"
                  className="letter-btn"
                  onClick={() => void handleSaveVersion()}
                  disabled={
                    improving ||
                    saving ||
                    adopting ||
                    busy ||
                    proposalSaved ||
                    !improvement.suggestion.trim()
                  }
                >
                  {saving
                    ? t("letter.improve.saving")
                    : proposalSaved
                      ? t("letter.improve.savedButton")
                      : t("letter.improve.saveVersion")}
                </button>
              )}
            </div>
          </section>
        )}
        {actionMessage && (
          <p ref={actionStatusRef} className="letter-review-success" role="status" tabIndex={-1}>
            {actionMessage}
          </p>
        )}
        {successAction && (
          <div className="applications-letter-improvement__success-actions" role="group">
            <p className="applications-letter-improvement__success-title" role="status">
              {t(successAction === "saved" ? "letter.improve.savedTitle" : "letter.improve.adoptedTitle")}
            </p>
            <div className="applications-letter-improvement__actions">
              {successAction === "saved" && savedVersionId && (
                <button
                  type="button"
                  className="letter-btn"
                  onClick={() => {
                    setToId(savedVersionId);
                    requestAnimationFrame(() => {
                      const reduceMotion =
                        typeof window.matchMedia === "function" &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                      comparisonRef.current?.scrollIntoView?.({
                        behavior: reduceMotion ? "auto" : "smooth",
                        block: "start",
                      });
                      toSelectRef.current?.focus({ preventScroll: true });
                    });
                  }}
                >
                  {t("letter.improve.compareVersion")}
                </button>
              )}
              {successAction === "adopted" && onOpenDraft && (
                <button type="button" className="letter-btn" onClick={onOpenDraft}>
                  {t("letter.improve.openDraft")}
                </button>
              )}
              {onNavigateToOverview && (
                <button type="button" className="btn-ghost" onClick={onNavigateToOverview}>
                  {t("letter.improve.toOverview")}
                </button>
              )}
              {onShowApplicationList && (
                <button type="button" className="btn-ghost" onClick={onShowApplicationList}>
                  {t("letter.improve.showAllApplications")}
                </button>
              )}
            </div>
          </div>
        )}
        {actionError && <p className="letter-review-warning" role="alert">{actionError}</p>}
      </section>
    </section>
  );
}

import { useState, useEffect, useMemo } from "react";
import type { Job, Profile, ModelOption } from "../types";
import { analyzeATS, type AtsAnalysisResponse, fetchModels } from "../api";
import { useLang } from "../i18n";
import { ConsentGate } from "./ConsentGate";
import { PrivacyNotice } from "./PrivacyNotice";

type Requirement = AtsAnalysisResponse["analysis"]["requirements"][0];
type Match = AtsAnalysisResponse["analysis"]["matches"][0];
type AIFormulation = NonNullable<AtsAnalysisResponse["ai"]["formulations"]>[0];

interface Props {
  job: Job;
  profile: Profile | null;
  onClose: () => void;
  onAtsAnalyzed?: (result: AtsAnalysisResponse) => void;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  MATCHED: "ats.status.matched",
  PARTIAL: "ats.status.partial",
  GAP: "ats.status.gap",
  UNKNOWN: "ats.status.unknown",
  missing_evidence: "ats.status.missing_evidence",
} as const;

type InternalStatus = keyof typeof STATUS_LABEL_MAP;

function getUserFacingStatus(status: string): string {
  const key = STATUS_LABEL_MAP[status as InternalStatus];
  return key ? key : status;
}

export default function AtsOverlay({ job, profile, onClose, onAtsAnalyzed }: Props) {
  const { t } = useLang();
  const [analysis, setAnalysis] = useState<AtsAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !profile.skills || !profile.skills.trim()) {
      setLoading(false);
      setError(t("match.noProfile"));
      return;
    }

    const profileForAts = { skills: profile.skills };
    analyzeATS(
      { title: job.title, tags: job.tags, slug: job.slug },
      profileForAts,
      { enabled: false }
    )
      .then((result) => {
        setAnalysis(result);
        onAtsAnalyzed?.(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || t("match.analysisError"));
        setLoading(false);
      });
  }, [job, profile, t, onAtsAnalyzed]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const modelsData = await fetchModels();
        setModels(modelsData.models || []);
        if (modelsData.recommendedModel) {
          setSelectedModel(modelsData.recommendedModel);
        }
      } catch {
        // Keep default model selection
      }
    };
    loadModels();
  }, []);

  const performAIAnalysis = async () => {
    if (!analysis || !profile) return;

    setAiLoading(true);
    setAiError("");

    try {
      const profileForAts = { skills: profile.skills };
      const refreshed = await analyzeATS(
        { title: job.title, tags: job.tags, slug: job.slug },
        profileForAts,
        { enabled: true, consent: true, ...(selectedModel ? { model: selectedModel } : {}) }
      );
      if (refreshed.analysis) {
        setAnalysis(refreshed);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAiError(message || t("match.aiError"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleConsent = () => {
    setConsentGiven(true);
    setShowAI(false);
    performAIAnalysis();
  };

  const handleClose = () => {
    setShowAI(false);
    setConsentGiven(false);
    setAiError("");
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAI) {
          setShowAI(false);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, showAI]);

  // Derived data for structured UI
  const requirements = useMemo(() => analysis?.analysis?.requirements ?? [], [analysis]);
  const matches = useMemo(() => analysis?.analysis?.matches ?? [], [analysis]);
  const criticalGaps = useMemo(() => analysis?.analysis?.criticalGaps ?? [], [analysis]);
  const ai = analysis?.ai;

  // Group requirements by match status for thematic sections
  const matchedRequirements = useMemo((): Requirement[] =>
    requirements.filter((req: Requirement) => {
      const match = matches.find((m: Match) => m.requirementId === req.id);
      return match?.status === "MATCHED";
    }), [requirements, matches]);

  const partialRequirements = useMemo((): Requirement[] =>
    requirements.filter((req: Requirement) => {
      const match = matches.find((m: Match) => m.requirementId === req.id);
      return match?.status === "PARTIAL";
    }), [requirements, matches]);

  const gapRequirements = useMemo((): Requirement[] =>
    requirements.filter((req: Requirement) => {
      const match = matches.find((m: Match) => m.requirementId === req.id);
      return match?.status === "GAP" || criticalGaps.some((g: { id: string }) => g.id === req.id);
    }), [requirements, matches, criticalGaps]);

  const unknownRequirements = useMemo((): Requirement[] =>
    requirements.filter((req: Requirement) => {
      const match = matches.find((m: Match) => m.requirementId === req.id);
      return match?.status === "UNKNOWN";
    }), [requirements, matches]);

  // Build tips from recommendations (only categories with data)
  const tips = useMemo(() => {
    const tipList: Array<{ category: string; titleKey: string; descKey: string; items: string[] }> = [];

    // Sharpen profile: matched requirements
    if (matchedRequirements.length > 0) {
      tipList.push({
        category: "sharpen",
        titleKey: "ats.tips.category.sharpen",
        descKey: "ats.tips.category.sharpen.desc",
        items: matchedRequirements.map((r) => r.text),
      });
    }

    // Verify evidence: partial requirements
    if (partialRequirements.length > 0) {
      tipList.push({
        category: "verify",
        titleKey: "ats.tips.category.verify",
        descKey: "ats.tips.category.verify.desc",
        items: partialRequirements.map((r) => r.text),
      });
    }

    // Adapt CV: unknown + gap requirements (combined as "missing evidence")
    const missingItems = [...unknownRequirements, ...gapRequirements].map((r) => r.text);
    if (missingItems.length > 0) {
      tipList.push({
        category: "adapt",
        titleKey: "ats.tips.category.adapt",
        descKey: "ats.tips.category.adapt.desc",
        items: missingItems,
      });
    }

    return tipList;
  }, [matchedRequirements, partialRequirements, unknownRequirements, gapRequirements]);

  const renderSection = (
    titleKey: string,
    annotationKey: string,
    children: React.ReactNode,
    showWhen: boolean = true
  ) => {
    if (!showWhen) return null;
    return (
      <section className="ats-section" aria-labelledby={`${titleKey}-title`}>
        <header className="ats-section-header">
          <h3 id={`${titleKey}-title`} className="ats-section-title">{t(titleKey)}</h3>
          <p className="ats-section-annotation">{t(annotationKey)}</p>
        </header>
        <div className="ats-section-content">{children}</div>
      </section>
    );
  };

  const renderScore = () => {
    if (!analysis) return null;
    return renderSection(
      "ats.section.score.title",
      "ats.section.score.annotation",
      (
        <div className="ats-score">
          <div className="ats-score-value">
            {Math.round(analysis.analysis?.score ?? 0)}/100
          </div>
          <div className="ats-score-label">
            Keyword Coverage:{' '}
            {Math.min(100, Math.max(0, Math.round(analysis.analysis?.keywordCoverage?.overall ?? 0)))}%
          </div>
        </div>
      ),
      !!analysis
    );
  };

  const renderDeterministicLabel = () => {
    if (!analysis) return null;
    return (
      <section className="ats-section" aria-labelledby="ats-deterministic-title" style={{ marginBottom: '8px' }}>
        <header className="ats-section-header">
          <h3 id="ats-deterministic-title" className="ats-section-title" style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t("ats.label.deterministic")}
          </h3>
        </header>
      </section>
    );
  };

  const renderRequirements = () => {
    if (!requirements.length) return null;
    return renderSection(
      "ats.section.requirements.title",
      "ats.section.requirements.annotation",
      (
        <div style={{ marginTop: '16px' }}>
          {requirements.map((req: Requirement, idx: number) => {
            const match = matches.find((m: Match) => m.requirementId === req.id);
            const status = match?.status || "UNKNOWN";
            const userStatus = t(getUserFacingStatus(status));

            return (
              <div
                key={req.id || idx}
                className={`ats-requirement ${status.toLowerCase()}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <span className="ats-requirement-text">{req.text}</span>
                  <span className={`ats-requirement-status ${status.toLowerCase()}`}>
                    {userStatus}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ),
      true
    );
  };

  const renderMatches = () => {
    if (!matchedRequirements.length) return null;
    return renderSection(
      "ats.section.matches.title",
      "ats.section.matches.annotation",
      (
        <div className="ats-criteria">
          {matchedRequirements.map((req, idx) => (
            <div key={req.id || idx} className="ats-requirement matched" style={{ borderLeftColor: 'var(--green)', background: 'rgba(22, 163, 74, 0.05)' }}>
              <span className="ats-requirement-text">{req.text}</span>
              <span className="ats-requirement-status matched">{t("ats.status.matched")}</span>
            </div>
          ))}
        </div>
      ),
      true
    );
  };

  const renderGaps = () => {
    const hasGaps = unknownRequirements.length > 0 || gapRequirements.length > 0;
    if (!hasGaps) return null;

    const allGapItems = [
      ...gapRequirements.map((req: Requirement) => ({ req, type: "gap" as const })),
      ...unknownRequirements.map((req: Requirement) => ({ req, type: "unknown" as const })),
    ];

    return renderSection(
      "ats.section.gaps.title",
      "ats.section.gaps.annotation",
      (
        <div className="ats-gaps-list">
          {allGapItems.map(({ req, type }, idx: number) => (
            <div key={`${type}-${req.id || idx}`} className="ats-gap-item" style={{
              borderLeftColor: type === "gap" ? 'var(--red)' : 'var(--muted)',
              background: type === "gap" ? 'rgba(220, 38, 38, 0.1)' : 'rgba(107, 98, 85, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <span className="ats-gap-text">{req.text}</span>
                <span className="ats-requirement-status" style={{
                  color: type === "gap" ? 'var(--red)' : 'var(--muted)'
                }}>
                  {t(getUserFacingStatus(type === "gap" ? "GAP" : "UNKNOWN"))}
                </span>
              </div>
            </div>
          ))}
        </div>
      ),
      true
    );
  };

  const renderTips = () => {
    if (!tips.length) return null;
    return renderSection(
      "ats.section.tips.title",
      "ats.section.tips.annotation",
      (
        <div className="ats-tips-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tips.map((tip: { category: string; titleKey: string; descKey: string; items: string[] }) => (
            <div key={tip.category} className="ats-tip-card" style={{
              padding: '16px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 600, color: 'var(--brand)', minWidth: '160px' }}>
                  {t(tip.titleKey)}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="ats-tip-desc" style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {t(tip.descKey)}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.85rem' }}>
                    {tip.items.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
      true
    );
  };

  const renderAI = () => {
    if (!ai?.requested) return null;

    return (
      <section className="ats-section" aria-labelledby="ats-ai-title">
        <header className="ats-section-header">
          <h3 id="ats-ai-title" className="ats-section-title">{t("ats.label.ai")}</h3>
          {ai.executed && !consentGiven && (
            <p className="ats-section-annotation" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              {t("ats.aiNotice")}
            </p>
          )}
        </header>
        <div className="ats-section-content">
          {!consentGiven && ai.requested && (
            <PrivacyNotice
              provider={ai?.provider}
              privacyStatus={ai?.privacyStatus}
            />
          )}

          {!consentGiven && (showAI || (!ai?.consentRequired && ai?.requested)) && (
            <ConsentGate
              onAccept={handleConsent}
              provider={ai?.provider || "OpenRouter"}
              privacyStatus={ai?.privacyStatus || "Unknown"}
            />
          )}

          {models.length > 0 && consentGiven && ai?.consentRequired !== false && (
            <div style={{ marginTop: '16px' }}>
              <label className="block text-sm font-medium mb-2" style={{ display: 'block', marginBottom: '8px' }}>
                {t("model.label")}
              </label>
              <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {models.map((model) => (
                  <label key={model.id} className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="ai-model"
                      checked={selectedModel === model.id}
                      onChange={() => setSelectedModel(model.id)}
                      className="rounded border-gray-300"
                      style={{ accentColor: 'var(--brand)' }}
                    />
                    <span>{model.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="ats-loading">
              <div className="ats-spinner" />
              <span>{t("ats.aiLoading")}</span>
            </div>
          )}

          {aiError && (
            <div className="ats-section" style={{ marginTop: '16px' }}>
              <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>
                {t("ats.aiError")}: {aiError}
              </p>
            </div>
          )}

          {ai.executed && ai.formulations?.length && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                {t("ats.label.ai")}
              </h4>
              {ai.formulations.map((form: AIFormulation, idx: number) => (
                <div key={idx} className="ats-recommendation">
                  <div className="ats-recommendation-title">
                    {form.changeType}
                  </div>
                  <div className="ats-recommendation-text">
                    {form.proposedText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("ats.overlayTitle")}>
        <div className="modal-box">
          <div className="modal-head">
            <h3>{t("ats.loading")}</h3>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={t("modal.close")}
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("ats.overlayTitle")}>
        <div className="modal-box">
          <div className="modal-head">
            <h3>{t("ats.error")}</h3>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={t("modal.close")}
            >
              &times;
            </button>
          </div>
          <div className="modal-text">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("ats.overlayTitle")}>
        <div className="modal-box">
          <div className="modal-head">
            <div>
              <h3>{t("ats.overlayTitle")}</h3>
              <p className="modal-sub">
                {job.title}
                {job.company_name && ` @ ${job.company_name}`}
              </p>
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={handleClose}
              aria-label={t("modal.close")}
            >
              &times;
            </button>
          </div>

          <div className="ats-module">
            {renderDeterministicLabel()}
            {renderScore()}
            {renderRequirements()}
            {renderMatches()}
            {renderGaps()}
            {renderTips()}
            {renderAI()}
          </div>
        </div>
      </div>

      {showAI && analysis && !consentGiven && (
        <PrivacyNotice
          provider={analysis.ai?.provider}
          privacyStatus={analysis.ai?.privacyStatus}
        />
      )}

      {showAI && analysis && !consentGiven && analysis.ai?.consentRequired !== false && (
        <ConsentGate
          onAccept={handleConsent}
          provider={analysis.ai?.provider || "OpenRouter"}
          privacyStatus={analysis.ai?.privacyStatus || "Unknown"}
        />
      )}
    </>
  );
}
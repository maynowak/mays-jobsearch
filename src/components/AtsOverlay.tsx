import { useState, useEffect } from "react";
import type { Job, Profile, ModelOption } from "../types";
import { analyzeATS, type AtsAnalysisResponse, fetchModels } from "../api";
import { useLang } from "../i18n";
import { ConsentGate } from "./ConsentGate";
import { PrivacyNotice } from "./PrivacyNotice";

interface Props {
  job: Job;
  profile: Profile | null;
  onClose: () => void;
  onAtsAnalyzed?: (result: AtsAnalysisResponse) => void;
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
        // BUG-22: die bestehende Modellauswahl wird jetzt tatsächlich genutzt
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

  const renderOverview = () => {
    if (!analysis) return null;

    return (
      <div className="ats-section">
        <div className="ats-section-header">
          <h3 className="ats-section-title">{t("ats.score")}</h3>
        </div>
        <div className="ats-section-content">
          <div className="ats-score">
            <div className="ats-score-value">
              {Math.round(analysis.analysis?.score ?? 0)}/100
            </div>
            <div className="ats-score-label">
              Keyword Coverage: 
              {Math.round((analysis.analysis?.keywordCoverage?.overall ?? 0) * 100)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRequirements = () => {
    if (!analysis?.analysis.requirements) return null;

    const matchedCount = analysis.analysis.matches?.filter(m => m.status === "MATCHED").length ?? 0;
    const partialCount = analysis.analysis.matches?.filter(m => m.status === "PARTIAL").length ?? 0;
    const gapCount = analysis.analysis.criticalGaps?.length ?? 0;
    const total = analysis.analysis.requirements.length;

    return (
      <div className="ats-section">
        <div className="ats-section-header">
          <h3 className="ats-section-title">{t("ats.requirements")}</h3>
        </div>
        <div className="ats-section-content">
          <div className="ats-criteria">
            <div className="ats-criterion">
              <span className="ats-criterion-label">Gesamt</span>
              <span className="ats-criterion-value">{total} {total === 1 ? "Anforderung" : "Anforderungen"}</span>
            </div>
            <div className="ats-criterion">
              <span className="ats-criterion-label">MATCHED</span>
              <span className="ats-criterion-value">{matchedCount}</span>
            </div>
            <div className="ats-criterion">
              <span className="ats-criterion-label">PARTIAL</span>
              <span className="ats-criterion-value">{partialCount}</span>
            </div>
            <div className="ats-criterion">
              <span className="ats-criterion-label">GAP</span>
              <span className="ats-criterion-value">{gapCount}</span>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            {analysis.analysis.requirements.map((req, idx) => {
              const match = analysis?.analysis.matches?.find(m => m.requirementId === req.id);
              const status = match?.status || "UNKNOWN";

              return (
                <div 
                  key={req.id || idx} 
                  className={`ats-requirement ${status.toLowerCase()}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="ats-requirement-text">{req.text}</span>
                    <span className={`ats-requirement-status`}>
                      {status === "MATCHED" && "✓ MATCHED"}
                      {status === "PARTIAL" && "⊘ PARTIAL"}
                      {status === "GAP" && "⚠ GAP"}
                      {status === "UNKNOWN" && "? UNKNOWN"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGaps = () => {
    if (!analysis?.analysis.criticalGaps || analysis.analysis.criticalGaps.length === 0) {
      return null;
    }

    return (
      <div className="ats-section">
        <div className="ats-section-header">
          <h3 className="ats-section-title">{t("ats.criticalGaps")}</h3>
        </div>
        <div className="ats-section-content">
          <div className="ats-gaps-list">
            {analysis.analysis.criticalGaps.map((gap, idx) => (
              <div key={gap.id || idx} className="ats-gap-item">
                <span className="ats-gap-text">{gap.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!analysis?.recommendations || analysis.recommendations.length === 0) return null;

    const labels: Record<string, string> = {
      KEYWORD_REINFORCEMENT: t("match.keywordReinforcement"),
      EVIDENCE_CLARIFICATION: t("match.evidenceClarification"),
      GAP_FLAG: t("match.gapFlag"),
      UNKNOWN_REVIEW: t("match.unknownReview"),
      MISSING_CERTIFICATE: t("match.missingCertificate"),
    };

    return (
      <div className="ats-section">
        <div className="ats-section-header">
          <h3 className="ats-section-title">{t("ats.recommendations")}</h3>
        </div>
        <div className="ats-section-content">
          <div className="ats-recommendations-list">
            {analysis.recommendations.map((rec, idx) => (
              <div key={rec.requirementId || idx} className="ats-recommendation">
                <div className="ats-recommendation-title">
                  {labels[rec.changeType] || rec.changeType}
                </div>
                <div className="ats-recommendation-text">
                  {rec.proposedChange}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAI = () => {
    if (!analysis?.ai || !analysis.ai.requested) return null;

    return (
      <div className="ats-section">
        <div className="ats-section-header">
          <h3 className="ats-section-title">AI Analysis</h3>
        </div>
        <div className="ats-section-content">
          {!consentGiven && analysis.ai && analysis.ai.requested && (
            <PrivacyNotice
              provider={analysis.ai?.provider}
              privacyStatus={analysis.ai?.privacyStatus}
            />
          )}

          {!consentGiven && (showAI || (!analysis.ai?.consentRequired && analysis.ai?.requested)) && (
            <ConsentGate
              onAccept={handleConsent}
              provider={analysis.ai?.provider || "OpenRouter"}
              privacyStatus={analysis.ai?.privacyStatus || "Unknown"}
            />
          )}

          {models.length > 0 && consentGiven && analysis?.ai && analysis.ai?.consentRequired !== false && (
            <div style={{ marginTop: '16px' }}>
              <label className="block text-sm font-medium mb-2">
                {t("model.label")}
              </label>
              <div className="space-y-2">
                {models.map((model) => (
                  <label key={model.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="ai-model"
                      checked={selectedModel === model.id}
                      onChange={() => setSelectedModel(model.id)}
                      className="rounded border-gray-300"
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
        </div>
      </div>
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
            {renderOverview()}
            {renderRequirements()}
            {renderGaps()}
            {renderRecommendations()}
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
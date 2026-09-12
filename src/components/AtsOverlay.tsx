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
        { enabled: true, consent: true }
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

  const statusColors: Record<string, string> = {
    MATCHED: "text-green-600",
    PARTIAL: "text-yellow-600",
    GAP: "text-red-600",
    UNKNOWN: "text-gray-600",
  };

  const changeTypeLabels: Record<string, string> = {
    KEYWORD_REINFORCEMENT: "Keyword Reinforcement",
    EVIDENCE_CLARIFICATION: "Evidence Clarification",
    GAP_FLAG: "Gap Identified",
    UNKNOWN_REVIEW: "Review Needed",
    MISSING_CERTIFICATE: "Missing Certificate",
  };

  const renderRequirements = () => {
    if (!analysis?.analysis.requirements) return null;

    return analysis.analysis.requirements.map((req, idx) => {
      const match = analysis?.analysis.matches?.find((m) => m.requirementId === req.id);
      const status = match?.status || "UNKNOWN";
      const confidence = match?.confidence || "LOW";

      return (
        <div key={req.id || idx} className="border-l-2 pl-4 mb-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{req.text}</span>
            <span className={`text-xs ${statusColors[status] || ""}`}>
              {changeTypeLabels[status] || status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">Confidence: {confidence}</p>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("ats.overlayTitle")}>
        <div className="modal-box">
          <div className="modal-head">
            <h3>{t("ats.loading")}</h3>
            <button type="button" className="modal-close" onClick={onClose} aria-label={t("modal.close")}>
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
            <button type="button" className="modal-close" onClick={onClose} aria-label={t("modal.close")}>
              &times;
            </button>
          </div>
          <p className="modal-text">{error}</p>
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
              <p className="modal-sub">{job.title}{job.company_name && ` @ ${job.company_name}`}</p>
            </div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label={t("modal.close")}>
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <h3 className="text-lg font-semibold mb-2">{t("ats.score")}</h3>
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(analysis.analysis?.score ?? 0)}/100
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Keyword Coverage: {Math.round((analysis.analysis?.keywordCoverage?.overall ?? 0) * 100)}%
              </div>
            </div>

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
              <div className="model-selection">
                <label className="block text-sm font-medium mb-2">{t("model.label")}</label>
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
              <div className="ai-loading">
                <span className="spinner" /> {t("ats.aiLoading")}
              </div>
            )}

            {aiError && (
              <div className="ai-error">
                <p>{t("ats.aiError")}: {aiError}</p>
              </div>
            )}

            <div className="ats-results">
              {renderRequirements()}
            </div>
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
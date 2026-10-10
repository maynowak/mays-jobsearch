import { useEffect, useRef, useState } from "react";
import type { Job, Match, Profile, StatusMessage, CvDocument, CvProcessingState, AnonymizationMode, ProcessingGoal, EmploymentType } from "./types";
import { fetchJobs, fetchMatches, isFreeQuotaExceeded, isModelUnavailable, withModelFallback, createProfile, analyzeATS, applyCvImprovement, computeMatchImpact, ApiError } from "./api";
import { useLang } from "./i18n";
import { modelDisplayName } from "./lib/modelDisplayName";
import { extractPdfText } from "./lib/pdf";
import { anonymizeText } from "./lib/anonymize";
import Navbar from "./components/Navbar";
import type { NavbarRoute } from "./components/Navbar";
import LandingHero from "./components/LandingHero";
import Hero from "./components/Hero";
import SearchForm from "./components/SearchForm";
import JobSources from "./components/JobSources";
import ModelSelector from "./components/ModelSelector";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import Footer from "./components/Footer";
import LetterModal from "./components/LetterModal";
import ATSModal from "./components/AtsOverlay";
import { useSearchWorldMotion } from "./hooks/useSearchWorldMotion";
import RegisterForm from "./components/RegisterForm";
import LoginForm from "./components/LoginForm";
import AuthCallback from "./components/AuthCallback";
import ProfilePage from "./components/Profile";
import CvDocumentList from "./components/CvDocumentList";
import CvConsentGate from "./components/CvConsentGate";
import CvProcessingStatus from "./components/CvProcessingStatus";
import CvProcessingSteps from "./components/CvProcessingSteps";
import CvGoalSelection from "./components/CvGoalSelection";
import Imprint from "./components/Imprint";
import Privacy from "./components/Privacy";
import Principles from "./components/Principles";

import CvAnonymizationChoice from "./components/CvAnonymizationChoice";
import CvProfileResult from "./components/CvProfileResult";
import CvProfilesOverlay from "./components/CvProfilesOverlay";
import { saveCvAtsProfile, saveCvSearchProfile, purgeLegacyCvListsFromLocalStorage, readCvProfileLists, resetCvProfileLists, findSavedSearchProfile } from "./lib/cvProfileStore";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAvailableModels } from "./hooks/useAvailableModels";

type Phase = "idle" | "searching" | "scoring" | "matching";

function arraysEqual<T>(a: T[] | null | undefined, b: T[] | null | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

// PROFILE-TAB-STATE-01: Ausgangswert der manuellen Suchmaske (Manual Tab).
// Dient auch als Reset-Ziel, wenn die Maske ein entferntes Profil zeigte.
const INITIAL_MANUAL_PROFILE: Profile = {
  skills: "",
  targetRoles: [],
  city: "",
  radiusKm: null,
  workModes: [],
  employmentTypes: ["full_time"],
};

interface JobDataset {
  jobs: Job[];
  profile: Profile;
}

export default function App() {
  const { t } = useLang();
  // Route aus URL ableiten (reaktiv bei Navigation)
  const route: NavbarRoute = (() => {
    const path = window.location.pathname;
    if (path === "/impressum") return "impressum";
    // REGISTRATION-UI-01: reine GUI-Routen (kein Backend, keine Session).
    if (path === "/registrieren") return "register";
    if (path === "/anmelden") return "login";
    return path === "/search" ? "matcher" : "landing";
  })();
  const isAuthCallback = window.location.pathname === "/auth/callback";
  const isProfile = window.location.pathname === "/profil";
  const isPrivacy = window.location.pathname === "/datenschutz";
  const isPrinciples = window.location.pathname === "/datenschutzprinzipien";
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [foundJobs, setFoundJobs] = useState<Job[]>([]);
  // Roh-Treffer je Source aus der letzten Suche (meta.sources) — damit auch
  // Quellen sichtbar bleiben, die geliefert haben, aber aus dem 50er-Anzeige-Pool fielen
  const [foundSources, setFoundSources] = useState<Partial<Record<string, number>> | null>(null);
  // Inaktive Quellen + Laufzeit-Gründe der letzten Suche (meta.disabledSources /
  // meta.sourceReasons) — JOB-SOURCES-01: fehlende Quellen nicht kommentarlos fehlen lassen
  const [foundDisabledSources, setFoundDisabledSources] = useState<string[] | null>(null);
  const [foundSourceReasons, setFoundSourceReasons] = useState<Partial<Record<string, string | null>> | null>(null);
  const [profile, setProfile] = useState<Profile>({ ...INITIAL_MANUAL_PROFILE });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);
  const [atsJob, setAtsJob] = useState<Job | null>(null);
  // CV-PROFILE-LISTS-01: Profil-Overlay pro CV (benannte Such-/ATS-Profile)
  const [profilesDocId, setProfilesDocId] = useState<string | null>(null);
  // Name fuer den ATS-Profil-Eintrag (Skills-Step bei Ziel ATS)
  const [atsProfileName, setAtsProfileName] = useState("");
  // CV-UPLOAD-UX-07: aktiv gewaehltes ATS-Profil (Liste des CVs) — wird bei
  // der per-Job-ATS-Analyse (AtsOverlay) als Profil verwendet.
  const [activeAtsEntryId, setActiveAtsEntryId] = useState<string | null>(null);
  // CV-UPLOAD-UX-08: gewaehltes gespeichertes Suchprofil + Edit-Kontext
  // (prefill Name beim Edit-Sprung; gleicher Name ueberschreibt beim Speichern)
  const [selectedSavedSearchId, setSelectedSavedSearchId] = useState<string | null>(null);
  const [editingSearchName, setEditingSearchName] = useState<string | null>(null);
  // Consent-Overlay (BUG-07): Benutzer kann das Overlay schließen, ohne die
  // Zustimmung zu erteilen. Der Consent bleibt dann ausstehend und kann über
  // "Einwilligung anzeigen" erneut geöffnet werden.
  const [consentDismissed, setConsentDismissed] = useState(false);
  // BUG-19: aktiven CV-Step fokussieren (Scroll-Handling siehe Effekt unten)
  const cvWorkflowRef = useRef<HTMLElement | null>(null);
  const [dataset, setDataset] = useState<JobDataset | null>(null);
  const [modelExhausted, setModelExhausted] = useState(false);
  const busyRef = useRef(false);

  // CV Processing State (Phases 6.1/6.2/6.3/6.4/6.5/6.6/6.7/6.8/6.9)
  const [cvState, setCvState] = useState<CvProcessingState>({
    step: "idle",
    documents: [],
    selectedDocumentIds: [],
    consentGiven: false,
    anonymizationMode: "anonymized",
    processingGoal: "ats",
    error: null,
    profile: null,
    suggestedProfile: null,
    fallbackNote: false,
    isProcessing: false,
    atsResult: null,
    aiSearchResult: null,
    improvementRecommendations: null,
    selectedImprovementIds: [],
    improvementResult: null,
    originalProfile: null,
    beforeAtsResult: null,
    afterAtsResult: null,
    reanalysisResult: null,
    matchImpactBefore: null,
    matchImpactAfter: null,
    matchImpactDelta: null,
    matchImpactChanges: null,
    matchImpactJob: null,
    selectedSkills: [],
    cvProfile: null,
  });

  const {
    state: modelsState,
    models,
    defaultModel,
    fallbackModel,
    recommendedModel,
  } = useAvailableModels();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const effectiveModel =
    modelsState === "ready"
      ? selectedModel && models.some((m) => m.id === selectedModel)
        ? selectedModel
        : models.some((m) => m.id === defaultModel)
          ? defaultModel
          : fallbackModel && models.some((m) => m.id === fallbackModel)
            ? fallbackModel
            : (models[0]?.id ?? null)
      : selectedModel;

  useEffect(() => {
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // CV-PROFILE-LISTS-02 (Privacy): Altlasten der v1-Listen im localStorage
    // einmalig entfernen — die Listen leben jetzt nur im Session-Speicher.
    purgeLegacyCvListsFromLocalStorage();
  }, []);

  // BUG-19: Kein manueller Scroll zwischen CV-Steps. Auf Desktop/Tablet liegt
  // der Workflow in einem fixed Overlay (Fokus genügt); mobil wird die
  // Inline-Card automatisch in den sichtbaren Bereich gescrollt.
  // CV-UPLOAD-UX-02: Overlay gilt jetzt auf allen Viewports — Fokus genügt.
  useEffect(() => {
    if (cvState.step === "idle") return;
    const el = cvWorkflowRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
  }, [cvState.step]);

  const profilesEqual = (a: Profile, b: Profile) =>
    a.skills === b.skills &&
    arraysEqual(a.targetRoles, b.targetRoles) &&
    a.city === b.city &&
    a.radiusKm === b.radiusKm &&
    arraysEqual(a.workModes, b.workModes) &&
    arraysEqual(a.employmentTypes, b.employmentTypes);

  const modelLabel = (id: string | null | undefined): string => {
    if (!id) return t("model.none");
    return modelDisplayName(models.find((m) => m.id === id) ?? null) || id;
  };

  const describeError = (err: unknown): string =>
    isFreeQuotaExceeded(err)
      ? t("model.quotaExceeded")
      : isModelUnavailable(err)
        ? t("model.unavailable")
        : (err as Error).message || t("status.genericError");

  const performMatch = async (nextDataset: JobDataset, model: string | null, isExplicitMatch = false) => {
    setStatus(null);
    if (!isExplicitMatch) {
      setPhase("scoring");
    } else if (phase !== "matching") {
      setPhase("matching");
    }
    try {
      const { data: matchResult, usedFallback, attempts } = await withModelFallback({
        initialModel: model,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) =>
          fetchMatches(nextDataset.profile, nextDataset.jobs, m, attempt),
      });

      // The old displayed results stay visible until the new search is complete.
      // Only now do we replace them (even for the zero-evaluation case).
      setFoundJobs(nextDataset.jobs);
      setMatches(matchResult.matches);
      setModelExhausted(false);

      if (matchResult.matches.length) {
        const found = t("status.found", {
          count: nextDataset.jobs.length,
          evaluated: matchResult.meta?.evaluated ?? matchResult.matches.length,
        });
        const message = usedFallback
          ? `${found} ${t("model.fallbackSuccess", {
              failed: modelLabel(attempts.filter((a) => !a.ok).at(-1)?.model ?? null),
              used: modelLabel(attempts.find((a) => a.ok)?.model ?? null),
            })}`
          : found;
        setStatus({ type: "info", message });
      } else {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || t("status.noMatches"),
        });
      }
    } catch (err) {
      if (isModelUnavailable(err)) {
        setModelExhausted(true);
        setStatus({ type: "error", message: t("model.fallbackExhausted") });
      } else {
        setModelExhausted(false);
        setStatus({ type: "error", message: describeError(err) });
      }
    } finally {
      setPhase("idle");
    }
  };

  const runSearch = async (submitted: Profile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProfile(submitted);
    setStatus(null);
    setModelExhausted(false);
    setDataset(null);
    setFoundJobs([]);
    setFoundSources(null);
    setFoundDisabledSources(null);
    setFoundSourceReasons(null);
    setMatches([]);

    const hasTargetRoles = Array.isArray(submitted.targetRoles) && submitted.targetRoles.length > 0;
    if (!submitted.skills && !hasTargetRoles) {
      setStatus({ type: "error", message: t("status.noSkills") });
      busyRef.current = false;
      return;
    }

    setPhase("searching");
    try {
      const board = await fetchJobs(submitted);

      if (!board.jobs.length) {
        const query = submitted.skills || (Array.isArray(submitted.targetRoles) ? submitted.targetRoles.join(", ") : submitted.targetRoles || "");
        setStatus({
          type: "warn",
          message: submitted.city
            ? t("status.noJobsCity", { q: query, city: submitted.city })
            : t("status.noJobs", { q: query }),
        });
        return;
      }

      const nextDataset: JobDataset = { jobs: board.jobs, profile: submitted };
      setDataset(nextDataset);
      setFoundJobs(board.jobs);
      setFoundSources(board.meta?.sources ?? null);
      setFoundDisabledSources(board.meta?.disabledSources ?? null);
      setFoundSourceReasons(board.meta?.sourceReasons ?? null);
    } catch (err) {
      setStatus({ type: "error", message: describeError(err) });
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const runCvSearch = async (submittedOverride?: Profile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    // cvProfile aus dem State — oder direkt uebergeben (Listener-Aufrufe duerfen
    // nicht auf einen veralteten State-Closure zeigen)
    const submitted = submittedOverride ?? cvState.cvProfile;
    console.debug("[runCvSearch] submitted profile:", JSON.stringify(submitted, null, 2));
    const hasTargetRoles = Array.isArray(submitted?.targetRoles) && submitted.targetRoles.length > 0;
    if (!submitted || (!submitted.skills && !hasTargetRoles)) {
      setStatus({ type: "error", message: t("status.noSkills") });
      busyRef.current = false;
      return;
    }

    setStatus(null);
    setModelExhausted(false);
    setDataset(null);
    setFoundJobs([]);
    setFoundSources(null);
    setFoundDisabledSources(null);
    setFoundSourceReasons(null);
    setMatches([]);

    setPhase("searching");
    try {
      const board = await fetchJobs(submitted);

      if (!board.jobs.length) {
        const query = submitted.skills || (Array.isArray(submitted.targetRoles) ? submitted.targetRoles.join(", ") : submitted.targetRoles || "");
        setStatus({
          type: "warn",
          message: submitted.city
            ? t("status.noJobsCity", { q: query, city: submitted.city })
            : t("status.noJobs", { q: query }),
        });
        return;
      }

      const nextDataset: JobDataset = { jobs: board.jobs, profile: submitted };
      setDataset(nextDataset);
      setFoundJobs(board.jobs);
      setFoundSources(board.meta?.sources ?? null);
      setFoundDisabledSources(board.meta?.disabledSources ?? null);
      setFoundSourceReasons(board.meta?.sourceReasons ?? null);
    } catch (err) {
      console.error("[runCvSearch] error:", err);
      setStatus({ type: "error", message: describeError(err) });
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const handleMatchWithAI = async () => {
    if (busyRef.current || !dataset) return;
    busyRef.current = true;
    setStatus(null);
    setModelExhausted(false);
    setPhase("matching");
    try {
      await performMatch(dataset, effectiveModel, true);
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const handleProfileChange = (next: Profile) => {
    setProfile(next);
    if (dataset && !profilesEqual(next, dataset.profile)) {
      setDataset(null);
      setModelExhausted(false);
    }
  };

  const handleModelChange = (model: string) => {
    if (busyRef.current) return;
    setSelectedModel(model);
    setModelExhausted(false);
  };

  // CV Processing Handlers (Phases 6.1/6.2)
  const generateDocumentId = () => `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  async function sha256Hex(text: string): Promise<string | null> {
    try {
      if (!crypto?.subtle) return null;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return null;
    }
  }

  // CV-UPLOAD-UX-01: Quick-Upload (Pfad A) startet direkt den CV-Workflow
  // (Pfad B) im Overlay — Einwilligung, Modellwahl, Anonymisierung und
  // Profil-Erstellung laufen dort einheitlich (kein Inline-Consent in der
  // Suchmaske mehr; der Dateiname ueberlappte den Consent-Rahmen).
  // Beim Schliessen/Abbrechen des Consents bleibt das Dokument in der Liste
  // unter der Suchmaske erhalten (consentDismissed -> Inline-Karte).
  const handleCvUploadStart = (file: File) => {
    const doc: CvDocument = {
      id: generateDocumentId(),
      name: file.name,
      size: file.size,
      selected: true,
      file,
    };
    setConsentDismissed(false);
    setCvState((prev) => ({
      ...prev,
      documents: [...prev.documents, doc].slice(0, 10),
      selectedDocumentIds: [...prev.selectedDocumentIds, doc.id],
      // Consent bereits erteilt (Sitzung): direkt zu den Optionen; sonst
      // zuerst die Einwilligung im Overlay (Consent vor jedem AI-Call).
      step: prev.consentGiven ? "creating-profile" : "consent-required",
      error: null,
      errorBackStep: null,
    }));
  };

  const handleAddCvFiles = (files: FileList | File[], skills?: string[]) => {
    const newDocuments: CvDocument[] = Array.from(files).map((file) => ({
      id: generateDocumentId(),
      name: file.name,
      size: file.size,
      selected: false,
      file,
      ...(skills && skills.length > 0 ? { skills } : {}),
    }));
    setCvState((prev) => {
      // Enforce max 10 CVs limit
      const combined = [...prev.documents, ...newDocuments];
      if (combined.length > 10) {
        // Keep only first 10
        return {
          ...prev,
          documents: combined.slice(0, 10),
          step: "document-selected",
        };
      }
      return {
        ...prev,
        documents: combined,
        step: "document-selected",
      };
    });
  };

  const handleSelectCvDocument = (id: string, selected: boolean) => {
    setCvState((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) =>
        doc.id === id ? { ...doc, selected } : doc
      ),
      selectedDocumentIds: selected
        ? [...prev.selectedDocumentIds, id]
        : prev.selectedDocumentIds.filter((docId) => docId !== id),
      step: "document-selected",
    }));
  };

  const handleRemoveCvDocument = (id: string) => {
    setCvState((prev) => {
      const remaining = prev.documents.filter((doc) => doc.id !== id);
      const wasSelected = prev.selectedDocumentIds.includes(id);
      return {
        ...prev,
        documents: remaining,
        selectedDocumentIds: wasSelected
          ? prev.selectedDocumentIds.filter((docId) => docId !== id)
          : prev.selectedDocumentIds,
        step: remaining.length > 0 ? "document-selected" : "idle",
      };
    });
  };

  // CV-PROFILE-LISTS-04 (Privacy): Alle CV-Daten entfernen — Session-Listen
  // + Legacy-localStorage + Dokumente/Workflow-States. Danach ist ein
  // erneutes Hochladen noetig (Hinweis im Bestaetigungsdialog).
  const handleCvRemoveData = () => {
    // PROFILE-TAB-STATE-01: Zeigt die Manual-Maske gerade ein gespeichertes
    // Suchprofil, das hiermit entfernt wird (Load via "Jobs Finden" aus der
    // Profil-Box), muss auch die Maske geleert werden — sonst bleiben die
    // Werte des geloeschten Profils sichtbar (State gesetzt, Form stale).
    // Eine unabhaengige manuelle Eingabe (ungleich allen entfernten Eintraegen)
    // bleibt erhalten (Tab-Grenze). Pruefung VOR dem Leeren der Listen.
    const manualShowsRemovedProfile = cvState.documents.some((doc) =>
      readCvProfileLists(doc.hash ?? null).searchProfiles.some((entry) =>
        profilesEqual(entry.profile, profile)
      )
    );
    resetCvProfileLists();
    purgeLegacyCvListsFromLocalStorage();
    setProfilesDocId(null);
    setAtsProfileName("");
    // CV-UPLOAD-UX-10: Auswahl-IDs zuruecksetzen (Listen sind entfernt)
    setSelectedSavedSearchId(null);
    setActiveAtsEntryId(null);
    setEditingSearchName(null);
    setConsentDismissed(false);
    if (manualShowsRemovedProfile) {
      setProfile({ ...INITIAL_MANUAL_PROFILE });
    }
    setCvState({
      step: "idle",
      documents: [],
      selectedDocumentIds: [],
      consentGiven: false,
      anonymizationMode: "anonymized",
      processingGoal: "ats",
      error: null,
      errorBackStep: null,
      profile: null,
      suggestedProfile: null,
      fallbackNote: false,
      isProcessing: false,
      atsResult: null,
      aiSearchResult: null,
      improvementRecommendations: null,
      selectedImprovementIds: [],
      improvementResult: null,
      originalProfile: null,
      beforeAtsResult: null,
      afterAtsResult: null,
      reanalysisResult: null,
      matchImpactBefore: null,
      matchImpactAfter: null,
      matchImpactDelta: null,
      matchImpactChanges: null,
      matchImpactJob: null,
      selectedSkills: [],
      cvProfile: null,
    });
  };

  // CV-UPLOAD-UX-08: gespeichertes Suchprofil im Profil-Step vorbefuellt
  // bearbeiten (Speichern mit gleichem Namen ueberschreibt den Eintrag).
  const editSavedSearchProfile = () => {
    const doc = cvState.documents.find((d) => d.selected) ?? cvState.documents[0];
    if (!doc) return;
    const entry = readCvProfileLists(doc.hash ?? null).searchProfiles.find(
      (e) => e.id === selectedSavedSearchId
    );
    if (!entry) return;
    setEditingSearchName(entry.name);
    setCvState((prev) => ({
      ...prev,
      suggestedProfile: {
        skills: entry.profile.skills.split(",").map((s) => s.trim()).filter(Boolean),
        experienceLevel: "",
        targetRoles: entry.profile.targetRoles ?? [],
        location: entry.profile.city,
      },
      cvProfile: entry.profile,
      selectedDocumentIds: prev.selectedDocumentIds.includes(doc.id)
        ? prev.selectedDocumentIds
        : [doc.id],
      step: "profile-ready",
      error: null,
      errorBackStep: null,
      fallbackNote: false,
      isProcessing: false,
    }));
  };

  // CV-UPLOAD-UX-08: gespeichertes ATS-Profil im Skills-Step vorbefuellt
  // bearbeiten (Name + Skills vorausgewaehlt; gleicher Name ueberschreibt).
  const editSavedAtsProfile = () => {
    const doc = cvState.documents.find((d) => d.selected) ?? cvState.documents[0];
    if (!doc) return;
    const entry = readCvProfileLists(doc.hash ?? null).atsProfiles.find(
      (e) => e.id === activeAtsEntryId
    );
    if (!entry) return;
    setAtsProfileName(entry.name);
    setCvState((prev) => ({
      ...prev,
      processingGoal: "ats",
      suggestedProfile: {
        skills: [...entry.skills],
        experienceLevel: "",
        targetRoles: entry.targetRoles ?? [],
        location: "",
      },
      selectedSkills: [...entry.skills],
      step: "skill-selection",
      error: null,
      errorBackStep: null,
      isProcessing: false,
    }));
  };

  // CV-UPLOAD-UX-08/10: Jobsuche startet nur mit einem gewaehlten
  // gespeicherten Suchprofil (kein Start mit leerer Auswahl).
  const startSearchWithSavedProfile = () => {
    const doc = cvState.documents.find((d) => d.selected) ?? cvState.documents[0];
    const lists = readCvProfileLists(doc?.hash ?? null);
    const entry = findSavedSearchProfile(lists, selectedSavedSearchId);
    if (!entry) {
      // Kein stiller Abbruch: der Klick muss immer eine sichtbare Reaktion haben
      setStatus({ type: "error", message: t("cv.startSearchMissing") });
      return;
    }
    handleProfileChange(entry.profile);
    handleSubmit(entry.profile);
  };

  const handleCvProcess = () => {
    const selectedDocs = cvState.documents.filter((d) => d.selected);
    if (!selectedDocs.length) return;

    // First-Use Recognition: Check if consent already given
    if (!cvState.consentGiven) {
      setConsentDismissed(false);
      setCvState((prev) => ({
        ...prev,
        step: "consent-required",
      }));
      return;
    }

    // Consent already given - proceed to creating-profile step (user selects options)
    setCvState((prev) => ({
      ...prev,
      step: "creating-profile",
      isProcessing: false,
    }));
  };

  const handleSearchWithSelectedCvs = () => {
    const selectedDocs = cvState.documents.filter((d) => d.selected);
    if (!selectedDocs.length) return;

    // Use the first selected document for profile creation, but merge skills from all selected
    const allSkills = selectedDocs
      .flatMap((doc) => doc.skills || [])
      .filter((skill, index, arr) => arr.indexOf(skill) === index);

    // Create a merged profile with skills from all selected CVs.
    // Quelle: bestaetigtes CV-Profil zuerst (cvProfile) — CV-UPLOAD-UX-01 legt
    // Uploads ohne Inline-Profil an, die Skills kommen dann aus dem Workflow.
    const baseProfile = cvState.cvProfile ?? cvState.profile ?? { skills: "", targetRoles: [], city: "", radiusKm: null, workModes: [], employmentTypes: ["full_time"] as EmploymentType[] };
    const mergedProfile = {
      ...baseProfile,
      skills: [...new Set([...(baseProfile.skills?.split(", ") || []), ...allSkills])].filter(Boolean).join(", "),
    };

    // Store in cvProfile (separate from manual search profile)
    setCvState((prev) => ({
      ...prev,
      cvProfile: mergedProfile,
      step: "goal-selection",
    }));
    // mergedProfile direkt uebergeben: der State ist in dieser Closure noch alt
    void runCvSearch(mergedProfile);
  };

  const handleCvConsentAccept = () => {
    const selectedDoc = cvState.documents.find((d) => cvState.selectedDocumentIds.includes(d.id));
    if (!selectedDoc) return;

    // CV-UPLOAD-UX-03: Reihenfolge der Privacy Boundary folgen — nach der
    // Einwilligung kommen zuerst die Optionen inkl. ANONYMISIERUNGS-Modus
    // (creating-profile), danach erst die Modellwahl. Erster Modell-Call
    // erfolgt im anonymizing-Step — also nach Festlegung der Anonymisierung.
    setCvState((prev) => ({
      ...prev,
      consentGiven: true,
      step: "creating-profile",
      isProcessing: false,
    }));
  };

  const handleCvContinue = (doc: CvDocument) => {
    createProfileFromPdf(doc);
  };

  const createProfileFromPdf = async (doc: CvDocument) => {
    setCvState((prev) => ({
      ...prev,
      step: "anonymizing",
      isProcessing: true,
      error: null,
    }));

    try {
      // Extract text from PDF
      const text = await extractPdfText(doc.file);
      if (text.replace(/\s/g, "").length < 20) {
        setCvState((prev) => ({
          ...prev,
          step: "error",
          isProcessing: false,
          error: t("cv.scannedError"),
        }));
        return;
      }

      // Apply anonymization if selected
      let processedText = text;
      if (cvState.anonymizationMode === "anonymized") {
        processedText = anonymizeText(text);
      }

      const normalized = normalizeText(processedText);
      const hash = await sha256Hex(normalized);

      // CV-PROFILE-LISTS-01: Hash am Dokument merken — Schluessel fuer die
      // benannten Profil-Listen (Suchprofile/ATS-Profile) dieses CVs.
      setCvState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => (d.id === doc.id ? { ...d, hash } : d)),
      }));

      // Determine model to use
      const modelToUse = effectiveModel;

      // Create profile using existing API with model fallback
      const { data: suggestedProfile, usedFallback } = await withModelFallback({
        initialModel: modelToUse,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) => createProfile(normalized, m, hash ?? undefined, attempt),
      });

      setCvState((prev) => ({
        ...prev,
        suggestedProfile,
        step: "profile-ready",
        isProcessing: false,
        fallbackNote: usedFallback,
      }));
    } catch (err) {
      // CV-UPLOAD-UX-01: model_not_free/model_invalid (nicht transient, werden
      // von withModelFallback nicht intern weitergereicht) fuehren ebenfalls
      // zur Modellauswahl-Recovery am Ort — kein Ruecksprung zum Dokument.
      const modelError =
        isModelUnavailable(err) ||
        (err instanceof ApiError && (err.code === "model_not_free" || err.code === "model_invalid"));
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : modelError
            ? t("model.unavailable")
            : t("cv.processError"),
        errorBackStep: modelError ? "model-selection" : null,
      }));
    }
  };

  // BUG-07: Abbrechen schließt das Consent-Overlay, ohne die Zustimmung zu
  // erteilen. Der Schritt bleibt "consent-required" (Consent ausstehend), das
  // Dokument bleibt erhalten und die Verarbeitung startet nicht. Über
  // "Einwilligung anzeigen" kann das Overlay erneut geöffnet werden.
  const handleCvConsentCancel = () => {
    setConsentDismissed(true);
  };

  const handleAnonymizationChange = (mode: string) => {
    setCvState((prev) => ({ ...prev, anonymizationMode: mode as AnonymizationMode }));
  };

  const handleGoalChange = (goal: ProcessingGoal) => {
    setCvState((prev) => ({ ...prev, processingGoal: goal }));
  };

  const handleGoalExecute = () => {
    // CV-UPLOAD-UX-04: Skills-Bestaetigung kommt VOR der Ausfuehrung — fuer
    // BEIDE Ziele (ATS-Analyse + KI-Jobsuche). Ohne bestaetigte Skills wuerde
    // die ATS-Analyse den CV still gegen seine eigenen (vorgeschlagenen)
    // Skills pruefen — faktisch bedeutungslos. Erst nach dem Skill-Confirm
    // startet die jeweilige Verarbeitung (siehe handleSkillSelectionConfirm).
    // CV-PROFILE-LISTS-03/05: Namensvorschlag fuer das ATS-Profil —
    // "<Zielrolle> - ATS1", "<Zielrolle> - ATS2", … (Zaehler aus der ATS-
    // Liste dieses CVs).
    if (cvState.processingGoal === "ats") {
      const doc = cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0]);
      const count = readCvProfileLists(doc?.hash ?? null).atsProfiles.length + 1;
      const base = cvState.cvProfile?.targetRoles?.[0] || cvState.suggestedProfile?.targetRoles[0] || "ATS";
      setAtsProfileName(`${base} - ATS${count}`);
    }
    // isProcessing bleibt false: skill-selection benoetigt bedienbare
    // Checkboxen (BUG-16).
    // CV-UPLOAD-UX-06: Default = ALLE erkannten Skills vorausgewaehlt
    // (Schritt dient der Bestaetigung/Abwahl, nicht der Leer-Auswahl).
    setCvState((prev) => ({
      ...prev,
      step: "skill-selection",
      isProcessing: false,
      selectedSkills: [...(prev.suggestedProfile?.skills ?? [])],
    }));
  };

  const handleSkillSelectionChange = (skills: string[]) => {
    setCvState((prev) => ({ ...prev, selectedSkills: skills }));
  };

  const handleSkillSelectionConfirm = () => {
    if (cvState.selectedSkills.length === 0) {
      return;
    }
    // CV-UPLOAD-UX-04/07: ATS-Ziel — die bestaetigten Skills werden als
    // benanntes ATS-Profil gespeichert (CV-PROFILE-LISTS-01) und der Workflow
    // SCHLIESST danach zum CV-Bereich; keine automatische Analyse mehr an
    // dieser Stelle (ATS-Analyse laeuft pro Treffer-Job, s. AtsOverlay).
    if (cvState.processingGoal === "ats") {
      const doc = cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0]);
      let savedName: string | null = null;
      if (doc?.hash) {
        savedName =
          saveCvAtsProfile(
            doc.hash,
            atsProfileName,
            cvState.selectedSkills,
            cvState.cvProfile?.targetRoles ?? cvState.suggestedProfile?.targetRoles ?? []
          )?.name ?? null;
      }
      setCvState((prev) => ({
        ...prev,
        step: "document-selected",
        isProcessing: false,
        error: null,
      }));
      setStatus({ type: "info", message: t("cv.atsProfileSaved", { name: savedName ?? "" }) });
      return;
    }
    setCvState((prev) => ({ ...prev, isProcessing: true }));
    // Use selected skills for the search profile - JSON encode to preserve
    // multi-word skill boundaries. Quelle: bestaetigtes CV-Profil zuerst
    // (cvProfile), Legacy-Fallback cvState.profile.
    const baseProfile = cvState.cvProfile ?? cvState.profile ?? { skills: "", targetRoles: [], city: "", radiusKm: null, workModes: [], employmentTypes: ["full_time"] };
    const searchProfile = { ...baseProfile, skills: JSON.stringify(cvState.selectedSkills) };
    runAiSearchWithProfile(searchProfile, t);
  };

  const runAiSearchWithProfile = async (
    searchProfile: Profile,
    t: (key: string, vars?: Record<string, string | number>) => string
  ) => {
    console.debug("[runAiSearchWithProfile] searchProfile:", JSON.stringify(searchProfile, null, 2));
    if (!searchProfile || !searchProfile.skills) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.aiSearchNoProfile"),
      }));
      return;
    }

    try {
      // First, search for jobs using the existing job search API
      const jobsResponse = await fetchJobs(searchProfile);

      if (!jobsResponse.jobs.length) {
        setCvState((prev) => ({
          ...prev,
          step: "ai-complete",
          isProcessing: false,
          aiSearchResult: { jobs: [], meta: { totalScanned: 0, totalFiltered: 0 } },
        }));
        return;
      }

      // Then, use AI to match/score the jobs
      const { data: matchResult } = await withModelFallback({
        initialModel: effectiveModel,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) => fetchMatches(searchProfile, jobsResponse.jobs, m, attempt),
      });

      // Create a compatible JobsResponse meta from matchResult
      const aiSearchMeta = {
        totalScanned: jobsResponse.meta?.totalScanned,
        totalFiltered: jobsResponse.meta?.totalFiltered,
        city: jobsResponse.meta?.city,
        keywords: jobsResponse.meta?.keywords,
        sources: jobsResponse.meta?.sources,
        sourceCounts: jobsResponse.meta?.sourceCounts,
        disabledSources: jobsResponse.meta?.disabledSources,
        sourceDetails: jobsResponse.meta?.sourceDetails,
        jobsCombined: jobsResponse.meta?.jobsCombined,
        apify: jobsResponse.meta?.apify,
        evaluated: matchResult.meta?.evaluated,
        note: matchResult.meta?.note,
        totalFound: matchResult.meta?.totalFound,
        displayedInitially: matchResult.meta?.displayedInitially,
      };

      setCvState((prev) => ({
        ...prev,
        step: "ai-complete",
        isProcessing: false,
        aiSearchResult: { jobs: jobsResponse.jobs, meta: aiSearchMeta },
        matches: matchResult.matches,
        foundJobs: jobsResponse.jobs,
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.aiSearchError"),
        errorBackStep: isModelUnavailable(err) ? "model-selection" : null,
      }));
    }
  };

  const runAtsProcessing = async (t: (key: string, vars?: Record<string, string | number>) => string) => {
    // BUG-20: Quelle der Wahrheit für den ATS-Pfad im CV-Workflow ist das
    // bestätigte CV-Profil (cvState.cvProfile). cvState.profile ist ein
    // verwaister Legacy-State, der im CV-Flow nie befüllt wird (dadurch
    // bisher immer cv.atsNoProfile). Das App-weite Such-Profile (manuelle
    // Suche) wird bewusst NICHT verwendet — Tab-Isolation bleibt erhalten.
    const atsProfile = cvState.cvProfile ?? cvState.profile;
    const selectedDoc = cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0]);
    const jobForAts = selectedDoc ? {
      title: cvState.suggestedProfile?.targetRoles[0] || atsProfile?.targetRoles?.[0] || "",
      // CV-UPLOAD-UX-04: Primaere Basis sind die vom Benutzer bestaetigten
      // Skills (Skills-Auswahl laeuft vor der ATS-Analyse); Fallback: die vom
      // CV vorgeschlagenen Skills.
      tags: cvState.selectedSkills.length > 0
        ? cvState.selectedSkills
        : cvState.suggestedProfile?.skills || atsProfile?.skills?.split(",") || [],
      slug: "cv-ats-" + Date.now(),
    } : null;

    if (!atsProfile || !atsProfile.skills) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.atsNoProfile"),
      }));
      return;
    }

    try {
      const result = await analyzeATS(
        jobForAts || { title: "", tags: [], slug: "" },
        { skills: atsProfile.skills },
        // BUG-22: aktuell gewähltes Modell an den ATS-Request durchreichen
        { enabled: false, ...(effectiveModel ? { model: effectiveModel } : {}) }
      );

      setCvState((prev) => ({
        ...prev,
        step: "ats-complete",
        isProcessing: false,
        atsResult: result,
      }));
    } catch (err) {
      if (isModelUnavailable(err)) {
        // BUG-22: Bei Modellfehler am ATS-Punkt bleiben: dokumente, consent,
        // cvProfile und ATS-Eingaben bleiben erhalten; nur das Modell wird
        // neu gewählt und ausschließlich ATS erneut gestartet.
        setCvState((prev) => ({
          ...prev,
          step: "ats-model-recovery",
          isProcessing: false,
          error: t("cv.atsModelUnavailable"),
        }));
        return;
      }
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : t("cv.atsProcessError"),
        errorBackStep: null,
      }));
    }
  };

  const handleImprovementSelectionChange = (ids: string[]) => {
    setCvState((prev) => ({ ...prev, selectedImprovementIds: ids }));
  };

  const handleImprovementExecute = async () => {
    const selectedIds = cvState.selectedImprovementIds;
    if (selectedIds.length === 0) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementNoSelectionError"),
      }));
      return;
    }

    if (!cvState.improvementRecommendations || cvState.improvementRecommendations.length === 0) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementNoSelectionError"),
      }));
      return;
    }

    // Store original profile before improvements
    const originalProfile = cvState.profile ? { ...cvState.profile } : null;

    setCvState((prev) => ({
      ...prev,
      step: "improving",
      isProcessing: true,
    }));

    try {
      const result = await applyCvImprovement({
        profile: cvState.profile!,
        selectedRecommendationIds: cvState.selectedImprovementIds,
        allRecommendations: cvState.improvementRecommendations!,
      });

      if (result.data.appliedCount === 0) {
        setCvState((prev) => ({
          ...prev,
          step: "improved",
          isProcessing: false,
          improvementResult: {
            improvedProfile: cvState.profile!,
            appliedCount: 0,
            appliedRecommendations: [],
          },
          originalProfile: originalProfile,
        }));
      } else {
        const improvedProfile = result.data.improvedProfile;
        // Store original profile and transition to improved step (not reanalysis yet)
        setCvState((prev) => ({
          ...prev,
          step: "improved",
          isProcessing: false,
          improvementResult: {
            improvedProfile: improvedProfile,
            appliedCount: result.data.appliedCount,
            appliedRecommendations: result.data.appliedRecommendations,
          },
          originalProfile: originalProfile,
          beforeAtsResult: null,
          afterAtsResult: null,
          reanalysisResult: null,
        }));
        // Update the main profile to the improved version
        setProfile(improvedProfile);
      }
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementError"),
      }));
    }
  };

  const handleImprovementBack = () => {
    setCvState((prev) => ({
      ...prev,
      step: "goal-selection",
      improvementRecommendations: null,
      selectedImprovementIds: [],
      improvementResult: null,
      originalProfile: null,
    }));
  };

  const handleReanalysisExecute = async () => {
    if (!cvState.originalProfile || !cvState.profile) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.reanalysisError"),
      }));
      return;
    }

    // Create a job object for ATS analysis from the current profile
    const jobForAts = {
      title: cvState.suggestedProfile?.targetRoles[0] || cvState.profile?.targetRoles?.[0] || "",
      tags: cvState.suggestedProfile?.skills || cvState.profile?.skills?.split(",") || [],
      slug: "cv-ats-reanalysis-" + Date.now(),
    };

    setCvState((prev) => ({
      ...prev,
      step: "reanalysis",
      isProcessing: true,
    }));

    try {
      // Run ATS analysis on original profile
      const beforeResponse = await analyzeATS(
        jobForAts,
        { skills: cvState.originalProfile.skills },
        { enabled: false }
      );

      // Run ATS analysis on improved profile
      const afterResponse = await analyzeATS(
        jobForAts,
        { skills: cvState.profile!.skills },
        { enabled: false }
      );

      const beforeAnalysis = beforeResponse.analysis;
      const afterAnalysis = afterResponse.analysis;

      // Compute delta
      const delta = {
        scoreDelta: afterAnalysis.score - beforeAnalysis.score,
        coverageDelta: afterAnalysis.keywordCoverage.overall - beforeAnalysis.keywordCoverage.overall,
      };

      setCvState((prev) => ({
        ...prev,
        step: "comparison",
        isProcessing: false,
        beforeAtsResult: beforeAnalysis,
        afterAtsResult: afterAnalysis,
        reanalysisResult: {
          before: beforeAnalysis,
          after: afterAnalysis,
          delta,
        },
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.reanalysisError"),
        errorBackStep: isModelUnavailable(err) ? "model-selection" : null,
      }));
    }
  };

  const handleReanalysisBack = () => {
    setCvState((prev) => ({
      ...prev,
      step: "improved",
      reanalysisResult: null,
      beforeAtsResult: null,
      afterAtsResult: null,
    }));
  };

  const handleMatchImpactExecute = async (job: Job) => {
    if (!cvState.originalProfile || !cvState.profile) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.matchImpactError"),
      }));
      return;
    }

    setCvState((prev) => ({
      ...prev,
      step: "comparison",
      isProcessing: true,
      matchImpactJob: job,
    }));

    try {
      const result = await computeMatchImpact({
        job: { title: job.title, tags: job.tags, slug: job.slug },
        originalProfile: { skills: cvState.originalProfile.skills, targetRoles: cvState.originalProfile.targetRoles, city: cvState.originalProfile.city },
        improvedProfile: { skills: cvState.profile!.skills, targetRoles: cvState.profile!.targetRoles, city: cvState.profile!.city },
      });

      setCvState((prev) => ({
        ...prev,
        step: "comparison",
        isProcessing: false,
        matchImpactBefore: result.data.before,
        matchImpactAfter: result.data.after,
        matchImpactDelta: result.data.delta,
        matchImpactChanges: result.data.changes,
        matchImpactJob: job,
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.matchImpactError"),
        errorBackStep: isModelUnavailable(err) ? "model-selection" : null,
      }));
    }
  };

  const handleMatchImpactBack = () => {
    setCvState((prev) => ({
      ...prev,
      step: "comparison",
      matchImpactBefore: null,
      matchImpactAfter: null,
      matchImpactDelta: null,
      matchImpactJob: null,
    }));
  };

  const handleSubmit = (submitted: Profile) => {
    if (busyRef.current) return;
    if (dataset && profilesEqual(submitted, dataset.profile)) {
      // This case should not happen anymore since rematch is now explicit via "Mit KI bewerten"
      // But keep for safety - treat as new search
      void runSearch(submitted);
    } else {
      void runSearch(submitted);
    }
  };

  // SEARCH-WORLD-04: schreibt beim Scrollen nur die CSS-Property
  // `--sw-progress` (kein State, kein Re-Rendering der App).
  const searchWorldRef = useSearchWorldMotion();

  const isSearching = phase === "searching" || phase === "scoring";
  const isMatching = phase === "matching";
  const canRematch = !!dataset && profilesEqual(dataset.profile, profile);
  const hasFoundJobs = !!dataset && foundJobs.length > 0;

  const hasResults = matches.length > 0 || foundJobs.length > 0;

  if (route === "landing" && !isSearching) {
    return (
      <div className="landing">
        <Navbar route="landing" />
        <LandingHero />
      </div>
    );
  }

  // CV-UPLOAD-UX-07/08: Quelle der gespeicherten Listen = erstes ausgewaehltes
  // Dokument (Fallback: erstes Dokument); Zuordnung ueber Inhalts-Hash.
  const listSourceDoc = cvState.documents.find((d) => d.selected) ?? cvState.documents[0] ?? null;
  const listSourceLists = readCvProfileLists(listSourceDoc?.hash ?? null);
  const activeAtsEntry =
    listSourceLists.atsProfiles.find((e) => e.id === activeAtsEntryId) ?? null;
  const listSourceDocId = listSourceDoc?.id ?? null;
  // ATS-PROFILE-INVESTIGATION-01 (Befund a): beim Wechsel des Quelldokuments
  // zeigen bestehende Auswahl-IDs auf fremde Listen -> Auswahl zuruecksetzen.
  useEffect(() => {
    setSelectedSavedSearchId(null);
    setActiveAtsEntryId(null);
  }, [listSourceDocId]);

  const searchCard = (
    <section className="card search-card">
      <SearchForm
        phase={phase}
        value={profile}
        onChange={handleProfileChange}
        onSubmit={handleSubmit}
        onMatch={handleMatchWithAI}
        matching={isMatching}
        hasJobs={hasFoundJobs}
        rematch={canRematch}
        onWorkflowStart={handleCvUploadStart}
      />
      {/* CV-UPLOAD-UX-08: Box fuer gespeicherte Profile UNTER dem
          CV-Upload-Bereich (Suchmaske): Suchprofil + ATS-Profil waehlen,
          jeweils per kleinem Button direkt zum vorbefuellten Bearbeitungs-
          Step springen; darunter der Job-Search-Startbutton. */}
      {cvState.step === "document-selected" &&
        listSourceDoc?.hash &&
        (listSourceLists.searchProfiles.length > 0 || listSourceLists.atsProfiles.length > 0) && (
          <div className="cv-saved-profiles" role="region" aria-label={t("cv.profilesRegionAria")}>
            {listSourceLists.searchProfiles.length > 0 && (
              <div className="field cv-saved-profiles__field">
                <label htmlFor="cv-saved-search-profile">{t("cv.chooseSearchProfile")}</label>
                <div className="cv-saved-profiles__row">
                  <select
                    id="cv-saved-search-profile"
                    value={selectedSavedSearchId ?? ""}
                    onChange={(e) => setSelectedSavedSearchId(e.target.value || null)}
                    disabled={cvState.isProcessing}
                  >
                    <option value="">{t("cv.choosePlaceholder")}</option>
                    {listSourceLists.searchProfiles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost cv-saved-profiles__edit"
                    disabled={!selectedSavedSearchId || cvState.isProcessing}
                    onClick={editSavedSearchProfile}
                  >
                    {t("cv.editShort")}
                  </button>
                </div>
              </div>
            )}
            {listSourceLists.atsProfiles.length > 0 && (
              <div className="field cv-saved-profiles__field">
                <label htmlFor="cv-saved-ats-profile">{t("cv.chooseAtsProfile")}</label>
                <div className="cv-saved-profiles__row">
                  <select
                    id="cv-saved-ats-profile"
                    value={activeAtsEntryId ?? ""}
                    onChange={(e) => setActiveAtsEntryId(e.target.value || null)}
                    disabled={cvState.isProcessing}
                  >
                    <option value="">{t("cv.choosePlaceholder")}</option>
                    {listSourceLists.atsProfiles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost cv-saved-profiles__edit"
                    disabled={!activeAtsEntryId || cvState.isProcessing}
                    onClick={editSavedAtsProfile}
                  >
                    {t("cv.editShort")}
                  </button>
                </div>
              </div>
            )}
            {/* CV-UPLOAD-UX-10: Start erst mit gewaehltem Suchprofil;
                Hinweis, solange nichts ausgewaehlt ist */}
            {listSourceLists.searchProfiles.length > 0 && (
              <>
                <button
                  type="button"
                  className="cv-continue-btn cv-saved-profiles__start"
                  onClick={startSearchWithSavedProfile}
                  disabled={cvState.isProcessing || !selectedSavedSearchId || isSearching || isMatching}
                >
                  <span className="btn-label">{isSearching ? t("search.searching") : t("cv.startSearch")}</span>
                  {isSearching && <span className="spinner" />}
                </button>
                {!selectedSavedSearchId && (
                  <p className="cv-saved-profiles__hint">{t("cv.startSearchHint")}</p>
                )}
              </>
            )}
          </div>
        )}
      <JobSources jobs={foundJobs} deliveredCounts={foundSources} disabledSources={foundDisabledSources} sourceReasons={foundSourceReasons} />
      <div className="model-divider" aria-hidden="true" />
      <ModelSelector
        state={modelsState}
        models={models}
        defaultModel={defaultModel}
        recommendedModel={recommendedModel}
        value={effectiveModel}
        onChange={handleModelChange}
        disabled={isSearching || isMatching || cvState.isProcessing}
        attention={modelExhausted}
      />
      <Status status={status} />
    </section>
  );

  // CV Processing UI - rendered when CV flow is active
  // BUG-14..19 + CV-UPLOAD-UX-02: EIN gemeinsames Overlay für den
  // CV-Verarbeitungs-Workflow auf ALLEN Viewports (Inhalt wechselt je nach
  // cvState.step), ab der Einwilligung.
  // Inline bleiben:
  // - document-selected (CV-Liste): sie ist der Einstiegspunkt und bleibt ohne
  //   Backdrop sichtbar, damit der bestehende Upload-/Schnellsuch-Pfad
  //   (CvUpload -> "Profil übernehmen und Jobs finden") ungestört funktioniert.
  // - consent-required im geschlossenen Zustand (ausstehend + "Einwilligung anzeigen").
  // - ats-complete (ATSModal ist selbst ein Overlay — kein verschachtelter Modal-Stack).
  const cvOverlayActive =
    cvState.step !== "document-selected" &&
    !(cvState.step === "consent-required" && consentDismissed) &&
    cvState.step !== "ats-complete";

  // CV-UPLOAD-UX-09: Overlay in JEDEM Step schliessen (X im Karten-Kopf).
  // Zustand + Dokumente bleiben erhalten; Ziel = Dokumentliste inline unter
  // der Suchmaske (bzw. idle, wenn keine Dokumente). Im Consent-Step zaehlt
  // Schliessen als "ausstehend" (wieder oeffnbar, wie Abbrechen).
  const handleCvWorkflowClose = () => {
    setEditingSearchName(null);
    if (cvState.step === "consent-required") {
      // Im Consent-Step zaehlt Schliessen als "ausstehend" (wieder oeffnbar
      // ueber "Einwilligung anzeigen") — kein Step-Wechsel.
      setConsentDismissed(true);
      return;
    }
    setCvState((prev) => ({
      ...prev,
      step: prev.documents.length > 0 ? "document-selected" : "idle",
    }));
  };

  const cvProcessingCard = (
    <section
      ref={cvWorkflowRef}
      tabIndex={-1}
      className="card cv-processing-card"
      aria-labelledby="cv-processing-title"
    >
      <div className="cv-processing-card__head">
        <h2 id="cv-processing-title" className="cv-processing-title">{t("cv.statusTitle")}</h2>
        {/* CV-UPLOAD-UX-09: Schliessen in jedem Overlay-Step */}
        {cvOverlayActive && (
          <button
            type="button"
            className="cv-processing-card__close"
            aria-label={t("cv.workflowClose")}
            onClick={handleCvWorkflowClose}
          >
            ×
          </button>
        )}
      </div>

      <CvProcessingStatus step={cvState.step} error={cvState.error} documentName={cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0])?.name ?? null} />

      {/* CV-UPLOAD-UX-03: Anzeige = tatsaechliche Reihenfolge: Optionen
          (Anonymisierung) VOR Modellwahl VOR Profil-Erstellung (erster
          Modell-Call); profile-ready zeigt ERSTMALS "Profil" als abgeschlossen
          bzw. aktuell (zuvor Fallback auf "document"). */}
      <CvProcessingSteps currentStep={
        cvState.step === "document-selected" ? "document" :
        cvState.step === "consent-required" || cvState.step === "consent-given" ? "consent" :
        cvState.step === "creating-profile" ? "anonymization" :
        cvState.step === "model-selection" ? "model" :
        cvState.step === "anonymizing" ? "profile" :
        cvState.step === "profile-ready" ? "profile" :
        cvState.step === "goal-selection" ? "goal" :
        cvState.step === "skill-selection" ? "skill" :
        // CV-UPLOAD-UX-05: Verbesserung/Re-Analyse/Match-Impact mappen auf
        // ihre eigenen Schritte (statt alle auf "target")
        cvState.step === "ats-processing" || cvState.step === "ats-model-recovery" ? "target" :
        cvState.step === "ai-searching" ? "processing" :
        cvState.step === "improvement-selection" ? "improvement" :
        cvState.step === "improving" ? "processing" :
        cvState.step === "improved" ? "complete" :
        cvState.step === "reanalysis" ? "reanalysis" :
        cvState.step === "comparison" ? "complete" :
        cvState.step === "match-impact-select" ? "match-impact" :
        cvState.step === "success" ? "complete" : "document"
      } />

      {/* BUG-07: Die Liste bleibt auch im Consent-Schritt sichtbar (disabled),
          damit das hochgeladene Dokument nach dem Schließen des Overlays
          erhalten und sichtbar bleibt. */}

      {(cvState.step === "document-selected" || cvState.step === "consent-required") && (
        <CvDocumentList
          documents={cvState.documents}
          onSelect={handleSelectCvDocument}
          onRemove={handleRemoveCvDocument}
          onAddFiles={handleAddCvFiles}
          onProcess={handleCvProcess}
          onSearch={handleSearchWithSelectedCvs}
          onShowProfiles={setProfilesDocId}
          onRemoveData={handleCvRemoveData}
          disabled={cvState.isProcessing || cvState.step !== "document-selected"}
          processing={cvState.isProcessing}
          searching={isSearching || isMatching}
        />
      )}

      {cvState.step === "consent-required" && (
        consentDismissed ? (
          <div className="cv-consent-pending" role="status">
            <p>{t("cv.consentPending")}</p>
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => setConsentDismissed(false)}
              disabled={cvState.isProcessing}
            >
              {t("cv.showConsent")}
            </button>
          </div>
        ) : (
          <CvConsentGate
            fileName={cvState.documents.find((d) => cvState.selectedDocumentIds.includes(d.id))?.name ?? cvState.documents[0]?.name ?? ""}
            onAccept={handleCvConsentAccept}
            onCancel={handleCvConsentCancel}
            processingInfo={cvState.processingGoal === "ats" ? t("cv.goalATSLabel") : t("cv.goalAISearchLabel")}
            externalAI={true}
            disabled={cvState.isProcessing}
          />
        )
      )}

      {cvState.step === "model-selection" && (
        <div className="cv-model-selection" role="region" aria-labelledby="cv-model-selection-title">
          <h3 id="cv-model-selection-title" className="cv-model-selection__title">
            {t("cv.modelSelect")}
          </h3>
          <p className="cv-model-selection__description">{t("cv.modelSelectDescription")}</p>
          <ModelSelector
            state={modelsState}
            models={models}
            defaultModel={defaultModel}
            recommendedModel={recommendedModel}
            value={effectiveModel}
            onChange={handleModelChange}
            disabled={cvState.isProcessing || isSearching || isMatching}
            attention={modelExhausted}
          />
          {cvState.isProcessing && (
            <p className="cv-model-selection__locked">{t("cv.modelSelectionLocked")}</p>
          )}
          <div className="cv-model-selection__actions">
            {/* CV-UPLOAD-UX-03: Weiter startet jetzt direkt die Verarbeitung
                (anonymizing): Anonymisierungs-Modus wurde im Schritt davor
                (creating-profile) festgelegt — Anonymisierung erfolgt vor dem
                ersten Modell-Call. */}
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => {
                const selectedDoc = cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0]);
                if (selectedDoc) handleCvContinue(selectedDoc);
              }}
              disabled={cvState.isProcessing || modelsState !== "ready" || !effectiveModel}
            >
              {cvState.isProcessing ? t("cv.continueProcessing") : t("cv.continue")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            {/* BUG-11: klarer Zurückweg, CV-State bleibt erhalten */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "creating-profile" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToOptions")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "creating-profile" && (
        <>
          {/* CV-UPLOAD-UX-03: Optionen inkl. Anonymisierungs-Modus kommen VOR
              der Modellwahl — die Anonymisierung wird damit festgelegt, bevor
              irgendein Modell-Call erfolgen kann (Privacy Boundary). */}
          <CvAnonymizationChoice
            value={cvState.anonymizationMode}
            onChange={handleAnonymizationChange}
            disabled={cvState.isProcessing}
          />
          <CvGoalSelection
            value={cvState.processingGoal}
            onChange={handleGoalChange}
            disabled={cvState.isProcessing}
          />
          <div className="cv-continue-actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => setCvState((prev) => ({ ...prev, step: "model-selection" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.continue")}
            </button>
            {/* BUG-11: klarer Zurückweg, CV-State bleibt erhalten */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "document-selected" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToDocuments")}
            </button>
          </div>
        </>
      )}

      {cvState.step === "anonymizing" && (
        <div className="cv-anonymizing" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{cvState.anonymizationMode === "anonymized" ? t("cv.anonymizingText") : t("cv.preparingProfile")}</p>
        </div>
      )}

      {cvState.step === "profile-ready" && cvState.suggestedProfile && (
        <CvProfileResult
          suggested={cvState.suggestedProfile}
          busy={cvState.isProcessing}
          loadingLabel={t("cv.savingProfile")}
          // CV-PROFILE-LISTS-03/05 + CV-UPLOAD-UX-08: im Edit-Modus der
          // bestehende Name; sonst Vorschlag "<Zielrolle> - Profil<n>"
          defaultName={
            editingSearchName ??
            `${
              cvState.suggestedProfile.targetRoles[0] || "Profil"
            } - Profil${
              readCvProfileLists(
                cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0])?.hash ?? null
              ).searchProfiles.length + 1
            }`
          }
          onConfirm={(profile, profileName) => {
            // CV-PROFILE-LISTS-01/08: Suchprofil unter seinem Namen an das CV
            // haengen (gleicher Name ueberschreibt den Eintrag).
            const doc = cvState.documents.find((d) => d.id === cvState.selectedDocumentIds[0]);
            if (doc?.hash) {
              const saved = saveCvSearchProfile(doc.hash, profileName, profile);
              if (saved) setSelectedSavedSearchId(saved.id);
            }
            setEditingSearchName(null);
            setCvState((prev) => ({
              ...prev,
              cvProfile: profile,
              step: "goal-selection",
              // suggestedProfile bleibt erhalten: der Skill-Auswahl-Step
              // benötigt die extrahierten Skills (BUG-16).
              fallbackNote: false,
            }));
          }}
          onBack={() => {
            setEditingSearchName(null);
            setCvState((prev) => ({
              ...prev,
              step: "document-selected",
              suggestedProfile: null,
              fallbackNote: false,
            }));
          }}
        />
      )}

      {cvState.step === "goal-selection" && (
        <div className="cv-goal-execution" role="region" aria-labelledby="cv-goal-execution-title">
          <h3 id="cv-goal-execution-title" className="cv-goal-execution__title">
            {t("cv.goalExecutionTitle")}
          </h3>
          <p className="cv-goal-execution__description">{t("cv.goalExecutionDescription")}</p>
          <CvGoalSelection
            value={cvState.processingGoal}
            onChange={handleGoalChange}
            disabled={cvState.isProcessing}
          />
          <div className="cv-goal-execution__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleGoalExecute}
              disabled={cvState.isProcessing}
            >
              {cvState.isProcessing ? t("cv.executingGoal") : t("cv.executeGoal")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "profile-ready" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToProfile")}
            </button>
          </div>
        </div>
      )}

      {/* CV-UPLOAD-UX-04: Skills-Auswahl gilt fuer BEIDE Ziele (ATS +
          KI-Jobsuche) — die Ausfuehrung startet erst nach der Bestaetigung
          der Skills. */}
      {cvState.step === "skill-selection" && cvState.suggestedProfile && (
        <div className="cv-skill-selection" role="region" aria-labelledby="cv-skill-selection-title">
          <h3 id="cv-skill-selection-title" className="cv-skill-selection__title">
            {cvState.processingGoal === "ats" ? t("cv.skillSelectTitleAts") : t("cv.skillSelectTitle")}
          </h3>
          <p className="cv-skill-selection__description">
            {cvState.processingGoal === "ats" ? t("cv.skillSelectDescriptionAts") : t("cv.skillSelectDescription")}
          </p>
          {/* CV-PROFILE-LISTS-01/05: Name fuer den ATS-Profil-Eintrag (Liste
              des CVs) — ganz oben in der Eingabereihenfolge des Steps */}
          {cvState.processingGoal === "ats" && (
            <div className="field">
              <label htmlFor="cv-ats-profile-name">{t("cv.atsProfileNameLabel")}</label>
              <input
                id="cv-ats-profile-name"
                type="text"
                value={atsProfileName}
                onChange={(e) => setAtsProfileName(e.target.value)}
                disabled={cvState.isProcessing}
                autoComplete="off"
                placeholder={t("cv.atsProfileNamePlaceholder")}
                // CV-PROFILE-LISTS-03: Klick markiert den ganzen Vorschlag
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
          {/* CV-UPLOAD-UX-06: Bulk-Auswahl — alle Skills selektieren bzw.
              abwaehlen (Default beim Betreten: alle selektiert). */}
          <div className="cv-skill-selection__bulk-actions">
            <button
              type="button"
              className="btn-ghost cv-skill-selection__bulk-btn"
              onClick={() => handleSkillSelectionChange([...(cvState.suggestedProfile?.skills ?? [])])}
              disabled={cvState.isProcessing}
            >
              {t("cv.selectAll")}
            </button>
            <button
              type="button"
              className="btn-ghost cv-skill-selection__bulk-btn"
              onClick={() => handleSkillSelectionChange([])}
              disabled={cvState.isProcessing}
            >
              {t("cv.deselectAll")}
            </button>
          </div>
          <div className="cv-skill-selection__list" role="listbox" aria-label={t("cv.skillSelectTitle")}>
            {cvState.suggestedProfile.skills.map((skill, index) => (
              <label key={index} className={`cv-skill-selection__item${cvState.selectedSkills.includes(skill) ? " selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={cvState.selectedSkills.includes(skill)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSkillSelectionChange([...cvState.selectedSkills, skill]);
                    } else {
                      handleSkillSelectionChange(cvState.selectedSkills.filter(s => s !== skill));
                    }
                  }}
                  disabled={cvState.isProcessing}
                  className="cv-skill-selection__checkbox"
                  aria-label={skill}
                />
                <span className="cv-skill-selection__label">{skill}</span>
              </label>
            ))}
          </div>
          <div className="cv-skill-selection__add">
            <input
              type="text"
              placeholder={t("cv.skillSelectPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  const newSkill = e.currentTarget.value.trim();
                  if (!cvState.selectedSkills.includes(newSkill)) {
                    handleSkillSelectionChange([...cvState.selectedSkills, newSkill]);
                  }
                  e.currentTarget.value = "";
                }
              }}
              disabled={cvState.isProcessing}
              className="cv-skill-selection__input"
              aria-label={t("cv.skillSelectAdd")}
            />
          </div>
          {cvState.selectedSkills.length === 0 && (
            <p className="cv-skill-selection__error">{t("cv.skillSelectNoSkills")}</p>
          )}
          <div className="cv-skill-selection__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleSkillSelectionConfirm}
              disabled={cvState.isProcessing || cvState.selectedSkills.length === 0}
            >
              {cvState.isProcessing ? t("cv.executingGoal") : t("cv.skillSelectContinue")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "goal-selection", selectedSkills: [] }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToProfile")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "improvement-selection" && cvState.improvementRecommendations && (
        <div className="cv-improvement-execution" role="region" aria-labelledby="cv-improvement-title">
          <h3 id="cv-improvement-title" className="cv-improvement__title">
            {t("cv.improvementTitle")}
          </h3>
          <p className="cv-improvement__description">{t("cv.improvementDescription")}</p>
          <p className="cv-improvement__select-label">{t("cv.improvementSelectLabel")}</p>
          <div className="cv-improvement__options" role="listbox" aria-label={t("cv.improvementSelectLabel")}>
            {cvState.improvementRecommendations.map((rec) => (
              <label
                key={rec.requirementId}
                className={`cv-improvement__option${cvState.selectedImprovementIds.includes(rec.requirementId) ? " selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={cvState.selectedImprovementIds.includes(rec.requirementId)}
                  onChange={() => {
                    const newIds = cvState.selectedImprovementIds.includes(rec.requirementId)
                      ? cvState.selectedImprovementIds.filter((id) => id !== rec.requirementId)
                      : [...cvState.selectedImprovementIds, rec.requirementId];
                    handleImprovementSelectionChange(newIds);
                  }}
                  disabled={cvState.isProcessing}
                  className="cv-improvement__checkbox"
                  aria-label={`${rec.changeTypeLabel}: ${rec.proposedChange}`}
                />
                <div className="cv-improvement__option-content">
                  <span className="cv-improvement__label">{rec.changeTypeLabel}</span>
                  <span className="cv-improvement__description">{rec.proposedChange}</span>
                  <span className="cv-improvement__rationale">{rec.rationale}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="cv-improvement__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleImprovementExecute}
              disabled={cvState.isProcessing || cvState.selectedImprovementIds.length === 0}
            >
              {cvState.isProcessing ? t("cv.applyingImprovement") : t("cv.applyImprovement")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleImprovementBack}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "improved" && cvState.improvementResult && (
        <div className="cv-improved" role="region" aria-labelledby="cv-improved-title">
          <h3 id="cv-improved-title" className="cv-improved__title">
            {t("cv.improvementApplied")}
          </h3>
          <p className="cv-improved__message">
            {t("cv.improvementAppliedCountMsg", { count: cvState.improvementResult.appliedCount })}
          </p>
          {cvState.improvementResult.appliedRecommendations.length > 0 && (
            <div className="cv-improved__applied">
              <h4>{t("cv.improvementAppliedSkills", { skills: cvState.improvementResult.appliedRecommendations.join(", ") })}</h4>
            </div>
          )}
          <div className="cv-improved__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleReanalysisExecute}
              disabled={cvState.isProcessing}
            >
              {cvState.isProcessing ? t("cv.reanalysisRunning") : t("cv.reanalysisTitle")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleImprovementBack}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "ats-processing" && (
        <div className="cv-ats-processing" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{t("cv.atsProcessing")}</p>
        </div>
      )}

      {/* BUG-22: ATS-Recovery am ATS-Punkt — Modell wechseln, nur ATS erneut starten. */}
      {cvState.step === "ats-model-recovery" && (
        <div className="cv-ats-recovery" role="alert">
          <p className="alert alert-error">{cvState.error}</p>
          <div className="cv-model-selection" role="region" aria-labelledby="cv-ats-model-recovery-title">
            <h3 id="cv-ats-model-recovery-title" className="cv-model-selection__title">
              {t("cv.modelSelect")}
            </h3>
            <ModelSelector
              state={modelsState}
              models={models}
              defaultModel={defaultModel}
              recommendedModel={recommendedModel}
              value={effectiveModel}
              onChange={handleModelChange}
              disabled={cvState.isProcessing || isSearching || isMatching}
              attention={true}
            />
          </div>
          <div className="cv-continue-actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => {
                setCvState((prev) => ({ ...prev, step: "ats-processing", isProcessing: true, error: null }));
                void runAtsProcessing(t);
              }}
              disabled={cvState.isProcessing}
            >
              {cvState.isProcessing ? t("cv.atsProcessing") : t("cv.atsRetry")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "goal-selection", error: null }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "ats-complete" && cvState.atsResult && (cvState.cvProfile ?? cvState.profile) && (
        <ATSModal
          job={{
            title: "CV ATS Analysis",
            company_name: "",
            location: [],
            remote: false,
            tags: [],
            url: "",
            slug: "cv-ats-analysis",
          }}
          profile={(cvState.cvProfile ?? cvState.profile)!}
          onClose={() => setCvState((prev) => ({ ...prev, step: "goal-selection", atsResult: null }))}
        />
      )}

      {cvState.step === "ai-searching" && (
        <div className="cv-ai-searching" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{t("cv.aiSearching")}</p>
        </div>
      )}

      {cvState.step === "ai-complete" && cvState.aiSearchResult && (
        <div className="cv-ai-complete">
          {cvState.aiSearchResult.jobs.length > 0 ? (
            <p className="cv-ai-complete__message">{t("cv.aiSearchComplete", { count: cvState.aiSearchResult.jobs.length })}</p>
          ) : (
            <p className="cv-ai-complete__message">{t("cv.aiSearchNoResults")}</p>
          )}
          <div className="cv-ai-complete__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => setCvState((prev) => ({ ...prev, step: "goal-selection", aiSearchResult: null, matches: [], foundJobs: [] }))}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "reanalysis" && (
        <div className="cv-reanalysis" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{cvState.isProcessing ? t("cv.reanalysisRunning") : t("cv.reanalysisDescription")}</p>
        </div>
      )}

      {cvState.step === "comparison" && cvState.reanalysisResult && (
        <div className="cv-comparison" role="region" aria-labelledby="cv-comparison-title">
          <h3 id="cv-comparison-title" className="cv-comparison__title">
            {t("cv.comparisonTitle")}
          </h3>
          <p className="cv-comparison__description">{t("cv.comparisonDescription")}</p>

          <div className="cv-comparison__scores">
            <div className="cv-comparison__score-card">
              <span className="cv-comparison__label">{t("cv.comparisonScoreLabel")}</span>
              <div className="cv-comparison__values">
                <span className="cv-comparison__before">{t("cv.comparisonBefore", { score: cvState.reanalysisResult.before.score })}</span>
                <span className="cv-comparison__arrow">→</span>
                <span className="cv-comparison__after">{t("cv.comparisonAfter", { score: cvState.reanalysisResult.after.score })}</span>
              </div>
              <span className={`cv-comparison__delta ${cvState.reanalysisResult.delta.scoreDelta >= 0 ? "positive" : "negative"}`}>
                {cvState.reanalysisResult.delta.scoreDelta >= 0 ? "+" : ""}{cvState.reanalysisResult.delta.scoreDelta}
              </span>
            </div>
            <div className="cv-comparison__score-card">
              <span className="cv-comparison__label">{t("cv.comparisonCoverageLabel")}</span>
              <div className="cv-comparison__values">
                <span className="cv-comparison__before">{cvState.reanalysisResult.before.keywordCoverage.overall}%</span>
                <span className="cv-comparison__arrow">→</span>
                <span className="cv-comparison__after">{cvState.reanalysisResult.after.keywordCoverage.overall}%</span>
              </div>
              <span className={`cv-comparison__delta ${cvState.reanalysisResult.delta.coverageDelta >= 0 ? "positive" : "negative"}`}>
                {cvState.reanalysisResult.delta.coverageDelta >= 0 ? "+" : ""}{cvState.reanalysisResult.delta.coverageDelta}%
              </span>
            </div>
          </div>

          <div className="cv-comparison__requirements">
            <h4>{t("cv.comparisonRequirementsLabel")}</h4>
            <div className="cv-comparison__requirements-list">
              {cvState.reanalysisResult.delta.requirementsImproved && cvState.reanalysisResult.delta.requirementsImproved > 0 && (
                <div className="cv-comparison__category improved">
                  <span className="cv-comparison__category-label">{t("cv.comparisonImproved")} ({cvState.reanalysisResult.delta.requirementsImproved})</span>
                  <ul>
                    {cvState.reanalysisResult.delta.requirementsImprovedDetails?.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cvState.reanalysisResult.delta.requirementsUnchanged && cvState.reanalysisResult.delta.requirementsUnchanged > 0 && (
                <div className="cv-comparison__category unchanged">
                  <span className="cv-comparison__category-label">{t("cv.comparisonUnchanged")} ({cvState.reanalysisResult.delta.requirementsUnchanged})</span>
                  <ul>
                    {cvState.reanalysisResult.delta.requirementsUnchangedDetails?.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cvState.reanalysisResult.delta.requirementsRegressed && cvState.reanalysisResult.delta.requirementsRegressed > 0 && (
                <div className="cv-comparison__category regressed">
                  <span className="cv-comparison__category-label">{t("cv.comparisonRegressed")} ({cvState.reanalysisResult.delta.requirementsRegressed})</span>
                  <ul>
                    {cvState.reanalysisResult.delta.requirementsRegressedDetails?.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!cvState.reanalysisResult.delta.requirementsImproved &&
               !cvState.reanalysisResult.delta.requirementsUnchanged &&
               !cvState.reanalysisResult.delta.requirementsRegressed && (
                <p className="cv-comparison__no-changes">{t("cv.comparisonNoChanges")}</p>
              )}
            </div>
          </div>

          <div className="cv-comparison__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleReanalysisBack}
              disabled={cvState.isProcessing}
            >
              {t("cv.comparisonBack")}
            </button>
            {foundJobs.length > 0 && (
              <button
                type="button"
                className="cv-continue-btn"
                onClick={() => setCvState((prev) => ({ ...prev, step: "match-impact-select" }))}
                disabled={cvState.isProcessing}
              >
                {t("cv.matchImpactRunAnalysis")}
              </button>
            )}
          </div>
        </div>
      )}

      {cvState.step === "match-impact-select" && foundJobs.length > 0 && (
        <div className="cv-match-impact-select" role="region" aria-labelledby="cv-match-impact-select-title">
          <h3 id="cv-match-impact-select-title" className="cv-match-impact__title">
            {t("cv.matchImpactTitle")}
          </h3>
          <p className="cv-match-impact__description">{t("cv.matchImpactDescription")}</p>
          <p>Select a job to compare match scores:</p>
          <div className="cv-match-impact__job-list">
            {foundJobs.slice(0, 10).map((job) => (
              <button
                key={job.slug}
                type="button"
                className="cv-match-impact__job-item"
                onClick={() => handleMatchImpactExecute(job)}
                disabled={cvState.isProcessing}
              >
                <span className="cv-match-impact__job-title">{job.title}</span>
                <span className="cv-match-impact__job-company">{job.company_name}</span>
                <span className="cv-match-impact__job-location">{(job.location || []).join(", ") || (job.remote ? t("match.remote") : t("match.locationNotStated"))}</span>
              </button>
            ))}
          </div>
          <div className="cv-match-impact__actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "comparison" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.matchImpactBack")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "comparison" && cvState.matchImpactDelta && cvState.matchImpactJob && (
        <div className="cv-match-impact" role="region" aria-labelledby="cv-match-impact-title">
          <h3 id="cv-match-impact-title" className="cv-match-impact__title">
            {t("cv.matchImpactTitle")}
          </h3>
          <p className="cv-match-impact__job-info">
            {cvState.matchImpactJob.title} — {cvState.matchImpactJob.company_name}
          </p>

          <div className="cv-match-impact__scores">
            <div className="cv-match-impact__score-card">
              <span className="cv-match-impact__label">{t("cv.matchImpactBeforeLabel")}</span>
              <span className="cv-match-impact__score">{cvState.matchImpactBefore?.score ?? 0}</span>
            </div>
            <div className="cv-match-impact__score-card">
              <span className="cv-match-impact__label">{t("cv.matchImpactAfterLabel")}</span>
              <span className="cv-match-impact__score">{cvState.matchImpactAfter?.score ?? 0}</span>
            </div>
            <div className="cv-match-impact__score-card delta">
              <span className="cv-match-impact__label">{t("cv.matchImpactDeltaLabel")}</span>
              <span className={`cv-match-impact__delta ${cvState.matchImpactDelta.score >= 0 ? "positive" : "negative"}`}>
                {cvState.matchImpactDelta.score >= 0 ? "+" : ""}{cvState.matchImpactDelta.score}
              </span>
            </div>
          </div>

          <div className="cv-match-impact__changes">
            <h4>{t("cv.comparisonRequirementsLabel")}</h4>
            <div className="cv-match-impact__changes-list">
              {cvState.matchImpactChanges && cvState.matchImpactChanges.improved.length > 0 && (
                <div className="cv-match-impact__category improved">
                  <span className="cv-match-impact__category-label">{t("cv.matchImpactImproved")}</span>
                  <ul>
                    {cvState.matchImpactChanges.improved.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cvState.matchImpactChanges && cvState.matchImpactChanges.unchanged.length > 0 && (
                <div className="cv-match-impact__category unchanged">
                  <span className="cv-match-impact__category-label">{t("cv.matchImpactUnchanged")}</span>
                  <ul>
                    {cvState.matchImpactChanges.unchanged.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cvState.matchImpactChanges && cvState.matchImpactChanges.regressed.length > 0 && (
                <div className="cv-match-impact__category regressed">
                  <span className="cv-match-impact__category-label">{t("cv.matchImpactRegressed")}</span>
                  <ul>
                    {cvState.matchImpactChanges.regressed.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!cvState.matchImpactChanges || (cvState.matchImpactChanges.improved.length === 0 &&
               cvState.matchImpactChanges.unchanged.length === 0 &&
               cvState.matchImpactChanges.regressed.length === 0) && (
                <p className="cv-match-impact__no-changes">{t("cv.matchImpactNoChanges")}</p>
              )}
            </div>
          </div>

          <div className="cv-match-impact__actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={handleMatchImpactBack}
              disabled={cvState.isProcessing}
            >
              {t("cv.matchImpactBack")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "error" && cvState.error && (
        <div className="cv-error-state" role="alert">
          <p className="alert alert-error">{cvState.error}</p>
          {cvState.errorBackStep === "model-selection" ? (
            // BUG-21B: Modell-Verfügbarkeitsfehler -> direkt zurück zur
            // Modellauswahl (Dokumente/Profil bleiben erhalten)
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                setCvState((prev) => ({ ...prev, step: "model-selection", error: null, errorBackStep: null }))
              }
            >
              {t("cv.backToModelSelection")}
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setCvState((prev) => ({ ...prev, step: "document-selected", error: null, errorBackStep: null }))}>
              {t("cv.backToDocuments")}
            </button>
          )}
        </div>
      )}
    </section>
  );

  // BUG-14..19 + CV-UPLOAD-UX-02: gemeinsames Overlay auf allen Viewports
  // (bzw. Inline fuer document-selected/consent-dismissed/ats-complete oben)
  const cvProcessingUI = cvState.step !== "idle" && (
    cvOverlayActive ? (
      <div className="cv-workflow-overlay">{cvProcessingCard}</div>
    ) : (
      cvProcessingCard
    )
  );

  // CV-PROFILE-LISTS-01: Zum Profil-Overlay gehoeriges Dokument aufloesen
  const profilesDoc = profilesDocId
    ? (cvState.documents.find((d) => d.id === profilesDocId) ?? null)
    : null;

// SEARCH-WORLD-09: Das halbrunde Podium (bisher `.search-world__floor`) ist der
  // LETZTE visuelle Abschluss der Future Search World und liegt hinter dem Footer.
  // Es wird deshalb nicht mehr im World-Fluss gefuehrt, sondern zusammen mit dem
  // Footer gerendert. Voraussetzung ist exakt dieselbe Bedingung wie fuer den
  // World-Zweig weiter unten — das Podium existiert nur, wo es die World gibt.
  const showsSearchWorld =
    route !== "impressum" &&
    route !== "register" &&
    route !== "login" &&
    !(route === "landing" && !isSearching);

  if (isAuthCallback) {
    return <AuthCallback />;
  }

  if (isProfile) {
    return (
      <ErrorBoundary
        title={t("error.boundaryTitle")}
        message={t("error.boundaryMessage")}
        reloadLabel={t("error.boundaryReload")}
      >
        <Navbar route={route} />
        <main className="container legal-main">
          <ProfilePage />
        </main>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      title={t("error.boundaryTitle")}
      message={t("error.boundaryMessage")}
      reloadLabel={t("error.boundaryReload")}
    >
      <Navbar route={route} />
      {isPrinciples ? (
        <main className="container legal-main">
          <Principles />
        </main>
      ) : isPrivacy ? (
        <main className="container legal-main">
          <Privacy />
        </main>
      ) : route === "impressum" ? (
        <main className="container legal-main">
          <Imprint />
        </main>
      ) : route === "register" || route === "login" ? (
        // REGISTRATION-UI-01: Auth-Masken als reine GUI (kein Backend,
        // keine Session, keine Gast-State-Berührung).
        <main className="container legal-main">
          <div className="auth-page">
            {route === "register" ? <RegisterForm /> : <LoginForm />}
          </div>
        </main>
      ) : (
        <>
          <Hero />
          {/* SEARCH-WORLD-01/-02: durchgehende futuristische „Future Search World"
              vom Hero bis zum Footer. Reines CSS-Layering, KEINE Animation.
              Bestehende Such-/Notification-UI bleibt unverändert und liegt
              per z-index vor dem Hintergrund. */}
          <div className="search-world" ref={searchWorldRef}>
            <div className="search-world__background" aria-hidden="true" />
            {/* SEARCH-WORLD-02: architektonisches Lichtportal zwischen Hero
                und Search World (rein dekorativ). */}
            <div className="search-world__top-light" aria-hidden="true" />
            <div className="search-world__content">
              <main className="container layout-search">
                <aside className="search-sidebar">
                  {searchCard}
                  {cvProcessingUI}
                </aside>

                {hasResults ? (
                  <section className="results-workspace">
                    <Results
                      matches={matches}
                      foundJobs={foundJobs}
                      onGenerateLetter={(job, prepare) => setLetterJob({ job, prepare })}
                      onAtsEvaluate={(job) => setAtsJob(job)}
                    />
                  </section>
                ) : (
                  <section className="alerts-section">
                    <AlertCard profile={profile} />
                  </section>
                )}
              </main>
            </div>
            {/* SEARCH-WORLD-03: drei vertikale Intelligence Columns
                (AI / MATCH / ATS) vom Deck bis in den Boden. Rein
                dekorativ, z-index 3 — unter Deck (4), Boden (5), UI (10). */}
            <div className="search-world__columns" aria-hidden="true">
              <span className="intelligence-column intelligence-column--ai">AI</span>
              <span className="intelligence-column intelligence-column--match">MATCH</span>
              <span className="intelligence-column intelligence-column--ats">ATS</span>
            </div>
            {/* SEARCH-WORLD-02: Lower Intelligence Deck + halbrunder Boden. */}
            <div className="search-world__intelligence" aria-hidden="true">
              <span className="search-world__chip search-world__chip--ai">AI</span>
              <span className="search-world__chip search-world__chip--jobs">JOBS</span>
              <span className="search-world__connector" />
              <span className="search-world__label">INTELLIGENCE</span>
              <span className="search-world__micro search-world__micro--match">MATCH</span>
              <span className="search-world__micro search-world__micro--ats">ATS</span>
              <span className="search-world__micro search-world__micro--profile">PROFILE</span>
              <span className="search-world__micro search-world__micro--skills">SKILLS</span>
              <span className="search-world__panel search-world__panel--a" />
              <span className="search-world__panel search-world__panel--b" />
              <span className="search-world__panel search-world__panel--c" />
              <span className="search-world__panel search-world__panel--d" />
              <span className="search-world__lines" />
              <span className="search-world__particles" />
            </div>
            <div className="search-world__fade" aria-hidden="true" />
          </div>
        </>
      )}
      {route !== "impressum" && (
        <>
          {letterJob && (
            <LetterModal
              job={letterJob.job}
              prepare={letterJob.prepare}
              profile={profile}
              model={effectiveModel}
              availableModels={models.map((model) => model.id)}
              recommendedModel={recommendedModel}
              onClose={() => setLetterJob(null)}
            />
          )}

          {atsJob && (activeAtsEntry || profile) && (
            <ATSModal
              job={atsJob}
              // CV-UPLOAD-UX-07: gewaehltes ATS-Profil (im CV-Bereich) hat Vorrang
              // vor dem allgemeinen Suchprofil
              profile={
                activeAtsEntry
                  ? {
                      skills: activeAtsEntry.skills.join(", "),
                      targetRoles: activeAtsEntry.targetRoles ?? [],
                      city: "",
                      radiusKm: null,
                      workModes: [],
                      employmentTypes: ["full_time"],
                    }
                  : profile
              }
              onClose={() => setAtsJob(null)}
            />
          )}

          {profilesDoc && (
            <CvProfilesOverlay
              docName={profilesDoc.name}
              docHash={profilesDoc.hash ?? null}
              onClose={() => setProfilesDocId(null)}
            />
          )}
          <Footer />
          {/* SEARCH-WORLD-09: Halbrundes Podium als letzter visueller Abschluss.
              Das BESTEHENDE Boden-Element wird hier weiterverwendet und nur
              raeumlich verschoben: es liegt hinter dem Footer (z-index 0 gegen
              Footer z-index 1), ist rein dekorativ (aria-hidden, pointer-events
              none) und markiert das Ende der Seite. Keine neue Grafik, keine
              neue Komponente, kein neues Design. */}
          {showsSearchWorld && <div className="search-world__floor" aria-hidden="true" />}
        </>
      )}
    </ErrorBoundary>
  );
}
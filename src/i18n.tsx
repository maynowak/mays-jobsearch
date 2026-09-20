import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "de";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.aria": "Main navigation",
  "nav.search": "Search",
  "nav.alerts": "Alerts",
  "nav.menuOpen": "Open menu",
  "nav.menuClose": "Close menu",
  "lang.aria": "Language",

  "hero.tagline":
    "Live jobs from multiple sources, scored by AI against your profile.",

  "landing.claim": "Find jobs that really fit you.",
  "landing.text":
    "Discover current jobs and let AI check how well they match your profile.",
  "landing.cta": "Find jobs →",

  "search.step": "1. Your search",
  "search.skills": "Skills",
  "search.skillsPh": "e.g. healthcare, sales, organization, Excel",
  "search.targetRole": "Target role",
  "search.targetRolePh": "e.g. sales associate, nurse, project manager",
  "search.city": "City or ZIP",
  "search.cityPh": "e.g. Berlin, 10115",
  "search.citySearching": "Searching locations…",
  "search.noLocations": "No locations found",
  "search.cityHelp": "We search for matching jobs near you.",
  "search.button": "Find my matches",
  "search.searching": "Searching the job board…",
  "search.scoring": "Scoring your matches with AI…",
  "search.buttonRematch": "Re-score with this model",
  "search.matchButton": "Evaluate with AI",
  "search.matching": "Evaluating with AI…",
  "search.radius": "Radius",
  "search.radiusNone": "Any distance",
  "search.radiusOption": "{km} km",
  "search.workMode": "Work model",
  "workMode.remote": "Remote",
  "workMode.hybrid": "Hybrid",
  "workMode.onsite": "On site",
  "search.employmentType": "Working hours",
  "employmentType.full_time": "Full time",
  "employmentType.part_time": "Part time",

  "cv.modeLabel": "How to create your profile",
  "cv.manual": "Enter manually",
  "cv.tabCv": "Upload CV",
  "cv.uploadAction": "Upload my CV (PDF)",
  "cv.dropZone": "Drop your CV here",
  "cv.dropZoneAlt": "or choose a PDF",
  "cv.dropZoneOver": "Drop PDF here",
  "cv.privacyNote":
    "Private: Your PDF stays on your device. Only the extracted text is sent to the AI to create your profile.",
  "cv.reading": "Reading CV locally…",
  "cv.creating": "Creating profile…",
  "cv.notPdf": "Please select a PDF file.",
  "cv.tooLarge": "The PDF is too large. Please use a file up to 10 MB.",
  "cv.scannedError":
    "This CV does not appear to contain readable text. Please use a text-based PDF or enter your profile manually.",
  "cv.processError":
    "We couldn't process your CV right now. You can still enter your profile manually.",
  "cv.resultHeading": "Your suggested search profile",
  "cv.skills": "Skills",
  "cv.experienceLevel": "Experience level",
  "cv.targetRoles": "Target role",
  "cv.location": "City or ZIP",
  "cv.confirm": "Use profile and find jobs",

  "cv.documentListTitle": "Your CVs",
  "cv.noDocuments": "No CVs uploaded yet",
  "cv.documentSelect": "Select PDF",
  "cv.documentSelected": "Selected",
  "cv.removeFile": "Remove file",
  "cv.processFiles": "Process selected CV",
  "cv.statusTitle": "Processing status",
  "cv.statusDocumentSelected": "Document selected",
  "cv.statusConsentRequired": "Consent required",
  "cv.statusConsentGiven": "Consent given",
  "cv.statusProfileCreating": "Creating profile...",
  "cv.statusAnonymizing": "Anonymizing...",
  "cv.statusGoalSelection": "Select processing goal",
  "cv.statusATSProcessing": "Running ATS analysis...",
  "cv.statusAISearching": "Searching with AI...",
  "cv.statusSuccess": "Processing complete",
  "cv.statusError": "Processing error",
  "cv.statusProcessing": "Processing...",
  "cv.processingStep1": "Document",
  "cv.processingStep2": "Consent",
  "cv.processingStep3": "Profile",
  "cv.processingStep4": "Anonymization",
  "cv.processingStep5": "Goal",
  "cv.processingStep6": "Target",
  "cv.processingStep7": "Processing",
  "cv.processingStep8": "Complete",
  "cv.goalTitle": "What do you want to do with your CV?",
  "cv.goalATSLabel": "ATS Analysis",
  "cv.goalATSDescription": "Check how well your CV matches job requirements",
  "cv.goalAISearchLabel": "AI Job Search",
  "cv.goalAISearchDescription": "Find matching jobs using AI scoring",
  "cv.modelSelect": "Select AI Model",
  "cv.modelUnavailable": "Selected model is no longer available",
  "cv.anonymizationTitle": "Anonymization",
  "cv.anonymizationOption1": "Anonymized",
  "cv.anonymizationDesc1": "Remove personal data before processing",
  "cv.anonymizationOption2": "Not anonymized",
  "cv.anonymizationDesc2": "Process with all data included",
  "cv.anonymized": "Your CV will be processed anonymized",
  "cv.notAnonymized": "Your CV will be processed with all data",

  "cv.consentTitle": "Allow CV processing?",
  "cv.consentDescription": "We need your consent to process the selected CV with AI.",
  "cv.consentFileLabel": "File:",
  "cv.consentDataUsed": "The following data will be processed:",
  "cv.consentDataItem1": "Skills and experience from your CV",
  "cv.consentDataItem2": "Target role and location preferences",
  "cv.consentDataItem3": "Anonymized profile data (if selected)",
  "cv.consentDataItem4": "Job matching and scoring results",
  "cv.consentDataItem5": "Generated cover letters (if requested)",
  "cv.consentPurpose": "Purpose:",
  "cv.consentDataProcessing": "Your data will be used for {processingInfo}.",
  "cv.consentExternalAI": "Processing uses external AI services via OpenRouter.",
  "cv.consentCheckbox": "I agree to the processing of my CV data as described.",
  "cv.consentCancel": "Cancel",
  "cv.consentConfirm": "Allow processing",

  "cv.backToEdit": "Back to edit",
  "cv.savingProfile": "Saving profile…",
  "cv.backToDocuments": "Back to documents",
  "cv.profileReady": "Profile created",
  "cv.continue": "Continue",
  "cv.continueProcessing": "Processing…",
  "cv.anonymizingText": "Anonymizing CV text…",
  "cv.preparingProfile": "Preparing profile…",
  "cv.goalExecutionTitle": "Execute processing goal",
  "cv.goalExecutionDescription": "Confirm the selected goal to start processing.",
  "cv.executeGoal": "Execute goal",
  "cv.executingGoal": "Executing goal…",
  "cv.backToProfile": "Back to profile",
  "cv.atsNotImplemented": "ATS processing will be implemented in a future step.",
  "cv.aiSearchNotImplemented": "AI Job Search will be implemented in a future step.",
  "cv.atsProcessing": "Running ATS analysis…",
  "cv.atsProcessError": "ATS analysis failed. Please try again.",
  "cv.atsNoProfile": "No profile available for ATS analysis.",
  "cv.aiSearching": "Searching for matching jobs with AI…",
  "cv.aiSearchComplete": "Found {count} matching jobs.",
  "cv.aiSearchNoResults": "No matching jobs found for your profile.",
  "cv.aiSearchError": "AI job search failed. Please try again.",
  "cv.aiSearchNoProfile": "No profile available for AI job search.",
  "cv.backToGoalSelection": "Back to goal selection",
  "cv.improvementTitle": "Apply CV Improvements",
  "cv.improvementDescription": "Select the recommendations you want to apply to your CV.",
  "cv.improvementSelectLabel": "Select recommendations to apply:",
  "cv.improvementNoSelection": "No recommendations selected. Please select at least one.",
  "cv.applyImprovement": "Apply improvements",
  "cv.applyingImprovement": "Applying improvements…",
  "cv.improvementApplied": "Improvements applied successfully.",
  "cv.improvementAppliedCount": "{count} improvement(s) applied to your CV.",
  "cv.improvementNoSelectionError": "Please select at least one recommendation to apply.",
  "cv.improvementNoChange": "No changes were made. The selected recommendations did not result in any changes.",
  "cv.improvementAppliedCountMsg": "{count} improvement(s) applied.",
  "cv.improvementOriginal": "Original",
  "cv.improvementImproved": "Improved",
  "cv.improvementShowOriginal": "Show original",
  "cv.improvementShowImproved": "Show improved",
  "cv.improvementAppliedSkills": "Applied to skills: {skills}",

  "model.label": "AI model",
  "model.loading": "Loading AI models …",
  "model.loadFailed": "Could not load model selection.",
  "model.empty": "No free AI models are available right now.",
  "model.none": "No model",
  "model.recommended": "Recommended",
  "model.sectionRecommended": "RECOMMENDED",
  "model.sectionOthers": "OTHER FREE MODELS",
  "model.unavailable":
    "This AI model is temporarily unavailable. Please choose another model.",
  "model.quotaExceeded":
    "Today's free AI request quota has been used up. Please try again later.",
  "model.fallbackNote":
    "The selected AI model is temporarily unavailable. We are using another free model for this request.",
  "model.fallbackSuccess":
    "The model {failed} is currently unavailable. We'll automatically try {used}. Your found jobs are kept.",
  "model.fallbackExhausted":
    "The selected AI model is currently unavailable. Your found jobs are kept. You can pick another model below without re-running the search.",
  "model.retryHint": "Please try selecting a different model.",

  "alerts.heading": "2. Daily job alerts",
  "alerts.hint": "Get an email every morning with new matches for your current search.",
  "alerts.email": "Email",
  "alerts.emailPh": "you@example.com",
  "alerts.subscribe": "Subscribe to daily digest",
  "alerts.cancel": "Cancel my alert",
  "alerts.needEmail": "Please enter your email address.",
  "alerts.needEmailUnsub": "Enter your email to cancel the alert.",

  "status.noSkills":
    "Add at least a skill or a target role so we know what to look for.",
  "status.noJobsCity":
    'No jobs matched "{q}" near "{city}". Try broader skills or leave the city empty.',
  "status.noJobs":
    'No jobs matched "{q}". Try broader keywords or different skills.',
  "status.noMatches":
    "We found jobs but the AI couldn't score them. Please try again.",
  "status.found": "Found {count} jobs · {evaluated} candidates evaluated by AI.",
  "status.genericError": "Something went wrong. Please try again.",

  "results.aria": "Matches",
  "results.yourTop": "Your top match",
  "results.yourTopN": "Your top {count} matches",
  "results.yourBest": "Your best matches",
  "results.allEvaluated": "All {count} evaluated matches",
  "results.topOf": "Top {shown} of {total}",
  "results.expandAll": "Show all {count} matches",
  "results.collapse": "Show top matches only",
  "results.evaluatedBadge": "AI evaluated",
  "results.moreFound": "View more found jobs →",
  "results.hideMore": "Hide more found jobs",
  "results.remaining": "{count} more jobs from your search",
  "results.viewFound": "View {count} found jobs",
  "results.hideFound": "Hide found jobs",
  "results.evaluatedUnavailable":
    "These jobs were found but could not be AI-evaluated right now. You can still browse them below.",
  "results.showMore": "Show more",
  "results.showLess": "Show less",
  "results.detailLoading": "Loading full details…",
  "results.detailError": "The full details couldn't be loaded. Please try again.",
  "results.published": "Published {date}",

  "jobtype.fullTime": "Full-time",
  "jobtype.partTime": "Part-time",
  "jobtype.remote": "Remote",
  "jobtype.freelance": "Freelance",
  "jobtype.internship": "Internship",
  "jobtype.contract": "Contract",

  "contract.permanent": "Permanent",
  "contract.fixedTerm": "Fixed-term",

  "match.locationNotStated": "Location not stated",
  "match.remote": "Remote",
  "match.unknownRole": "Unknown role",
  "match.prepare": "Prepare:",
  "match.viewPosting": "View original posting →",
  "match.generateLetter": "Generate application",
  "match.noProfile": "No profile available for ATS evaluation",
  "match.analysisError": "Could not analyze job",
  "match.atsEvaluate": "Evaluate with ATS",

  "ats.overlayTitle": "ATS Analysis",
  "ats.loading": "Analyzing job requirements...",
  "ats.error": "Analysis failed",
  "ats.score": "Match Score",
  "ats.requirements": "Requirements",
  "ats.criticalGaps": "Critical Gaps",
  "ats.recommendations": "Recommendations",
  "ats.aiAction": "Evaluate with AI",
  "ats.aiLoading": "AI is analyzing your CV...",
  "ats.aiError": "AI evaluation failed",

  "modal.close": "Close",
  "ats.consentTitle": "Enable AI Optimization",
  "ats.consentDescription": "Allow AI to suggest CV improvements for this job.",
  "ats.consentAccept": "Yes, enable AI",
  "ats.consentReject": "No, continue with ATS only",

  "source.label": "Source",
  "source.arbeitnow": "Arbeitnow",
  "source.arbeitsagentur": "Arbeitsagentur",

  "sources.heading": "Job sources",
  "sources.total": "Total",
  "sources.unit": "jobs",


  "sources.info": "Data source info",
  "sources.infoTooltip": "May's Job Matcher processes job listings from multiple data sources and prepares them for search and display. The source of each job is shown directly in the job listing.",

  "sources_info.label": "Datenquellen-Info",

  "score.title": "{score}/100 match",

  "letter.heading": "Cover letter",
  "letter.loading": "Your cover letter is being written…",
  "letter.error": "Couldn't generate the letter.",
  "letter.errorPrefix": "Error generating: ",
  "letter.copy": "Copy",
  "letter.copied": "Copied ✓",
  "letter.download": "Download .txt",
  "letter.closeAria": "Close",
  "letter.fileName": "cover-letter",

  "footer.pre": "Job listings",
  "footer.post": ". Scores are AI-generated suggestions — always check the original posting.",
  "footer.version": "Version",
};

const de: Dict = {
  "nav.aria": "Hauptnavigation",
  "nav.search": "Suche",
  "nav.alerts": "Benachrichtigungen",
  "nav.menuOpen": "Menü öffnen",
  "nav.menuClose": "Menü schließen",
  "lang.aria": "Sprache",

  "hero.tagline":
    "Live-Jobs aus verschiedenen Quellen, per KI gegen dein Profil bewertet.",

  "landing.claim": "Finde Jobs, die wirklich zu dir passen.",
  "landing.text":
    "Entdecke aktuelle Jobs und lass KI prüfen, wie gut sie zu deinem Profil passen.",
  "landing.cta": "Jobs finden →",

  "search.step": "1. Deine Suche",
  "search.skills": "Skills",
  "search.skillsPh": "z. B. Pflege, Verkauf, Organisation, Excel",
  "search.targetRole": "Zielrolle",
  "search.targetRolePh": "z. B. Verkäuferin, Pflegefachkraft, Projektmanager",
  "search.city": "Stadt oder PLZ",
  "search.cityPh": "z. B. Berlin, 10115",
  "search.citySearching": "Orte werden gesucht…",
  "search.noLocations": "Keine Orte gefunden",
  "search.cityHelp": "Wir suchen passende Jobs in deiner Nähe.",
  "search.button": "Meine Treffer finden",
  "search.searching": "Suche auf der Jobbörse…",
  "search.scoring": "Bewerte deine Treffer mit KI…",
  "search.buttonRematch": "Mit diesem Modell erneut bewerten",
  "search.matchButton": "Mit KI bewerten",
  "search.matching": "Bewerte mit KI…",
  "search.radius": "Umkreis",
  "search.radiusNone": "Entfernung egal",
  "search.radiusOption": "{km} km",
  "search.workMode": "Arbeitsmodell",
  "workMode.remote": "Remote",
  "workMode.hybrid": "Hybrid",
  "workMode.onsite": "Vor Ort",
  "search.employmentType": "Arbeitszeit",
  "employmentType.full_time": "Vollzeit",
  "employmentType.part_time": "Teilzeit",

  "cv.modeLabel": "So erstellst du dein Profil",
  "cv.manual": "Manuell eingeben",
  "cv.tabCv": "Lebenslauf hochladen",
  "cv.uploadAction": "Meinen Lebenslauf hochladen (PDF)",
  "cv.dropZone": "Lebenslauf hier ablegen",
  "cv.dropZoneAlt": "oder PDF auswählen",
  "cv.dropZoneOver": "PDF hier ablegen",
  "cv.privacyNote":
    "Privat: Die PDF bleibt auf deinem Gerät. Nur der gelesene Text wird zur Profilerstellung an die KI gesendet.",
  "cv.reading": "Lebenslauf wird lokal gelesen …",
  "cv.creating": "Profil wird erstellt …",
  "cv.notPdf": "Bitte wähle eine PDF-Datei aus.",
  "cv.tooLarge": "Die PDF ist zu groß. Bitte verwende eine Datei mit maximal 10 MB.",
  "cv.scannedError":
    "Dieser Lebenslauf enthält offenbar keinen auslesbaren Text. Bitte verwende eine textbasierte PDF oder nutze die manuelle Eingabe.",
  "cv.processError":
    "Dein Lebenslauf konnte gerade nicht ausgewertet werden. Du kannst dein Profil weiterhin manuell eingeben.",
  "cv.resultHeading": "Dein vorgeschlagenes Suchprofil",
  "cv.skills": "Skills",
  "cv.experienceLevel": "Erfahrungslevel",
  "cv.targetRoles": "Zielrolle",
  "cv.location": "Stadt oder PLZ",
  "cv.confirm": "Profil übernehmen und Jobs finden",

  "cv.documentListTitle": "Deine Lebensläufe",
  "cv.noDocuments": "Noch keine Lebensläufe hochgeladen",
  "cv.documentSelect": "PDF auswählen",
  "cv.documentSelected": "Ausgewählt",
  "cv.removeFile": "Datei entfernen",
  "cv.processFiles": "Ausgewählten CV verarbeiten",
  "cv.statusTitle": "Verarbeitungsstatus",
  "cv.statusDocumentSelected": "Dokument ausgewählt",
  "cv.statusConsentRequired": "Einwilligung erforderlich",
  "cv.statusConsentGiven": "Einwilligung erteilt",
  "cv.statusProfileCreating": "Profil wird erstellt...",
  "cv.statusAnonymizing": "Anonymisierung...",
  "cv.statusGoalSelection": "Verarbeitungsziel wählen",
  "cv.statusATSProcessing": "ATS-Analyse läuft...",
  "cv.statusAISearching": "KI-Suche läuft...",
  "cv.statusSuccess": "Verarbeitung abgeschlossen",
  "cv.statusError": "Verarbeitungsfehler",
  "cv.statusProcessing": "Wird verarbeitet...",
  "cv.processingStep1": "Dokument",
  "cv.processingStep2": "Einwilligung",
  "cv.processingStep3": "Profil",
  "cv.processingStep4": "Anonymisierung",
  "cv.processingStep5": "Ziel",
  "cv.processingStep6": "Zielrolle",
  "cv.processingStep7": "Verarbeitung",
  "cv.processingStep8": "Abgeschlossen",
  "cv.goalTitle": "Was möchtest du mit deinem Lebenslauf tun?",
  "cv.goalATSLabel": "ATS-Analyse",
  "cv.goalATSDescription": "Prüfen, wie gut dein Lebenslauf zu Stellenanforderungen passt",
  "cv.goalAISearchLabel": "KI-Jobsuche",
  "cv.goalAISearchDescription": "Passende Jobs mit KI-Bewertung finden",
  "cv.modelSelect": "KI-Modell auswählen",
  "cv.modelUnavailable": "Ausgewähltes Modell nicht mehr verfügbar",
  "cv.anonymizationTitle": "Anonymisierung",
  "cv.anonymizationOption1": "Anonymisiert",
  "cv.anonymizationDesc1": "Persönliche Daten vor Verarbeitung entfernen",
  "cv.anonymizationOption2": "Nicht anonymisiert",
  "cv.anonymizationDesc2": "Mit allen Daten verarbeiten",
  "cv.anonymized": "Dein Lebenslauf wird anonymisiert verarbeitet",
  "cv.notAnonymized": "Dein Lebenslauf wird mit allen Daten verarbeitet",

  "cv.consentTitle": "CV-Verarbeitung erlauben?",
  "cv.consentDescription": "Wir brauchen deine Einwilligung, um den ausgewählten Lebenslauf mit KI zu verarbeiten.",
  "cv.consentFileLabel": "Datei:",
  "cv.consentDataUsed": "Folgende Daten werden verarbeitet:",
  "cv.consentDataItem1": "Fähigkeiten und Erfahrung aus deinem Lebenslauf",
  "cv.consentDataItem2": "Zielrolle und Standortpräferenzen",
  "cv.consentDataItem3": "Anonymisierte Profildaten (falls gewählt)",
  "cv.consentDataItem4": "Job-Matching und Bewertungsergebnisse",
  "cv.consentDataItem5": "Generierte Bewerbungsschreiben (falls angefordert)",
  "cv.consentPurpose": "Zweck:",
  "cv.consentDataProcessing": "Deine Daten werden für {processingInfo} verwendet.",
  "cv.consentExternalAI": "Verarbeitung nutzt externe KI-Dienste über OpenRouter.",
  "cv.consentCheckbox": "Ich stimme der Verarbeitung meiner CV-Daten wie beschrieben zu.",
  "cv.consentCancel": "Abbrechen",
  "cv.consentConfirm": "Verarbeitung erlauben",

  "cv.backToEdit": "Zurück zum Bearbeiten",
  "cv.savingProfile": "Profil wird gespeichert…",
  "cv.backToDocuments": "Zurück zu Dokumenten",
  "cv.profileReady": "Profil erstellt",
  "cv.continue": "Weiter",
  "cv.continueProcessing": "Wird verarbeitet…",
  "cv.anonymizingText": "CV-Text wird anonymisiert…",
  "cv.preparingProfile": "Profil wird vorbereitet…",
  "cv.goalExecutionTitle": "Verarbeitungsziel ausführen",
  "cv.goalExecutionDescription": "Bestätigen Sie das gewählte Ziel, um die Verarbeitung zu starten.",
  "cv.executeGoal": "Ziel ausführen",
  "cv.executingGoal": "Ziel wird ausgeführt…",
  "cv.backToProfile": "Zurück zum Profil",
  "cv.atsNotImplemented": "ATS-Verarbeitung wird in einem späteren Schritt implementiert.",
  "cv.aiSearchNotImplemented": "KI-Jobsuche wird in einem späteren Schritt implementiert.",
  "cv.atsProcessing": "ATS-Analyse läuft…",
  "cv.atsProcessError": "ATS-Analyse fehlgeschlagen. Bitte versuchen Sie es erneut.",
  "cv.atsNoProfile": "Kein Profil für ATS-Analyse verfügbar.",
  "cv.aiSearching": "Suche passende Jobs mit KI…",
  "cv.aiSearchComplete": "{count} passende Jobs gefunden.",
  "cv.aiSearchNoResults": "Keine passenden Jobs für dein Profil gefunden.",
  "cv.aiSearchError": "KI-Jobsuche fehlgeschlagen. Bitte versuchen Sie es erneut.",
  "cv.aiSearchNoProfile": "Kein Profil für KI-Jobsuche verfügbar.",
  "cv.backToGoalSelection": "Zurück zur Zielauswahl",
  "cv.improvementTitle": "CV-Verbesserungen anwenden",
  "cv.improvementDescription": "Wählen Sie die Empfehlungen aus, die auf Ihren Lebenslauf angewendet werden sollen.",
  "cv.improvementSelectLabel": "Zu verbessernde Empfehlungen auswählen:",
  "cv.improvementNoSelection": "Keine Empfehlungen ausgewählt. Bitte wählen Sie mindestens eine aus.",
  "cv.applyImprovement": "Verbesserungen anwenden",
  "cv.applyingImprovement": "Verbesserungen werden angewendet…",
  "cv.improvementApplied": "Verbesserungen erfolgreich angewendet.",
  "cv.improvementAppliedCount": "{count} Verbesserung(en) auf Ihren Lebenslauf angewendet.",
  "cv.improvementNoSelectionError": "Bitte wählen Sie mindestens eine Empfehlung zum Anwenden aus.",
  "cv.improvementNoChange": "Keine Änderungen vorgenommen. Die ausgewählten Empfehlungen haben zu keinen Änderungen geführt.",
  "cv.improvementAppliedCountMsg": "{count} Verbesserung(en) angewendet.",
  "cv.improvementOriginal": "Original",
  "cv.improvementImproved": "Verbessert",
  "cv.improvementShowOriginal": "Original anzeigen",
  "cv.improvementShowImproved": "Verbessert anzeigen",
  "cv.improvementAppliedSkills": "Auf Skills angewendet: {skills}",

  "model.label": "KI-Modell",
  "model.loading": "KI-Modelle werden geladen …",
  "model.loadFailed": "Modellauswahl konnte nicht geladen werden.",
  "model.empty": "Aktuell sind keine kostenlosen KI-Modelle verfügbar.",
  "model.none": "Kein Modell",
  "model.recommended": "Empfohlen",
  "model.sectionRecommended": "EMPFOHLEN",
  "model.sectionOthers": "WEITERE KOSTENLOSE MODELLE",
  "model.unavailable":
    "Dieses KI-Modell ist momentan nicht verfügbar. Bitte wähle ein anderes Modell.",
  "model.quotaExceeded":
    "Die kostenlosen KI-Anfragen für heute sind aufgebraucht. Bitte versuche es später erneut.",
  "model.fallbackNote":
    "Das ausgewählte KI-Modell ist momentan nicht verfügbar. Wir verwenden vorübergehend ein anderes kostenloses Modell.",
  "model.fallbackSuccess":
    "Das Modell {failed} ist derzeit nicht verfügbar. Wir versuchen es automatisch mit {used}. Ihre bereits gefundenen Stellen bleiben erhalten.",
  "model.fallbackExhausted":
    "Das ausgewählte AI-Modell ist derzeit nicht verfügbar. Ihre bereits gefundenen Stellen bleiben erhalten. Sie können unten ein anderes verfügbares Modell auswählen, ohne die Jobs erneut zu laden.",
  "model.retryHint": "Bitte versuche, ein anderes Modell auszuwählen.",

  "alerts.heading": "2. Tägliche Job-Benachrichtigungen",
  "alerts.hint":
    "Erhalte jeden Morgen eine E-Mail mit neuen Treffern für deine aktuelle Suche.",
  "alerts.email": "E-Mail",
  "alerts.emailPh": "du@beispiel.de",
  "alerts.subscribe": "Tagesübersicht abonnieren",
  "alerts.cancel": "Benachrichtigung abbestellen",
  "alerts.needEmail": "Bitte gib deine E-Mail-Adresse ein.",
  "alerts.needEmailUnsub": "Gib deine E-Mail ein, um die Benachrichtigung abzubestellen.",

  "status.noSkills":
    "Füge mindestens eine Fähigkeit oder eine Zielrolle hinzu, damit wir wissen, wonach wir suchen.",
  "status.noJobsCity":
    'Keine Jobs zu „{q}" in der Nähe von „{city}" gefunden. Versuche breitere Fähigkeiten oder lass das Feld „Stadt" leer.',
  "status.noJobs":
    'Keine Jobs zu „{q}" gefunden. Versuche breitere Begriffe oder andere Fähigkeiten.',
  "status.noMatches":
    "Wir haben Jobs gefunden, aber die KI konnte sie nicht bewerten. Bitte versuche es erneut.",
  "status.found": "{count} Jobs gefunden · {evaluated} Kandidaten mit KI bewertet.",
  "status.genericError": "Etwas ist schiefgelaufen. Bitte versuche es erneut.",

  "results.aria": "Treffer",
  "results.yourTop": "Dein bester Treffer",
  "results.yourTopN": "Deine {count} besten Treffer",
  "results.yourBest": "Deine besten Matches",
  "results.allEvaluated": "Alle {count} bewerteten Treffer",
  "results.topOf": "Top {shown} von {total}",
  "results.expandAll": "Alle {count} Treffer anzeigen",
  "results.collapse": "Nur Top-Matches anzeigen",
  "results.evaluatedBadge": "KI bewertet",
  "results.moreFound": "Weitere gefundene Jobs ansehen →",
  "results.hideMore": "Weitere gefundene Jobs ausblenden",
  "results.remaining": "{count} weitere Stellen aus deiner Suche",
  "results.viewFound": "{count} gefundene Stellen ansehen",
  "results.hideFound": "Gefundene Stellen ausblenden",
  "results.evaluatedUnavailable":
    "Diese Jobs wurden gefunden, konnten aber gerade nicht per KI bewertet werden. Du kannst sie unten trotzdem durchstöbern.",
  "results.showMore": "Mehr anzeigen",
  "results.showLess": "Weniger anzeigen",
  "results.detailLoading": "Vollständige Details werden geladen…",
  "results.detailError": "Die vollständigen Details konnten nicht geladen werden. Bitte versuche es erneut.",
  "results.published": "Veröffentlicht am {date}",

  "jobtype.fullTime": "Vollzeit",
  "jobtype.partTime": "Teilzeit",
  "jobtype.remote": "Remote",
  "jobtype.freelance": "Freelance",
  "jobtype.internship": "Praktikum",
  "jobtype.contract": "Befristet",

  "contract.permanent": "Unbefristet",
  "contract.fixedTerm": "Befristet",

  "match.locationNotStated": "Ort nicht angegeben",
  "match.remote": "Remote",
  "match.unknownRole": "Unbekannte Rolle",
  "match.prepare": "Vorbereitung:",
  "match.viewPosting": "Original-Anzeige ansehen →",
  "match.generateLetter": "Bewerbung generieren",
  "match.noProfile": "Kein Profil für die ATS-Bewertung verfügbar",
  "match.analysisError": "Konnte die Stelle nicht analysieren",
  "match.atsEvaluate": "Mit ATS bewerten",

  "ats.overlayTitle": "ATS-Analyse",
  "ats.loading": "Stellenanforderungen werden analysiert...",
  "ats.error": "Analyse fehlgeschlagen",
  "ats.score": "Übereinstimmungs-Score",
  "ats.requirements": "Anforderungen",
  "ats.criticalGaps": "Kritische Lücken",
  "ats.recommendations": "Empfehlungen",
  "ats.aiAction": "Mit KI bewerten",
  "ats.aiLoading": "KI analysiert deinen Lebenslauf...",
  "ats.aiError": "KI-Bewertung fehlgeschlagen",

  "modal.close": "Schließen",
  "ats.consentTitle": "KI-Optimierung aktivieren",
  "ats.consentDescription": "Erlaube der KI, Vorschläge zur CV-Optimierung für diese Stelle zu erstellen.",
  "ats.consentAccept": "Ja, KI aktivieren",
  "ats.consentReject": "Nein, nur ATS",

  "source.label": "Quelle",
  "source.arbeitnow": "Arbeitnow",
  "source.arbeitsagentur": "Arbeitsagentur",

  "sources.heading": "Jobquellen",
  "sources.total": "Insgesamt",
  "sources.unit": "Stellen",

  "sources.info": "Datenquellen-Info",
  "sources.infoTooltip": "May's Job Matcher verarbeitet Stellenangebote aus verschiedenen Datenquellen und bereitet sie für Suche und Darstellung auf. Die Quelle jedes Stellenangebots wird direkt im Stellenangebot angezeigt.",

  "score.title": "{score}/100 Übereinstimmung",

  "letter.heading": "Bewerbungsschreiben",
  "letter.loading": "Dein Anschreiben wird geschrieben…",
  "letter.error": "Das Schreiben konnte nicht erstellt werden.",
  "letter.errorPrefix": "Fehler beim Generieren: ",
  "letter.copy": "Kopieren",
  "letter.copied": "Kopiert ✓",
  "letter.download": "Download .txt",
  "letter.closeAria": "Schließen",
  "letter.fileName": "anschreiben",

  "footer.pre": "Jobangebote",
  "footer.post": ". Bewertungen sind KI-generierte Vorschläge — prüfe immer die Original-Anzeige.",
  "footer.version": "Version",
};

const translations: Record<Lang, Dict> = { en, de };

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function detectBrowserLanguage(): Lang {
  if (typeof navigator === "undefined") return "de";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    if (!lang) continue;
    const normalized = lang.toLowerCase();
    if (normalized.startsWith("de")) return "de";
    if (normalized.startsWith("en")) return "en";
  }
  return "de";
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem("mj-lang");
    if (stored === "de" || stored === "en") return stored;
    return detectBrowserLanguage();
  } catch {
    return detectBrowserLanguage();
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  useEffect(() => {
    try {
      localStorage.setItem("mj-lang", lang);
    } catch {
      /* noop */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = translations[lang][key] ?? key;
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(val));
        }
      }
      return value;
    },
    [lang]
  );

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LangProvider");
  return ctx;
}
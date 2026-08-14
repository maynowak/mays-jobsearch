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
    "Live jobs from Arbeitnow and the Arbeitsagentur, scored by AI against your profile.",

  "landing.claim": "Find jobs that really fit you.",
  "landing.text":
    "Discover current jobs and let AI check how well they match your profile.",
  "landing.cta": "Find jobs →",

  "search.step": "1. Your search",
  "search.skills": "Skills",
  "search.skillsPh": "e.g. JavaScript, React, Node.js, SQL",
  "search.targetRole": "Target role",
  "search.targetRolePh": "e.g. Frontend Developer",
  "search.city": "City",
  "search.cityPh": "e.g. Berlin, München, Hamburg",
  "search.citySearching": "Searching locations…",
  "search.noLocations": "No locations found",
  "search.button": "Find my matches",
  "search.searching": "Searching the job board…",
  "search.scoring": "Scoring your matches with AI…",

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
  "cv.location": "Location",
  "cv.confirm": "Use profile and find jobs",

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
  "status.found": "Found {count} relevant jobs, scored your best ones.",
  "status.genericError": "Something went wrong. Please try again.",

  "results.aria": "Matches",
  "results.yourTop": "Your top match",
  "results.yourTopN": "Your top {count} matches",
  "results.scored": "Scored {count} jobs by AI against your profile.",

  "match.locationNotStated": "Location not stated",
  "match.remote": "Remote",
  "match.unknownRole": "Unknown role",
  "match.prepare": "Prepare:",
  "match.viewPosting": "View original posting →",
  "match.generateLetter": "Generate application",

  "source.label": "Source",
  "source.existing": "Arbeitnow",
  "source.apify": "Arbeitsagentur",

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
};

const de: Dict = {
  "nav.aria": "Hauptnavigation",
  "nav.search": "Suche",
  "nav.alerts": "Benachrichtigungen",
  "nav.menuOpen": "Menü öffnen",
  "nav.menuClose": "Menü schließen",
  "lang.aria": "Sprache",

  "hero.tagline":
    "Live-Jobs von Arbeitnow und der Arbeitsagentur, per KI gegen dein Profil bewertet.",

  "landing.claim": "Finde Jobs, die wirklich zu dir passen.",
  "landing.text":
    "Entdecke aktuelle Jobs und lass KI prüfen, wie gut sie zu deinem Profil passen.",
  "landing.cta": "Jobs finden →",

  "search.step": "1. Deine Suche",
  "search.skills": "Skills",
  "search.skillsPh": "z. B. JavaScript, React, Node.js, SQL",
  "search.targetRole": "Zielrolle",
  "search.targetRolePh": "z. B. Frontend-Entwickler",
  "search.city": "Stadt",
  "search.cityPh": "z. B. Berlin, München, Hamburg",
  "search.citySearching": "Orte werden gesucht…",
  "search.noLocations": "Keine Orte gefunden",
  "search.button": "Meine Treffer finden",
  "search.searching": "Suche auf der Jobbörse…",
  "search.scoring": "Bewerte deine Treffer mit KI…",

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
  "cv.location": "Stadt",
  "cv.confirm": "Profil übernehmen und Jobs finden",

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
  "status.found": "{count} relevante Jobs gefunden, deine besten Treffer wurden bewertet.",
  "status.genericError": "Etwas ist schiefgelaufen. Bitte versuche es erneut.",

  "results.aria": "Treffer",
  "results.yourTop": "Dein bester Treffer",
  "results.yourTopN": "Deine {count} besten Treffer",
  "results.scored": "{count} Jobs wurden per KI gegen dein Profil bewertet.",

  "match.locationNotStated": "Ort nicht angegeben",
  "match.remote": "Remote",
  "match.unknownRole": "Unbekannte Rolle",
  "match.prepare": "Vorbereitung:",
  "match.viewPosting": "Original-Anzeige ansehen →",
  "match.generateLetter": "Bewerbung generieren",

  "source.label": "Quelle",
  "source.existing": "Arbeitnow",
  "source.apify": "Arbeitsagentur",

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
};

const translations: Record<Lang, Dict> = { en, de };

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): Lang {
  try {
    return localStorage.getItem("mj-lang") === "de" ? "de" : "en";
  } catch {
    return "en";
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
// LEGAL-IMPRINT-01: Zentrale Konfiguration fuer rechtliche Seiten
// E-Mail-Adresse wird ausschliesslich ueber Environment Variable bezogen.
// KEIN Fallback mit echter Adresse im Source Code.

export interface LegalConfig {
  contactEmail: string | null;
  isDev: boolean;
}

function getContactEmail(): string | null {
  // VITE_* Variablen sind im Client verfuegbar (Vite).
  // Im Build wird import.meta.env.VITE_CONTACT_EMAIL zur Build-Zeit ersetzt.
  const email = import.meta.env?.VITE_CONTACT_EMAIL ?? null;
  return email?.trim() || null;
}

function isDevEnvironment(): boolean {
  return import.meta.env?.DEV === true || import.meta.env?.MODE === "development";
}

export const legalConfig: LegalConfig = {
  contactEmail: getContactEmail(),
  isDev: isDevEnvironment(),
};

// Helper fuer UI: zeigt Entwicklungszustand an, wenn E-Mail fehlt
export function getContactEmailDisplay(): { email: string; isPlaceholder: boolean } {
  const email = legalConfig.contactEmail;
  if (email) return { email, isPlaceholder: false };
  return {
    email: legalConfig.isDev
      ? "[E-Mail ueber VITE_CONTACT_EMAIL im Development nicht gesetzt]"
      : "[Kontakt-E-Mail nicht konfiguriert]",
    isPlaceholder: true,
  };
}
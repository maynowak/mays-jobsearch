export const DEFAULT_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_EDENAI_MODEL = "google/gemma-4-26b-a4b-it";

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export function getEdenaiModel() {
  return process.env.EDENAI_MODEL || DEFAULT_EDENAI_MODEL;
}

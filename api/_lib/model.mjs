export const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}
import { createGreenhouseSource } from "../greenhouse.mjs";
import { createLeverSource } from "./adapters/lever.mjs";
import { createAshbySource } from "./adapters/ashby.mjs";
import { createWorkableSource } from "./adapters/workable.mjs";
import { createRecruiteeSource } from "./adapters/recruitee.mjs";
import { createPersonioSource } from "./adapters/personio.mjs";

const ADAPTERS = {
  greenhouse: createGreenhouseSource,
  lever: createLeverSource,
  ashby: createAshbySource,
  workable: createWorkableSource,
  recruitee: createRecruiteeSource,
  personio: createPersonioSource,
};

export function createPublicJobSource(config) {
  const { provider, identifier, enabled = true, label, options = {} } = config;

  if (!provider || !ADAPTERS[provider]) {
    throw new Error(`Unknown public ATS provider: ${provider}`);
  }
  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    throw new Error(`Missing identifier for provider ${provider}`);
  }

  const adapter = ADAPTERS[provider];
  const source = adapter({ identifier: identifier.trim(), enabled, label, options });

  source.id = `${provider}:${identifier.trim()}`;
  source.provider = "ats";

  return source;
}

export function getSupportedProviders() {
  return Object.keys(ADAPTERS);
}
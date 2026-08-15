import { useEffect, useState } from "react";
import type { ModelOption } from "../types";
import { fetchModel, fetchModels, setFallbackMaxAttempts } from "../api";

export type ModelsState = "loading" | "ready" | "error" | "empty";

interface ModelsCache {
  models: ModelOption[];
  defaultModel: string | null;
  fallbackModel: string | null;
  recommendedModel: string | null;
}

const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

interface ModelsCacheEntry {
  data: ModelsCache;
  fetchedAt: number;
}

let cache: ModelsCacheEntry | null = null;

export function __resetModelsCacheForTests() {
  cache = null;
}

export function useAvailableModels() {
  const [state, setState] = useState<ModelsState>("loading");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [fallbackModel, setFallbackModel] = useState<string | null>(null);
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState("loading");
      let list: ModelOption[] | null = null;
      let configured: string | null = null;
      let fallback: string | null = null;
      let recommended: string | null = null;

      const cached =
        cache && Date.now() - cache.fetchedAt < MODELS_CACHE_TTL_MS ? cache : null;
      if (cached) {
        list = cached.data.models;
        configured = cached.data.defaultModel;
        fallback = cached.data.fallbackModel;
        recommended = cached.data.recommendedModel;
      } else {
        try {
          const res = await fetchModels();
          list = res.models ?? [];
          configured = res.defaultModel ?? null;
          fallback = res.fallbackModel ?? null;
          recommended = res.recommendedModel ?? null;
          setFallbackMaxAttempts(res.fallbackMaxAttempts ?? 3);
          cache = { data: { models: list, defaultModel: configured, fallbackModel: fallback, recommendedModel: recommended }, fetchedAt: Date.now() };
        } catch {
          list = null;
        }

        if (!list) {
          try {
            configured = await fetchModel();
          } catch {
            configured = null;
          }
        }
      }

      if (cancelled) return;
      setModels(list ?? []);
      setDefaultModel(configured);
      setFallbackModel(fallback);
      setRecommendedModel(recommended);

      if (list === null) setState("error");
      else if (list.length === 0) setState("empty");
      else setState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return {
    state,
    models,
    defaultModel,
    fallbackModel,
    recommendedModel,
    reload: () => {
      cache = null;
      setReload((n) => n + 1);
    },
  };
}
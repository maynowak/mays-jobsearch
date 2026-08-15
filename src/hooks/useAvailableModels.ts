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

let cache: ModelsCache | null = null;

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

      if (cache) {
        list = cache.models;
        configured = cache.defaultModel;
        fallback = cache.fallbackModel;
        recommended = cache.recommendedModel;
      } else {
        try {
          const res = await fetchModels();
          list = res.models ?? [];
          configured = res.defaultModel ?? null;
          fallback = res.fallbackModel ?? null;
          recommended = res.recommendedModel ?? null;
          setFallbackMaxAttempts(res.fallbackMaxAttempts ?? 3);
          cache = {
            models: list,
            defaultModel: configured,
            fallbackModel: fallback,
            recommendedModel: recommended,
          };
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
    reload: () => setReload((n) => n + 1),
  };
}
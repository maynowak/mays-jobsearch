import { useEffect, useState } from "react";
import type { ModelOption } from "../types";
import { fetchModel, fetchModels } from "../api";

export type ModelsState = "loading" | "ready" | "error" | "empty";

interface ModelsCache {
  models: ModelOption[];
  defaultModel: string | null;
}

let cache: ModelsCache | null = null;

export function useAvailableModels() {
  const [state, setState] = useState<ModelsState>("loading");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState("loading");
      let list: ModelOption[] | null = null;
      let configured: string | null = null;

      if (cache) {
        list = cache.models;
        configured = cache.defaultModel;
      } else {
        try {
          const res = await fetchModels();
          list = res.models ?? [];
          configured = res.defaultModel ?? null;
          cache = { models: list, defaultModel: configured };
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
    reload: () => setReload((n) => n + 1),
  };
}
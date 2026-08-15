import type { ModelOption } from "../types";

export function modelDisplayName(model: ModelOption | null | undefined): string {
  if (!model) return "";
  if (model.provider?.name) return `${model.provider.name} · ${model.name}`;
  return model.name;
}
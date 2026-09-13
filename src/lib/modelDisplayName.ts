import type { ModelOption } from "../types";

function extractReadableNameFromId(id: string): string {
  if (!id) return "";

  let name = id;

  if (name.includes("/")) {
    const parts = name.split("/");
    name = parts[parts.length - 1];
  }

  name = name
    .replace(/[-_:]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  name = name.replace(/\s+/g, " ").trim();

  return name || id;
}

export function modelDisplayName(model: ModelOption | null | undefined): string {
  if (!model) return "";

  const { name, provider } = model;

  const isRawIdName =
    !name ||
    name.includes("@") ||
    name.includes("/") ||
    (name.includes("-") && name.includes(":")) ||
    name.includes("::");

  const displayName = isRawIdName
    ? extractReadableNameFromId(name || model.id)
    : name;

  if (provider?.name) {
    return `${displayName} · ${provider.name}`;
  }
  return displayName;
}
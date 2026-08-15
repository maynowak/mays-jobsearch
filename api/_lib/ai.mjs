import { HttpError } from "./filter.mjs";
import { assertFreeModel, resolveDefaultModel } from "./models.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 40_000;

function modelUnavailable() {
  return new HttpError(
    502,
    "This AI model is temporarily unavailable. Please choose another model.",
    "model_unavailable"
  );
}

export function requireOpenRouterKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      500,
      "The server is missing the OPENROUTER_API_KEY environment variable, so AI features aren't available yet. Ask your developer to add it on Vercel.",
      "missing_key"
    );
  }
  return apiKey;
}

export async function chat({ system, prompt, json = false, temperature = 0.3, maxTokens = 1500, model }) {
  let resolvedModel = await resolveDefaultModel();
  if (model) {
    await assertFreeModel(model);
    resolvedModel = model;
  }
  const apiKey = requireOpenRouterKey();

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.warn(`[ai] OpenRouter request timed out after ${OPENROUTER_TIMEOUT_MS}ms`);
    }
    throw modelUnavailable();
  }

  if (response.status === 401) {
    throw new HttpError(
      502,
      "The OpenRouter API key on the server is invalid. Check the OPENROUTER_API_KEY environment variable.",
      "key_invalid"
    );
  }
  if (response.status === 402) {
    throw new HttpError(
      402,
      "The OpenRouter account has run out of credits. Top up at openrouter.ai to keep matching.",
      "insufficient_credits"
    );
  }
  if (response.status === 429) {
    throw modelUnavailable();
  }
  if (!response.ok) {
    throw modelUnavailable();
  }

  let jsonBody;
  try {
    jsonBody = await response.json();
  } catch {
    throw modelUnavailable();
  }

  const content = jsonBody?.choices?.[0]?.message?.content;
  if (!content) {
    throw modelUnavailable();
  }
  return content;
}

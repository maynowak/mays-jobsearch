import { HttpError } from "./filter.mjs";
import { assertFreeModel, resolveDefaultModel } from "./models.mjs";
import {
  countOpenRouterAttempt,
  countOpenRouterFailure,
  countOpenRouterRequest,
  openRouterLimitReached,
} from "./usage.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 40_000;

function modelUnavailable() {
  return new HttpError(
    502,
    "This AI model is temporarily unavailable. Please choose another model.",
    "model_unavailable"
  );
}

function logModelError(stage, { model, attempt, status, providerError }) {
  const parts = [`[ai] model=${model ?? "(none)"}`];
  parts.push(`stage=${stage}`);
  if (attempt) parts.push(`attempt=${attempt}`);
  if (status) parts.push(`status=${status}`);
  if (providerError) parts.push(`provider=${providerError}`);
  console.error(parts.join(" "));
}

function budgetReached() {
  return new HttpError(
    503,
    "The free AI request budget for this month has been reached. Please try again next month.",
    "limit_reached"
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

export async function chat({
  system,
  prompt,
  json = false,
  temperature = 0.3,
  maxTokens = 1500,
  model,
  attempt = 0,
}) {
  let resolvedModel = await resolveDefaultModel();
  if (model) {
    await assertFreeModel(model);
    resolvedModel = model;
  }
  const apiKey = requireOpenRouterKey();

  if (await openRouterLimitReached()) {
    throw budgetReached();
  }

  await countOpenRouterRequest(resolvedModel);
  if (attempt > 1) {
    await countOpenRouterAttempt();
  }

  try {
    return await requestOpenRouter({
      apiKey,
      system,
      prompt,
      json,
      temperature,
      maxTokens,
      model: resolvedModel,
      attempt,
    });
  } catch (err) {
    await countOpenRouterFailure();
    throw err;
  }
}

async function requestOpenRouter({
  apiKey,
  system,
  prompt,
  json,
  temperature,
  maxTokens,
  model,
  attempt = 0,
}) {
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
    const timedOut = Boolean(err && (err.name === "TimeoutError" || err.name === "AbortError"));
    logModelError(timedOut ? "timeout" : "network", { model, attempt });
    throw modelUnavailable();
  }

  if (response.status === 401) {
    logModelError("http-401", { model, attempt, status: response.status });
    throw new HttpError(
      502,
      "The OpenRouter API key on the server is invalid. Check the OPENROUTER_API_KEY environment variable.",
      "key_invalid"
    );
  }
  if (response.status === 402) {
    logModelError("http-402", { model, attempt, status: response.status });
    throw new HttpError(
      402,
      "The OpenRouter account has run out of credits. Top up at openrouter.ai to keep matching.",
      "insufficient_credits"
    );
  }
  if (response.status === 429) {
    logModelError("http-429", { model, attempt, status: response.status });
    throw modelUnavailable();
  }
  if (!response.ok) {
    let providerError = "";
    try {
      const errBody = await response.json();
      providerError = String(errBody?.error?.message ?? errBody?.message ?? "").slice(0, 180);
    } catch {
      /* body not readable */
    }
    logModelError("http-error", { model, attempt, status: response.status, providerError });
    throw modelUnavailable();
  }

  let jsonBody;
  try {
    jsonBody = await response.json();
  } catch {
    logModelError("json-parse", { model, attempt, status: response.status });
    throw modelUnavailable();
  }

  const content = jsonBody?.choices?.[0]?.message?.content;
  if (!content) {
    logModelError("empty-content", { model, attempt, status: response.status });
    throw modelUnavailable();
  }
  return content;
}

import { HttpError } from "./filter.mjs";
import { getOpenRouterModel } from "./model.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

export async function chat({ system, prompt, json = false, temperature = 0.3, maxTokens = 1500 }) {
  const apiKey = requireOpenRouterKey();
  const model = getOpenRouterModel();

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
    });
  } catch {
    throw new HttpError(502, "Couldn't reach the AI service. Please try again in a moment.", "network");
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
    throw new HttpError(429, "The AI is rate-limited right now. Please wait a moment and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(
      502,
      `The AI service hit an error (HTTP ${response.status}). Please try again shortly.`,
      "upstream"
    );
  }

  let jsonBody;
  try {
    jsonBody = await response.json();
  } catch {
    throw new HttpError(502, "The AI service sent back an unreadable response. Try again shortly.", "upstream");
  }

  const content = jsonBody?.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "The AI returned an empty response. Please try again.", "empty");
  }
  return content;
}

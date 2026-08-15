# AI Providers

The app routes all AI work (CV profile extraction, job matching, cover letters) through a **provider router** that supports multiple AI providers behind one `chat()` facade.

## Providers

| Provider | Catalogue | Chat | Free eligibility | Key env vars |
|---|---|---|---|---|
| OpenRouter | `GET https://openrouter.ai/api/v1/models` | `POST https://openrouter.ai/api/v1/chat/completions` | Pricing free (`prompt`/`completion`/`request` all `"0"`), text in + text out, not expired | `OPENROUTER_API_KEY` |
| EdenAI | `GET https://api.edenai.run/v3/models` (public) | `POST https://api.edenai.run/v3/chat/completions` (OpenAI-compatible) | Catalogue `pricing` zero-cost (`input_cost_per_token` / `output_cost_per_token` = `"0"`), text in + text out (no audio-only), structured via `capabilities.supports_response_schema` | `EDENAI_API_KEY` / `EDENAI_DEV_API_KEY` |

Providers are never hardcoded by model name. "Free" is always derived from machine-readable pricing metadata.

## Architecture

```
Application (api/*.mjs endpoints)
        │  chat({ system, prompt, json, model, ... })
        ▼
api/_lib/ai.mjs            (facade, re-exports chat + isFreeDailyQuotaError)
        ▼
api/_lib/providers/index.mjs   (router)
        │  ├─ providerForModel(model) → owning provider (catalogue membership)
        │  ├─ provider-level fallback on quota-exhaustion codes
        │  └─ model catalogue aggregation (dedup by id, OpenRouter first)
        ├─ api/_lib/providers/openrouter.mjs
        └─ api/_lib/providers/edenai.mjs
```

- `api/_lib/ai.mjs` and `api/_lib/models.mjs` are thin facades so existing endpoints and tests keep working.
- Each provider implements the same interface: `enabled()`, `getModels()`, `ownsModel(id)`, `getEligibleModel(preferred)`, `getDefaultModel()`, `chat()`, `limitReached()`, `countRequest/countFailure/countAttempt`, plus a 10-minute in-memory catalogue cache.

## Provider resolution & fallback

1. A request may carry a `model` ID. The router resolves the provider that owns that ID via `ownsModel()` (catalogue membership). If no provider owns it → `model_not_free` (400).
2. Without a `model`, the router uses the first enabled provider (OpenRouter first) and its `getDefaultModel()`.
3. **Provider-level fallback (server side):** if the primary provider throws a provider-exhausted error (`free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`), the router retries on the next enabled provider with that provider's own eligible model. Attempts are bounded by the number of enabled providers and capped by `MODEL_FALLBACK_MAX_ATTEMPTS`. There are no parallel requests and no infinite loops.
4. **Model-level errors** (`model_unavailable`, timeout, network, bad response) are NOT provider exhaustion — they propagate so the client's `withModelFallback` can try another model ID within the same provider.

Model IDs may collide between providers (e.g. `openai/gpt-4o` on both). The router resolves ownership deterministically — OpenRouter first. `/api/models` deduplicates by ID (OpenRouter preferred).

## Error normalization

`api/_lib/providers/errors.mjs` defines `AiError` (extends `HttpError`) with a `category` and the normalized codes below. Existing frontend codes are preserved unchanged.

| Code | Category | Meaning |
|---|---|---|
| `model_unavailable` | model | Transient model/provider failure — client may fall back to another model |
| `quota_exhausted` | provider | Provider quota used up (EdenAI 429 with quota hint) |
| `free_quota_exceeded` | provider | OpenRouter daily free quota (`free-models-per-day`) |
| `rate_limited` | provider | Too many requests (transient) |
| `timeout` / `network_error` | provider | Request timed out / network failure |
| `authentication_failed` | provider | Auth error |
| `key_invalid` | provider | Bad API key |
| `insufficient_credits` | provider | No credits left (402) |
| `limit_reached` | provider | Monthly request backstop hit |
| `models_unavailable` | provider | Catalogue unreachable |
| `model_invalid` / `model_not_free` | client | Bad / not-eligible model ID |
| `bad_request` | client | Validation failure |
| `bad_ai_response` | model | AI returned unparsable content |

Provider-exhaustion codes that trigger server-side provider fallback: `free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`.

## Configuration

All values are environment variables with safe defaults (see `docs/DEPLOYMENT.md` and `.env.example`). No secrets are ever exposed to the browser.

| Env var | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | OpenRouter key (production) |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Preferred OpenRouter model |
| `OPENROUTER_ENABLED` | `true` | Enable/disable the OpenRouter provider |
| `EDENAI_API_KEY` | — | EdenAI production key |
| `EDENAI_DEV_API_KEY` | — | EdenAI sandbox token (dev, simulated responses, no cost) |
| `EDENAI_ENV` | — | Override mode: `production` uses `EDENAI_API_KEY`, anything else prefers `EDENAI_DEV_API_KEY`. Without it, `VERCEL_ENV === "production"` decides. |
| `EDENAI_MODEL` | `cloudflare/@cf/google/gemma-7b-it-lora` | Preferred EdenAI model |
| `EDENAI_ENABLED` | `true` | Enable/disable the EdenAI provider |
| `OPENROUTER_MONTHLY_MAX_REQUESTS` | `1000` | OpenRouter request-count backstop |
| `EDENAI_MONTHLY_MAX_REQUESTS` | `200` | EdenAI request-count backstop |
| `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` | `0.80` | Advisory operator threshold |
| `EDENAI_MONTHLY_SOFT_LIMIT_USD` | `1.00` | Advisory operator threshold |
| `MODEL_FALLBACK_MAX_ATTEMPTS` | `3` | Client model-fallback cap (also bounds provider fallback) |

### Key selection (EdenAI)

```
if EDENAI_ENV == "production":                     → EDENAI_API_KEY (production token)
else if VERCEL_ENV == "production":                → EDENAI_API_KEY
else (dev / preview / local):                      → EDENAI_DEV_API_KEY preferred, else EDENAI_API_KEY
```

Sandbox tokens return simulated/mock responses at no cost through the same endpoints (there is no separate sandbox host). A missing key simply disables that provider; it never blocks the other provider.

## Usage & cost guards

- Per-provider monthly counters live in Upstash Redis: OpenRouter keeps its original keys (`mj-usage:openrouter:*`), EdenAI uses `mj-usage:ai:edenai:*`.
- Before a call, the provider's `limitReached()` checks the request-count backstop → `503 limit_reached` without calling the provider. The router then tries the next enabled provider; only when all are exhausted does the request fail.
- `GET /api/usage` exposes per-provider counters and configured limits (token-protected, no secrets in the response).
- Soft USD limits are advisory only — provider dashboards are authoritative for billing.

## Adding another provider

1. Add `api/_lib/providers/<name>.mjs` implementing the provider interface (catalogue `getModels()`, `ownsModel`, `getEligibleModel`, `getDefaultModel`, `chat`, `limitReached`, counters, error normalization to `ERROR_CODES`).
2. Register it in the `PROVIDERS` array in `api/_lib/providers/index.mjs` (order = fallback priority).
3. Add its config flags/limits to `api/_lib/config.mjs` and document them in `.env.example`, `docs/AI_PROVIDERS.md` and `docs/ARCHITECTURE.md`.
4. Add tests in `tests/api/<name>-provider.test.mjs` following `tests/api/edenai-provider.test.mjs`.
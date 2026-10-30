# AVCU AI provider gateway

## What is covered

The member-facing Ask and Member Advisor surfaces call `/.netlify/functions/ask` through `src/lib/privateLlm.js`. That endpoint now supports a server-side provider chain:

1. OpenRouter
2. Groq
3. Google Gemini
4. Anthropic Claude
5. Base44 Core `InvokeLLM`
6. Optional OpenAI-compatible private endpoint

Set `AI_PROVIDER_ORDER` to change the order. Unconfigured providers are skipped through a controlled failure and the next provider is attempted. The endpoint returns only the answer and provider label; provider keys never reach the browser. Gemini credentials are sent in the API-key header rather than the request URL to reduce exposure in URL logs.

## Usage controls

The gateway requires Upstash Redis REST credentials and fails closed if the usage store is unavailable. An atomic Lua reservation applies:
- Per-user monthly request allowance (default 30 for free members).
- Per-user burst limit (default 5 requests per minute).
- Higher monthly allowance (default 300) for user IDs explicitly listed in the server-only `AI_SUBSCRIBER_USER_IDS` environment variable.
- A global daily reserved-spend ceiling, using a conservative fixed reservation per request.
- A maximum output-token limit per request.

The allowlist is a temporary entitlement source, not an automatic subscription integration. Do not populate it from client input. Replace it with a verified billing/subscription webhook and server-owned entitlement record before scaling paid plans. Unknown users remain on the free allowance.

The spend ceiling is a reservation-based guard, not provider-invoice reconciliation. Set `AI_MAX_REQUEST_COST_CENTS` conservatively for the most expensive model allowed in `AI_PROVIDER_ORDER`; review provider usage and invoices separately. Failed provider attempts consume the reservation by design to prevent repeated retries from bypassing controls.

## Required server environment

Configure these in Netlify site environment variables (never in `VITE_*` variables):
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `AI_PER_MINUTE_REQUESTS` (default 5)
- One or more of `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- Optional `AI_PROVIDER_ORDER`, model overrides, allowance and spend limits
- `AI_SUBSCRIBER_USER_IDS` only after confirming subscription entitlement out-of-band

Base44 `InvokeLLM` remains in the chain when the authenticated Base44 SDK exposes the Core integration. The old private endpoint remains optional as a final compatibility provider.

## Audit findings and remaining scope

- `src/lib/privateLlm.js` previously called one private endpoint only; it did not implement provider fallback or user allowances.
- `netlify/functions/ask.mjs` previously required one `PRIVATE_LLM_URL` and had no durable per-user usage accounting.
- The User schema does not define a subscription entitlement field. There is no verified subscription webhook/entitlement source in this recovery branch; the server-side ID allowlist is intentionally conservative.
- `VantorisAssistant.jsx` and `AgentChat.jsx` use Base44 Agents directly. `base44/functions/oracleRuntime/entry.ts` invokes the Oracle runtime, whose Spark layer calls `services.model.invoke`. These are separate execution paths and are not yet governed by the Netlify Ask gateway's quotas/fallback chain. Do not claim the whole application is on one AI gateway until those agent/runtime paths are migrated or centrally gated.
- The Oracle runtime dependency audit found `bootLoader.ts` and `nexus.ts` missing from `base44/shared/runtime/`. `logger.ts` and `eventBus.ts` have now been restored on the recovery branch. The event bus is process-local telemetry only, not a durable queue. The Oracle runtime remains non-deployable until boot orchestration, Nexus, capability resolution, and the referenced platform service adapters are implemented and validated. The frontend recovery build does not compile or deploy Base44 functions.
- The Oracle runtime previously accepted browser-supplied capabilities and priority. The entry point now fixes member capabilities to `reasoning` and priority to `normal`, validates message type/length, restricts health diagnostics to administrative roles, removes the missing logger dependency from the function entry, and returns a generic client error instead of leaking internal exception messages. Runtime modules now have structured logging and a bounded process-local event bus, but these modules have not yet been validated in the Base44 Deno runtime.
- The Guardian policy registry previously granted every authenticated user wildcard `*` capability access. The default policy is now limited to `reasoning` and `knowledge`; privileged capabilities must be explicitly registered. This policy change still requires runtime-level tests after the missing runtime dependencies are restored.
- No provider credentials are included in this repository. The gateway cannot make real external calls until secrets and Upstash are configured in the deployment environment.
- No live provider billing, rate limits, invoice reconciliation, or production behavior is certified by a source build.

## Safety

AVCU Intelligence is informational and read-only. It must not execute transfers, payment rails, card actions, KYC decisions, account mutations, or settlement. Those workflows remain behind their existing authorized backend controls.

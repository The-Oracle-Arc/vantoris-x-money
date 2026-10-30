# AVCU unified assistant runtime and AI gateway

## Request path

All browser assistant surfaces use the authenticated Base44 `oracleRuntime` function through `src/lib/oracleAssistant.js`:
- Member Advisor (`MemberAdvisorChat`) uses the compatibility wrapper in `src/lib/privateLlm.js`, which delegates to Oracle.
- Admin Agent Chat (`AgentChat`) uses Oracle directly.
- Vantoris Assistant (`VantorisAssistant`) uses Oracle directly.

The Oracle runtime applies Guardian policy checks, Nexus specialist routing, persisted conversation history, Spark reasoning, and Orbit's deferred-work interface. Spark's only model adapter is the server-side gateway configured by `AVCU_AI_GATEWAY_URL` or `AVCU_APP_URL`. The adapter rejects non-HTTPS endpoints and forwards the authenticated member bearer token for gateway-side session verification. No browser component calls Base44 Agents or the Netlify Ask endpoint directly.

The Netlify Ask function is the provider gateway and supports this server-side fallback chain:
1. OpenRouter
2. Groq
3. Google Gemini
4. Anthropic Claude
5. Base44 Core `InvokeLLM`
6. Optional OpenAI-compatible private endpoint

Set `AI_PROVIDER_ORDER` to change the order. Provider credentials remain server-only. The old standalone local private-model proxy (`server/llm-proxy.mjs`), its package scripts, and its Vite proxy route have been removed so local development does not create a second AI execution path.

## Conversation and memory continuity

`AIConversation` and `AIMessage` store member-scoped conversation threads and messages. The authenticated history action returns only the current member's thread. Nexus loads recent messages before Spark generates a reply and passes the saved context into the prompt. The conversation schema also includes `memory_summary` and `preferences` fields, which Nexus can read when populated.

`memory_summary` is now updated after each response with a bounded rolling record of the member's recent messages (maximum 3,000 characters). This is continuity context, not semantic memory extraction: the system does not infer stable preferences or facts. Recent transcript messages are also supplied separately. The memory writer is best-effort so a memory-write failure does not block a member response.

## Specialist context

Nexus currently routes by message intent to fraud, compliance, payments, credit, investment, documents, banking, or general guidance. It appends the selected specialist's operating instructions to the shared assistant prompt. This is a first routing layer, not a multi-agent collaboration engine: specialist collaborators, authoritative policy retrieval, and domain-data adapters are not yet implemented.

Action-impacting categories receive structured recommendation output for staff review. The assistant remains read-only and must not initiate transfers, payments, card controls, account changes, KYC decisions, or settlement.

## Usage controls

The gateway requires Upstash Redis REST credentials and fails closed if the usage store is unavailable. An atomic Lua reservation applies:
- Per-user monthly request allowance (default 30 for free members).
- Per-user burst limit (default 5 requests per minute).
- Higher monthly allowance (default 300) for user IDs explicitly listed in server-only `AI_SUBSCRIBER_USER_IDS`.
- A global daily reserved-spend ceiling using a fixed reservation per request.
- A maximum output-token limit per request.

The ID allowlist is a temporary entitlement source, not automatic subscription verification. Replace it with a verified billing webhook and server-owned entitlement record before scaling paid plans. The spend ceiling is reservation-based, not provider-invoice reconciliation.

## Required server environment

Configure these in the Netlify function environment, never in `VITE_*` variables:
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `AVCU_AI_GATEWAY_URL` (HTTPS URL to `/.netlify/functions/ask`), or `AVCU_APP_URL` (HTTPS Netlify site origin)
- One or more of `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- Optional `AI_PROVIDER_ORDER`, provider model overrides, allowance and spend limits
- `AI_SUBSCRIBER_USER_IDS` only after entitlement has been verified out-of-band

No provider credentials are included in this repository. No real external provider call is verified until secrets and Upstash are configured in the relevant environment.

## Validation status and remaining blockers

- Frontend assistant entry points have been moved to the shared Oracle function.
- Direct Base44 Agents calls have been removed from the two chat components that previously used them.
- The standalone local private-model proxy and its Vite/package entry points have been removed.
- Nexus tests now cover specialist routing, specialist prompt injection, saved conversation context, and capability filtering. CI also runs `deno check` against the Oracle entry point.
- The health endpoint reports gateway and conversation-store wiring as `configured_unverified` / `wired_unverified`; configuration is not proof of reachability or database health.
- Base44 deployment/runtime execution, live provider credentials, Redis enforcement, live Base44 RLS enforcement, browser end-to-end behavior, and provider fallback under real failures remain unverified.
- Subscription entitlements still use a temporary server-side ID allowlist. Provider spend reservation is not invoice reconciliation.
- The event bus is process-local telemetry, not a durable queue. Metrics are structured logs, not durable metrics storage.

Keep the pull request in draft. Do not merge or deploy to production until the runtime tests pass and the external environment, RLS, browser, provider, and financial safety checks are completed.

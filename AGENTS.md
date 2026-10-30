# VANTORIS X MONEY — AI Agent Operating Mandate

## Authority and scope

AI coding agents working in this repository are authorized to inspect, edit, refactor, replace, create, and remove application code across the full repository when needed to complete an assigned task. Scope is not limited to one page or component.

This authority includes:
- React pages, layouts, routing, navigation, responsive UI, design system, accessibility, and visual polish.
- Shared components, hooks, state management, API clients, schemas, data models, and validation.
- Authentication, authorization, role separation, session handling, and audit logging.
- Netlify Functions, server code, provider adapters, AI gateways, background jobs, and integration contracts.
- Tests, lint/type/build configuration, CI workflows, deployment configuration, documentation, and developer tooling.
- Fixing root causes and connected regressions rather than hiding errors with mock data or canned success responses.

Agents should work autonomously through the complete engineering loop: inspect → plan → implement → run relevant checks → inspect failures → fix → rerun checks → summarize evidence and remaining blockers. Do not stop after merely recommending code changes when repository write tools are available.

## Working rules

1. Inspect existing architecture and callers before changing shared contracts.
2. Make changes directly on the assigned feature/recovery branch; keep work reviewable and do not force-push or rewrite protected branch history.
3. Prefer complete, maintainable implementations over placeholders, silent fallbacks, and duplicated logic.
4. Never claim a feature, test, integration, browser flow, deployment, or provider is working unless there is current evidence.
5. Do not fabricate account balances, payment confirmations, flight quotes, market data, identity verification, or other live results.
6. Keep secrets, provider keys, access tokens, and private member data out of source code, logs, client bundles, and test fixtures.
7. Agents may implement financial/identity workflows and their security controls, but must not bypass authorization, ledger integrity, idempotency, reconciliation, audit trails, or provider verification to make a demo appear functional.
8. Real-money movements, account issuance, KYC decisions, role elevation, permanent customer-data deletion, secret rotation, production migrations, and production deployments require a properly authorized server-side workflow and the required human/provider approval. Do not simulate these actions or disable controls to make a test pass.
9. Use synthetic fixtures only in isolated tests and label them clearly. Never mix mock records with production data.
10. When credentials, permissions, provider contracts, or external approval are missing, finish all safe code work, fail closed at the boundary, and report the exact blocker plus the required configuration. Do not invent credentials or pretend the integration is live.
11. Update tests and documentation when behavior changes. Keep the pull request focused enough to review, but do not leave necessary dependent fixes unfinished.
12. If a check cannot be run in the available environment, state that clearly and provide the exact unverified items.

## Completion report

For each substantial task, report:
- Files and behaviors changed.
- Build, lint, typecheck, unit, integration, and browser checks actually run, with results.
- Security or compatibility considerations.
- External credentials/provider configuration still required.
- Any remaining risks or unverified claims.

## Product context

VANTORIS X MONEY is a premium financial-services experience. The member experience and operations workspace must remain distinct. AI agents should improve the platform broadly while preserving privacy, financial correctness, accessibility, reliability, and an honest distinction between implemented UI and live provider functionality.

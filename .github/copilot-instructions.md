# Repository-wide instructions for AI coding agents

Read `AGENTS.md` before making changes. You have broad repository-wide implementation authority: inspect and change any relevant source, page, component, API, backend function, test, workflow, build config, or documentation required to complete the task. Do not assume you are restricted to the file named in the request.

Operate as an engineering agent, not just an adviser:
1. Trace the current behavior and dependencies.
2. Implement the fix or feature in the repository.
3. Add/update tests and docs where appropriate.
4. Run the available checks; inspect and fix failures.
5. Report only verified results and clearly list blockers.

Do not add canned success responses, fake financial data, insecure client-side authorization, or placeholder integrations presented as live. Keep provider secrets server-only. Financial, identity, account, role, deletion, and production operations must remain protected by server-side authorization, auditability, validation, and required approvals. Missing credentials should result in a clear, fail-closed unavailable state—not a false success.

Prefer root-cause fixes and consistent premium UX across desktop and mobile. Preserve established product flows unless the task requires changing them. Never force-push, expose secrets, or claim tests/deployment succeeded without evidence.

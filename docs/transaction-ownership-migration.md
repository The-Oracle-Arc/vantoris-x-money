# Transaction ownership migration runbook

## Status

**Prepared, not executed.** The configured Base44 app ID in the recovery CI workflow (6a3d85c1632966fefe16f3d4) was not accessible to the connected Base44 account during this audit, and it does not appear in the list of apps owned by that account. Do not run a data write until the correct app/workspace access is confirmed.

## Why this migration may be required

The Transaction entity read policy is keyed to data.user_id == {{user.id}} (with explicit operator-role exceptions), while older transaction records may have only account_id. The Account entity includes user_id. A legacy transaction with no user_id may therefore become invisible to its member after the policy is deployed, even when its account is correctly owned.

## Required preflight

1. Confirm the target Base44 app ID and environment with the app owner; do not use a similarly named app.
2. Export or query Account and Transaction records with stable record IDs, Account.id, Account.user_id, Transaction.id, Transaction.account_id, Transaction.user_id, amount, type, reference, transaction_date, posting_date, source, and imported_statement_id. Store exports in an access-controlled location; do not commit personal or financial data to Git.
3. Take a recoverable, encrypted backup and record row counts, total amounts grouped by currency/type/status, and a checksum before any write.
4. Build an ownership map from Account.id to Account.user_id. Do not infer ownership from email, description, reference, account number, or client-supplied values.
5. Classify each transaction:
   - **Safe candidate:** account_id resolves to exactly one account with a non-empty user_id, and transaction user_id is blank or already equals that account owner.
   - **Conflict:** transaction user_id differs from account owner.
   - **Orphan:** account_id is missing or resolves to no account.
   - **Ambiguous:** the account mapping is not unique or the account owner is blank.
6. Produce a dry-run report with total records and counts by classification. Do not modify conflicts, orphans, or ambiguous rows automatically. Resolve them through an audited operator review.
7. Verify that the chosen Base44 API supports the intended privileged update path and that row-level policies do not block it. Run only with a dedicated, authorized server-side/admin migration identity; never bypass access controls with a member token.

## Backfill procedure

For safe candidates only, set Transaction.user_id to the authoritative Account.user_id, in small batches, using conditional updates that only match rows whose user_id is absent/empty. Make the migration idempotent: rerunning it must not change rows already correct. Log only record IDs, classification, timestamps, counts, and outcome; do not log transaction descriptions, account numbers, tokens, or full records.

Do not change balances, amounts, transaction dates, posting dates, references, status, or ledger order. This is an ownership metadata backfill, not a financial ledger rewrite. Do not create replacement transactions.

## Post-migration verification

1. Re-query counts and prove every migrated transaction user_id matches the owner of its linked account.
2. Confirm zero unresolved conflicts were silently changed; report remaining orphan/ambiguous records separately.
3. Compare transaction counts and amount totals by account, type, status, and source before/after; they must remain unchanged.
4. Test access with two separate member identities: each member can read only their own records; cross-member reads are denied; unauthorized create/update/delete are denied.
5. Test each intended operator role explicitly. A role must only have access justified by the approved policy.
6. Verify account-detail, statements, historical imports, and member transaction history in a preview/staging environment before release.
7. Keep the backup and migration report until the owner signs off. No production deployment or merge is implied by this runbook.

## Current blocker

Live policy enforcement and data inventory remain unverified because the connected Base44 account cannot access the configured app. No transaction records were queried or changed as part of preparing this runbook.

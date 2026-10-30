# AVCU transactional payment store — implementation gate

## Why this migration exists

The current Base44 payment workflow uses application-level duplicate lookups and conditional entity updates. Those are useful defensive checks, but the documented Base44 entity interface does not provide the database-level unique constraints and multi-record SQL transactions needed to guarantee payment idempotency and balanced double-entry posting under concurrent requests.

This migration establishes a PostgreSQL foundation for:
- unique payment-operation idempotency keys;
- unique provider event identity by provider, environment and event ID;
- unique bank receipt references and receipt idempotency keys;
- append-only, balanced double-entry journals using positive debit cents and negative credit cents;\n- append-only payment audit records with update/delete/truncate denied to the runtime role;
- expiring worker leases with monotonically increasing fencing tokens;\n- atomic outgoing funds holds serialized on the member ledger account, with capture on settlement and release on provider failure/cancellation.

## Critical: code is wired, infrastructure is not activated

The server-side adapter is wired into outgoing transfer idempotency, Plaid event-page ingestion, provider-event settlement/reversal processing, incoming receipt idempotency and independent receipt verification/posting. It also uses a retryable outbox to project committed payment state into Base44. This is code-level integration only: no PostgreSQL instance is provisioned or connected in this environment, the migration has not been applied, ledger accounts are not mapped, and the database integration tests have not been run. Do not treat these paths as live until the infrastructure and release gates below pass.

## Deployment requirements

1. Provision a dedicated managed PostgreSQL database in an AVCU-approved environment.
2. Store its connection string only as a server-side secret, e.g. `AVCU_LEDGER_DATABASE_URL`. Never expose it through a `VITE_` variable or browser code. Use a separate disposable `AVCU_LEDGER_TEST_DATABASE_URL` for integration tests; it must point to a dedicated test database with a migration-owner/test-fixture role because the suite seeds ledger-account fixtures and creates append-only test journals. Never point it at production.
3. Configure `AVCU_ACH_CLEARING_LEDGER_ACCOUNT_ID` and `AVCU_FEDWIRE_CLEARING_LEDGER_ACCOUNT_ID` only after Finance and the sponsor bank approve and provision the corresponding clearing accounts. These IDs are required for settlement journal posting.
4. Apply `migrations/001_avcu_payment_control_plane.sql` through a reviewed migration process.
5. Create a dedicated non-superuser login role named avcu_backend through the DBA-approved secret process (NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT). Set its password through the managed secret manager, not in source control. Apply migrations/002_avcu_backend_grants.sql to grant only the adapter's required table/function permissions. Do not grant database access to member/browser clients.
8. Use the server-side adapter at `base44/functions/_shared/paymentStore.ts`; it claims outgoing transfer idempotency in PostgreSQL before creating the Base44 request projection, persists Plaid event pages and cursors in one transaction, commits provider settlement/reversal journals, and verifies/posts/returns incoming receipts through transactional journals with a retryable Base44 projection outbox. Keep each payment operation, idempotency claim, provider-event claim and ledger journal in one SQL transaction.
9. Require `assert_lease` and the current fencing token before committing work performed by a leased worker. A stale worker must fail after a new owner acquires the lease.
10. Build a reversal as a new journal with entries exactly opposite the original journal, in the same transaction; never edit or delete posted entries.
11. Add tests for concurrent duplicate keys, duplicate bank references, stale lease takeover, stale-owner fencing, unbalanced journals, duplicate journals, exact reversals, process crashes and retry after ambiguous provider timeouts.
12. Only after the adapter and tests pass may payment paths be switched from Base44-only persistence to this transactional authority.

## Outgoing-payment funds reservation — code implemented, infrastructure/test gate remains

The recovery branch now includes `migrations/003_avcu_outgoing_funds_holds.sql` and server-side integration in `paymentStore.ts` and `createTransferRequest`. The reservation function locks the mapped member-deposit ledger account, calculates posted available balance from the double-entry ledger, subtracts active holds, and inserts a unique hold tied to the idempotent payment operation. It rejects insufficient funds. Bank submission now requires an active hold matching the transfer amount. Verified settlement captures the hold in the same transaction as the settlement journal; provider failure/cancellation releases it. A settlement event without a matching active hold is held for investigation.

This is not yet a verified balance system: the migration is not applied, the PostgreSQL database is not provisioned/configured, the member ledger account mappings and opening balances are not reconciled, and the real database concurrency tests have not run. Existing legacy transfer projections without holds will be blocked from automated submission and settlement until operations reconciles them. Do not enable real-money transfers yet.

## Manual bank workflow limitation

Manual bank submission recording now requires an active matching funds hold. Manual settlement, return and failure actions are intentionally blocked until they can commit the corresponding ledger journal/hold transition in PostgreSQL. This prevents a Base44-only status change from falsely representing a settled or returned financial event. Do not bypass this guard by editing the entity directly.

## Data mapping still required

- Map each verified AVCU account to one `ledger_accounts.external_account_ref` using an approved immutable account identifier.
- Provision and reconcile the bank-clearing ledger accounts for ACH and Fedwire.
- Confirm account-normal-balance conventions and the positive-debit/negative-credit mapping with AVCU finance, sponsor bank and auditors before enabling any posting.
- Define which provider events are authoritative for submitted, settled, returned and cancelled states.

## Release status

**Blocked / not production-connected.** Code paths now use the PostgreSQL adapter, but the migration has not been applied, no database connection is configured, integration tests have not run, and account/clearing mappings are not provisioned. Real-money transfers must remain disabled until all gates above and sponsor-bank/Plaid approvals are complete.

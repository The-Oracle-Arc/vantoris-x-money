# AVCU transactional payment store — implementation gate

## Why this migration exists

The current Base44 payment workflow uses application-level duplicate lookups and conditional entity updates. Those are useful defensive checks, but the documented Base44 entity interface does not provide the database-level unique constraints and multi-record SQL transactions needed to guarantee payment idempotency and balanced double-entry posting under concurrent requests.

This migration establishes a PostgreSQL foundation for:
- unique payment-operation idempotency keys;
- unique provider event identity by provider, environment and event ID;
- unique bank receipt references and receipt idempotency keys;
- append-only, balanced double-entry journals;
- expiring worker leases with monotonically increasing fencing tokens.

## Critical: not yet connected to live payment paths

This is a schema foundation only. It does not make Plaid production-ready, create a sponsor-bank relationship, tokenize beneficiaries, move funds, or activate ledger posting. The application currently continues to use Base44 entities. Do not represent the PostgreSQL tables as active until the database is provisioned, the migration is applied, the backend adapter is implemented, and integration tests pass.

## Deployment requirements

1. Provision a dedicated managed PostgreSQL database in an AVCU-approved environment.
2. Store its connection string only as a server-side secret, e.g. `AVCU_LEDGER_DATABASE_URL`. Never expose it through a `VITE_` variable or browser code.
3. Apply `migrations/001_avcu_payment_control_plane.sql` through a reviewed migration process.
4. Create a least-privilege backend role. Do not grant database access to member/browser clients.
5. Add a server-side adapter that runs each payment operation, idempotency claim, provider-event claim and ledger journal in a single SQL transaction.
6. Require `assert_lease` and the current fencing token before committing work performed by a leased worker. A stale worker must fail after a new owner acquires the lease.
7. Build a reversal as a new journal with entries exactly opposite the original journal, in the same transaction; never edit or delete posted entries.
8. Add tests for concurrent duplicate keys, duplicate bank references, stale lease takeover, stale-owner fencing, unbalanced journals, duplicate journals, exact reversals, process crashes and retry after ambiguous provider timeouts.
9. Only after the adapter and tests pass may payment paths be switched from Base44-only persistence to this transactional authority.

## Data mapping still required

- Map each verified AVCU account to one `ledger_accounts.external_account_ref` using an approved immutable account identifier.
- Provision and reconcile the bank-clearing ledger accounts for ACH and Fedwire.
- Confirm accounting treatment with AVCU finance, sponsor bank and auditors before enabling any posting.
- Define which provider events are authoritative for submitted, settled, returned and cancelled states.

## Release status

**Blocked / not production-connected.** The SQL migration has not been applied to a database, and no runtime payment code uses it yet. Existing Base44 duplicate pre-checks remain non-atomic. Real-money transfers must remain disabled until all gates above and sponsor-bank/Plaid approvals are complete.

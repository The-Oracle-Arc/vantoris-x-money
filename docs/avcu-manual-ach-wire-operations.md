# AVCU Manual ACH and Domestic Wire Operations

## Purpose

This document defines the first manual-processing release for America Vanguard Credit Union (AVCU). It is an operations workflow, not a claim that AVCU is a licensed credit union, holds deposits, or has a live payment rail. The legal entity, sponsor-bank relationship, and authority to originate ACH/Fedwire must be verified before any live payment is accepted.

## Supported request types

- Incoming ACH: record an expected or reported incoming ACH credit; reconcile it against bank-originated evidence.
- Incoming domestic Fedwire: provide sponsor-bank-approved receiving instructions; record and reconcile the actual incoming wire.
- Outgoing ACH: accept a member request, place it in review, and have an authorized bank operator originate it through the sponsor bank's approved portal.
- Outgoing domestic Fedwire: accept a member request, perform enhanced review and dual authorization, then have an authorized bank operator originate it through the sponsor bank's approved portal.

ACH and Fedwire are separate rails. Do not label an ACH request as a wire or promise same-day settlement.

## Member request lifecycle

1. Draft: member enters amount, recipient/beneficiary details, payment purpose, requested date, and rail.
2. Submitted: member explicitly confirms the details; immutable request ID and idempotency key are assigned.
3. Under review: request is visible to authorized operations staff only.
4. Needs information / rejected: staff records a reason; no funds move.
5. Approved for bank processing: approval is recorded, but this is NOT a completed payment.
6. Submitted to bank: an authorized operator records the sponsor bank's confirmation/reference after submitting through the bank's own approved channel.
7. Settled / returned / failed: update only from reliable sponsor-bank evidence or reconciliation.
8. Reconciled: ledger and bank statement/payment confirmation match.

Never infer settlement from an operator clicking Approve, from a member screenshot, or from an internally generated receipt.

## Controls

- Enforce server-side authentication, role checks, account ownership, available-funds checks, limits, and approval policy.
- Require dual control for outgoing wires: requester/reviewer and a distinct final approver or bank operator.
- Store recipient and bank details with least-privilege access; mask them in general-purpose UI and logs.
- Keep provider credentials and bank portal credentials out of the browser, source control, logs, and chat.
- Use immutable audit events for create, edit, review, approval, bank submission, status changes, and reconciliation.
- Enforce idempotency and duplicate detection before any bank submission.
- Never allow a client-side balance edit to represent a deposit, withdrawal, ACH, or wire.
- Member-facing statuses must distinguish Pending review, Approved for processing, Submitted to bank, Settled, Returned, and Rejected.
- Receipts must be clearly marked as request acknowledgements until bank confirmation exists.

## Manual operations evidence

For each bank submission, record the operator identity, timestamp, rail, amount, beneficiary, sponsor-bank reference, bank status/evidence location, and reconciliation result. Do not store online banking passwords, full card data, or unnecessary sensitive data.

## Release gates

Live processing stays disabled until all of the following are documented and tested:

1. Verified legal applicant and authorized sponsor-bank/program relationship.
2. Written bank approval for the applicable ACH and domestic Fedwire origination/receiving flows.
3. Approved operating procedures, limits, sanctions/fraud screening, returns/reversals handling, and customer disclosures.
4. Server-side ledger and role-based controls tested with member, operator, and administrator accounts.
5. Dual approval, idempotency, audit trail, reconciliation, and exception handling tested.
6. Member and operator end-to-end tests completed against bank-approved test procedures.
7. Security review and production change approval completed.

Until then, disable member-facing ACH and wire submission entirely. Do not expose sandbox/demo payment flows as substitutes for production. Do not debit balances, claim that funds were sent, or generate bank-looking confirmation numbers.


## Production provider decision and release gates (2026-10-30)

Plaid Transfer is the selected primary provider candidate for ACH and domestic wire, but the account is not confirmed as approved for Plaid Transfer Production or the early-availability wire network. Do not enable submission until Plaid approves the AVCU business/use case and the implementation checklist is complete.

Plaid-specific requirements:
- Complete the Production Request, Transfer Application/Questionnaire, and Transfer Document Collection. Plaid asks for business/use-case details, ACH processing history and projections, entity/individual verification, and control-person identity details where applicable.
- Plaid Transfer is a Custom-plan product with a 12-month minimum contract. Plaid must approve the use case; Transfer for Platforms remains beta.
- Wire is early availability. Request wire network access from the Plaid account manager. Plaid wire transfers are credit-only, have a documented $999,999.99 limit, and a 6:30 PM Eastern business-day cutoff.
- ACH requires the correct approved SEC code and account linking. A valid Plaid authorization must be created before a transfer. Do not skip the authorization/risk decision.
- Wire recipients require the Plaid account-migration flow and a wire routing number. The current member form's routing number plus account last four is not sufficient to initiate a Plaid wire.
- Plaid webhook authenticity uses the `Plaid-Verification` ES256 JWT, Plaid's webhook verification key endpoint, a five-minute age check, and the signed raw-body SHA-256. Do not substitute a generic HMAC header.
- Plaid's Transfer webhook is only a notification (`TRANSFER_EVENTS_UPDATE`). Fetch event details from `/transfer/event/sync`, persist the event cursor, and handle duplicates/out-of-order events. A notification alone must never change a transfer status.
- Preserve provider transfer IDs separately from bank-generated references. Only store a bank reference when the provider/bank actually supplies one.

Current code status (manual workflow update):
- Member intake creates an authenticated ACH/Fedwire request and does not debit an account.
- Staff review/rejection and a separate second wire approver are implemented as server-side state transitions. Wire reviewer and approver IDs must differ.
- The new `recordManualTransferEvent` server function lets an authorized operator record a bank submission performed separately in the sponsor bank's approved portal. It requires the bank-generated reference and a secure evidence locator; it does not send money.
- A second authorized finance/treasury/compliance/admin user can independently reconcile a manually submitted item as settled, returned, or failed. The verifier must differ from the submitting operator. Evidence locators, staff IDs, timestamps, references, and notes are recorded in the protected transfer record and audit log.
- The Transfers operations screen now exposes manual submission and reconciliation actions for eligible statuses. The UI prompts staff for the bank reference and secure evidence location; it must never accept bank portal passwords or raw credentials.
- ACH and Fedwire automated adapter contracts remain deliberately unconfigured/fail-closed. Automated submission also requires an approved state and provider-issued beneficiary account token.
- Plaid webhook signature verification and notification intake are implemented, but event-sync cursor and provider-specific event reconciliation still require completion and CI verification.
- No Plaid Production credentials, Transfer approval, wire enablement, sponsor-bank/core settlement connection, Plaid Link account tokenization, or real bank reference has been confirmed. Do not claim live money movement.
- Important remaining engineering gate: Base44 updates are currently read-then-update, not transactional compare-and-set. Before live bank submission or settlement, add race-safe conditional state transitions and persistence-level uniqueness for idempotency keys/provider events, then test role/RLS enforcement in the real backend.

Release gate: keep the submission adapter fail-closed and keep this PR in draft until Plaid approves AVCU, production credentials and the correct account-linking/beneficiary flows are configured, race-safe approval persistence is verified, webhook sync/reconciliation passes tests, and an authorized low-value live test is completed under the provider's approved limits.

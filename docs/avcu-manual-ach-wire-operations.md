# AVCU Manual ACH and Domestic Wire Operations

## Purpose

This document defines the first manual-processing release for Atchison Village Credit Union (AVCU). It is an operations workflow, not a claim that AVCU is a licensed credit union, holds deposits, or has a live payment rail. The legal entity, sponsor-bank relationship, and authority to originate ACH/Fedwire must be verified before any live payment is accepted.

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

Until then, the interface may collect clearly labeled non-binding test requests only; it must not debit balances, claim that funds were sent, or generate bank-looking confirmation numbers.

# AVCU ACH and Fedwire implementation audit

**Repository:** `iamtheoracle/vantoris-x-money`  
**Branch:** `recovery/merge-vantoris-live`  
**Audit scope:** frontend payment entry points, operations access boundary, withdrawal processing, and the manual ACH/Fedwire readiness page.  
**Audit posture:** static source review only. This is not a penetration test, bank certification, legal opinion, or verification of Base44 production row-level security.

## Current implementation state

- The operations readiness page is registered at `/operations/payment-rails` and is protected by the existing `OperationsRoute`.
- The member `MoveMoney` screen explicitly sets `SERVER_MONEY_OPERATIONS_ENABLED = false`. Its send and add-money handlers return before creating a transaction.
- The operations withdrawal screen explicitly sets `SERVER_OPERATIONS_MUTATIONS_ENABLED = false`. Its approve, reject, and bulk mutation handlers return before changing records or balances.
- The withdrawal screen reads `WithdrawalRequest`, `Account`, and `WithdrawalLimit` entities from the browser. It requests broad collections and applies search/filtering in the UI. UI filtering is not an authorization boundary.
- The withdrawal screen contains legacy `paid` terminology and a legacy mutation implementation that, if ever re-enabled without replacement, creates a transaction and updates an account balance directly from the client. Do not turn its feature flag on.
- The operations route checks roles in the frontend. That does not prove server-side entity permissions or row-level security.
- No verified ACH/Fedwire bank submission endpoint, bank reference workflow, settlement evidence model, or reconciliation service was found in the reviewed files.

## Findings and required remediation

| Priority | Finding | Required fix before live use |
|---|---|---|
| Critical | Client-side balance mutation exists in legacy withdrawal code behind a disabled flag. | Keep the flag disabled. Replace the entire mutation path with an authenticated server-side ledger/payment workflow and atomic database transaction. |
| Critical | Browser-side entity reads request broad account and withdrawal collections. | Verify and enforce Base44 entity permissions/RLS on the server; members must only access their own records and operators only records permitted by their role. |
| Critical | Frontend role checks do not enforce backend authorization. | Add server-side role checks to every read/write function; deny by default and test direct API calls as member, operator, and administrator. |
| Critical | No evidence of an approved sponsor-bank ACH/Fedwire execution and reconciliation integration. | Keep live rails disabled until written bank approval and the manual operating procedure are in place. |
| High | Legacy `paid` status can be mistaken for bank settlement. | Use distinct statuses: submitted, under review, approved for bank processing, submitted to bank, settled, returned, failed, reconciled. Only bank evidence may set settled/reconciled. |
| High | No verified idempotency or duplicate-submission protection in the reviewed manual rail workflow. | Enforce unique idempotency keys and duplicate checks server-side before a bank operator submits an instruction. |
| High | No immutable bank evidence/reconciliation record was found. | Store bank reference, rail, amount, beneficiary fingerprint, operator identity, timestamps, evidence pointer, and reconciliation outcome in a protected audit model. |
| High | Wire dual control is not implemented in the reviewed ACH/Fedwire page. | Require two distinct authorized identities for wire approval and record both decisions in immutable audit events. |
| Medium | The current operations page is informational only. | Do not add a member-facing submit action until persistent request storage, backend policy, privacy controls, and operator workflow are implemented. |

## Safe implementation sequence

1. Verify the legal applicant and sponsor-bank/program relationship; document approved ACH and Fedwire capabilities, limits, cutoffs, fees, returns, recalls, and member disclosures.
2. Inspect and export the live Base44 entity schemas and permissions. Confirm ownership and role rules in the backend, not only in React.
3. Create a dedicated payment-request data model with immutable event history. Do not reuse generic `Transaction` records as proof that a bank payment was sent.
4. Implement server functions for request creation, member ownership checks, risk/limit checks, review, dual approval, bank-reference recording, and reconciliation.
5. Enforce idempotency, duplicate detection, separation of duties, least-privilege access, and audit retention in the server layer.
6. Build member and operator screens against those server functions. Mask beneficiary data and never expose bank portal credentials.
7. Test with authorized test accounts and bank-approved procedures. Verify unauthorized direct API calls fail.
8. Enable live processing only after bank authorization, security review, reconciliation testing, and formal production approval.

## Explicit non-goals

- This change does not create a bank account, establish AVCU as a chartered credit union, or grant ACH/Fedwire access.
- It does not initiate, sign, debit, credit, or settle money.
- It does not create bank confirmation numbers or treat internal approvals as bank acceptance.
- It does not prove production Base44 RLS configuration; that requires inspection in the actual backend environment.

## Evidence reviewed

- `src/pages/MoveMoney.jsx`
- `src/pages/admin/AdminWithdrawals.jsx`
- `src/components/OperationsRoute.jsx`
- `src/lib/AuthContext.jsx`
- `src/api/base44Client.js`
- `src/pages/operations/PaymentRailOperations.jsx`
- `src/App.jsx`
